# Shark Design System — macOS Style

All frontend UI must follow this document. The design target is a native **macOS** look & feel: clean, light, subtle shadows, system fonts, rounded corners, and minimal decoration.

---

## Typography

| Role        | Size      | Weight       | Color     |
|-------------|-----------|--------------|-----------|
| Page title  | 17px      | semibold     | #1D1D1F   |
| Section head| 13px      | semibold     | #1D1D1F   |
| Body        | 13px      | regular      | #333333   |
| Secondary   | 12px      | regular      | #666666   |
| Caption     | 11px      | regular      | #999999   |

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

---

## Color Palette

### Surface & Background

| Token            | Value     | Usage                            |
|------------------|-----------|----------------------------------|
| bg-primary       | #FFFFFF   | Main content area                |
| bg-secondary     | #F6F6F6   | Sidebars, secondary panels       |
| bg-tertiary      | #F0F0F0   | Hover states on secondary bg     |
| bg-hover         | #ECECEC   | Hover on list items              |
| bg-selected      | #EBF5FF   | Selected item highlight          |
| bg-overlay       | #000000/30| Modal backdrop                   |
| bg-full-overlay  | #000000/95| Full-screen lightbox backdrop    |

### Text

| Token            | Value     | Usage                            |
|------------------|-----------|----------------------------------|
| text-primary     | #1D1D1F   | Headings, primary labels         |
| text-default     | #333333   | Body text                        |
| text-secondary   | #666666   | Secondary / description text     |
| text-tertiary    | #999999   | Placeholder, hint text           |
| text-disabled    | #C7C7CC   | Disabled element text            |

### Borders

| Token            | Value     | Usage                            |
|------------------|-----------|----------------------------------|
| border-default   | #E5E5E5   | Default borders                  |
| border-light     | #F0F0F0   | Subtle dividers                  |
| border-focus     | #0063E1   | Input focus ring                 |
| border-selected  | #0063E1   | Selected item border             |

### Accent (System Blue)

| Token            | Value     | Usage                            |
|------------------|-----------|----------------------------------|
| accent           | #0063E1   | Primary actions, links, focus    |
| accent-hover     | #0052CC   | Hover state on accent            |
| accent-light     | #EBF5FF   | Light accent background          |

### Semantic

| Token            | Value     | Usage                            |
|------------------|-----------|----------------------------------|
| error            | #FF3B30   | Error states                     |
| warning          | #FF9500   | Warning states                   |
| success          | #34C759   | Success states                   |

### Traffic Lights (Window Controls)

| Color   | Value     |
|---------|-----------|
| Red     | #FF5F56   |
| Yellow  | #FFBD2E   |
| Green   | #27C93F   |

---

## Spacing

Base unit: 4px

| Token    | Value | Usage                              |
|----------|-------|------------------------------------|
| xs       | 4px   | Tight inner spacing                |
| sm       | 8px   | Inner padding, icon gaps           |
| md       | 12px  | Standard element spacing           |
| lg       | 16px  | Section padding, card gaps         |
| xl       | 24px  | Panel padding                      |
| 2xl      | 32px  | Container padding                  |

---

## Border Radius

| Token          | Value  | Usage                           |
|----------------|--------|---------------------------------|
| sm             | 4px    | Tags, badges                    |
| md             | 6px    | Buttons, inputs, cards          |
| lg             | 10px   | Modals, panels                  |
| xl             | 14px   | Large containers                |
| full           | 9999px | Pills, scrollbars, avatars      |

---

## Shadows

macOS uses soft, layered shadows. Avoid hard drop shadows.

```css
/* Subtle elevation — cards, dropdowns */
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06);

/* Standard elevation — modals, popovers */
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08);

/* High elevation — full-screen overlays, dialog stacks */
--shadow-lg: 0 8px 30px rgba(0, 0, 0, 0.15), 0 4px 8px rgba(0, 0, 0, 0.1);
```

---

## Components

### Buttons

**Primary (filled)**
```
bg-accent text-white rounded-md px-4 py-1.5 text-[13px] font-medium
hover:bg-accent-hover active:bg-[#003FA3]
disabled:opacity-40 disabled:cursor-not-allowed
transition-colors duration-150
```

**Secondary (outlined/ghost)**
```
bg-gray-100 text-gray-700 rounded-md px-3 py-1.5 text-[13px] font-medium
hover:bg-gray-200 active:bg-gray-300
transition-colors duration-150
```

**Icon button**
```
p-1.5 text-gray-500 rounded-md
hover:bg-gray-200 hover:text-gray-700
disabled:opacity-40 disabled:cursor-not-allowed
transition-colors duration-150
```

### Inputs

**Text input**
```
w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md text-[13px]
focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none
placeholder:text-tertiary
```

**Select**
```
w-full bg-white border border-gray-200 rounded-md px-2 py-1.5 text-[13px]
focus:border-accent focus:outline-none
```

### Cards / Grid Items

```
border border-gray-200 rounded-md bg-white
hover:bg-gray-50
selected: bg-accent-light border-accent ring-2 ring-accent/20
```

### Modals

**Backdrop:** `fixed inset-0 z-50 bg-overlay`

**Container:**
```
bg-white rounded-lg shadow-lg border border-gray-200
p-5 max-w-sm w-full
```

**Header:** Title in `text-lg font-semibold text-primary`, close button top-right.

**Footer:** Buttons right-aligned with gap-3.

### Sidebar / Panels

```
bg-secondary border-r border-gray-200
```

Panel headings: `text-[11px] font-semibold uppercase tracking-wider text-tertiary`

### Scrollbar

Custom macOS-style scrollbar (thin, semi-transparent, rounded):

```css
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border: 3px solid transparent;
  background-clip: padding-box;
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.3); }
```

### Progress Bar

```
h-1.5 bg-gray-200 rounded-full overflow-hidden
fill: h-full bg-accent rounded-full transition-all duration-150
```

### Tags / Badges

```
px-2 py-0.5 rounded-full text-[11px] font-medium
variants: bg-accent-light text-accent / bg-gray-100 text-gray-600
```

---

## Layout

- **App shell:** `h-screen w-screen flex flex-col overflow-hidden`
- **Three-panel:** Sidebar (fixed width) | Main grid (flex-1) | Inspector (fixed width)
- **Dividers:** 1px `border-gray-200` (no thick separators)
- **Resizable panels:** via drag handle on border

---

## Transitions & Animation

- **Default:** `transition-colors duration-150` (hover, focus, state changes)
- **No complex animations** — macOS favors instant or very subtle transitions
- **Opacity transitions** for loading states: `transition-opacity duration-200`

---

## Icons

- **Library:** Lucide React
- **Sizes:** 14px (inline), 16px (buttons), 18px (standalone)
- **Color:** Inherits text color; use `text-secondary` for inactive, `text-accent` for active

---

## General Principles

1. **Light & airy** — generous whitespace, minimal borders
2. **Native feel** — system fonts, macOS color tokens, subtle shadows
3. **Restraint** — no gradients, no heavy shadows, no decorative elements
4. **Consistency** — same spacing scale, same radius tokens, same interaction patterns everywhere
5. **Accessibility** — focus rings on all interactive elements, sufficient contrast
6. **No emoji in UI** — use icons from Lucide instead
