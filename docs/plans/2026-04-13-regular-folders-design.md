# Regular Folders Design

Date: 2026-04-13

## Overview

Implement manual (user-managed) folders — users can create, rename, delete, and nest folders; assign items to folders via right-click menu or drag-and-drop; reorder folders via drag-and-drop in the sidebar.

## Requirements

- Nested folder support (multi-level tree via `parent_id`)
- Create via: + button on section header, right-click on folder (sub-folder), right-click on empty area
- Add items to folder via: right-click "Add to Folder" submenu on grid items, drag items from grid to sidebar folder
- Drag-and-drop reorder in sidebar (move into/out of parent, reorder siblings)
- Display item count per folder
- Delete folder removes folder + item associations only, does NOT delete image files
- Schema already exists (`folders` + `item_folders` tables), no migration needed

## Backend IPC Commands

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `create_folder` | `name: String, parent_id: Option<String>` | `Folder` | Create folder with auto UUID |
| `rename_folder` | `id: String, name: String` | `Folder` | Rename folder |
| `delete_folder` | `id: String` | `()` | Delete folder + children (CASCADE), item_folders cleaned by FK |
| `move_folder` | `id: String, parent_id: Option<String>, sort_order: Option<i32>` | `()` | Move to new parent and/or reorder |
| `get_folder_item_counts` | none | `Vec<FolderCount>` | Returns `{ folder_id, count }` for each folder |
| `add_items_to_folder` | `folder_id: String, item_ids: Vec<String>` | `()` | Bulk add items to folder |
| `remove_items_from_folder` | `folder_id: String, item_ids: Vec<String>` | `()` | Bulk remove items from folder |

**Database:** No schema changes. Existing `folders` and `item_folders` tables with `ON DELETE CASCADE` handle cleanup.

## Frontend

### folderStore (`src/stores/folderStore.ts`)

New Zustand store, parallel to `smartFolderStore`:

```typescript
interface FolderState {
  folders: Folder[];
  itemCounts: Record<string, number>;
  loading: boolean;
}

interface FolderActions {
  fetchFolders(): Promise<void>;           // fetches folders + counts
  create(name: string, parentId?: string | null): Promise<Folder>;
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
  move(id: string, parentId: string | null, sortOrder?: number): Promise<void>;
  addItems(folderId: string, itemIds: string[]): Promise<void>;
  removeItems(folderId: string, itemIds: string[]): Promise<void>;
  getItemCount(folderId: string): number;
}
```

### FolderList Component (`src/components/Sidebar/FolderList.tsx`)

Complete rewrite:

- **Tree display**: Recursive rendering with indentation, matching SmartFolderList pattern
- **Section header**: "FOLDERS" label with + button to create top-level folder
- **Right-click context menu on folder**: Rename, New Sub-folder, Delete
- **Right-click context menu on empty area**: New Folder
- **Item counts**: `(N)` displayed after folder name
- **Selection**: Click to filter items by folder, highlight active folder
- **Drag-and-drop reorder**: HTML5 drag API
  - Drag folder over another folder = move into as child
  - Drag folder between two folders (top/bottom edge) = insert as sibling
  - Blue indicator line shows drop position
- **Drop from grid**: When items dragged from grid onto a folder, calls `addItems`

### Grid Item Context Menu

Add "Add to Folder" submenu:

```
┌─────────────────────┐
│  Open               │
│  ─────────────────  │
│  Add to Folder  >   │──── ┌──────────────┐
│                     │     │  旅行         │
│  Edit Tags          │     │  设计素材     │
│  Delete             │     │  新建文件夹...│
└─────────────────────┘     └──────────────┘
```

- Lists all folders (hierarchical)
- Items already in a folder show checkmark
- "New Folder..." option: prompt for name, create, then add items

## File Changes

### Rust (`src-tauri/src/`)
- **db.rs**: Add 7 database operation functions
- **commands.rs**: Add 7 `#[tauri::command]` handlers
- **main.rs**: Register new commands

### TypeScript (`src/`)
- **stores/folderStore.ts**: New file — Folder CRUD store
- **components/Sidebar/FolderList.tsx**: Rewrite — tree + context menu + drag-and-drop + counts
- **components/Grid/**: Modify item context menu to add "Add to Folder" submenu
- **lib/types.ts**: Add `FolderCount` type if needed

### Unchanged
- Database schema (tables already exist)
- filterStore (already supports `folder_id` filtering)
