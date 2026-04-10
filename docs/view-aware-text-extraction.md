# View-Aware Text Extraction

## Background

The current text extraction pipeline (`pdf-text-extractor.ts`) uses pdfjs-dist to extract every text item from a PDF page with exact x,y coordinates. It then presents this data to the agent in one of two formats:

- **"rows"**: Groups text items by Y-coordinate (3px tolerance), sorted top-to-bottom. Each row shows items joined with `|` separators. Includes a Y coordinate per row but no X coordinates for individual items.
- **"compact"**: Groups text into broad spatial zones (top-left, top-right, bottom-left, bottom-right, title-block, center).

Neither format tells the agent **which drawing view** a piece of text belongs to.

### Why This Is a Problem

Construction drawing sheets typically show the same stair in **multiple views** on a single page:

- **Section view** — full vertical cut showing all flights, risers, stringer lengths, flight rises
- **Plan views** — top-down view of the stair at each level, showing width, landing dimensions, rail configurations
- **Detail callouts** — enlarged details of connections, tread profiles, etc.

A typical stair sheet might have 1 section view + 9 plan views (one per level) on a single page. Each plan view has its own dimensions, and **landing dimensions can vary by level**.

With the current pipeline, all text from all views is dumped into a flat list of rows sorted by Y. The agent cannot tell:
- Which dimensions belong to which level
- Which text came from the section view vs a plan view
- Whether a dimension like `5'-0"` is a landing length at Level 03 or Level 05

The existing dedup clustering only looks at riser/tread annotations and tells the agent to "ignore secondary clusters." But going forward, we need ALL views — we just need the agent to know which view each measurement belongs to.

---

## What We Need to Count

Every stair takeoff must extract all of the following:

| # | Component | Primary Source View |
|---|-----------|-------------------|
| 1 | Treads (count per flight) | Section view |
| 2 | Risers (count per flight) | Section view |
| 3 | Number of flights | Section view |
| 4 | Stringer length per flight (= rail length) | Section view |
| 5 | Width of stair | Plan views |
| 6 | Number of landings | Section + plan views |
| 7 | Landing length (direction of travel) per level | Plan views |
| 8 | Landing depth (perpendicular to travel) per level | Plan views |
| 9 | Rails (count per flight) | Plan views + details |

**Key insight**: Landing dimensions can differ by level. The Level 03 landing might be 5'-0" x 4'-2" while Level 06 is 5'-6" x 4'-6". The agent must know which measurements belong to which level. This requires reading each plan view independently.

---

## Proposed Solution: View-Aware Extraction

### Core Idea

Instead of dumping all text in flat rows, **spatially cluster text items into drawing views** and present them to the agent organized by view. Each view gets:
1. A label (view title if found, otherwise positional like "upper-left view")
2. All text items within that view, organized by row
3. A high-resolution cropped image of just that view

### How It Works

#### Step 1: Spatial Clustering of All Text Items

Construction drawings arrange views in a grid-like layout with clear whitespace gaps between views. We cluster ALL text items (not just riser/tread annotations) by finding natural spatial gaps:

- Sort all text items by X coordinate, find gaps > threshold (e.g., 8-10% of page width)
- Within each X-band, sort by Y and find gaps > threshold
- This produces rectangular clusters that correspond to individual drawing views

This is a generalization of the existing `clusterAnnotationsIntoViews()` which only clusters riser/tread annotations. The new version clusters everything.

#### Step 2: View Title Identification

Within each cluster, search for text that matches view title patterns:
- `"SECTION - STAIR N - LOOKING EAST/WEST/NORTH/SOUTH"`
- `"STAIR N - LEVEL NN IP PLAN"`
- `"STAIR N - LEVEL NN-NN IP PLAN"` (multi-level plans)
- Detail callout labels (numbered circles/bubbles with text)

View titles are typically found near the bottom of the view, but this is NOT guaranteed. The search should look at all text in the cluster, with preference for text near the bottom edge.

If no title pattern is found, label the view by position (e.g., "left-column view", "row-2-col-3 view").

#### Step 3: Bounding Box Calculation

For each cluster, compute the bounding box from the min/max x,y of all text items in that cluster, with padding to include the drawing border/frame.

These bounding boxes are in **PDF coordinate space** (points, 1/72 inch), which is the same coordinate system as:
- pdfjs-dist text item positions
- pdf-lib page dimensions

To convert to render pixel space for image cropping: `pixels = points × (dpi / 72)`

#### Step 4: Per-View Image Crops

Using each view's bounding box (converted to render pixel space), crop a high-resolution image of just that view from the PDF. This gives the agent a focused, readable image for each view rather than a full page where everything is tiny.

#### Step 5: Structured Output

Present the data to the agent organized by view:

```
=== Page 252: STAIR 2 ===

VIEW 1: "SECTION - STAIR 2 - LOOKING EAST" (section view)
  Bounding box: x=0-450, y=0-1200 (PDF points)
  [spatial-rows within this view]
    ROW y=45: 14 EQ RSRS 7'-0 7/8"
    ROW y=120: 12 EQ RSRS 6'-1 3/4"
    ...
  [cropped image of this section view]

VIEW 2: "STAIR 2 - LEVEL 03 IP PLAN" (plan view, Level 03)
  Bounding box: x=500-800, y=600-900 (PDF points)
  [spatial-rows within this view]
    ROW y=620: 5'-0"
    ROW y=640: 4'-2"
    ROW y=680: METAL PAN STAIRS
    ...
  [cropped image of Level 03 plan]

VIEW 3: "STAIR 2 - LEVEL 05 IP PLAN" (plan view, Level 05)
  Bounding box: x=500-800, y=300-600 (PDF points)
  [spatial-rows within this view]
    ROW y=320: 5'-6"
    ROW y=340: 4'-6"
    ...
  [cropped image of Level 05 plan]
```

### Coordinate Spaces

There are three coordinate spaces in play. Keeping them straight is critical:

| Space | Origin | Units | Source | Used For |
|-------|--------|-------|--------|----------|
| **PDF points** | Top-left* | Points (1/72 in) | pdfjs-dist getTextContent() | Text item positions, view bounding boxes |
| **Render pixels** | Top-left | Pixels | Canvas at DPI (scale = dpi/72) | Image cropping, extractPdfRegion() |
| **Overview image pixels** | Top-left | Pixels | Downscaled JPEG sent to agent | Agent's crop coordinates (current workflow) |

*Note: Native PDF uses bottom-left origin, but pdfjs-dist text extraction in our code already converts to top-left (y = pageHeight - translateY).

**Conversion: PDF points → Render pixels:** `px = pt × (dpi / 72)`

For view-aware extraction, we work entirely in **PDF points** for clustering and bounding boxes, then convert to **render pixels** only when cropping images. This avoids the coordinate mapping problem where the agent sees a downscaled image and gives coordinates in the wrong space — we compute everything ourselves.

---

## What Changes vs Current Architecture

### Replaces
- **Row-based flat text dump** → View-organized text
- **Riser/tread-only clustering** → All-text spatial clustering
- **Dedup guide ("ignore secondary clusters")** → All views identified and labeled, agent uses each for its purpose

### Keeps
- pdfjs-dist for text extraction (same extractAllPagesText pipeline)
- Image rendering via pdf.js canvas (same extractPdfRegion approach)
- Text item data structure (TextItem with x, y, fontSize, text)

### New
- General-purpose spatial clustering function
- View title pattern matching
- Per-view bounding box computation
- Automated per-view image cropping
- Structured per-view output format

---

## Impact on Agent Architecture

If view-aware extraction works well, it simplifies the agent architecture significantly:

**Before (specialist agents):**
- Discovery → Routing Layer → 4 specialist agents in parallel → Compilation → User Review
- Each specialist needs its own prompt, its own image inputs, cross-agent coordination

**After (single agent per stair with good input):**
- Discovery → View-aware extraction per stair → Single counting agent → User Review
- The agent gets well-organized text + images per view
- Most answers come directly from the OCR data
- Images are for confirmation / edge cases where text annotations are missing
- No routing layer needed — the views are already identified and organized

This is simpler, cheaper (one agent call instead of 4+), and more reliable (no cross-agent coordination failures).

The dedup concern for risers/treads remains — the section view and plan views may both label the same flights. But with view-aware output, the agent knows which view each annotation came from and can apply the rule: "use the section view for riser/tread counts, use plan views for width and landing dimensions."

---

## Edge Cases to Handle

1. **No view titles** — Some drawings don't label views. Cluster by spatial gaps and label by position.
2. **Views on adjacent pages** — Section view on page 250, plan views on page 251. Each page clusters independently; the agent correlates across pages.
3. **Irregular layouts** — Views not in a clean grid. Gap-based clustering should still work since views are separated by whitespace regardless of arrangement.
4. **No text annotations for some measurements** — Some drawings don't annotate treads/risers as text. The cropped image per view lets the agent visually count or measure.
5. **Very dense pages** — Many views close together. May need to tune gap thresholds or use adaptive thresholds based on page density.
6. **Title below vs beside vs above view** — Title search should check all text in the cluster, not assume bottom position.

---

## Adaptive Clustering: Agent-Guided View Detection (Future Option)

### The Overfitting Problem

The code-based clustering approaches (gap-based, title-anchored grid) rely on hardcoded heuristics:
- Gap thresholds as a percentage of page dimensions
- Title text pattern matching (SECTION, LEVEL XX PLAN, etc.)
- Row boundary bias percentages (85/15 split)
- Assumptions about grid regularity

These work well for the drawing sets we've tested, but construction drawings vary significantly between architectural firms, drawing scales, and project types. Any fixed set of thresholds will eventually fail on a layout we haven't seen.

### The Idea: Let the Agent Set the Boundaries

Instead of trying to handle every layout variation in code, use an LLM agent call to visually analyze the page layout and provide the view boundaries. The agent is naturally good at this — it can look at a drawing sheet and instantly see "there's a tall section view on the left and a grid of plan views on the right." That visual understanding is very hard to replicate in pure code but trivial for the agent.

### How It Would Work

```
┌─────────────────────────────────────────────────────────────┐
│  1. Render low-res overview of the page (cheap, ~100 tokens)│
│                                                             │
│  2. Send to agent with prompt:                              │
│     "Identify each drawing view on this sheet.              │
│      For each view, provide:                                │
│      - type: section / plan / detail / other                │
│      - title: the view title if visible                     │
│      - level: which floor/level (for plan views)            │
│      - bounds: {left, top, right, bottom} as 0-1 fractions  │
│        of the page dimensions"                              │
│                                                             │
│  3. Agent returns structured JSON:                          │
│     [                                                       │
│       { type: "section",                                    │
│         title: "Section - Stair 2 - Looking East",          │
│         bounds: {left: 0, top: 0, right: 0.21, bottom: 1}},│
│       { type: "plan",                                       │
│         title: "Stair 2 - Level 03 IP Plan",                │
│         level: "03",                                        │
│         bounds: {left: 0.48, top: 0.66, right: 0.72,       │
│                  bottom: 1.0}},                             │
│       ...                                                   │
│     ]                                                       │
│                                                             │
│  4. Code converts percentage bounds to pixel coordinates    │
│     and performs deterministic cropping + text grouping      │
└─────────────────────────────────────────────────────────────┘
```

### Why This Could Be Powerful

| Advantage | Why |
|-----------|-----|
| **Handles any layout** | Agent adapts to irregular grids, stacked views, L-shaped arrangements, etc. |
| **No threshold tuning** | No gap percentages, bias ratios, or pattern matching to maintain |
| **Cheap** | One low-res image + one agent call. Layout detection is a simple visual task — could use a fast/cheap model |
| **Keeps preprocessing deterministic** | Once the agent provides boundaries, all cropping and text grouping is pure code. No hallucination risk in the data pipeline. |
| **Self-correcting** | If the agent gets boundaries slightly wrong, the counting agent will still see most of the right content. Small boundary errors are tolerable. |
| **Handles missing titles** | Agent can visually identify view types even when text titles aren't present |

### Cost Estimate

- One low-res overview image: ~100-200 image tokens
- Short structured output: ~200-300 output tokens
- Total: roughly $0.01-0.02 per page
- This is a one-time cost per page, not per stair or per measurement

### Concerns & Open Questions

1. **Reliability** — How consistently does the agent return accurate bounding boxes? Would need to test across multiple drawing sets. Small errors in bounds are fine (content still mostly captured), but major errors (missing a view entirely, overlapping bounds) would be a problem.

2. **Latency** — Adds one agent round-trip before preprocessing can begin. Probably 2-5 seconds. Acceptable if it means the downstream counting works better.

3. **When to use it** — Could be the primary approach, or could be a fallback when code-based clustering fails (e.g., when title detection finds 0 titles). Could also be used as validation: run code-based clustering, then have the agent verify the results.

4. **Prompt engineering** — The prompt needs to be precise about output format. Bounding boxes as fractions (0-1) avoids the coordinate space confusion entirely — the code handles the conversion.

5. **Model selection** — This is a simple visual task (identify rectangular regions). A cheaper/faster model might work fine, saving the expensive model for the actual counting.

### Conclusion: Agent-Guided Should Be the Primary Path

After testing code-based clustering on multiple pages, we concluded that **agent-guided view detection should be the primary approach, not a fallback.**

The code-based approach breaks on:
- **Page 256 (OHWC)** — Irregular layout with views at different sizes/positions. The grid assumption fails because titles don't form a regular grid.
- **Different drawing sets entirely** — A drawing from a different firm (AO) uses "ELEVATOR #1 AND STAIR #1 SEVENTH FLOOR PLAN" instead of "STAIR 2 - LEVEL 07 IP PLAN". Levels are spelled out ("SEVENTH FLOOR", "BASEMENT"), titles include combined elevator/stair naming, and non-stair views (attic details, roof plans) are mixed in.

No set of regex patterns can handle every architectural firm's naming conventions. We'd be playing whack-a-mole forever. The agent visually understands any layout regardless of naming conventions.

**Code-based clustering remains useful as:**
- A fast optimization for known drawing sets (skip the agent call when patterns match)
- A validation check (compare agent's boundaries against what code would produce)
- A reference implementation that documents the coordinate math

But the **agent-guided approach is the path forward** for production use.

### Relationship to Current Test Script

The `eval/test-view-clustering.ts` script currently tests code-based clustering only. To test agent-guided clustering, we would:

1. Add a `--agent` flag that sends the overview to an LLM instead of running code-based clustering
2. Compare the agent's proposed boundaries against the code-based boundaries
3. Compare the resulting crops visually

This would tell us whether the agent-guided approach produces better, worse, or equivalent results — and on which types of pages each approach excels.

---

## Implementation Reference: Code-Based Clustering (As Built)

This section documents the complete technical details of the code-based view clustering pipeline as implemented and tested in `eval/test-view-clustering.ts`. This serves as a reference for reimplementation or extension.

### Coordinate System Problem

pdfjs-dist extracts text with coordinates from the PDF's transform matrix:
- `x = transform[4]` — raw PDF user space X
- `y = viewport.height - transform[5]` — converted from bottom-up PDF coords to top-down

**Critical issue:** Many CAD/architectural PDFs have a non-zero origin. For example, page 252 of the OHWC drawing set has:
- Page dimensions: 3456 × 2592 points
- Text X range: -1683 to +1681 (origin is at center of page)
- Text Y range: 1389 to 3843 (shifted, not starting at 0)

**Solution:** Normalize all coordinates before clustering by shifting so min x,y = 0:
```typescript
const minX = Math.min(...items.map(i => i.x));
const minY = Math.min(...items.map(i => i.y));
const normalizedItems = items.map(i => ({
  ...i,
  x: i.x - minX,
  y: i.y - minY,
}));
const effectiveWidth = maxX - minX;   // "text extent" width
const effectiveHeight = maxY - minY;  // "text extent" height
```

### Step 1: Title Detection

Search all text items for view title patterns:

```typescript
// Section views
/SECTION/i  — then verify "STAIR" appears in nearby items (same Y ±10, same X ±200)

// Plan views with level numbers
/LEVEL\s*([\d]+(?:\s*[-–—]\s*\d+)?)\s*(?:IP\s*)?PLAN/i
// Captures: "Level 03", "Level 06-08", "Level 10", etc.
```

**Important:** When constructing the full title from nearby text items, restrict to items within **±200 points X** of the matched item. Without this X restriction, titles from different views at the same Y coordinate get merged (because grid rows share the same Y).

**Deduplication:** Multiple text items from the same title will match. Deduplicate by rejecting any title within 100pts X and 30pts Y of an already-found title.

### Step 2: Grid Detection from Title Positions

Titles form a grid. Extract column and row positions:

```typescript
// Cluster title X values (>100pts apart = different column)
const colPositions = [titleXs[0]];
for (let i = 1; i < titleXs.length; i++) {
  if (titleXs[i] - colPositions[colPositions.length - 1] > 100)
    colPositions.push(titleXs[i]);
}

// Same for Y values (>100pts apart = different row)
```

For page 252 this produces:
- 4 columns at x ≈ 326, 1108, 1878, 2665
- 3 rows at y ≈ 749, 1547, 2416

### Step 3: Grid Cell Boundaries

**Column boundaries:** Midpoints between column positions, with page edges at 0 and pageWidth.
```
Columns: 326, 1108, 1878, 2665
Boundaries: 0, 717, 1493, 2271, 3364
```

**Row boundaries:** Biased splits, NOT midpoints. Titles are at the **bottom** of each view, so the drawing content extends far above the title. Using midpoints cuts off the top of lower-row views.

```typescript
const ROW_BIAS = 0.15; // boundary is 15% below the upper title
const rowBoundaries = [0]; // top edge
for (let i = 0; i < rowPositions.length - 1; i++) {
  const gap = rowPositions[i + 1] - rowPositions[i];
  rowBoundaries.push(rowPositions[i] + gap * ROW_BIAS);
}
rowBoundaries.push(pageHeight); // bottom edge
```

For page 252: rows at y = 749, 1547, 2416 → boundaries at 0, 868, 1678, 2454
(vs midpoints which would be 0, 1148, 1982, 2454 — these cut off the tops of views)

### Step 4: Spanning View Detection

Some views occupy multiple grid rows (e.g., a section view spanning the full page height). The section view on page 252 has its title in row 2, column 0 — but rows 0 and 1 in column 0 are empty.

**Rule:** If a column has only one title across all rows, that title's view gets the **entire column height** (top = 0, bottom = pageHeight). If a column has multiple titles, each gets its own row range.

```typescript
for (let c = 0; c < colPositions.length; c++) {
  const titledRows = colCells.filter(cell => cell.title !== null);
  if (titledRows.length === 1) {
    // One title → entire column height
    mergedCell.top = 0;
    mergedCell.bottom = pageHeight;
  } else {
    // Multiple titles → each gets its grid row range
  }
}
```

### Step 5: Text Item Assignment

Every text item is assigned to the grid cell it falls within:
```typescript
for (const item of normalizedItems) {
  for (const cell of mergedCells) {
    if (item.x >= cell.left && item.x < cell.right &&
        item.y >= cell.top && item.y < cell.bottom) {
      cell.items.push(item);
      break;
    }
  }
}
```

This is a clean rectangular containment test — no distance calculations, no ambiguity.

### Step 6: Coordinate Mapping for Image Cropping

To crop from the rendered image (produced by `pdftoppm` at 150 DPI), we need to map normalized text coordinates to render pixel coordinates.

**The problem:** Normalized coords range from 0 to textExtent, but the rendered image covers the full PDF page. The text doesn't start at the page edge — there's margin.

**Solution:** Estimate the page edges in raw PDF coords, then compute a linear mapping:

```typescript
// Text extent is slightly smaller than page — margins on each side
const xMargin = (pageWidth - textWidth) / 2;
const yMargin = (pageHeight - textHeight) / 2;
const estPageLeftRaw = minX - xMargin;
const estPageTopRaw = minY - yMargin;

// Scale from PDF points to render pixels
const pixelPerPtX = renderWidth / pageWidth;
const pixelPerPtY = renderHeight / pageHeight;

// Map normalized crop bounds back to raw, then to pixels
const rawCropX = cluster.cropBounds.x + minX;  // denormalize
const rawCropY = cluster.cropBounds.y + minY;
const cropPixelX = (rawCropX - estPageLeftRaw) * pixelPerPtX;
const cropPixelY = (rawCropY - estPageTopRaw) * pixelPerPtY;
const cropPixelW = cluster.cropBounds.width * pixelPerPtX;
const cropPixelH = cluster.cropBounds.height * pixelPerPtY;
```

**Note:** This assumes symmetric margins, which works for the OHWC drawing set. PDFs with non-centered origins may need a different mapping approach. The agent-guided approach avoids this problem entirely by using fractional bounds (0-1).

### Step 7: Image Rendering Without Electron

The production code uses Electron's BrowserWindow + canvas for PDF rendering. For the test script (runs in Bun/Node), we use:

- **`pdftoppm`** (from poppler) for rendering PDF pages to JPEG: `pdftoppm -f <page> -l <page> -jpeg -r <dpi> "<pdf>" "<output>"`
- **`canvas`** (node-canvas npm package) for cropping regions from the rendered JPEG

pdfjs-dist's Node rendering doesn't work reliably for architectural PDFs (fails on embedded images with "Image or Canvas expected" error from drawImage).

### Results on Page 252

The code-based pipeline correctly identifies:
- 1 section view (spanning full height, column 0) — 126 text items
- 9 plan views (3×3 grid, columns 1-3) — 43-130 text items each
- All 10 view titles correctly matched
- Clean rectangular crops with no overlap

---

## Implementation Reference: Agent-Guided Clustering (Future)

If the code-based approach fails (no titles found, unusual layout), an agent can visually determine the view boundaries. Here's how it would work in detail.

### Agent Input

Send the agent a **low-resolution overview** of the page. The overview image is already produced by `extractPdfPages()` at 150 DPI, downscaled to max 1568px. This is the same image the counting agent currently sees.

Along with the image, send a structured prompt requesting view boundary detection.

### Prompt Design

```
You are analyzing a construction drawing sheet. This page contains multiple
drawing views of a staircase (section views, plan views, detail callouts).

For each distinct drawing view on this page, identify:
1. type: "section", "plan", "detail", or "other"
2. title: the view title text if visible (e.g., "STAIR 2 - LEVEL 03 IP PLAN")
3. level: the floor level number if this is a plan view (e.g., "03", "06-08")
4. bounds: the bounding box as fractions of the page dimensions:
   - left: 0.0 = left edge, 1.0 = right edge
   - top: 0.0 = top edge, 1.0 = bottom edge
   - right: right edge of the view
   - bottom: bottom edge of the view

Return ONLY a JSON array. Example:
[
  {"type": "section", "title": "Section - Stair 2 - Looking East",
   "bounds": {"left": 0.0, "top": 0.0, "right": 0.21, "bottom": 1.0}},
  {"type": "plan", "title": "Stair 2 - Level 03 IP Plan", "level": "03",
   "bounds": {"left": 0.45, "top": 0.66, "right": 0.70, "bottom": 1.0}}
]

Rules:
- Include ALL drawing views, even small ones
- Bounds should tightly enclose each view including its title and border
- Views should not overlap
- A section view typically shows the stair from the side with all flights
- Plan views show the stair from above at a specific floor level
```

### Converting Agent Bounds to Crop Coordinates

The agent returns bounds as fractions (0-1). Converting to render pixel coordinates is trivial:

```typescript
const cropPixelX = bounds.left * renderWidth;
const cropPixelY = bounds.top * renderHeight;
const cropPixelW = (bounds.right - bounds.left) * renderWidth;
const cropPixelH = (bounds.bottom - bounds.top) * renderHeight;
```

**This completely bypasses the PDF coordinate system problems.** No need to deal with centered origins, non-zero offsets, or point-to-pixel conversions. The agent sees the image in pixel space, returns fractions in that same space, and we crop in that same space.

### Assigning Text Items to Agent-Defined Views

After the agent provides view bounds, we still need to assign pdfjs-dist text items to each view. Since text items are in normalized PDF coordinates and agent bounds are in fractional image space, we need a mapping:

```typescript
// Map normalized text coords (0..textExtent) to fractional page coords (0..1)
// This is approximate but sufficient for containment testing
const fracX = (item.x - minX + xMargin) / pageWidth;
const fracY = (item.y - minY + yMargin) / pageHeight;

// Then check: does (fracX, fracY) fall within the agent's bounds?
if (fracX >= bounds.left && fracX <= bounds.right &&
    fracY >= bounds.top && fracY <= bounds.bottom) {
  // item belongs to this view
}
```

Alternatively, convert agent bounds to normalized text coords and use the same containment test as the code-based approach.

### Structured Output from Agent

To ensure reliable parsing, use the API's tool/function calling feature or JSON mode rather than free-text parsing. The agent's response should be a single JSON array that can be parsed directly.

### Fallback Chain

```
1. Try code-based title detection + grid clustering
   ↓ (if < 2 views found, or no titles matched)
2. Try agent-guided view detection
   ↓ (if agent returns malformed response or 0 views)
3. Fall back to simple quadrant splitting (top-left, top-right, etc.)
   — crude but always works
```

---

## Testing Plan

Before building this into the agent pipeline, test the preprocessing in isolation:

**Test script: `eval/test-view-clustering.ts`**

Run on known stair pages (250-270 from the OHWC drawing set) with no LLM involved:

1. Extract all text items from the page via pdfjs-dist
2. Run spatial clustering to identify views
3. Attempt view title identification within each cluster
4. Compute bounding boxes
5. Crop a high-resolution image for each view
6. Dump everything to an output folder:
   - `page-252-overview.jpg` — full page for reference
   - `page-252-view-1-section.jpg` — cropped section view
   - `page-252-view-2-level-03-plan.jpg` — cropped Level 03 plan
   - `page-252-clustering-report.txt` — text dump showing all clusters, their text, bounding boxes, identified titles

Evaluate by visual inspection: open the output folder, check that views were correctly identified and cropped, and that text is correctly grouped.

**Success criteria:**
- Views are separated correctly (no two views merged, no single view split)
- View titles are correctly identified when present
- Cropped images show the complete view with reasonable padding
- Text within each view cluster matches what's visually in that view
