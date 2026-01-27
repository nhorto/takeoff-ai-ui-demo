# Hybrid Image Strategy — Implementation Plan

**Date:** January 27, 2026
**Status:** Planning
**Prerequisite:** Step 1 optimizations (Sonnet, JPEG, baked skill) — completed

---

## What Is the Hybrid Approach?

The hybrid approach gives Claude two levels of image detail for each construction drawing page:

1. **Overview** — A full-page image (same as today) that shows the entire sheet layout at low effective resolution (~43 DPI). Claude uses this to understand what's on the page, where things are, and what areas need closer inspection.

2. **Detail crop** — A zoomed-in region of the page at much higher effective resolution (~87-261 DPI depending on crop size). Claude requests these on-demand for specific areas where it needs to read small text like dimension callouts, riser counts, material notes, etc.

This mirrors how a human estimator works: zoom out to see the whole sheet, then zoom in to read the numbers.

---

## How It Differs From the Current Approach

### Current (Full-Page Only)

```
PDF Page → Render at 150 DPI → Resize to 1568px max → Send to Claude
```

- Claude sees the entire page at ~43 effective DPI
- Large text (titles, sheet numbers) is readable
- Small text (dimensions, callouts like "13R @ 7 3/8"") is often illegible
- 1 image per page
- Claude has no way to "zoom in"

### Hybrid (Overview + On-Demand Crops)

```
Step 1: PDF Page → Render at 150 DPI → Resize to 1568px max → Send to Claude (overview)
Step 2: Claude identifies areas needing detail
Step 3: PDF Page → Render region at 150 DPI → Crop to specified area → Resize to 1568px max → Send to Claude
```

- Claude sees the full layout first (same as current)
- Then Claude requests crops for areas with small text it needs to read
- Each crop has 2-6x the effective DPI of the full-page view
- Claude-driven: only crops what's needed, so simple pages cost nothing extra

### Blanket Tiling (What We're Skipping)

```
PDF Page → Render at 150 DPI → Split into 4 quadrants → Resize each to 1568px → Send all 4 to Claude
```

- Every page gets 4 images regardless of whether Claude needs the detail
- 4x image cost on every page, even blank areas or title blocks
- No intelligence about which areas matter

### Cost Comparison Per Page

| Approach | Images Per Page | Token Cost Per Page |
|----------|----------------|---------------------|
| Current (full-page) | 1 | ~1,750 tokens |
| Blanket tiling (4 quadrants) | 4 | ~7,000 tokens |
| Hybrid (overview + avg 1-2 crops) | 2-3 | ~3,500-5,250 tokens |

The hybrid approach costs roughly half of blanket tiling while delivering equal or better resolution where it matters (Claude targets the important areas, not blank space).

---

## Effective Resolution by Crop Size

For a typical 24x36 inch construction drawing sheet:

| Crop Area | Rendered Pixels | After 1568px Resize | Effective DPI | Readability |
|-----------|----------------|---------------------|---------------|-------------|
| Full page (36x24") | 5400x3600 | 1568x1045 | ~43 | Large text only |
| Quadrant (18x12") | 2700x1800 | 1568x1045 | ~87 | Most text readable |
| Half page (36x12") | 5400x1800 | 1568x523 | ~65 | Moderate |
| Medium crop (12x12") | 1800x1800 | 1568x1568 | ~130 | Fine text readable |
| Small crop (6x6") | 900x900 | 900x900 (no resize) | ~150 | Everything readable |

Quadrant-based crops (the named regions) give ~87 DPI — a 2x improvement that should make most dimension text readable. Coordinate-based crops can go even higher for specific details.

---

## New Tool: `extract_pdf_region`

### Tool Definition

```typescript
{
  name: 'extract_pdf_region',
  description: 'Extract a cropped region of a PDF page at higher resolution for detailed reading. Use this after viewing the full page overview (via extract_pdf_pages) when you need to read small text, dimensions, or details that are not legible in the overview. You can specify a named region (quadrant) or exact pixel coordinates.',
  input_schema: {
    type: 'object',
    properties: {
      page_number: {
        type: 'number',
        description: 'The page number to crop from (1-indexed)'
      },
      region: {
        type: 'string',
        enum: [
          'top-left', 'top-right', 'bottom-left', 'bottom-right',
          'top-half', 'bottom-half', 'left-half', 'right-half',
          'center'
        ],
        description: 'Named region to extract. Each quadrant is 50% of the page width and height. Halves are 100% x 50% or 50% x 100%. Center is the middle 50% x 50%.'
      },
      crop: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate of the crop origin (pixels at render DPI, from top-left corner)' },
          y: { type: 'number', description: 'Y coordinate of the crop origin (pixels at render DPI, from top-left corner)' },
          width: { type: 'number', description: 'Width of the crop area in pixels at render DPI' },
          height: { type: 'number', description: 'Height of the crop area in pixels at render DPI' }
        },
        required: ['x', 'y', 'width', 'height'],
        description: 'Exact pixel coordinates for the crop area. Use this for precise targeting. Coordinates are relative to the page rendered at 150 DPI.'
      }
    },
    required: ['page_number']
    // Either 'region' or 'crop' must be provided (validated in implementation)
  }
}
```

### How Named Regions Map to Coordinates

Given a page rendered at `W x H` pixels:

| Region | x | y | width | height |
|--------|---|---|-------|--------|
| `top-left` | 0 | 0 | W/2 | H/2 |
| `top-right` | W/2 | 0 | W/2 | H/2 |
| `bottom-left` | 0 | H/2 | W/2 | H/2 |
| `bottom-right` | W/2 | H/2 | W/2 | H/2 |
| `top-half` | 0 | 0 | W | H/2 |
| `bottom-half` | 0 | H/2 | W | H/2 |
| `left-half` | 0 | 0 | W/2 | H |
| `right-half` | W/2 | 0 | W/2 | H |
| `center` | W/4 | H/4 | W/2 | H/2 |

### Rendering Pipeline

```
1. Render full page at 150 DPI (same as extract_pdf_pages)
2. Crop to the specified region (either named or coordinates)
3. Resize cropped area to fit within 1568px max dimension
4. Export as JPEG at quality 0.85
5. Return as base64 image content block
```

### Optimization: Page Render Cache

The `extract_pdf_region` tool will often be called for the same page that was just viewed in overview. To avoid re-rendering the full page from PDF every time, cache the rendered canvas/bitmap per page in the session.

```
First call for page 250:  PDF → render at 150 DPI → cache full bitmap → crop → return
Second call for page 250: cache hit → crop → return (skip PDF render)
```

Cache is keyed by `(pdfPath, pageNumber, dpi)` and lives only for the session duration.

---

## Implementation Plan

### Phase 1: Core — Add `extract_pdf_region` Tool

**Files to modify:**

#### 1. `src/main/core/types.ts`
- No changes needed (PDFPageImage type already supports jpeg)

#### 2. `src/main/core/pdf-extractor.ts`
- Add new function: `extractPdfRegion(pdfPath, pageNumber, cropArea, dpi)`
  - `cropArea: { x: number, y: number, width: number, height: number }`
  - Renders the full page, crops to the area, resizes to 1568px max, returns base64 JPEG
  - Returns `PDFPageImage` (same type as `extractPdfPages`)
- Add region-to-coordinates mapping function: `resolveRegionToCrop(region, pageWidth, pageHeight)`
- Consider: page render caching (can be added later as optimization)

#### 3. `src/main/core/tools.ts`
- Add `extract_pdf_region` to `TOOL_DEFINITIONS` array (see schema above)
- Add `case 'extract_pdf_region':` to `executeTool()` switch
- Implement `extractPdfRegionForClaude(pageNumber, region?, crop?)` handler
  - Validates that either `region` or `crop` is provided
  - If `region`, converts to pixel coordinates via mapping function
  - Calls `extractPdfRegion` from pdf-extractor
  - Returns image content block (same format as extract_pdf_pages)
  - Saves crop to session images dir as `page-{N}-{region}.jpg` or `page-{N}-crop-{x}-{y}.jpg`

#### 4. `src/main/core/agent-loop.ts`
- No changes needed (tool results already handle image content blocks)
- `cleanupOldImages` already handles image-bearing tool results generically

### Phase 2: Knowledge — Teach Claude When and How to Use It

**Files to modify:**

#### 5. `resources/knowledge-base/CLAUDE.md`
- Add `extract_pdf_region` to the PDF Operations tools list:
  ```
  - `extract_pdf_region(page_number, region?, crop?)` - Zoom into a specific area of a page for detailed reading.
    Use after viewing the overview to read small text, dimensions, or callouts.
  ```
- Update the Working Notes section to mention that crops should also be documented

#### 6. `resources/knowledge-base/skills/ConstructionTakeoff.md`
- Update the methodology to incorporate the two-pass pattern:
  - Step 1 (existing): Extract pages for overview
  - Step 1.5 (new): For each page with important details, request crops of areas with dimension text, callouts, or material notes
  - Step 2+: Continue as before with reading/counting

#### 7. Workflow files (optional, lower priority)
- `workflows/QuantityTakeoff.md` — Add note about using `extract_pdf_region` for reading dimension callouts
- `workflows/ExtractSheets.md` — No change (sheet-level extraction, not detail-level)

### Phase 3: Tuning (After Initial Testing)

#### 8. Adjust batch limits and cleanup
- Currently `MAX_PAGES_PER_BATCH = 5` for full pages. Crops are single images, so they don't need batching.
- Consider whether crops should count toward the cleanup limit or be tracked separately
- If Claude is making many crop calls, the 2-second rate limit delay (`agent-loop.ts:98`) adds up. May need to reduce.

#### 9. Optional: Lower overview DPI
- Since the overview is now just for spatial context (Claude will crop for detail), consider dropping from 150 to 100 DPI
- This makes the overview image smaller (fewer tokens) and renders faster
- The crop tool handles the detail work at full DPI

#### 10. Optional: Page render cache
- If profiling shows re-rendering is a bottleneck, add an in-memory LRU cache for rendered page bitmaps
- Key: `(pageNumber, dpi)`, value: canvas bitmap or raw pixel buffer
- Evict after N pages (e.g., 10) to bound memory

---

## Expected Workflow (What Claude Does)

```
Turn 1:  Claude calls extract_pdf_pages([250, 251, 252, 253, 254])
         → Receives 5 full-page overview images

Turn 2:  Claude analyzes overviews:
         "Page 250 is sheet A0500 - Stair Plans. I can see stair locations
          but need to read the dimension callouts in the top-right area."
         "Page 253 is sheet A0510 - Stair Details. Dense detail views,
          I need to read material callouts."
         → Writes working notes
         → Calls extract_pdf_region(250, region='top-right')
         → Calls extract_pdf_region(253, region='top-left')

Turn 3:  Claude reads the cropped detail:
         "Now I can read: 13 RISERS @ 7 3/8", stringer is MC12x10.6..."
         → Calls extract_pdf_region(253, region='bottom-left')

Turn 4:  Claude continues...
         → Writes updated working notes
         → Requests next batch of overview pages
```

Compare to current approach where Claude would just see the overview and try to guess values it can't actually read.

---

## API Cost Estimate

For a 21-page takeoff with hybrid approach:

| Component | Count | Tokens Each | Total Tokens |
|-----------|-------|-------------|-------------|
| Overview images | 21 | ~1,750 | ~36,750 |
| Detail crops (avg 1.5 per page) | ~32 | ~1,750 | ~56,000 |
| **Total image tokens** | | | **~92,750** |

Compare to:
- Current (full-page only): ~36,750 image tokens — but can't read small text
- Blanket tiling: ~147,000 image tokens — reads everything but wastes tokens on blank areas

Hybrid falls in between and targets the tokens where they matter.

**Estimated cost per run (Sonnet + JPEG + baked skill + hybrid):**

| Scenario | Estimated Cost |
|----------|---------------|
| Few crops needed (simple drawings) | $1.00-1.50 |
| Moderate crops (typical takeoff) | $1.50-3.00 |
| Heavy crops (dense detail sheets) | $3.00-5.00 |

This is well within acceptable range, especially compared to the $20-40 blanket tiling with Opus would have cost.

---

## Files Changed Summary

| File | Change | Phase |
|------|--------|-------|
| `src/main/core/pdf-extractor.ts` | Add `extractPdfRegion()` function + region mapping | 1 |
| `src/main/core/tools.ts` | Add tool definition + execution handler | 1 |
| `resources/knowledge-base/CLAUDE.md` | Add tool to docs, update working notes section | 2 |
| `resources/knowledge-base/skills/ConstructionTakeoff.md` | Update methodology for two-pass pattern | 2 |
| `src/main/core/agent-loop.ts` | No changes expected (already handles image tool results) | — |
| `src/main/core/types.ts` | No changes expected | — |
| `workflows/QuantityTakeoff.md` | Optional: mention crop tool for dimension reading | 2 |

---

## Risks and Considerations

### Extra turns = more compounding history cost
Each crop request is an API round-trip. If Claude requests 2-3 crops per page across 21 pages, that's 40-60+ extra turns. The conversation history compounds. Mitigation: the working notes pattern already handles this, and the baked skill saves a turn. Monitor actual turn count in testing.

### Claude needs to learn when NOT to crop
If Claude crops every quadrant of every page, it degrades to blanket tiling. The skill and system prompt must be clear: crop only when the overview isn't sufficient to read a specific value. The ConstructionTakeoff skill already teaches "read from drawings, don't estimate" — this naturally pushes Claude toward cropping when it can't read values, and not cropping when it can.

### Rate limiting
With more tool calls, the 2-second delay between API calls adds up. A 40-turn session with 2-second delays = 80 seconds of just waiting. Consider reducing to 1 second or implementing adaptive rate limiting.

### Crop might span content boundaries
A named quadrant might split a stair section or detail view in half. Claude can handle this by requesting adjacent quadrants, but it's worth noting in the tool description that content may be split across regions.

---

## Open Questions (To Resolve During Implementation)

1. **Should crops include overlap?** e.g., each quadrant could be 55% of the page instead of 50%, creating a 10% overlap zone. This prevents content from being split exactly at the boundary. Adds ~10% more pixels per crop but improves usability.

2. **Should the overview include page dimensions in the response?** Claude needs to know the pixel dimensions of the rendered page if it wants to use coordinate-based crops. The tool result text could say "Page rendered at 5400x3600 pixels (150 DPI)" to help Claude calculate coordinates.

3. **Should we support multi-region in a single call?** e.g., `extract_pdf_region(250, regions=['top-right', 'bottom-left'])` to get two crops in one turn. Saves turns but increases per-request image load.
