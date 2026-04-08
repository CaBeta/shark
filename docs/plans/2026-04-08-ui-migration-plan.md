# UI Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate Shark's dark-theme UI to a macOS-inspired light theme matching the reference UI (shark_UI), adding an Inspector panel.

**Architecture:** Style-only migration — all Zustand stores, Tauri invoke calls, and functional logic remain unchanged. Components get restyled from dark to light theme, and one new component (Inspector) is added. Uses `lucide-react` for icons matching the reference.

**Tech Stack:** React 19, Tailwind CSS v4, Zustand, Tauri 2, @tanstack/react-virtual, lucide-react (new)

---

### Task 1: Install lucide-react

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

Run: `cd /Users/carpon/web/shark && npm install lucide-react`

**Step 2: Verify installation**

Run: `grep lucide-react package.json`
Expected: `"lucide-react": "^0.xxx"` appears in dependencies

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add lucide-react dependency"
```

---

### Task 2: Update global styles

**Files:**
- Modify: `src/main.css`

**Step 1: Replace main.css with light theme base styles**

```css
@import "tailwindcss";

@theme {
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  background-color: #ffffff;
}

/* Custom scrollbar for macOS feel */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border: 3px solid transparent;
  background-clip: padding-box;
  border-radius: 9999px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}
```

**Step 2: Verify the app still loads**

Run: `npm run dev` and check browser — should have white background, macOS-style scrollbars.

**Step 3: Commit**

```bash
git add src/main.css
git commit -m "style: update global styles for light theme"
```

---

### Task 3: Update App.tsx shell layout

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/stores/viewStore.ts` — add `inspectorOpen` state

**Step 1: Add `inspectorOpen` to viewStore**

In `src/stores/viewStore.ts`, add to the `ViewState` interface:
```ts
inspectorOpen: boolean;
```

Add to the initial state:
```ts
inspectorOpen: true,
```

Add to `ViewActions`:
```ts
toggleInspector: () => void;
```

Add the action:
```ts
toggleInspector: () => set((state) => ({ inspectorOpen: !state.inspectorOpen })),
```

**Step 2: Update App.tsx layout to light theme with 3-column**

Replace the App component's return with the 3-column light layout. Key changes:
- Root: `h-screen w-screen flex flex-col bg-white text-[#333333] font-sans overflow-hidden select-none`
- Error toast: `bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm`
- Layout: `<Toolbar />` then `<div className="flex flex-1 overflow-hidden">` with Sidebar, VirtualGrid, and Inspector

```tsx
return (
  <div className="h-screen w-screen flex flex-col bg-white text-[#333333] font-sans overflow-hidden select-none">
    {error && (
      <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
        {error}
        <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
      </div>
    )}
    <Toolbar />
    <div className="flex flex-1 overflow-hidden">
      {sidebarOpen && <Sidebar />}
      <VirtualGrid />
      {inspectorOpen && <Inspector />}
    </div>
    <ImageViewer />
    <ImportProgress />
    <DropOverlay />
    <DedupDialog />
  </div>
);
```

Import `Inspector` from `@/components/Inspector/Inspector` and `inspectorOpen` from viewStore.

**Step 3: Verify app loads with white background and 3 columns**

Run: `npm run dev` — app should be white, sidebar and grid visible. Inspector won't exist yet so it will error — create a placeholder.

Create `src/components/Inspector/Inspector.tsx` temporarily:
```tsx
export function Inspector() {
  return <div className="w-72 bg-[#F6F6F6] border-l border-gray-200 shrink-0">Inspector</div>;
}
```

**Step 4: Commit**

```bash
git add src/App.tsx src/stores/viewStore.ts src/components/Inspector/Inspector.tsx
git commit -m "feat: update App shell to light theme with 3-column layout"
```

---

### Task 4: Rewrite Toolbar to match reference

**Files:**
- Modify: `src/components/Toolbar/Toolbar.tsx`

**Step 1: Replace Toolbar component**

Replace the entire Toolbar with the reference style. The toolbar has three sections:
- **Left (w-64):** Decorative traffic lights, sidebar toggle icon, nav arrows
- **Center (flex-1):** Grid/list toggle buttons, item count, zoom slider
- **Right (w-72):** Search input, filter button, + import button

Key styles:
- Container: `h-14 border-b border-gray-200 bg-[#F6F6F6] flex items-center px-4 justify-between shrink-0`
- Traffic lights: decorative dots `w-3 h-3 rounded-full` with red/yellow/green
- Grid/list toggle: `bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden`
- Zoom slider: `input[type=range]` with `accent-blue-500`
- Search: `bg-white border border-gray-200 rounded-md`
- Icons: lucide-react `Sidebar, ChevronLeft, ChevronRight, LayoutGrid, List, Search, SlidersHorizontal, Plus, Image as ImageIcon`

Keep all existing functionality (search handler, grid size controls, sidebar toggle, import button). Map grid size to a 10-100 zoom value for the slider.

```tsx
import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useLibraryStore } from '@/stores/libraryStore';
import { useViewStore } from '@/stores/viewStore';
import { useFilterStore } from '@/stores/filterStore';
import { useUiStore } from '@/stores/uiStore';
import { useItemStore } from '@/stores/itemStore';
import { ImportButton } from '@/components/Import/ImportButton';
import type { SearchResult } from '@/lib/types';
import {
  Search, Plus, LayoutGrid, List, SlidersHorizontal,
  ChevronLeft, ChevronRight, Sidebar as SidebarIcon,
  Image as ImageIcon,
} from 'lucide-react';

export function Toolbar() {
  const { libraries, activeLibraryId } = useLibraryStore();
  const { sidebarOpen, toggleSidebar, gridSize, setGridSize, viewMode, setViewMode, inspectorOpen, toggleInspector } = useViewStore();
  const { searchQuery, setSearchQuery } = useFilterStore();
  const { setItems, loadItems } = useItemStore();
  const activeLib = libraries.find((l) => l.id === activeLibraryId);

  // Map gridSize (100-400) to zoom slider (10-100)
  const zoom = Math.round(((gridSize - 100) / 300) * 90 + 10);
  const handleZoomChange = (z: number) => {
    const size = Math.round(((z - 10) / 90) * 300 + 100);
    setGridSize(size);
  };

  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (!activeLibraryId) return;
      if (value.trim()) {
        invoke<SearchResult[]>('search_items_cmd', {
          libraryId: activeLibraryId,
          query: value,
          limit: 100,
        })
          .then((results) => setItems(results.map((r) => r.item), results.length))
          .catch((e) => useUiStore.getState().setError(String(e)));
      } else {
        loadItems(
          activeLibraryId,
          {},
          { field: 'created_at', direction: 'desc' },
          { page: 0, page_size: 100 },
        );
      }
    },
    [activeLibraryId, setSearchQuery, setItems, loadItems],
  );

  return (
    <div className="h-14 border-b border-gray-200 bg-[#F6F6F6] flex items-center px-4 justify-between shrink-0">
      {/* Left: Traffic Lights & Nav */}
      <div className="flex items-center gap-6 w-64 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
          <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
        </div>
        <div className="flex items-center gap-3 text-gray-500">
          <SidebarIcon size={18} className="hover:text-gray-800 cursor-pointer" onClick={toggleSidebar} />
          <div className="flex items-center gap-1">
            <ChevronLeft size={20} className="text-gray-400" />
            <ChevronRight size={20} className="text-gray-400" />
          </div>
        </div>
      </div>

      {/* Center: View Controls */}
      <div className="flex items-center justify-center flex-1">
        <div className="flex items-center bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1 ${viewMode === 'grid' ? 'bg-gray-100 text-gray-700' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 border-l border-gray-200 ${viewMode === 'list' ? 'bg-gray-100 text-gray-700' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <List size={16} />
          </button>
        </div>
        <div className="mx-4 text-[13px] font-medium text-gray-700">
          {activeLib ? activeLib.name : 'Shark'}
        </div>
        <div className="flex items-center gap-2 w-32">
          <ImageIcon size={14} className="text-gray-400" />
          <input
            type="range"
            min="10"
            max="100"
            value={zoom}
            onChange={(e) => handleZoomChange(Number(e.target.value))}
            className="w-full accent-blue-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <ImageIcon size={18} className="text-gray-400" />
        </div>
      </div>

      {/* Right: Search & Actions */}
      <div className="flex items-center gap-3 w-72 justify-end shrink-0">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-8 pr-3 py-1 text-[13px] bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
        </div>
        <button className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-md">
          <SlidersHorizontal size={16} />
        </button>
        <ImportButton />
      </div>
    </div>
  );
}
```

**Step 2: Verify toolbar renders correctly**

Run: `npm run dev` — toolbar should show traffic lights, grid/list toggle, zoom slider, search, all in light theme.

**Step 3: Commit**

```bash
git add src/components/Toolbar/Toolbar.tsx
git commit -m "feat: rewrite Toolbar in reference light theme style"
```

---

### Task 5: Restyle ImportButton to match reference

**Files:**
- Modify: `src/components/Import/ImportButton.tsx`

**Step 1: Update ImportButton styles**

Change the button from the dark pill style to the reference's blue + icon style:

Replace the return JSX:
```tsx
return (
  <button
    onClick={handleImport}
    disabled={!activeLibraryId}
    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
    title="Import"
  >
    <Plus size={18} />
  </button>
);
```

Add the import: `import { Plus } from 'lucide-react';`

**Step 2: Commit**

```bash
git add src/components/Import/ImportButton.tsx
git commit -m "style: restyle ImportButton to light theme + icon"
```

---

### Task 6: Restyle Sidebar to light theme

**Files:**
- Modify: `src/components/Sidebar/Sidebar.tsx`
- Modify: `src/components/Sidebar/LibrarySelector.tsx`
- Modify: `src/components/Sidebar/FolderList.tsx`
- Modify: `src/components/Sidebar/SmartFolderList.tsx`
- Modify: `src/components/Sidebar/SidebarDropZone.tsx`

**Step 1: Update Sidebar.tsx container**

Change container from dark to light:
```tsx
<div className="w-64 bg-[#F6F6F6] border-r border-gray-200 flex flex-col overflow-y-auto pt-4 px-3 pb-4 shrink-0">
```

Remove SidebarDropZone (the drop zone is replaced by the full-app DropOverlay).

**Step 2: Restyle LibrarySelector.tsx**

Light theme dropdown and button:
- Container: remove `border-b border-neutral-700`, add `mb-4 px-1`
- Select: `w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-[13px] focus:outline-none focus:border-blue-500`
- Create button: `mt-1 text-xs text-blue-500 hover:text-blue-600 text-left`

**Step 3: Restyle FolderList.tsx**

Match reference's nav item style:
- Container: `flex-1 mb-6` (remove px-2 padding since sidebar has px-3)
- "All Items" button: active = `bg-[#0063E1] text-white`, inactive = `hover:bg-gray-200/50 text-gray-700`
- Folder buttons: same pattern
- Add lucide-react icons: `Folder, Image as ImageIcon, Tag, Star, Trash2, Clock` for nav items

For the nav items section, restructure to match the reference with a "Folders" section header:
```tsx
<div className="mb-2 flex items-center justify-between px-1">
  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Folders</span>
</div>
```

**Step 4: Restyle SmartFolderList.tsx**

Light theme styling:
- Container: remove `border-t border-neutral-700 pt-2 px-2`, use `mb-6`
- Section header: `text-[11px] font-semibold text-gray-400 uppercase tracking-wider`
- Active folder: `bg-[#0063E1] text-white` (instead of purple)
- Inactive: `hover:bg-gray-200/50 text-gray-700`
- Context menu: `bg-white border border-gray-200 rounded-lg shadow-lg`
- Context menu items: `text-gray-700 hover:bg-gray-100`

**Step 5: Update SidebarDropZone.tsx to light theme**

- Drag over: `border-blue-400 bg-blue-50 text-blue-500`
- Normal: `border-gray-300 text-gray-400`

**Step 6: Verify sidebar renders in light theme**

Run: `npm run dev` — sidebar should be light gray with blue active highlights.

**Step 7: Commit**

```bash
git add src/components/Sidebar/
git commit -m "feat: restyle Sidebar to light theme matching reference UI"
```

---

### Task 7: Restyle AssetCard to light theme

**Files:**
- Modify: `src/components/Grid/AssetCard.tsx`

**Step 1: Update AssetCard styles**

Match reference's card style:
- Outer: `group relative flex flex-col rounded-lg p-2 cursor-pointer transition-colors`
- Selected outer: `bg-blue-50`
- Unselected outer: `hover:bg-gray-50`
- Image container: `relative aspect-square rounded-md overflow-hidden bg-gray-100 mb-2 border`
- Selected border: `border-blue-500 ring-2 ring-blue-500/20`
- Unselected border: `border-gray-200 group-hover:border-gray-300`
- Ext badge: `absolute bottom-1 right-1 bg-black/60 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded`
- Title: `text-[12px] font-medium truncate text-gray-800` (selected: `text-blue-700`)
- Meta: `text-[11px] text-gray-400 flex justify-between mt-0.5`

Extract file extension from `item.file_name` for the badge:
```tsx
const ext = item.file_name.split('.').pop()?.toUpperCase() || '';
const dim = item.width && item.height ? `${item.width}x${item.height}` : '';
const size = item.file_size ? formatFileSize(item.file_size) : '';
```

Add a `formatFileSize` helper:
```tsx
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

**Step 2: Verify cards render with light styling**

Run: `npm run dev` — cards should have rounded corners, white/gray backgrounds, ext badges.

**Step 3: Commit**

```bash
git add src/components/Grid/AssetCard.tsx
git commit -m "feat: restyle AssetCard to light theme with ext badge"
```

---

### Task 8: Update VirtualGrid with filter bar

**Files:**
- Modify: `src/components/Grid/VirtualGrid.tsx`

**Step 1: Add filter bar above the grid**

Add lucide-react import: `import { ChevronDown } from 'lucide-react';`

Add a `FilterBar` component at the top of the grid container:

```tsx
{/* Filter Bar */}
<div className="h-10 border-b border-gray-100 flex items-center px-4 gap-4 text-[12px] text-gray-500 shrink-0">
  <div className="flex items-center gap-1 hover:text-gray-800 cursor-pointer">
    <span>Date Added</span>
    <ChevronDown size={14} />
  </div>
  <div className="flex items-center gap-1 hover:text-gray-800 cursor-pointer">
    <span>Types</span>
    <ChevronDown size={14} />
  </div>
  <div className="flex items-center gap-1 hover:text-gray-800 cursor-pointer">
    <span>Tags</span>
    <ChevronDown size={14} />
  </div>
</div>
```

**Step 2: Update container styles**

- Main container: `flex-1 flex flex-col bg-white overflow-hidden`
- Grid scroll area: `flex-1 overflow-y-auto p-4`
- Empty state text: `text-gray-500 text-sm`
- Welcome state: `text-gray-400`

**Step 3: Verify filter bar shows above grid**

Run: `npm run dev` — should see "Date Added", "Types", "Tags" filter pills above the grid.

**Step 4: Commit**

```bash
git add src/components/Grid/VirtualGrid.tsx
git commit -m "feat: add filter bar and light theme to VirtualGrid"
```

---

### Task 9: Build Inspector panel

**Files:**
- Modify: `src/components/Inspector/Inspector.tsx` (replace placeholder)

**Step 1: Build full Inspector component**

The Inspector shows details for the first selected item. It reads from `useItemStore` and `useViewStore`.

```tsx
import { useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useItemStore } from '@/stores/itemStore';
import { Plus } from 'lucide-react';
import type { Item } from '@/lib/types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function getExt(fileName: string): string {
  return fileName.split('.').pop()?.toUpperCase() || '';
}

export function Inspector() {
  const { items, selectedIds, thumbnailPaths } = useItemStore();

  // Get the first selected item
  const selectedItemId = selectedIds.values().next().value;
  const item = items.find((i) => i.id === selectedItemId) ?? null;
  const thumbnailPath = selectedItemId ? thumbnailPaths[selectedItemId] : undefined;

  if (!item) {
    return (
      <div className="w-72 bg-[#F6F6F6] border-l border-gray-200 shrink-0 flex items-center justify-center text-gray-400 text-[13px]">
        Select an item to inspect
      </div>
    );
  }

  const src = thumbnailPath
    ? (thumbnailPath.startsWith('data:') ? thumbnailPath : convertFileSrc(thumbnailPath))
    : item.file_path.startsWith('data:') ? item.file_path : convertFileSrc(item.file_path);
  const ext = getExt(item.file_name);
  const dim = item.width && item.height ? `${item.width}x${item.height}` : 'N/A';
  const size = formatFileSize(item.file_size);
  const tags = item.tags ? item.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

  return (
    <div className="w-72 bg-[#F6F6F6] border-l border-gray-200 flex flex-col overflow-y-auto shrink-0 text-[13px]">
      {/* Preview */}
      <div className="p-4 border-b border-gray-200 flex flex-col items-center justify-center bg-gray-50/50">
        <div className="w-full aspect-square rounded-lg overflow-hidden bg-white border border-gray-200 shadow-sm mb-3">
          <img src={src} alt={item.file_name} className="w-full h-full object-contain" />
        </div>
        <div className="font-medium text-gray-800 text-center break-words w-full">
          {item.file_name}
        </div>
        <div className="text-[11px] text-gray-500 mt-1">{size} &bull; {dim}</div>
      </div>

      {/* Properties */}
      <div className="p-4 space-y-5">
        {/* Title */}
        <div>
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Title</div>
          <input
            type="text"
            defaultValue={item.file_name.replace(/\.[^.]+$/, '')}
            className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-[13px] focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Notes */}
        <div>
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Notes</div>
          <textarea
            defaultValue={item.notes || ''}
            placeholder="Add a note..."
            className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-[13px] focus:outline-none focus:border-blue-500 min-h-[60px] resize-none"
          />
        </div>

        {/* Tags */}
        <div>
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Tags</span>
            <Plus size={12} className="cursor-pointer hover:text-gray-600" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="bg-gray-200/80 text-gray-700 px-2 py-0.5 rounded-md text-[12px]">
                {tag}
              </span>
            ))}
            {tags.length === 0 && (
              <span className="border border-dashed border-gray-300 text-gray-400 px-2 py-0.5 rounded-md text-[12px] cursor-pointer hover:bg-gray-100">
                Add Tag...
              </span>
            )}
          </div>
        </div>

        {/* Information */}
        <div>
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Information</div>
          <div className="space-y-2 text-[12px]">
            <div className="flex justify-between">
              <span className="text-gray-500">Format</span>
              <span className="text-gray-800">{ext} Image</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Dimensions</span>
              <span className="text-gray-800">{dim}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Size</span>
              <span className="text-gray-800">{size}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date Added</span>
              <span className="text-gray-800">{formatDate(item.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Modified</span>
              <span className="text-gray-800">{formatDate(item.modified_at)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify Inspector shows selected item details**

Run: `npm run dev` — click an item, Inspector should show preview, title, tags, file info.

**Step 3: Commit**

```bash
git add src/components/Inspector/Inspector.tsx
git commit -m "feat: add Inspector panel with preview, tags, and file info"
```

---

### Task 10: Restyle modals to light theme

**Files:**
- Modify: `src/components/Sidebar/CreateLibraryModal.tsx`
- Modify: `src/components/Sidebar/SmartFolderEditor.tsx`
- Modify: `src/components/Import/DedupDialog.tsx`

**Step 1: Restyle CreateLibraryModal**

Replace dark theme classes with light:
- Backdrop: `bg-black/30` (lighter)
- Modal: `bg-white rounded-lg p-5 w-96 shadow-xl border border-gray-200`
- Title: `text-base font-semibold mb-4 text-gray-800`
- Labels: `text-sm text-gray-500 mb-1`
- Inputs: `bg-white border border-gray-200 rounded px-2.5 py-1.5 text-sm text-gray-800 focus:border-blue-500 focus:outline-none`
- Browse button: `px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm border border-gray-200`
- Cancel: `text-gray-500 hover:text-gray-800`
- Create button: `bg-blue-600 hover:bg-blue-700 text-white rounded` (keep)

**Step 2: Restyle SmartFolderEditor**

Same pattern — replace all dark classes:
- Backdrop: `bg-black/30`
- Modal: `bg-white border border-gray-200 rounded-lg shadow-xl`
- Title: `text-gray-800`
- Labels: `text-gray-500`
- Inputs/selects: `bg-white border border-gray-200 text-gray-800`
- Cancel: `text-gray-500 hover:text-gray-800`
- Save: `bg-blue-600 text-white hover:bg-blue-500`

**Step 3: Restyle DedupDialog**

- Backdrop: `bg-black/30`
- Modal: `bg-white rounded-lg p-5 w-[520px] shadow-xl border border-gray-200`
- Title: `text-gray-800`
- Existing/New cards: `bg-gray-50 border border-gray-200 rounded-lg p-3`
- Card labels: `text-gray-500`
- Card filenames: `text-gray-800`
- Checkbox: `rounded border-gray-300`
- Skip All: `text-gray-500 hover:text-gray-800`
- Skip: `bg-gray-100 hover:bg-gray-200 rounded text-gray-700`
- Keep Both: `bg-blue-600 hover:bg-blue-700 text-white rounded`

**Step 4: Verify all modals look correct in light theme**

Run: `npm run dev` — test creating a library, creating a smart folder.

**Step 5: Commit**

```bash
git add src/components/Sidebar/CreateLibraryModal.tsx src/components/Sidebar/SmartFolderEditor.tsx src/components/Import/DedupDialog.tsx
git commit -m "style: restyle all modals to light theme"
```

---

### Task 11: Restyle remaining overlay components

**Files:**
- Modify: `src/components/Import/ImportProgress.tsx`
- Modify: `src/components/Import/DropOverlay.tsx`
- Modify: `src/components/Viewer/ImageViewer.tsx`

**Step 1: Restyle ImportProgress**

```tsx
<div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2.5 z-50 shadow-lg">
  <div className="flex items-center gap-3">
    <span className="text-sm text-gray-700 whitespace-nowrap">Importing…</span>
    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div className="h-full bg-blue-500 rounded-full transition-all duration-150" style={{ width: `${pct}%` }} />
    </div>
    <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap">{current}/{total}</span>
  </div>
</div>
```

**Step 2: Restyle DropOverlay**

```tsx
<div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-blue-500/5 border-4 border-dashed border-blue-400/60">
  <div className="bg-white/90 backdrop-blur-sm rounded-xl px-8 py-6 flex flex-col items-center gap-3 shadow-lg border border-blue-200">
    <svg className="w-12 h-12 text-blue-500" ...>...</svg>
    <span className="text-lg font-medium text-blue-600">Drop to import</span>
  </div>
</div>
```

**Step 3: ImageViewer stays mostly dark (fullscreen overlay) but update text colors**

The viewer is a fullscreen dark overlay — this is fine. Minor tweaks:
- Bottom bar text: keep `text-neutral-300` / `text-neutral-500` (dark overlay context)

No changes needed for ImageViewer.

**Step 4: Commit**

```bash
git add src/components/Import/ImportProgress.tsx src/components/Import/DropOverlay.tsx
git commit -m "style: restyle overlay components to light theme"
```

---

### Task 12: Final polish and verification

**Step 1: Run the dev server and visually verify everything**

Run: `npm run dev`

Check:
- [ ] White background, macOS-style scrollbars
- [ ] Toolbar: traffic lights, grid/list toggle, zoom slider, search, + button
- [ ] Sidebar: light gray bg, blue active items, section headers
- [ ] Grid: filter bar, white bg, rounded cards with ext badges
- [ ] Inspector: shows on item select, preview/tags/info
- [ ] Modals: white bg, gray borders
- [ ] Import progress: light theme
- [ ] Drop overlay: light theme

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "style: final UI migration polish"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Install lucide-react | `package.json` |
| 2 | Global styles | `src/main.css` |
| 3 | App shell layout | `src/App.tsx`, `src/stores/viewStore.ts` |
| 4 | Toolbar rewrite | `src/components/Toolbar/Toolbar.tsx` |
| 5 | ImportButton restyle | `src/components/Import/ImportButton.tsx` |
| 6 | Sidebar restyle | `src/components/Sidebar/*` |
| 7 | AssetCard restyle | `src/components/Grid/AssetCard.tsx` |
| 8 | VirtualGrid filter bar | `src/components/Grid/VirtualGrid.tsx` |
| 9 | Inspector panel | `src/components/Inspector/Inspector.tsx` |
| 10 | Modals restyle | `CreateLibraryModal`, `SmartFolderEditor`, `DedupDialog` |
| 11 | Overlays restyle | `ImportProgress`, `DropOverlay` |
| 12 | Final polish | All |
