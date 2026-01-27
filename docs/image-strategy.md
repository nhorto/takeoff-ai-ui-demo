# Image Strategy for TakeoffAI

How we send construction drawing images to Claude, what the constraints are, and what options we have for improving quality.

---

## The Problem

Construction drawings are large-format sheets (typically 24x36 inches). Claude needs to read small text like dimension callouts ("13 RISERS @ 7 3/8""), detail references, and notes from these drawings. The Anthropic API has strict size limits on images, and we need to fit the most readable image possible within those limits.

## Anthropic API Image Constraints

| Constraint | Limit | What It Means |
|-----------|-------|---------------|
| **Per-image file size** | 5 MB | Each base64-encoded image must be under 5MB |
| **Per-image pixel cap** | 1568 px on longest side | Anthropic auto-resizes any image exceeding this before Claude sees it |
| **Total request size** | ~32 MB | The entire API request (system prompt + conversation + images + tools) |
| **Images per request** | 100 max (but 2000px cap when >20 images) | Pixel limit drops when sending many images |

The 1568px cap is the key constraint. No matter what resolution we send, Claude never sees more than 1568px on any side. For a 24x36 inch drawing, that means Claude sees it at roughly **43 effective DPI** — about the same as viewing the full sheet on a 1080p monitor.

## Current Implementation (v1 - Full Page)

**How it works:**
1. Render PDF page at 150 DPI (3600x5400 pixels for 24x36 sheet)
2. Downscale to fit 1568px max dimension (1045x1568 pixels)
3. Export as PNG (~200-400 KB per image)
4. Send max 5 pages per API call
5. Old batches cleaned up after new ones arrive

**Pros:**
- Simple, one image per page
- Claude sees the full sheet layout (title block, general arrangement, notes)
- Low image count = more room in the API request

**Cons:**
- Small text (dimensions, callouts) may be illegible at ~43 effective DPI
- Dense detail sheets lose fine information
- Claude may miss critical values it needs to read

**Best for:** Getting an overview of what's on each sheet, identifying sheet types, reading large text and general layouts.

---

## Option A: Tiling (Recommended Next Step)

Split each page into tiles (e.g., 4 quadrants). Each tile gets the full 1568px treatment, effectively doubling the resolution on every part of the drawing.

**How it would work:**
1. Render page at 150 DPI (3600x5400 pixels)
2. Split into 4 quadrants: top-left, top-right, bottom-left, bottom-right
3. Each quadrant is ~1800x2700 pixels
4. Downscale each to 1568px max → ~1045x1568 pixels
5. Send tiles to Claude (4 images per page instead of 1)

**Effective resolution:** ~87 DPI (2x improvement over full-page approach)

**Pros:**
- 2x detail on every part of the drawing — dimension text should be readable
- No manual work — fully automatic
- Tiles can be labeled ("top-left quadrant of page 250") so Claude knows spatial context
- Each tile is still small (~200-400 KB)

**Cons:**
- 4x the images per page → 5 pages becomes 20 images
- With the 5-image-per-batch limit, only ~1 page per batch (4 tiles + 1 overflow)
- More API calls needed, higher token cost
- Content split across tile boundaries may be harder to interpret

**Batch sizing with tiling:**
- Current: 5 full-page images per batch
- With 4 tiles per page: either increase batch to ~8 images (2 pages worth) or accept 1 page per batch
- May need to adjust `MAX_PAGES_PER_BATCH` and `cleanupOldImages` keepRecentCount

**Could also do 2 tiles (top/bottom half):**
- Only 2x images instead of 4x
- Still a meaningful resolution improvement (~1.4x)
- Better fit with current batching limits

---

## Option B: Cropping to Relevant Areas

Instead of blindly tiling, crop to the specific regions that matter (detail views, schedules, dimension strings, stair sections).

**How it would work:**
1. First pass: Send full page at low res so Claude sees the layout
2. Claude identifies regions of interest ("I need to zoom into the stair section at the center of this sheet")
3. Extract just those regions at high resolution
4. Claude reads the cropped areas in detail

**Effective resolution:** Very high — depends on crop size. A 12x12 inch crop at 150 DPI = 1800x1800 → fits in 1568px with minimal downscaling. That's ~130 DPI effective — easily readable.

**Pros:**
- Highest quality where it matters
- Minimal wasted resolution on blank/irrelevant areas
- Fewer images overall (only extract what's needed)

**Cons:**
- Requires two passes (overview + detail)
- Need a mechanism for Claude to specify crop regions (coordinates or named areas)
- More complex implementation
- Adds latency from the extra round-trip

**Implementation complexity:** Medium-high. Would need:
- A new tool like `extract_pdf_region(page, x, y, width, height)` or `extract_pdf_region(page, quadrant)`
- Logic for Claude to specify regions (could be as simple as "top-left", "center", "bottom-right")
- Full-page overview at low res as a first step

---

## Option C: Hybrid (Full Page + Tiles or Crops)

Combine approaches: send a full-page overview first, then follow up with tiles or crops for detail.

**How it would work:**
1. Send full page at current resolution (1045x1568) for layout context
2. Then send tiled or cropped versions for areas that need detail reading
3. Claude uses the overview for spatial understanding and the detail images for accurate reading

**Pros:**
- Best of both worlds — layout context AND readable detail
- Claude can request detail only where needed (saves images on simple sheets)
- Most similar to how a human estimator works (zoom out, then zoom in)

**Cons:**
- Most complex implementation
- Highest image count per page (1 overview + 2-4 detail images)
- Need to coordinate between overview and detail passes

---

## Option D: Different API Provider

Switch from Anthropic to a provider with higher image resolution limits.

| Provider | Max Image Resolution | Notes |
|----------|---------------------|-------|
| **Anthropic Claude** | 1568px (auto-resize) | Current provider, best reasoning |
| **Google Gemini** | Higher resolution, 2M token context | May not match Claude's drawing interpretation |
| **OpenAI GPT-4o** | Different limits | Would require full rewrite |

**Pros:**
- Could get significantly higher resolution to Claude-equivalent models
- Larger context windows could hold more images

**Cons:**
- Major rewrite of agent loop, SDK, tools, and prompts
- Unknown quality of construction drawing interpretation
- Different API patterns and error handling
- Risk of regression in takeoff accuracy

**Recommendation:** Only consider if other approaches don't achieve sufficient quality.

---

## Option E: Pre-process with OCR

Run OCR on drawings before sending to Claude. Send extracted text data alongside lower-res images.

**How it would work:**
1. Run Tesseract or similar OCR on each page
2. Extract all readable text with coordinates
3. Send text data + low-res image to Claude
4. Claude uses text for values, image for spatial understanding

**Pros:**
- Text data is tiny compared to images
- Could capture dimension strings OCR can read
- Reduces dependence on image quality

**Cons:**
- OCR on construction drawings is unreliable (non-standard fonts, overlapping elements, hand markup)
- Adds a significant dependency (Tesseract or similar)
- Need to handle OCR errors/noise
- Coordinate mapping between OCR text and drawing features

---

## Recommendation Path

```
Phase 1 (Current):  Full-page images with resize + batching
                     ✅ Implemented — works but limited detail

Phase 2 (Next):      Tiling (4 quadrants per page)
                     2x resolution improvement, automatic, no manual work

Phase 3 (Later):     Hybrid (overview + detail crops)
                     Highest quality, Claude-driven cropping

Phase 4 (If needed): Different API or OCR augmentation
                     Only if Phase 2-3 don't achieve sufficient accuracy
```

---

## Key Numbers Reference

For a typical 24x36 inch construction drawing sheet:

| Approach | Pixels Claude Sees | Effective DPI | Estimated Readability |
|----------|-------------------|---------------|----------------------|
| Full page (current) | 1045 x 1568 | ~43 | Large text OK, small dims hard |
| 4 tiles | 1045 x 1568 each (per quadrant) | ~87 | Most text readable |
| 2 tiles (top/bottom) | 1045 x 1568 each (per half) | ~65 | Moderate improvement |
| Targeted crop (12x12") | ~1300 x 1300 | ~108 | Fine text readable |
| Targeted crop (6x6") | ~1568 x 1568 | ~261 | Everything readable |

Note: These are approximate. Actual effective DPI depends on the sheet size in the PDF.
