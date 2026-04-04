# E2E Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Get Shark's core workflows running end-to-end by fixing build/runtime issues, then validating each user path from library creation through image viewing.

**Architecture:** Fix blocking issues first (build config, missing plugin, permissions), then launch and validate each path sequentially. Each task is a small, verifiable fix.

**Tech Stack:** Tauri v2, React 19, TypeScript, Zustand 5, Rust, SQLite

---

### Task 1: Fix build configuration

The `tauri.conf.json` uses `pnpm` but the project may not have pnpm. Normalize to the package manager that's actually available. Also fix the window title in `index.html`.

**Files:**
- Modify: `src-tauri/tauri.conf.json:7,9`
- Modify: `index.html:7`

**Step 1: Check which package manager is available**

Run: `which pnpm && which npm`
- If pnpm is available, keep as-is
- If only npm, change `pnpm dev` → `npm run dev` and `pnpm build` → `npm run build`

**Step 2: Fix tauri.conf.json (if needed)**

If npm only, update lines 7 and 9 in `src-tauri/tauri.conf.json`:
```json
"beforeDevCommand": "npm run dev",
"beforeBuildCommand": "npm run build",
```

**Step 3: Update index.html title**

Change `<title>Tauri + React + Typescript</title>` → `<title>Shark</title>`

**Step 4: Verify build starts**

Run: `npm run tauri dev` (or `pnpm tauri dev`)
Expected: Both Vite dev server and Rust compilation start without errors. Window opens (may show errors in console, that's OK for now).

**Step 5: Commit**

```bash
git add src-tauri/tauri.conf.json index.html
git commit -m "fix: normalize build config and app title"
```

---

### Task 2: Add Tauri dialog plugin to Rust backend

The frontend uses `@tauri-apps/plugin-dialog` (in `ImportButton.tsx:17`) but the Rust side doesn't register the dialog plugin. Without it, `open()` calls will fail.

**Files:**
- Modify: `src-tauri/Cargo.toml` — add `tauri-plugin-dialog` dependency
- Modify: `src-tauri/src/lib.rs:14` — register plugin
- Modify: `src-tauri/capabilities/default.json` — add dialog permission

**Step 1: Add dependency to Cargo.toml**

Add under `[dependencies]` in `src-tauri/Cargo.toml`:
```toml
tauri-plugin-dialog = "2"
```

**Step 2: Register plugin in lib.rs**

After line 14 (`tauri_plugin_opener::init()`), add:
```rust
.plugin(tauri_plugin_dialog::init())
```

**Step 3: Add dialog permission to capabilities**

In `src-tauri/capabilities/default.json`, add `"dialog:default"` to the permissions array:
```json
"permissions": [
  "core:default",
  "opener:default",
  "dialog:default"
]
```

**Step 4: Verify Rust compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors

**Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "feat: add Tauri dialog plugin for folder picker"
```

---

### Task 3: Wire up app initialization flow

On app startup, the `LibrarySelector` already calls `list_libraries`, and if a library was previously active (persisted in localStorage), it should auto-open and load items. Currently `LibrarySelector` lists libraries but doesn't auto-select the active one on mount.

**Files:**
- Modify: `src/components/Sidebar/LibrarySelector.tsx`

**Step 1: Add auto-open on mount**

When `LibrarySelector` mounts, if `activeLibraryId` is set and matches a known library, auto-call `open_library` and `loadItems`. Update the `useEffect` to handle this:

```tsx
useEffect(() => {
  invoke<Library[]>('list_libraries').then((libs) => {
    setLibraries(libs);
    // Auto-open previously active library
    const activeId = useLibraryStore.getState().activeLibraryId;
    if (activeId && libs.some((l) => l.id === activeId)) {
      const lib = libs.find((l) => l.id === activeId)!;
      invoke('open_library', { path: lib.path }).catch(() => {});
      loadItems(activeId, {}, { field: 'created_at', direction: 'desc' }, { page: 0, page_size: 100 });
    }
  }).catch(() => {});
}, [setLibraries, loadItems]);
```

**Step 2: Verify in browser**

Run: `npm run tauri dev`
1. Create a library
2. Restart the app
3. Expected: Library auto-selects and items load

**Step 3: Commit**

```bash
git add src/components/Sidebar/LibrarySelector.tsx
git commit -m "feat: auto-open active library on app startup"
```

---

### Task 4: Validate Path 1 — Create Library

Verify the full create-library flow works.

**Files:** None (validation only)

**Step 1: Launch app**

Run: `npm run tauri dev`

**Step 2: Create a library**

1. Click "+ New Library" in sidebar
2. Enter name: "Test Library"
3. Enter path: `/tmp/shark-test-lib`
4. Click OK

**Step 3: Verify**

Check the following:
- `/tmp/shark-test-lib/images/` directory exists
- `/tmp/shark-test-lib/.shark/metadata.db` exists
- Registry at `~/Library/Application Support/com.shark.asset-manager/registry.db` has the library entry
- The library appears in the dropdown and is selected

If any step fails, note the exact error and fix inline.

**Step 4: Commit any fixes**

---

### Task 5: Validate Path 2 — Import Files

Verify the import flow works end-to-end.

**Files:** None (validation only, fixes if needed)

**Step 1: Create test images**

Run:
```bash
mkdir -p /tmp/shark-test-images
for i in $(seq 1 10); do
  convert -size 100x100 xc:blue /tmp/shark-test-images/test_${i}.png 2>/dev/null || \
  python3 -c "
from PIL import Image
img = Image.new('RGB', (100,100), (0,0,255))
img.save('/tmp/shark-test-images/test_${i}.png')
" 2>/dev/null || \
  cp /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/ToolbarUtilitiesFolderIcon.icns /tmp/shark-test-images/test_${i}.png 2>/dev/null || \
  echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > /tmp/shark-test-images/test_${i}.png
done
```

**Step 2: Import via UI**

1. Click "Import" button
2. Select `/tmp/shark-test-images`
3. Wait for import to complete

**Step 3: Verify**

- Import result alert shows imported count
- Grid shows thumbnails for imported images
- `/tmp/shark-test-lib/images/` contains the imported files
- Database has items in the `items` table

If any step fails, note exact error and fix inline.

**Step 4: Commit any fixes**

---

### Task 6: Validate Path 3 — Browse Grid & Thumbnails

Verify the virtual grid displays items correctly.

**Files:** None (validation only, fixes if needed)

**Step 1: Verify grid rendering**

With items imported from Task 5:
1. Check that AssetCard shows image thumbnails (via `convertFileSrc`)
2. Click items — selection ring should appear
3. Shift+click for range selection
4. Ctrl+click for toggle selection
5. Resize grid with size buttons in toolbar
6. Scroll through grid — should be smooth

**Step 2: Verify common issues**

- If thumbnails don't load: check browser console for `convertFileSrc` errors
- If grid is empty: check that `query_items` returns data (add console.log)
- If scroll is janky: verify virtual scroll is working (check DOM node count)

**Step 3: Commit any fixes**

---

### Task 7: Validate Path 4 — Search

Verify FTS5 search works.

**Files:** None (validation only, fixes if needed)

**Step 1: Test search**

1. Type "test" in the search box
2. Results should filter to show items matching "test" in filename
3. Clear search — grid should show all items again

**Step 2: Verify search behavior**

- Search query is passed to `search_items_cmd`
- Results replace grid items
- Clearing search reloads via `loadItems`

**Step 3: Commit any fixes**

---

### Task 8: Validate Path 5 — Image Viewer

Verify full-screen viewer works.

**Files:** None (validation only, fixes if needed)

**Step 1: Test viewer**

1. Double-click an item in the grid
2. Full-screen viewer should open
3. Image should display at full resolution
4. Left/right arrow keys navigate between images
5. Escape or click outside closes viewer
6. File info (dimensions, position) shown at bottom

**Step 2: Verify viewer behavior**

- Navigation buttons work
- Keyboard shortcuts work (arrow keys, Escape)
- Image scales correctly in viewport

**Step 3: Commit any fixes**

---

### Task 9: Validate Path 6 — Folder Tree

Verify folder sidebar works.

**Files:** None (validation only, fixes if needed)

**Step 1: Test folder list**

1. Folder list should show "All Items" button (no folders yet since import doesn't auto-create folder entries)
2. Click "All Items" — grid shows all items

Note: The current `import_files` flow doesn't create folder entries. This is expected — folders are a future feature for manual organization. The folder list being empty is correct behavior.

**Step 2: Commit any fixes**

---

### Task 10: Fix thumbnail display to use generated thumbnails

Currently `AssetCard` uses `convertFileSrc(item.file_path)` which loads the original file. This is slow for large images. Switch to use the `get_thumbnails_batch` command for the 256px tier.

**Files:**
- Modify: `src/components/Grid/AssetCard.tsx`
- Modify: `src/components/Grid/VirtualGrid.tsx` or create a hook

**Step 1: Add thumbnail batch loading to itemStore**

In `src/stores/itemStore.ts`, after items are loaded, call `get_thumbnails_batch`:

Add to state:
```ts
thumbnailPaths: Record<string, string>;
```

Add action:
```ts
loadThumbnails: async (itemIds: string[]) => {
  const { activeLibraryId } = useLibraryStore.getState();
  if (!activeLibraryId) return;
  try {
    const map = await invoke<Record<string, string>>('get_thumbnails_batch', {
      itemIds,
      size: 'S256',
    });
    set((state) => ({ thumbnailPaths: { ...state.thumbnailPaths, ...map } }));
  } catch {
    // Thumbnails not yet generated — fall back to original file
  }
},
```

Call `loadThumbnails` after `loadItems` succeeds and after search results come in.

**Step 2: Update AssetCard to use thumbnail path**

In `AssetCard.tsx`, accept an optional `thumbnailPath` prop. If present, use `convertFileSrc(thumbnailPath)`, otherwise fall back to `convertFileSrc(item.file_path)`.

**Step 3: Wire thumbnailPaths from VirtualGrid to AssetCard**

Pass thumbnail paths from itemStore to AssetCard via VirtualGrid.

**Step 4: Verify thumbnails load**

- Import images
- Grid should show 256px thumbnails (faster than loading originals)
- If thumbnail not generated yet, falls back to original file

**Step 5: Commit**

```bash
git add src/stores/itemStore.ts src/components/Grid/AssetCard.tsx src/components/Grid/VirtualGrid.tsx
git commit -m "feat: use generated 256px thumbnails in grid"
```

---

### Task 11: Add error handling for IPC calls

Several frontend IPC calls have empty `.catch(() => {})` handlers. Add proper error display.

**Files:**
- Modify: `src/stores/libraryStore.ts`
- Modify: `src/components/Sidebar/LibrarySelector.tsx`
- Modify: `src/components/Sidebar/FolderList.tsx`
- Modify: `src/components/Toolbar/Toolbar.tsx`

**Step 1: Add error state to uiStore**

In `src/stores/uiStore.ts`, add:
```ts
error: string | null;
setError: (msg: string | null) => void;
```

**Step 2: Replace empty catches with error display**

For each `.catch(() => {})`, replace with:
```ts
.catch((e) => useUiStore.getState().setError(String(e)))
```

**Step 3: Add error toast to App.tsx**

Add a simple error banner that auto-dismisses:
```tsx
{error && (
  <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-2 rounded shadow-lg text-sm">
    {error}
    <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
  </div>
)}
```

**Step 4: Verify error handling**

- Try to import without a library selected — should show error
- Try to open a non-existent library path — should show error

**Step 5: Commit**

```bash
git add src/stores/uiStore.ts src/stores/libraryStore.ts src/components/Sidebar/LibrarySelector.tsx src/components/Sidebar/FolderList.tsx src/components/Toolbar/Toolbar.tsx src/App.tsx
git commit -m "feat: add error handling for IPC calls"
```

---

### Task 12: Run Rust tests

Verify the backend is solid before performance testing.

**Files:** None (validation only)

**Step 1: Run all Rust tests**

Run: `cd src-tauri && cargo test`
Expected: All tests pass

**Step 2: Fix any test failures**

If any tests fail, investigate and fix. Common issues:
- Missing test dependencies (tempfile crate)
- Schema changes not reflected in tests

**Step 3: Commit any fixes**

---

### Task 13: Performance benchmark — import speed

Test import throughput with a larger batch of images.

**Files:** None (validation only)

**Step 1: Generate 100 test images**

```bash
mkdir -p /tmp/shark-perf-images
for i in $(seq 1 100); do
  echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > /tmp/shark-perf-images/img_$(printf '%03d' $i).png
done
```

**Step 2: Time the import**

1. Create a fresh library
2. Click Import, select `/tmp/shark-perf-images`
3. Note the time from click to completion alert
4. Target: < 1 second for 100 small images (>500/sec for real images on SSD)

**Step 3: Report results**

Document actual import time and any bottlenecks found.

---

### Task 14: Performance benchmark — grid scroll & search

Test grid and search performance.

**Files:** None (validation only)

**Step 1: Grid scroll test**

1. Import 100+ images
2. Set grid size to smallest (click smaller button multiple times)
3. Scroll through the grid rapidly
4. Check: no visible jank, smooth scrolling
5. Open DevTools → Performance tab, record a scroll, check for frame drops

**Step 2: Search speed test**

1. With 100+ items imported, type a search term
2. Check response time
3. Target: < 200ms for results to appear

**Step 3: Memory check**

1. Open DevTools → Memory tab
2. Take a heap snapshot during normal browsing
3. Target: < 500MB total

**Step 4: Report results**
