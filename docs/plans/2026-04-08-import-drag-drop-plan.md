# Import Drag & Drop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add drag-and-drop import support — drag files/folders into the app window or a sidebar drop zone to trigger import.

**Architecture:** Use Tauri v2 built-in drag-drop events (`onDragDropEvent`). Frontend listens for enter/drop/leave, shows overlay. New `import_from_paths` backend command handles mixed file+folder paths. Reuses existing two-phase import flow (prepare → dedup → commit).

**Tech Stack:** Tauri v2 native drag-drop (no plugin needed), React/TypeScript/Zustand, Rust

---

### Task 1: Add `prepare_from_paths` to indexer

**Files:**
- Modify: `src-tauri/src/indexer.rs`

**Step 1: Add `prepare_from_paths` function**

This function handles mixed file+folder paths, unlike `prepare_import` which only takes a single directory. Add after `prepare_import` (after line 105):

```rust
/// Prepare import from a mixed list of file and folder paths.
/// Files are processed directly; folders are recursively walked.
pub fn prepare_from_paths(paths: &[String]) -> Result<Vec<Result<PreparedFile, AppError>>, AppError> {
    let mut all_files: Vec<std::path::PathBuf> = Vec::new();

    for p in paths {
        let path = Path::new(p);
        if !path.exists() {
            continue;
        }
        if path.is_file() {
            if is_supported_image(path) {
                all_files.push(path.to_path_buf());
            }
        } else if path.is_dir() {
            let dir_files: Vec<std::path::PathBuf> = WalkDir::new(path)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .filter(|e| is_supported_image(e.path()))
                .map(|e| e.into_path())
                .collect();
            all_files.extend(dir_files);
        }
    }

    // Deduplicate paths (same file might appear via folder + direct path)
    all_files.sort();
    all_files.dedup();

    if all_files.is_empty() {
        return Ok(Vec::new());
    }

    let prepared: Vec<Result<PreparedFile, AppError>> = all_files
        .into_par_iter()
        .map(|path| {
            let file_name = path
                .file_name()
                .and_then(|n| n.to_str().map(String::from))
                .unwrap_or_default();
            let file_size = path.metadata().map(|m| m.len() as i64).unwrap_or(0);
            let ext = path
                .extension()
                .and_then(std::ffi::OsStr::to_str)
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
```

**Step 2: Run cargo check**

Run: `~/.cargo/bin/cargo check --manifest-path src-tauri/Cargo.toml`
Expected: compiles with no errors

**Step 3: Run existing tests**

Run: `~/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml`
Expected: all tests pass

**Step 4: Commit**

```bash
git add src-tauri/src/indexer.rs
git commit -m "feat: add prepare_from_paths for mixed file/folder import"
```

---

### Task 2: Add `import_from_paths` IPC command

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add command to commands.rs**

Add after `import_commit` (after line 251):

```rust
#[tauri::command]
pub async fn import_from_paths(
    library_id: String,
    paths: Vec<String>,
    state: State<'_, DbState>,
) -> Result<ImportPrepResult, AppError> {
    let lib = with_registry_conn(&state, |conn| db::get_library(conn, &library_id))?;
    let lib_path = lib.path.clone();

    tauri::async_runtime::spawn_blocking(move || -> Result<ImportPrepResult, AppError> {
        let prepared = crate::indexer::prepare_from_paths(&paths)?;
        let lib_db_path = Path::new(&lib_path).join(".shark").join("metadata.db");
        let conn = db::init_library_db(&lib_db_path)?;

        let total_prepared = prepared.iter().filter(|p| p.is_ok()).count();
        let (duplicates, _non_dup_files) = crate::indexer::find_duplicates(&conn, &prepared)?;

        Ok(ImportPrepResult {
            duplicates,
            total_prepared,
        })
    })
    .await
    .map_err(|e| AppError::Import(format!("Import from paths failed: {e}")))?
}
```

**Step 2: Add `import_commit_paths` command**

This is needed because `import_commit` takes a `source_path` directory, but drag-drop may have loose files from different locations. Add after the above:

```rust
#[tauri::command]
pub async fn import_commit_paths(
    library_id: String,
    paths: Vec<String>,
    actions: std::collections::HashMap<String, DedupAction>,
    state: State<'_, DbState>,
    app: tauri::AppHandle,
) -> Result<ImportResult, AppError> {
    let lib = with_registry_conn(&state, |conn| db::get_library(conn, &library_id))?;
    let lib_path = lib.path.clone();

    tauri::async_runtime::spawn_blocking(move || -> Result<ImportResult, AppError> {
        let prepared = crate::indexer::prepare_from_paths(&paths)?;
        let lib_db_path = Path::new(&lib_path).join(".shark").join("metadata.db");
        let conn = db::init_library_db(&lib_db_path)?;

        let (duplicates, mut non_dup_files) = crate::indexer::find_duplicates(&conn, &prepared)?;

        let mut kept_count = 0i64;
        let prepared_lookup: std::collections::HashMap<String, crate::indexer::PreparedFile> = prepared
            .into_iter()
            .filter_map(|p| p.ok())
            .map(|p| (p.source_path.to_string_lossy().to_string(), p))
            .collect();

        for (source_path, action) in &actions {
            if matches!(action, DedupAction::KeepBoth) {
                if let Some(pf) = prepared_lookup.get(source_path) {
                    non_dup_files.push(pf.clone());
                    kept_count += 1;
                }
            }
        }

        let skipped_count = duplicates.len() as i64 - kept_count;
        let dup_count = duplicates.len() as i64;

        let thumb_dir = Path::new(&lib_path).join(".shark").join("thumbnails");
        std::fs::create_dir_all(Path::new(&lib_path).join("images"))?;
        std::fs::create_dir_all(&thumb_dir)?;

        let counter = std::sync::atomic::AtomicUsize::new(0);
        let total = non_dup_files.len();
        let processed: Vec<(Item, Option<String>)> = non_dup_files
            .into_par_iter()
            .map(|pf| {
                let dest_path = crate::indexer::copy_to_library(&pf.source_path, Path::new(&lib_path), &pf.id)?;
                let thumb_path = crate::thumbnail::generate_thumbnail(&dest_path, &thumb_dir, &pf.id, 720).ok();

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
                let thumb_str = thumb_path.map(|p| p.to_string_lossy().into_owned());

                let current = counter.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
                let payload = serde_json::json!({
                    "current": current,
                    "total": total,
                    "item": item,
                    "thumbnailPath": thumb_str.as_deref(),
                });
                let _ = app.emit("import-progress", payload);

                Ok((item, thumb_str))
            })
            .collect::<Result<Vec<_>, AppError>>()?;

        conn.execute_batch("BEGIN")?;
        let insert_result: Result<(), AppError> = (|| {
            for (item, thumb_str) in &processed {
                crate::db::insert_item(&conn, item)?;
                if let Some(ref tp) = thumb_str {
                    crate::db::insert_thumbnail(&conn, &item.id, Some(tp), None)?;
                }
            }
            Ok(())
        })();
        match insert_result {
            Ok(()) => conn.execute_batch("COMMIT")?,
            Err(e) => {
                conn.execute_batch("ROLLBACK").ok();
                return Err(e);
            }
        }

        Ok(ImportResult {
            imported: processed.len() as i64,
            skipped: skipped_count,
            duplicates: dup_count,
        })
    })
    .await
    .map_err(|e| AppError::Import(format!("Import commit paths failed: {e}")))?
}
```

**Step 3: Register new commands in lib.rs**

Add to the `invoke_handler` list in `src-tauri/src/lib.rs`:

```rust
commands::import_from_paths,
commands::import_commit_paths,
```

**Step 4: Run cargo check**

Run: `~/.cargo/bin/cargo check --manifest-path src-tauri/Cargo.toml`
Expected: compiles with no errors

**Step 5: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat: add import_from_paths and import_commit_paths commands"
```

---

### Task 3: Add `isDragOver` state to uiStore

**Files:**
- Modify: `src/stores/uiStore.ts`

**Step 1: Add `isDragOver` to UiState interface**

Add after `dedupSourcePath` (after line 29):

```typescript
isDragOver: boolean;
```

**Step 2: Add actions to UiActions interface**

Add:

```typescript
setDragOver: (over: boolean) => void;
```

**Step 3: Add initial value and implementation**

Add to initial state (after `dedupSourcePath: null,`):

```typescript
isDragOver: false,
```

Add implementation:

```typescript
setDragOver: (over) => set({ isDragOver: over }),
```

**Step 4: Also store pending drop paths for the commit phase**

Add to UiState:

```typescript
pendingDropPaths: string[] | null;
```

Add to actions:

```typescript
setPendingDropPaths: (paths: string[] | null) => void;
```

Add initial value:

```typescript
pendingDropPaths: null,
```

Add implementation:

```typescript
setPendingDropPaths: (paths) => set({ pendingDropPaths: paths }),
```

**Step 5: Verify frontend compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no type errors

**Step 6: Commit**

```bash
git add src/stores/uiStore.ts
git commit -m "feat: add isDragOver and pendingDropPaths to uiStore"
```

---

### Task 4: Create DropOverlay component

**Files:**
- Create: `src/components/Import/DropOverlay.tsx`

**Step 1: Create the component**

```tsx
import { useUiStore } from '@/stores/uiStore';

export function DropOverlay() {
  const isDragOver = useUiStore((s) => s.isDragOver);

  if (!isDragOver) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-blue-500/10 border-4 border-dashed border-blue-400/60">
      <div className="bg-neutral-800/90 rounded-xl px-8 py-6 flex flex-col items-center gap-3">
        <svg
          className="w-12 h-12 text-blue-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <span className="text-lg font-medium text-blue-300">
          松手导入
        </span>
      </div>
    </div>
  );
}
```

**Step 2: Verify frontend compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no type errors

**Step 3: Commit**

```bash
git add src/components/Import/DropOverlay.tsx
git commit -m "feat: add DropOverlay component"
```

---

### Task 5: Create SidebarDropZone component

**Files:**
- Create: `src/components/Sidebar/SidebarDropZone.tsx`
- Modify: `src/components/Sidebar/Sidebar.tsx`

**Step 1: Create the component**

```tsx
import { useUiStore } from '@/stores/uiStore';

export function SidebarDropZone() {
  const isDragOver = useUiStore((s) => s.isDragOver);

  return (
    <div
      className={`mt-auto mx-2 mb-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
        isDragOver
          ? 'border-blue-400 bg-blue-500/10 text-blue-300'
          : 'border-neutral-600 text-neutral-500'
      }`}
    >
      <svg
        className={`w-6 h-6 mx-auto mb-1 ${isDragOver ? 'text-blue-400' : 'text-neutral-600'}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
        />
      </svg>
      <span className="text-xs">拖入文件或文件夹</span>
    </div>
  );
}
```

**Step 2: Add to Sidebar.tsx**

Import and render at the bottom of the sidebar flex container, before the closing `</div>`:

```tsx
import { SidebarDropZone } from './SidebarDropZone';
```

Add `<SidebarDropZone />` as the last child inside the sidebar div, after `{editorOpen && ...}`.

**Step 3: Verify frontend compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no type errors

**Step 4: Commit**

```bash
git add src/components/Sidebar/SidebarDropZone.tsx src/components/Sidebar/Sidebar.tsx
git commit -m "feat: add SidebarDropZone component"
```

---

### Task 6: Wire up Tauri drag-drop events in App.tsx

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add drag-drop event listener**

Import at top:

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';
```

Add a `useEffect` inside the `App` function to listen for Tauri drag-drop events:

```typescript
useEffect(() => {
  const unlisten = getCurrentWindow().onDragDropEvent((event) => {
    const { importing } = useUiStore.getState();
    switch (event.payload.type) {
      case 'enter':
        useUiStore.getState().setDragOver(true);
        break;
      case 'leave':
        useUiStore.getState().setDragOver(false);
        break;
      case 'drop': {
        useUiStore.getState().setDragOver(false);
        if (importing) return;
        const paths = event.payload.paths;
        if (!paths || paths.length === 0) return;
        handleDropImport(paths);
        break;
      }
    }
  });

  return () => {
    unlisten.then((fn) => fn());
  };
}, []);
```

**Step 2: Add `handleDropImport` function**

This function mirrors the ImportButton logic but takes paths instead of a directory:

```typescript
const handleDropImport = async (paths: string[]) => {
  const { libraries, activeLibraryId } = useLibraryStore.getState();
  const { setImporting, setImportProgress, showDedupDialog, setPendingDropPaths } = useUiStore.getState();
  const loadItems = useItemStore.getState().loadItems;

  const lib = libraries.find((l) => l.id === activeLibraryId);
  if (!lib) {
    useUiStore.getState().setError('请先选择或创建一个库');
    return;
  }

  setImporting(true);
  try {
    const prep = await invoke<ImportPrepResult>('import_from_paths', {
      libraryId: lib.id,
      paths,
    });

    if (prep.duplicates.length > 0) {
      setImporting(false);
      setPendingDropPaths(paths);
      showDedupDialog(prep.duplicates, '');
      return;
    }

    // No duplicates — commit directly
    await invoke<ImportResult>('import_commit_paths', {
      libraryId: lib.id,
      paths,
      actions: {},
    });

    if (activeLibraryId) {
      loadItems(activeLibraryId, {}, { field: 'created_at', direction: 'desc' }, { page: 0, page_size: 100 });
    }
  } catch (err) {
    console.error('Drop import failed:', err);
    useUiStore.getState().setError(`导入失败: ${err}`);
  } finally {
    setImporting(false);
    setImportProgress(null);
  }
};
```

Add necessary imports:

```typescript
import { invoke } from '@tauri-apps/api/core';
import { useUiStore } from '@/stores/uiStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useItemStore } from '@/stores/itemStore';
import type { ImportPrepResult, ImportResult } from '@/lib/types';
```

**Step 3: Render DropOverlay**

Add `<DropOverlay />` next to the existing `<ImportProgress />` and `<DedupDialog />`:

```tsx
<ImportProgress />
<DropOverlay />
<DedupDialog />
```

Import it:

```tsx
import { DropOverlay } from '@/components/Import/DropOverlay';
```

**Step 4: Verify frontend compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no type errors

**Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire up Tauri drag-drop events with DropOverlay"
```

---

### Task 7: Update DedupDialog to support path-based import

**Files:**
- Modify: `src/components/Import/DedupDialog.tsx`

**Step 1: Update `resolveAndImport` to handle path-based imports**

When `pendingDropPaths` is set, use `import_commit_paths` instead of `import_commit`. In the `resolveAndImport` function, change the invoke call:

Find the existing `invoke<ImportResult>('import_commit', ...)` call and replace the entire `resolveAndImport` function body with:

```typescript
const resolveAndImport = async () => {
  const state = useUiStore.getState();
  const lib = libraries.find((l) => l.id === activeLibraryId);
  if (!lib) return;

  dismissDedupDialog();
  setImporting(true);

  try {
    if (state.pendingDropPaths && state.pendingDropPaths.length > 0) {
      // Drag-drop import
      await invoke<ImportResult>('import_commit_paths', {
        libraryId: lib.id,
        paths: state.pendingDropPaths,
        actions: state.dedupDecisions,
      });
      useUiStore.getState().setPendingDropPaths(null);
    } else if (state.dedupSourcePath) {
      // Directory import
      await invoke<ImportResult>('import_commit', {
        libraryId: lib.id,
        sourcePath: state.dedupSourcePath,
        actions: state.dedupDecisions,
      });
    }

    if (activeLibraryId) {
      loadItems(activeLibraryId, {}, { field: 'created_at', direction: 'desc' }, { page: 0, page_size: 100 });
    }
  } catch (err) {
    console.error('Import commit failed:', err);
  } finally {
    setImporting(false);
    setImportProgress(null);
  }
};
```

**Step 2: Verify frontend compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no type errors

**Step 3: Commit**

```bash
git add src/components/Import/DedupDialog.tsx
git commit -m "feat: update DedupDialog to support path-based import commits"
```

---

### Task 8: End-to-end verification

**Step 1: Run full Rust test suite**

Run: `~/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml`
Expected: all tests pass

**Step 2: Run frontend type check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors

**Step 3: Start dev server and manual test**

Run: `pnpm tauri dev`

Manual test checklist:
- [ ] Drag image files onto the window → DropOverlay appears
- [ ] Drop files → import runs, images appear in grid
- [ ] Drag a folder onto the window → import runs recursively
- [ ] Drag mixed files + folders → all images collected and imported
- [ ] Drag non-image files → silently skipped, shows result
- [ ] Sidebar drop zone highlights when dragging over window
- [ ] Dedup dialog works correctly for drag-drop imports
- [ ] Button-based import still works as before
- [ ] DropOverlay disappears after drop or drag-leave

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during drag-drop e2e testing"
```
