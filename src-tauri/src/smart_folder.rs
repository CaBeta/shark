use rusqlite::types::ToSql;

use crate::error::AppError;
use crate::models::{Condition, RuleGroup};

/// Fields that can be used in smart folder rules.
const ALLOWED_FIELDS: &[&str] = &[
    "file_name",
    "file_type",
    "file_size",
    "width",
    "height",
    "tags",
    "rating",
    "notes",
    "created_at",
    "modified_at",
];

/// Operators allowed per field type.
fn allowed_ops_for_field(field: &str) -> &[&str] {
    match field {
        "file_name" | "notes" => &["contains", "eq", "neq"],
        "file_type" => &["eq", "neq", "in", "not_in"],
        "tags" => &["contains", "eq", "neq"],
        "file_size" | "width" | "height" => &["eq", "gt", "gte", "lt", "lte", "between"],
        "rating" => &["eq", "gt", "gte", "lt", "lte"],
        "created_at" | "modified_at" => &["gte", "lte", "between"],
        _ => &[],
    }
}

fn validate_condition(cond: &Condition) -> Result<(), AppError> {
    if !ALLOWED_FIELDS.contains(&cond.field.as_str()) {
        return Err(AppError::Database(format!(
            "Invalid field: '{}'",
            cond.field
        )));
    }
    if !allowed_ops_for_field(&cond.field).contains(&cond.op.as_str()) {
        return Err(AppError::Database(format!(
            "Invalid operator '{}' for field '{}'",
            cond.op, cond.field
        )));
    }
    Ok(())
}

/// Convert a condition into a SQL fragment and parameter values.
fn condition_to_sql(
    cond: &Condition,
    param_offset: usize,
) -> Result<(String, Vec<Box<dyn ToSql>>), AppError> {
    validate_condition(cond)?;

    let field = &cond.field;
    let op = &cond.op;
    let mut params: Vec<Box<dyn ToSql>> = Vec::new();

    let sql = match op.as_str() {
        "contains" => {
            let val = cond
                .value
                .as_str()
                .ok_or_else(|| AppError::Database("contains expects a string".into()))?;
            if field == "tags" {
                params.push(Box::new(format!("%,{val},%")));
                let p1 = param_offset + 1;
                params.push(Box::new(format!("{val},%")));
                let p2 = param_offset + 2;
                params.push(Box::new(format!("%,{val}")));
                let p3 = param_offset + 3;
                format!(
                    "({field} LIKE ?{p1} OR {field} LIKE ?{p2} OR {field} LIKE ?{p3} OR {field} = ?{p4})",
                    p4 = param_offset + 4
                )
            } else {
                params.push(Box::new(format!("%{val}%")));
                format!("{field} LIKE ?{}", param_offset + 1)
            }
        }
        "eq" | "neq" => {
            let cmp = if op == "eq" { "=" } else { "!=" };
            let val = value_to_sql_param(&cond.value, field)?;
            params.push(val);
            format!("{field} {cmp} ?{}", param_offset + 1)
        }
        "gt" | "gte" | "lt" | "lte" => {
            let cmp = match op.as_str() {
                "gt" => ">",
                "gte" => ">=",
                "lt" => "<",
                "lte" => "<=",
                _ => unreachable!(),
            };
            let val = value_to_sql_param(&cond.value, field)?;
            params.push(val);
            format!("{field} {cmp} ?{}", param_offset + 1)
        }
        "in" | "not_in" => {
            let arr = cond
                .value
                .as_array()
                .ok_or_else(|| AppError::Database("in/not_in expects an array".into()))?;
            if arr.is_empty() {
                return Ok(("1=1".to_string(), Vec::new()));
            }
            let placeholders: Vec<String> = (0..arr.len())
                .map(|i| format!("?{}", param_offset + i + 1))
                .collect();
            for v in arr {
                params.push(value_to_sql_param(v, field)?);
            }
            let keyword = if op == "in" { "IN" } else { "NOT IN" };
            format!("{field} {keyword} ({})", placeholders.join(", "))
        }
        "between" => {
            let arr = cond
                .value
                .as_array()
                .ok_or_else(|| AppError::Database("between expects an array [min, max]".into()))?;
            if arr.len() != 2 {
                return Err(AppError::Database(
                    "between expects exactly 2 values".into(),
                ));
            }
            let min_val = value_to_sql_param(&arr[0], field)?;
            let max_val = value_to_sql_param(&arr[1], field)?;
            let p1 = param_offset + 1;
            let p2 = param_offset + 2;
            params.push(min_val);
            params.push(max_val);
            format!("{field} BETWEEN ?{p1} AND ?{p2}")
        }
        _ => return Err(AppError::Database(format!("Unknown operator: {op}"))),
    };

    Ok((sql, params))
}

fn value_to_sql_param(val: &serde_json::Value, field: &str) -> Result<Box<dyn ToSql>, AppError> {
    match val {
        serde_json::Value::String(s) => Ok(Box::new(s.clone())),
        serde_json::Value::Number(n) => {
            if n.is_i64() {
                Ok(Box::new(n.as_i64().unwrap()))
            } else {
                Ok(Box::new(n.as_f64().unwrap()))
            }
        }
        _ => Err(AppError::Database(format!(
            "Unsupported value type for field '{field}'"
        ))),
    }
}

/// Convert a RuleGroup into a SQL WHERE clause (without the WHERE keyword)
/// and a list of parameter values.
pub fn rules_to_sql(rules: &RuleGroup) -> Result<(String, Vec<Box<dyn ToSql>>), AppError> {
    if rules.conditions.is_empty() {
        return Ok(("1=1".to_string(), Vec::new()));
    }

    let mut fragments: Vec<String> = Vec::new();
    let mut all_params: Vec<Box<dyn ToSql>> = Vec::new();

    for cond in &rules.conditions {
        let offset = all_params.len();
        let (sql, params) = condition_to_sql(cond, offset)?;
        fragments.push(sql);
        all_params.extend(params);
    }

    let joiner = match rules.operator.as_str() {
        "OR" => " OR ",
        _ => " AND ",
    };

    let where_sql = if fragments.len() == 1 {
        fragments.into_iter().next().unwrap()
    } else {
        format!("({})", fragments.join(joiner))
    };

    Ok((where_sql, all_params))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_condition(field: &str, op: &str, value: serde_json::Value) -> Condition {
        Condition {
            field: field.to_string(),
            op: op.to_string(),
            value,
        }
    }

    #[test]
    fn test_single_eq_condition() {
        let rules = RuleGroup {
            operator: "AND".to_string(),
            conditions: vec![make_condition("rating", "gte", serde_json::json!(3))],
        };
        let (sql, params) = rules_to_sql(&rules).unwrap();
        assert!(sql.contains("rating >="));
        assert_eq!(params.len(), 1);
    }

    #[test]
    fn test_multiple_and_conditions() {
        let rules = RuleGroup {
            operator: "AND".to_string(),
            conditions: vec![
                make_condition("rating", "gte", serde_json::json!(3)),
                make_condition("file_type", "eq", serde_json::json!("JPG")),
            ],
        };
        let (sql, params) = rules_to_sql(&rules).unwrap();
        assert!(sql.starts_with('('));
        assert!(sql.contains("AND"));
        assert_eq!(params.len(), 2);
    }

    #[test]
    fn test_or_conditions() {
        let rules = RuleGroup {
            operator: "OR".to_string(),
            conditions: vec![
                make_condition("file_type", "eq", serde_json::json!("JPG")),
                make_condition("file_type", "eq", serde_json::json!("PNG")),
            ],
        };
        let (sql, _) = rules_to_sql(&rules).unwrap();
        assert!(sql.contains("OR"));
    }

    #[test]
    fn test_in_operator() {
        let rules = RuleGroup {
            operator: "AND".to_string(),
            conditions: vec![make_condition(
                "file_type",
                "in",
                serde_json::json!(["JPG", "PNG", "WEBP"]),
            )],
        };
        let (sql, params) = rules_to_sql(&rules).unwrap();
        assert!(sql.contains("IN"));
        assert!(sql.contains("?1, ?2, ?3"));
        assert_eq!(params.len(), 3);
    }

    #[test]
    fn test_between_operator() {
        let rules = RuleGroup {
            operator: "AND".to_string(),
            conditions: vec![make_condition(
                "file_size",
                "between",
                serde_json::json!([1000, 5000]),
            )],
        };
        let (sql, params) = rules_to_sql(&rules).unwrap();
        assert!(sql.contains("BETWEEN"));
        assert_eq!(params.len(), 2);
    }

    #[test]
    fn test_contains_text() {
        let rules = RuleGroup {
            operator: "AND".to_string(),
            conditions: vec![make_condition(
                "file_name",
                "contains",
                serde_json::json!("sunset"),
            )],
        };
        let (sql, params) = rules_to_sql(&rules).unwrap();
        assert!(sql.contains("LIKE"));
        assert_eq!(params.len(), 1);
    }

    #[test]
    fn test_empty_conditions() {
        let rules = RuleGroup {
            operator: "AND".to_string(),
            conditions: vec![],
        };
        let (sql, params) = rules_to_sql(&rules).unwrap();
        assert_eq!(sql, "1=1");
        assert!(params.is_empty());
    }

    #[test]
    fn test_empty_in_array() {
        let rules = RuleGroup {
            operator: "AND".to_string(),
            conditions: vec![make_condition("file_type", "in", serde_json::json!([]))],
        };
        let (sql, params) = rules_to_sql(&rules).unwrap();
        assert_eq!(sql, "1=1");
        assert!(params.is_empty());
    }

    #[test]
    fn test_invalid_field_rejected() {
        let rules = RuleGroup {
            operator: "AND".to_string(),
            conditions: vec![make_condition(
                "evil_field",
                "eq",
                serde_json::json!("hax"),
            )],
        };
        assert!(rules_to_sql(&rules).is_err());
    }

    #[test]
    fn test_invalid_op_rejected() {
        let rules = RuleGroup {
            operator: "AND".to_string(),
            conditions: vec![make_condition("rating", "contains", serde_json::json!("x"))],
        };
        assert!(rules_to_sql(&rules).is_err());
    }

    #[test]
    fn test_not_in_operator() {
        let rules = RuleGroup {
            operator: "AND".to_string(),
            conditions: vec![make_condition(
                "file_type",
                "not_in",
                serde_json::json!(["GIF", "BMP"]),
            )],
        };
        let (sql, _) = rules_to_sql(&rules).unwrap();
        assert!(sql.contains("NOT IN"));
    }
}
