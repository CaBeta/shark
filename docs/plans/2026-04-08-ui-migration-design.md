# Shark UI Migration Design

**Date:** 2026-04-08
**Goal:** Migrate Shark's UI from the current dark theme to a macOS-inspired light theme, matching the reference UI (shark_UI) exactly.

## Reference UI Layout

```
┌──────────────────────────────────────────────────────────┐
│ Toolbar: [traffic lights] [sidebar/nav] | [grid/list] [zoom] | [search] [filter] [+] │
├──────────┬───────────────────────────────────┬───────────┤
│ Sidebar  │ Filter Bar: Date|Types|Tags|...   │ Inspector │
│ w-64     │ Grid: rounded cards w/ ext badges │ w-72      │
│ #F6F6F6  │ white bg                          │ #F6F6F6   │
│          │                                   │ Preview   │
│ All      │                                   │ Title     │
│ Uncat.   │                                   │ Notes     │
│ Untagged │                                   │ Tags      │
│ Random   │                                   │ Colors    │
│ Trash    │                                   │ Info      │
│          │                                   │           │
│ Smart    │                                   │           │
│ Folders  │                                   │           │
│          │                                   │           │
│ Folders  │                                   │           │
└──────────┴───────────────────────────────────┴───────────┘
```

## Scope

### Changes

| Component | Current | Target |
|-----------|---------|--------|
| App shell | `bg-neutral-900 text-white` | `bg-white text-gray-800` |
| Toolbar | Dark, minimal controls | Light `#F6F6F6`, traffic lights (decorative), grid/list toggle, zoom slider, search, filter btn, + btn |
| Left Sidebar | Dark `bg-neutral-800`, w-56 | Light `#F6F6F6`, w-64, active items with blue `#0063E1` bg |
| Grid area | Dark cards, virtual grid | White bg, filter bar, rounded cards with ext badge overlay |
| Inspector | Does not exist | New right sidebar w-72 with preview/tags/info |
| Modals | Dark theme | Light theme |

### Preserved (No functional changes)

- All Tauri `invoke` calls and backend integration
- All Zustand stores (view, filter, item, library, UI, smart folder)
- Import flow (drag-drop, dedup dialog, progress)
- Smart folder system (editor, context menus)
- Library selector
- Virtual grid rendering (tanstack-virtual)
- Double-click to open full viewer

### New dependency

- `lucide-react` for icons (matches reference UI)

## Component Breakdown

### 1. `main.css`
- macOS-style scrollbar (thin, transparent track, rounded thumb)
- Font: system font stack (-apple-system, SF Pro Text, Segoe UI)
- Body: `overflow: hidden`, white background

### 2. `Toolbar` — Full restyle
- Height 56px, `bg-[#F6F6F6]`, border-b
- Left section: decorative traffic lights, sidebar toggle, nav arrows
- Center: grid/list toggle buttons, item count label, zoom slider
- Right: search input, filter button (SlidersHorizontal), add button (+)
- Uses lucide-react icons

### 3. `Sidebar` — Restyle to light theme
- Width 264px (w-64), `bg-[#F6F6F6]`
- LibrarySelector stays at top (restyled)
- Nav items: All Items, Uncategorized, Untagged, Random, Trash
- Smart Folders section with + button
- Folders section with search + + buttons
- Active item: `bg-[#0063E1] text-white`
- Inactive item: `hover:bg-gray-200/50 text-gray-700`
- Section headers: 11px uppercase gray-400

### 4. `AssetCard` — Rounded cards
- Rounded-lg, padding 8px
- Aspect-square image container, `bg-gray-100`
- Selected: `bg-blue-50`, border-blue-500, ring-2
- Hover: `bg-gray-50`, border-gray-300
- Ext badge: bottom-right overlay, `bg-black/60 backdrop-blur-sm`
- Title: 12px, gray-800
- Meta line: dimensions + size

### 5. `VirtualGrid` — Add filter bar, white bg
- Filter bar: 40px height, border-b, filter pills (Date Added, Types, Tags, Colors, Shapes) with chevron
- Grid area: white bg, padding, CSS grid with responsive columns based on zoom
- Keep tanstack-virtual for performance

### 6. `Inspector` — New component
- Width 288px (w-72), `bg-[#F6F6F6]`, border-l
- Preview section: aspect-square image in white card, filename + size/dim below
- Properties section:
  - Title input (editable)
  - Notes textarea (editable)
  - Tags: chips + "Add Tag..." button
  - Colors: color swatches
  - Information: Format, Dimensions, Size, Date Added, Modified
- Shows when an item is selected; empty state when nothing selected

### 7. `App.tsx` — 3-column layout
- `<div className="h-screen w-screen flex flex-col bg-white ...">`
- Toolbar on top
- Flex row: Sidebar | MainContent (VirtualGrid + filter bar) | Inspector

### 8. Modals — Light theme restyle
- CreateLibraryModal: white bg, gray borders
- SmartFolderEditor: white bg, gray borders
- DedupDialog: white bg, gray borders

### 9. Traffic Lights
- Decorative macOS-style dots (red/yellow/green) in toolbar
- Tauri handles actual window controls
- Visual element only for brand consistency

## Data Flow

No changes to data flow. The Inspector reads from existing stores:
- `useItemStore` — selected item data, thumbnail paths
- `useUiStore` — could add a `selectedItemId` for Inspector, or reuse the click-to-select pattern

The filter bar in the grid area will be a placeholder UI initially (the filter dropdowns don't need to be functional yet — they match the reference's visual but backend filter logic already exists via `filterStore`).

## Implementation Order

1. Install lucide-react
2. Update `main.css` (scrollbar, fonts, base styles)
3. Update `App.tsx` (light shell, 3-column layout)
4. Rewrite `Toolbar`
5. Restyle `Sidebar` + sub-components
6. Restyle `AssetCard`
7. Update `VirtualGrid` (add filter bar)
8. Create `Inspector` component
9. Restyle modals (CreateLibraryModal, SmartFolderEditor, DedupDialog)
10. Restyle remaining components (ImportProgress, DropOverlay, ImageViewer)
