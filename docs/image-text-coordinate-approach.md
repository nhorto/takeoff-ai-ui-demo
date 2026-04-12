# Image + Text Coordinate Approach

## Overview

This document describes the planned changes to how we send page data to the agent LLM. Instead of sending text alone (with optional image requests), we will send **both the page image and the extracted text with spatial coordinates** together, allowing the LLM to reason about which text belongs to which drawing view using both visual and positional information.

This replaces the previous approach of:
- Hard-coded deduplication (marking clusters as "primary" vs "duplicate")
- Text-only spatial rows without precise X coordinates
- Separate image requests that don't correlate with text data

## Why This Change

### The Problem

Construction drawing sheets contain multiple views of the same stair (section views, plan views, details). The same annotations (e.g., "13 EQ RSRS") appear in multiple views. The current system tries to handle this with algorithmic deduplication — clustering annotations by X-gaps and telling the LLM to ignore "duplicate" clusters.

This approach has two fundamental problems:

1. **It pre-decides what's important.** The deduplication marks secondary views as "IGNORE", but those views contain unique information (landing dimensions, stair widths, handrail details) that the agent actually needs.

2. **It's fragile.** The X-gap clustering depends on thresholds (10% of page width) that don't generalize across different firms' drawing styles and layouts.

### The Solution

Give the LLM both the image and the text with precise coordinates in the same coordinate space. The LLM can then:
- **See the layout** visually (which views exist, how they're arranged)
- **Read precise text positions** (where each annotation is on the page)
- **Reason about which text belongs to which view** (text at x=100-400 is in the section view, text at x=500-800 is in a plan view)
- **Decide for itself** which views to use for which purpose (section view for riser counts, plan views for dimensions)

## Coordinate Mapping

### The Critical Issue

Text is extracted from the PDF via pdfjs-dist at scale 1.0. Coordinates are in PDF "points" (~72 DPI). A typical 48"x36" architectural sheet is ~3456x2592 points.

The image the LLM sees is rendered via pdftoppm at 150 DPI, then downscaled to fit within 1568px max dimension. So the image might be 1568x1176 pixels.

**These coordinate spaces do not match.** If we send `ROW y=1423` (PDF points) alongside a 1568x1176 image, the LLM cannot correlate the text position to what it sees in the image.

### The Solution: Transform to Image Pixel Space

When sending text alongside the rendered image, transform all coordinates from PDF points to image pixels:

```
imagePixelX = (textItem.x / pdfPageWidth) * imageWidth
imagePixelY = (textItem.y / pdfPageHeight) * imageHeight
```

This works because:
- pdf.js `getViewport({ scale: 1.0 })` normalizes coordinates to (0,0)-(pageWidth, pageHeight) with Y=0 at top
- pdftoppm renders the full page from the same (0,0) origin
- Both use the same page dimensions, just at different scales

The `imageWidth` and `imageHeight` values are already computed in `tools.ts` (lines 746-758) when rendering pages.

### Previous Approach (Eval Code)

The eval scripts (`test-view-clustering.ts`, `test-llm-view-detection.ts`) used a more complex margin estimation:

```typescript
const xMargin = (pageWidth - textWidth) / 2;  // Assumes symmetric margins
const estPageLeftRaw = minX - xMargin;
```

This assumed text was centered on the page with equal margins. This worked for the test PDF set but is fragile for sheets with asymmetric margins or non-standard layouts. The simpler direct formula above should be more robust, but **this needs to be verified during testing**.

### Verification Plan

To confirm the coordinate mapping is correct:
1. Render a test page image
2. Extract text items and transform coordinates
3. Draw circles/markers on the image at each text item's transformed position
4. Visually verify the markers align with the actual text in the image

If misalignment is found, investigate whether pdfjs viewport coordinates have an offset from the pdftoppm render origin. This would be the case if the PDF has a non-standard MediaBox or CropBox.

## Changes to `tools.ts`

### 1. Remove Deduplication Logic

**Remove:**
- `clusterAnnotationsIntoViews()` function (lines 1006-1110)
- `generateDeduplicationGuide()` function (lines 1116-1159)
- The deduplication call in `getPageText()` (lines 1195-1201)

**Why:** The LLM will now reason about views itself using the image + coordinates. Pre-computed deduplication was too opinionated and caused the agent to ignore useful information in secondary views.

### 2. Update Text Format (rows mode)

**Current format:**
```
ROW y=1423: SECTION | - | STAIR | 2 | - | LOOKING | EAST
ROW y=1456: 13 | EQ | RSRS | 7" | TREAD
```

- Has Y coordinate per row (in PDF points — wrong space)
- Missing X coordinates entirely from the output
- Items are pipe-separated in left-to-right order but exact positions are lost

**New format:**
```
ROW y=412 x=35-280: SECTION | - | STAIR | 2 | - | LOOKING | EAST
ROW y=425 x=40-250: 13 | EQ | RSRS | 7" | TREAD
```

- Y and X range in **image pixel space** (matching the image the LLM sees)
- LLM can match text positions to visual locations in the image

**Implementation:** Modify `groupIntoRows()` to accept image dimensions and apply the coordinate transform. Update `getPageText()` to pass these dimensions through.

### 3. Send Image with Text (rows mode)

When `getPageText()` is called with `format='rows'`, also render and include the page image in the tool response. This means the LLM gets text + image in a single tool call instead of needing separate `extract_pdf_pages` + `get_page_text` calls.

**Implementation notes:**
- Reuse the existing `extractPdfPages()` rendering pipeline
- Include image dimensions in the text header so the LLM knows the coordinate space
- Image cleanup (lines 396-427 in agent-loop.ts) already handles removing old images from context

### 4. Discovery Flow — No Change

The compact format (`format='compact'`) used for page discovery remains unchanged. No images are sent during discovery — the current zone-based summary is sufficient for identifying relevant pages.

## Prompting Changes

### Riser Counting Guidance

The agent must be prompted to understand the drawing hierarchy:

> **IMPORTANT: Riser counts must come from the SECTION VIEW (the main stair overview).** This is the tall cross-section drawing that shows the full stair tower from bottom to top. It has flight-by-flight riser callouts like "8 EQ RSRS" or "13 EQ RISERS" annotated directly on each flight run.
>
> The secondary views (plan views at each level) may also show riser/tread annotations, but these are for individual floor levels only and may not include all flights. **Do NOT count risers from plan views.** Use the section view as the single source of truth for riser counts.
>
> The section view is typically the leftmost or largest drawing on the sheet, labeled something like "SECTION - STAIR 2 - LOOKING EAST".

### View-Aware Text Reasoning

The agent needs to understand how to use the text coordinates:

> The text items provided have coordinates (x, y) that match the image pixel space. Text items at similar x-ranges are in the same vertical column (same drawing view). Text items at similar y-ranges are on the same horizontal line.
>
> Use the image to identify which drawing views exist on the page and their approximate positions. Then use the text coordinates to determine which text items belong to which view. This lets you:
> - Read annotations from the correct view
> - Get dimensions from plan views (which show width, depth, landing sizes)
> - Avoid double-counting annotations that appear in multiple views

### Missing Information Handling

> Some information may not be explicitly shown on the drawings. When you need to make an assumption (e.g., a landing dimension is not called out), you MUST:
> 1. State the assumption clearly
> 2. Explain your reasoning
> 3. Flag it to the user so they can verify

## What This Does NOT Change

- **Image rendering pipeline** — pdftoppm at 150 DPI, downscale to 1568px max
- **Text extraction** — pdfjs-dist at scale 1.0 with top-down Y conversion
- **Discovery flow** — compact format zone summaries, no images
- **Image cleanup** — old images already removed from context automatically
- **Search functionality** — `searchPdfText()` unchanged

## Token Cost Impact

| Component | Current | New | Delta |
|-----------|---------|-----|-------|
| Text (rows format) | ~2000 tokens | ~2500 tokens (added X coords) | +500 |
| Image (per page) | 0 (separate call) | ~1568 tokens (auto-included) | +1568 |
| Deduplication guide | ~200 tokens | 0 (removed) | -200 |
| **Total per detailed page** | **~2200** | **~4068** | **+1868** |

At Sonnet pricing ($3/M input), that's ~$0.006 extra per page. For a 20-page stair set, ~$0.12 more. Acceptable for a batch preprocessing step focused on accuracy.

The key efficiency gain: the agent no longer needs a separate `extract_pdf_pages` call to see the image, saving one full round-trip per page analysis.

## Testing Plan

1. **Coordinate verification**: Render test pages, overlay text markers at transformed coordinates, verify visual alignment
2. **Section view identification**: Test that the LLM correctly identifies the section view as source of truth for risers on 5+ different stair sheets
3. **Cross-view reasoning**: Test that the LLM can pull dimensions from plan views while counting risers from the section view
4. **Compare accuracy**: Run the same stair set through old (deduplication) and new (image+coords) approaches, compare against golden answers
5. **Token monitoring**: Track actual token usage to confirm cost estimates

## Future Considerations

- If this approach works well for text reasoning, the same image+coordinates could potentially help the LLM generate accurate bounding boxes (as explored in the eval experiments)
- The coordinate mapping formula should be validated against PDFs from multiple architectural firms with different drawing standards
- If asymmetric margins cause issues, fall back to the margin estimation approach from the eval code
