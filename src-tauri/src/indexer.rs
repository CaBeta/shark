use std::ffi::OsStr;
use std::path::Path;

use rayon::prelude::*;
use rusqlite::Connection;
use sha2::{Digest, Sha256};
use walkdir::WalkDir;

use crate::error::AppError;
use crate::models::{ImportResult, Item, ItemStatus};
use crate::thumbnail::generate_thumbnail;

const SUPPORTED_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "webp", "bmp"];

fn is_supported_image(path: &Path) -> bool {
    path
        .extension()
        .and_then(OsStr::to_str)
        .map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn compute_sha256(path: &Path) -> Result<String, AppError> {
    let data = std::fs::read(path)?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    Ok(format!("{:x}", hasher.finalize()))
}

fn copy_to_library(src: &Path, library_path: &Path, id: &str) -> Result<std::path::PathBuf, AppError> {
    let ext = src
        .extension()
        .and_then(OsStr::to_str)
        .unwrap_or("jpg");
    let dest_dir = library_path.join("images");
    std::fs::create_dir_all(&dest_dir)?;
    let dest = dest_dir.join(format!("{id}.{ext}"));
    std::fs::copy(src, &dest)?;
    Ok(dest)
}

/// Data extracted from source file during parallel processing (no copy yet).
pub struct PreparedFile {
    pub source_path: std::path::PathBuf,
    pub id: String,
    pub file_name: String,
    pub file_size: i64,
    pub file_type: String,
    pub sha256: String,
    pub width: Option<i64>,
    pub height: Option<i64>,
}

/// Phase 1+2: Walk files and extract metadata in parallel — no DB lock needed.
pub fn prepare_import(source_path: &Path) -> Result<Vec<Result<PreparedFile, AppError>>, AppError> {
    let files: Vec<std::path::PathBuf> = WalkDir::new(source_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| is_supported_image(e.path()))
        .map(|e| e.into_path())
        .collect();

    if files.is_empty() {
        return Ok(Vec::new());
    }

    let prepared: Vec<Result<PreparedFile, AppError>> = files
        .into_par_iter()
        .map(|path| {
            let file_name = path
                .file_name()
                .and_then(|n| n.to_str().map(String::from))
                .unwrap_or_default();
            let file_size = path.metadata().map(|m| m.len() as i64).unwrap_or(0);
            let ext = path
                .extension()
                .and_then(OsStr::to_str)
                .map(|e| e.to_uppercase())
                .unwrap_or_else(|| "JPG".to_string());

            let sha256 = compute_sha256(&path)?;

            let (width, height) = match image::image_dimensions(&path) {
                Ok((w, h)) => (Some(w as i64), Some(h as i64)),
                Err(_) => (None, None),
            };

            Ok(PreparedFile {
                source_path: path,
                id: uuid::Uuid::new_v4().to_string(),
                file_name,
                file_size,
                file_type: ext,
                sha256,
                width,
                height,
            })
        })
        .collect();

    Ok(prepared)
}

/// Phase 3: Dedup check, copy, generate thumbnails, and insert into DB.
/// Holds DB lock only for the duration of writes.
pub fn commit_import(
    conn: &Connection,
    library_path: &Path,
    prepared: Vec<Result<PreparedFile, AppError>>,
) -> Result<ImportResult, AppError> {
    let mut result = ImportResult::default();
    let thumb_dir = library_path.join(".shark").join("thumbnails");

    for pf in prepared {
        match pf {
            Ok(pf) => {
                // Check dedup BEFORE copying to avoid orphan files
                if crate::db::sha256_exists(conn, &pf.sha256)? {
                    result.duplicates += 1;
                    continue;
                }

                // Copy to library (only after dedup check passed)
                let dest_path = copy_to_library(&pf.source_path, library_path, &pf.id)?;

                // Generate 256px thumbnail
                let thumb_path = generate_thumbnail(&dest_path, &thumb_dir, &pf.id, 256).ok();

                let now = chrono::Utc::now().to_rfc3339();
                let item = Item {
                    id: pf.id,
                    file_path: dest_path.to_string_lossy().to_string(),
                    file_name: pf.file_name,
                    file_size: pf.file_size,
                    file_type: pf.file_type,
                    width: pf.width,
                    height: pf.height,
                    tags: String::new(),
                    rating: 0,
                    notes: String::new(),
                    sha256: pf.sha256,
                    status: ItemStatus::Active,
                    created_at: now.clone(),
                    modified_at: now,
                };

                crate::db::insert_item(conn, &item)?;
                if let Some(ref tp) = &thumb_path {
                    let rel = tp.to_string_lossy().to_string();
                    crate::db::insert_thumbnail(conn, &item.id, Some(&rel), None)?;
                }
                result.imported += 1;
            }
            Err(e) => {
                eprintln!("Import error: {e}");
                result.skipped += 1;
            }
        }
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_supported_image() {
        assert!(is_supported_image(Path::new("test.jpg")));
        assert!(is_supported_image(Path::new("test.PNG")));
        assert!(is_supported_image(Path::new("test.webp")));
        assert!(!is_supported_image(Path::new("test.pdf")));
        assert!(!is_supported_image(Path::new("test.mp4")));
    }

    #[test]
    fn test_compute_sha256() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("test.txt");
        std::fs::write(&file, b"hello").unwrap();
        let hash = compute_sha256(&file).unwrap();
        assert_eq!(hash.len(), 64);
    }
}
