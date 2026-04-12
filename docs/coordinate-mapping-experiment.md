# Coordinate Mapping Experiment

## Date
April 11, 2026

## Purpose

Before implementing the image+text coordinate approach (see `docs/image-text-coordinate-approach.md`), we needed to verify that text coordinates extracted from the PDF can be accurately mapped to positions on the rendered page image. If the coordinates don't align with what the LLM sees in the image, the entire approach fails.

## Background

The production pipeline has two separate data sources:
1. **Text extraction** via pdfjs-dist at `scale: 1.0` — produces text items with (x, y) coordinates in PDF "points"
2. **Image rendering** via pdftoppm at 150 DPI, downscaled to 1568px max — produces the JPEG image the LLM sees

These use different coordinate systems. PDF text coordinates for this test PDF ranged from **x: -1683 to +1681** and **y: 1389 to 3843** (on a page that is 3456 x 2592 points). The rendered image is 1568 x 1176 pixels.

The question: how do we convert text (x, y) in PDF points to (px, py) in image pixels so they match?

## Test Setup

**Script:** `eval/test-coordinate-mapping.ts`
**Run:** `bun run eval/test-coordinate-mapping.ts`
**Output:** `eval/coordinate-mapping-test/`

**Test pages:** 252 and 256 from the OHWC drawing set (stair detail sheets with multiple views)

**Method:** For each page, render the image, extract text, transform coordinates using three different approaches, draw colored markers on the image at each text position, and visually verify alignment.

## Three Approaches Tested

### Approach 1: Simple Direct Formula

```
imageX = (textX / pageWidth) * imageWidth
imageY = (textY / pageHeight) * imageHeight
```

**Hypothesis:** If pdf.js viewport already normalizes coordinates to (0,0)-(pageWidth, pageHeight), this should work.

**Result: FAILED COMPLETELY.**

The PDF has a CAD-centered origin — text X coordinates range from -1683 to +1681 (centered at ~0), not from 0 to 3456. This produced **negative pixel coordinates** for half the text items. Markers appeared only in the right half of the image, with many off-screen entirely.

Example: "LEVEL 01 IP" at PDF position (-1535, 3540) mapped to pixel (-696, 1606) — off the left edge.

### Approach 2: Margin Estimation (from eval code)

```typescript
// Compute text extent
const textWidth = maxX - minX;  // width occupied by all text
const textHeight = maxY - minY;

// Estimate symmetric margins
const xMargin = (pageWidth - textWidth) / 2;
const yMargin = (pageHeight - textHeight) / 2;

// Estimate where the page edge is in raw PDF coords
const estPageLeftRaw = minX - xMargin;
const estPageTopRaw = minY - yMargin;

// Transform
imageX = ((textX - estPageLeftRaw) / pageWidth) * imageWidth
imageY = ((textY - estPageTopRaw) / pageHeight) * imageHeight
```

**Hypothesis:** If we estimate where the page edges are by centering the text extent within the page dimensions, we can map to image space.

**Result: WORKS (approximately).**

Markers aligned well with actual text positions on both test pages. However, this approach **assumes text is symmetrically centered** on the page. For this PDF set, margins are small (~46pts in X, ~69pts in Y) so the centering assumption holds. But it could fail for PDFs where content is concentrated on one side of the page.

Example: "LEVEL 01 IP" at PDF (-1535, 3540) mapped to pixel (88, 1007) — correct position on the left edge of the drawing.

Estimated page origin: (-1729, 1320) vs true origin should be (-1728, 1296) — off by ~1pt in X and ~24pts in Y.

### Approach 3: Viewport Transform (pdf.js native)

```typescript
const viewport = page.getViewport({ scale: 1.0 });
const [vpX, vpY] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);

// Then simple formula works because vpX/vpY are in viewport space
imageX = (vpX / viewport.width) * imageWidth
imageY = (vpY / viewport.height) * imageHeight
```

**Hypothesis:** pdf.js's viewport already knows how to convert from the PDF's internal coordinate system to viewport (screen) space. Using `convertToViewportPoint()` should handle any origin system correctly.

**Result: WORKS (correctly).**

Markers aligned precisely with text positions. This approach uses pdf.js's own coordinate transformation, which handles:
- Center-origin CAD drawings
- Non-standard MediaBox/CropBox definitions
- Page rotation
- Any arbitrary PDF coordinate system

Example: "STAIR 2" viewport coordinates: (2647.5, 2300.8) → pixel (1201, 1044)
Same item via margin estimation: pixel (1202, 1033) — ~11px difference in Y.

## Comparison Table

| Approach | Works? | Accuracy | Robustness | Implementation Complexity |
|----------|--------|----------|------------|--------------------------|
| Simple direct | **NO** | N/A — produces negative coords | Fails on CAD-origin PDFs | Trivial |
| Margin estimation | **Yes** | ~11px off from viewport in Y | Assumes symmetric margins — fragile | Moderate (needs min/max text bounds) |
| Viewport transform | **Yes** | Mathematically exact | Handles any PDF origin system | Simple (one function call) |

## Visual Results

Output images in `eval/coordinate-mapping-test/`:

| File | Marker Color | Description |
|------|-------------|-------------|
| `page-252-simple-transform.jpg` | Red | All markers clustered right, many off-screen left |
| `page-252-margin-estimated.jpg` | Blue | Markers aligned with text — slight Y offset |
| `page-252-viewport-transform.jpg` | Green | Markers aligned with text — precise |
| `page-256-simple-transform.jpg` | Red | Same failure pattern |
| `page-256-margin-estimated.jpg` | Blue | Markers aligned — slight Y offset |
| `page-256-viewport-transform.jpg` | Green | Markers aligned — precise |

## Key Discovery: CAD-Origin PDFs

The OHWC drawing set uses a **center-origin coordinate system** typical of CAD software:
- X ranges from -1683 to +1681 (centered at ~0)
- Y ranges from 1389 to 3843 (offset, NOT centered)
- Page dimensions: 3456 x 2592 points

This means:
- The page left edge is at approximately x = -1728 (which is -pageWidth/2)
- The page top edge is at approximately y = 1296 (which is pageHeight/2)
- The Y axis is flipped in PDF space (0 at bottom) — pdf.js handles this in the viewport

**Any coordinate mapping approach must handle non-zero origins.** The simple formula `textX / pageWidth` only works if coordinates start at 0, which is NOT guaranteed for architectural/engineering PDFs.

## Recommendation

**Use Approach 3 (viewport transform)** for all coordinate mapping.

The implementation requires a small change to `pdf-text-extractor.ts`:

**Current code (line 169-170):**
```typescript
const tx = item.transform[4];
const ty = viewport.height - item.transform[5];
```

**Should be:**
```typescript
const [tx, ty] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
```

This single change fixes the coordinate system at the source. After this change, the simple formula `textX / pageWidth * imageWidth` works correctly for any PDF, because the text coordinates are now in viewport space (0,0)-(pageWidth, pageHeight) with Y=0 at top.

## Impact on Existing Code

Changing the text extractor coordinates will affect:
1. **`groupIntoRows()`** in tools.ts — uses Y for row grouping (still works, just different Y values)
2. **`clusterAnnotationsIntoViews()`** in tools.ts — uses X/Y for gap detection (still works, values are proportional)
3. **`classifyZone()`** in pdf-text-extractor.ts — uses x/pageWidth and y/pageHeight for quadrant classification (NOW CORRECT — currently broken for center-origin PDFs)
4. **eval scripts** — test-view-clustering.ts and test-llm-view-detection.ts both have their own coordinate normalization that can be simplified

The change makes coordinates MORE correct everywhere, not less. The `classifyZone()` function in particular has been silently wrong for center-origin PDFs — it divides raw x by pageWidth, which gives negative fractions for left-side content.

## Caveats

- This was tested on ONE PDF set (OHWC). Should be validated against PDFs from other architectural firms.
- The viewport transform assumes pdftoppm and pdf.js agree on page dimensions. If pdftoppm uses a different page box (CropBox vs MediaBox), coordinates could still be off.
- Text items near page edges may still have slight misalignment due to rounding.
