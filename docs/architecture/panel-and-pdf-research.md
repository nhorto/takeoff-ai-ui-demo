# Panel System & PDF Viewer Research

_Last updated: 2026-04-16._

Research into two capabilities for the workbench: (1) VS Code-style draggable/splittable tab panels, and (2) PDF viewing with annotation for architectural drawings.

---

## Part 1: Draggable / Splittable Tab Panels

Goal: VS Code-style tabs that can be reordered, dragged to split left/right/top/bottom, and resized. Arbitrary React content per panel (stair editors, PDF drawings, etc.).

### Option A: dockview-react ⭐ Recommended

| | |
|---|---|
| **Stars** | ~3,100 |
| **Downloads** | ~48K/week |
| **Last updated** | Apr 2026 (v5.2.0) |
| **Bundle** | ~392 KB (zero runtime deps) |
| **License** | MIT |

**Pros:**
- Purpose-built for VS Code/IDE workbench layouts — closest match to what we want
- Full feature set: tabs, drag-to-split, floating panels, popout windows, tab reorder
- Zero external dependencies
- Layout state serializable via `toJSON()`/`fromJSON()` — can persist to localStorage
- Written in TypeScript, ships types
- Very actively maintained (updated 2 days ago)
- Dark/light themes via CSS classes

**Cons:**
- Imperative API (`api.addPanel()`) rather than declarative JSX children
- Components registered by name in a map, not passed as JSX
- Relatively newer community (3K stars vs FlexLayout's longer track record)

---

### Option B: flexlayout-react — Strong Alternative

| | |
|---|---|
| **Stars** | ~1,280 |
| **Downloads** | ~54K/week (highest) |
| **Last updated** | Mar 2026 (v0.8.19) |
| **Bundle** | ~522 KB (zero runtime deps) |
| **License** | ISC (MIT-compatible) |

**Pros:**
- Most downloaded docking library — battle-tested
- 6 built-in themes (light, dark, underline, gray, rounded, combined)
- "Border tabsets" feature maps to VS Code sidebar/bottom panel areas
- JSON model-based API — define layout as JSON config
- Supports popout windows, tab overflow menus
- Works with React 18 and 19

**Cons:**
- Still on v0.x despite years of development
- No floating panels
- JSON model is mutable (call actions on it, not React state)
- Higher learning curve — model schema (nodes, tabsets, borders) takes getting used to

---

### Option C: react-mosaic — Not Recommended for Our Use Case

| | |
|---|---|
| **Stars** | ~4,000 |
| **Downloads** | ~48K/week |
| **Last updated** | Apr 2026 (v7 beta) |
| **Bundle** | ~404 KB |
| **License** | Apache-2.0 |

**Pros:**
- Used in Apache Superset
- Good tiling window manager

**Cons:**
- **No tabs within panels** — strictly tiled, not docked
- No floating panels
- Heavy deps (react-dnd, lodash-es, uuid, etc.)
- Blueprint.js default theming pulls in large CSS framework
- Different mental model (tiling WM, not VS Code)

---

### Option D: allotment — Split Panes Only (Complement, Not Standalone)

| | |
|---|---|
| **Stars** | ~1,240 |
| **Downloads** | ~162K/week |
| **Bundle** | ~206 KB |
| **License** | MIT |

**Pros:**
- Derived from VS Code's actual split view source code
- Simplest API: `<Allotment><Allotment.Pane>...</Allotment.Pane></Allotment>`
- Smallest bundle, zero deps

**Cons:**
- **No tabs, no drag-to-dock, no drag-to-split** — only resizable dividers
- Would need to combine with a tab library
- Cannot dynamically add/remove panes via drag

---

### Option E: rc-dock — Niche

~770 stars, ~5K downloads, v4 in alpha. Capable but small community and alpha-state v4 are risks. Skip.

### Option F: golden-layout — Dead for React

~6,650 stars but last updated Feb 2023. No official React wrapper. Maintainers themselves recommend FlexLayout for React. Skip.

### Panel Recommendation

**Use dockview-react.** It's the only library explicitly designed for the VS Code workbench pattern. Zero deps, MIT, active maintenance, serializable layouts. The imperative API is a minor trade-off for getting the exact UX we want out of the box.

FlexLayout is a solid fallback if dockview has issues in practice.

---

## Part 2: PDF Viewer with Annotation

Goal: View architectural drawing PDFs with smooth pan/zoom (scroll wheel + click-drag), basic annotation (text comments, colored highlights/rectangles), annotations stored as JSON in localStorage.

### Option A: @react-pdf-viewer/core + fabric.js overlay ⭐ Recommended

**PDF layer — react-pdf-viewer:**

| | |
|---|---|
| **Stars** | ~2,200 |
| **Bundle** | ~80 KB + pdfjs-dist worker (~350 KB) |
| **License** | MIT |

- Plugin architecture: zoom, scroll, page navigation, search, thumbnails
- Built-in page virtualization for large PDFs
- Smooth zoom controls (toolbar buttons, keyboard, pinch)
- TypeScript, React 18 compatible

**Annotation layer — fabric.js:**

| | |
|---|---|
| **Stars** | ~29,000 |
| **Bundle** | ~100 KB min+gzip |
| **License** | MIT |

- Object model: rectangles, text, freehand paths — each is a serializable object
- Built-in selection, moving, resizing of annotations
- `canvas.toJSON()` / `canvas.loadFromJSON()` maps directly to localStorage
- Color, opacity, stroke width on every object
- Event system for auto-persisting changes

**How it works together:**
```
┌─────────────────────────────────┐
│  Container (position: relative) │
│  ┌───────────────────────────┐  │
│  │  PDF Canvas Layer         │  │  ← react-pdf-viewer renders here
│  │  (pointer-events: none    │  │
│  │   when annotating)        │  │
│  ├───────────────────────────┤  │
│  │  Annotation Canvas Layer  │  │  ← fabric.js canvas overlay
│  │  (position: absolute,     │  │
│  │   same dimensions)        │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Pros:**
- react-pdf-viewer handles the hard PDF stuff (virtualization, zoom, navigation)
- fabric.js handles annotation with minimal code
- Clean JSON serialization for localStorage
- Total bundle: ~530 KB (reasonable)
- Full control over annotation UX

**Cons:**
- Must sync coordinates between PDF and annotation layers during pan/zoom (the hardest part)
- Must build toolbar UI (color picker, tool selection)
- ~1-2 weeks engineering for polished experience

---

### Option B: raw pdfjs-dist + react-konva

**PDF layer — pdfjs-dist (Mozilla):**

| | |
|---|---|
| **Stars** | ~50,000 (Mozilla project) |
| **Bundle** | ~350 KB |
| **License** | Apache 2.0 |

- Maximum control over rendering pipeline
- Direct canvas transform manipulation for smoothest possible pan/zoom
- Can implement tile-based rendering for very large architectural pages
- Worker thread handles PDF parsing off-main-thread

**Annotation layer — react-konva:**

| | |
|---|---|
| **Stars** | ~11,000 |
| **License** | MIT |

- Declarative React components: `<Rect>`, `<Text>`, `<Group>`
- Fits React patterns better than fabric.js's imperative API
- Built-in drag, resize, transform
- JSON serialization

**Pros:**
- Best possible pan/zoom quality — full control of transform matrix
- Declarative annotations fit React model
- Smallest total dependency footprint

**Cons:**
- Must build everything: page virtualization, zoom controls, page navigation, toolbar
- ~3-4 weeks engineering
- Must handle memory management (page.cleanup(), document.destroy())

---

### Option C: react-pdf (wojtekmaj) + fabric.js

| | |
|---|---|
| **Stars** | ~9,200 |
| **Bundle** | ~45 KB + worker |
| **License** | MIT |

**Pros:**
- Most popular React PDF component
- Simple declarative API: `<Document file={url}><Page /></Document>`

**Cons:**
- **No built-in pan/zoom** — renders static pages, you build the interaction
- **No page virtualization** — must implement yourself for large documents
- **No toolbar, navigation, search** — all custom
- Re-renders entire canvas on scale change (janky without debouncing)

**Verdict:** Worse than react-pdf-viewer in every way for our use case. Skip.

---

### Option D: PSPDFKit (commercial)

| | |
|---|---|
| **Bundle** | ~10-15 MB (WASM) |
| **License** | Commercial, ~$3-5K/year |

**Pros:**
- **Everything built-in**: highlights, rectangles, freehand, text, stamps, arrows, measurement tools
- Measurement tools directly relevant to construction estimating
- Excellent pan/zoom (hardware-accelerated WASM renderer)
- Annotation export as JSON (Instant JSON format)
- Handles massive PDFs (WASM faster than PDF.js for complex drawings)

**Cons:**
- $3-5K/year cost
- 10-15 MB initial download (WASM binary)
- Vendor lock-in
- Proprietary annotation format
- Overkill if we only need basic rectangles and text

**Verdict:** Best if budget allows and you want measurement tools. Otherwise too expensive and heavy for our current needs.

---

### Option E: pdf-annotate.js — Dead

Last commit 2019, incompatible with modern PDF.js. Do not use.

---

### PDF Recommendation

**Use @react-pdf-viewer/core + fabric.js overlay.** This gets us:
- Good PDF viewing out of the box (zoom, scroll, virtualization, search)
- Custom annotations with full control over the UX and data model
- Clean JSON persistence to localStorage
- ~530 KB total bundle
- ~1-2 weeks to build the annotation toolbar and coordinate sync

If we find the coordinate sync between layers too painful, fall back to **raw pdfjs-dist + react-konva** for maximum control (at the cost of more engineering).

If we later need measurement tools (area, distance, perimeter), revisit PSPDFKit or Apryse.

---

## Combined Architecture

```
┌─────────────────────────────────────────────────────┐
│  dockview-react (panel/tab system)                  │
│  ┌──────────────────────┬──────────────────────────┐│
│  │  Tab: Flight 1       │  Tab: Drawing Sheet A1   ││
│  │  ┌────────────────┐  │  ┌────────────────────┐  ││
│  │  │ Stair Editor   │  │  │ react-pdf-viewer   │  ││
│  │  │ (existing)     │  │  │ + fabric.js overlay │  ││
│  │  │                │  │  │ (pan/zoom/annotate) │  ││
│  │  └────────────────┘  │  └────────────────────┘  ││
│  └──────────────────────┴──────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

Dockview manages the layout. Users drag tabs to split side-by-side. PDF viewer + annotations live in one panel type. Stair editors live in another. Layout state persisted to localStorage via dockview's `toJSON()`.
