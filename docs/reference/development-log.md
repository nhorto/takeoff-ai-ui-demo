# TakeoffAI Development Log

Summary of changes, decisions, and next steps for the TakeoffAI Electron application.

---

## Background

TakeoffAI is an Electron desktop app that uses the Claude API to perform construction quantity takeoffs from PDF drawings. The user uploads a PDF of construction documents, the app extracts pages as images, sends them to Claude, and Claude analyzes the drawings to produce a bill of materials (CSV) and coordination report.

The app was ported from a Node.js proof-of-concept (`takeoff-ai-poc`) to Electron. Both projects share nearly identical architecture: an agent loop that calls Claude's API, executes tools (PDF extraction, file I/O, user questions), and streams updates to the UI.

---

## Problems Encountered and Fixes

### Problem 1: 413 Request Too Large

**What happened:** Claude requested all 21 stair-related pages in a single `extract_pdf_pages` call. The combined base64 images exceeded the Anthropic API's ~32 MB request size limit.

**Root cause:** No per-call limit on how many pages could be extracted. The tool description didn't tell Claude to limit batch size.

**Fix (tools.ts):**
- Added `MAX_PAGES_PER_BATCH = 5` constant
- Modified `extractPdfPagesForClaude()` to cap at 5 pages per call
- If more pages are requested, only the first 5 are returned; the status message tells Claude to request the remaining pages in follow-up calls
- Updated the `extract_pdf_pages` tool description to say "Maximum 5 pages per call"

**Files changed:** `src/main/core/tools.ts`

---

### Problem 2: 400 Image Exceeds 5 MB

**What happened:** After fixing the batch limit, a single construction drawing rendered at 150 DPI produced a 6.9 MB PNG — exceeding Anthropic's 5 MB per-image limit.

**Root cause:** Construction drawings are large-format (24x36 inches). At 150 DPI, a single page renders to 3600x5400 pixels, which is too large even as a single image.

**Key insight:** Anthropic auto-resizes any image to a maximum of 1568px on its longest side before Claude processes it. So sending a 5400px image provides zero benefit over a 1568px image — Claude sees the same thing. Rendering at high DPI and then downscaling (supersampling) produces a cleaner result than rendering directly at low DPI.

**Fix (pdf-extractor.ts):**
- After rendering at 150 DPI, added a resize step that downscales the image to fit within 1568x1568 pixels
- This produces images of ~200-400 KB each (well under the 5 MB limit)
- The supersampling from 150 DPI gives better quality than rendering directly at ~43 DPI

**Files changed:** `src/main/core/pdf-extractor.ts`

---

### Problem 3: 400 Too Many cache_control Blocks

**What happened:** After 4 batches of page extractions, the API returned: "A maximum of 4 blocks with cache_control may be provided. Found 5."

**Root cause:** The code added a `cache_control: { type: "ephemeral" }` marker to the last image in every tool result containing images. The system prompt also had one. After 4 image batches: 1 (system prompt) + 4 (image batches) = 5 markers, exceeding the API's limit of 4.

**Fix (agent-loop.ts):**
- Removed `cache_control` from image content blocks in both `executeToolCalls()` and `buildInitialMessage()`
- Only the system prompt retains its `cache_control` marker (1 out of 4 allowed)
- System prompt caching is the main cost benefit; images change every turn and get cleaned up anyway

**Files changed:** `src/main/core/agent-loop.ts`

---

### Problem 4: Agent Looping (50+ Iterations)

**What happened:** After a separate session changed `MAX_ITERATIONS` from 25 to 100 and `cleanupOldImages` keepRecentCount from 1 to 5, Claude would extract all pages then start over, re-extracting pages endlessly because earlier images had been removed from the conversation.

**Root cause:** When old images get cleaned up (replaced with text summaries), Claude has no record of what it already analyzed. It sees the cleanup message saying "images removed" but has no way to recover the data it extracted. So it re-extracts.

**Fix — Working Notes System:**

Implemented a persistent external memory system so Claude can reference its earlier findings without re-extracting pages.

**Changes across 4 files:**

1. **tools.ts** — Added `globalSessionDir` state management. After extracting images, saves PNGs to the session temp directory. Status messages remind Claude to write findings to the working notes file.

2. **agent-loop.ts** — Updated the `cleanupOldImages` replacement message to point Claude to the working notes file path, telling it to read notes instead of re-extracting.

3. **ipc-handlers.ts** — Creates a session temp directory at `/tmp/takeoff-session-{timestamp}/` with an `images/` subfolder. Passes the working notes file path in the initial message. Instructs Claude to maintain notes.

4. **CLAUDE.md (system prompt)** — Added a full "Working Notes (Image Memory Management)" section with required workflow, rules, and a structured notes format template.

**Files changed:** `src/main/core/tools.ts`, `src/main/core/agent-loop.ts`, `src/main/ipc-handlers.ts`, `resources/knowledge-base/CLAUDE.md`

---

### Problem 5: Notes Format — Summary vs. Raw Data

**What happened:** With the working notes system in place, Claude successfully iterated through all 21 pages without looping. However, the notes it wrote were structured like draft reports — summary tables, polished inventories, narrative observations. When Claude read the notes back, it had summaries of what each batch contained, but not the raw extracted data it needed for the takeoff.

For example, Claude wrote: "Various dimension strings but hard to read specific values" instead of recording partial values like "dimension near grid bA looks like 4'-something."

**Decision:** Restructured the notes format to have two distinct sections:

- **Section 1: Page-by-Page Observations** — A chronological diary using structured categories: `Saw`, `Read`, `Partial`, `Not found`, `Notes`. Captures everything Claude observed including partial reads and failed extraction attempts. This tells Claude what it already looked at.

- **Section 2: Structured Data Form** — A per-stair data collection form with specific fields for every value the takeoff needs (levels, configuration, width, flights table with risers/heights/treads, landings, material specs). Values get filled in progressively. Gaps marked as `[NOT FOUND]` or `[PARTIAL: value]`.

**Key rules added:**
- "Do NOT write summary reports as your notes" — keeps notes as raw working data
- "Record partial reads" — partial values are more useful than "not readable"

**Files changed:** `resources/knowledge-base/CLAUDE.md`

---

## Decisions Made

### DPI and Image Pipeline

**Decision:** Render at 150 DPI, then downscale to 1568px max dimension.

**Rationale:** Anthropic auto-resizes all images to 1568px max before Claude processes them. Rendering at high DPI and downscaling (supersampling) produces better quality than rendering directly at low resolution. 150 DPI was chosen as a good balance — high enough for quality supersampling, but the rendered image (before downscale) stays within manageable memory limits.

**Result:** Each page ends up as a ~1045x1568 pixel image at approximately 43 effective DPI. Large text (sheet titles, stair labels, level callouts) is readable. Small text (dimension callouts like "13R @ 7 3/8"") is often not readable at this resolution.

### Batch Size

**Decision:** Maximum 5 pages per `extract_pdf_pages` call.

**Rationale:** With images at ~200-400 KB each after resize, 5 images total ~1-2 MB of base64 data per tool result. This is comfortably within the API's ~32 MB request limit while allowing efficient batching. Smaller batches (3-4) would work but slow down processing. Larger batches (8-10) risk hitting the limit as conversation history grows.

### Image Cleanup

**Decision:** Keep the 5 most recent image groups in conversation (`keepRecentCount = 5`).

**Rationale:** At 5 images per group and ~300 KB per image, 5 groups = ~25 images = ~7.5 MB of base64 in the conversation. This is safe within API limits and gives Claude access to recent images for cross-referencing between batches. Older images are replaced with text summaries pointing to the working notes file.

### Working Notes Format

**Decision:** Two-section format (page diary + structured data form) over a single summary format.

**Rationale:** The single summary format caused Claude to write report-like output that lost raw data. The two-section format separates what Claude *observed* (Section 1) from what data it *extracted* (Section 2). Section 1 prevents duplicate work (Claude knows what it already looked at). Section 2 gives Claude the exact data it needs to compile the final output, organized by stair rather than by page batch.

---

## Current Limitations

### Image Resolution

The primary limitation is image quality. At ~43 effective DPI (full page at 1568px), Claude can identify:
- Sheet layouts and titles
- Stair configurations (scissor, switchback, straight)
- Level counts and floor plans
- General construction type

But it **cannot reliably read**:
- Dimension callouts (e.g., "13R @ 7 3/8"")
- Small text annotations
- Material size specifications in notes columns
- Riser/tread counts from section views

This means Claude can identify all the stairs and their general scope, but cannot produce an accurate bill of materials because the exact quantities (riser counts, heights, stair widths, material sizes) are not readable.

See `docs/image-strategy.md` for a full analysis of the constraint and available approaches.

### Token Cost

A full 21-page analysis costs approximately $1.50-2.00 in API tokens. The majority of the cost is input tokens from the growing conversation history (images + working notes). Tiling would increase this since each page becomes multiple images.

### Skills and Knowledge Base Loading (Needs Investigation)

Claude is not loading the workflow documentation that contains the detailed step-by-step takeoff methodology. This likely contributes to suboptimal behavior during the analysis.

**The problem:**

There are three knowledge-loading tools, and their roles are unclear:

| Tool | What it does | Files it accesses |
|------|-------------|-------------------|
| `read_skill(skill_name)` | Loads a skill by name (enum: `ConstructionTakeoff`, `CoordinationReview`, `FullAnalysis`) | `knowledge-base/skills/{name}.md` |
| `read_documentation(doc_path)` | Reads any file from the knowledge base by relative path | `knowledge-base/{doc_path}` |
| `list_available_skills()` | Lists files in the skills directory | `knowledge-base/skills/` |

**Issues identified:**

1. **Missing skill files.** The `read_skill` tool accepts three enum values (`ConstructionTakeoff`, `CoordinationReview`, `FullAnalysis`), but only `skills/ConstructionTakeoff.md` exists as a file. The other two would return errors. There are `CoordinationReview` and `FullAnalysis` workflow files, but they're in `workflows/`, not `skills/`.

2. **Workflow documentation never gets loaded.** The `ConstructionTakeoff` skill references four workflow files:
   - `workflows/QuantityTakeoff.md` — the core step-by-step takeoff process
   - `workflows/CoordinationReview.md`
   - `workflows/FullAnalysis.md`
   - `workflows/ExtractSheets.md`

   The skill's routing table lists these files, but doesn't explicitly tell Claude to call `read_documentation("workflows/QuantityTakeoff.md")` to load them. In the test run, Claude loaded the skill on Turn 1 but **never loaded any workflow documentation**. It performed the takeoff based only on the skill's high-level methodology section, missing the detailed step-by-step instructions.

3. **Tool overlap is confusing.** Having `read_skill`, `read_documentation`, and `list_available_skills` as three separate tools is likely unnecessary. Claude has to figure out which tool loads what. A simpler design might be a single tool that loads any knowledge base file, or automatically loading the relevant workflow when the skill is loaded.

**What the actual knowledge base contains:**
```
knowledge-base/
├── CLAUDE.md                              (system prompt — loaded automatically)
├── skills/
│   └── ConstructionTakeoff.md             (main skill — methodology overview)
└── workflows/
    ├── QuantityTakeoff.md                 (detailed takeoff steps — NEVER LOADED)
    ├── CoordinationReview.md              (coordination process — NEVER LOADED)
    ├── FullAnalysis.md                    (combined workflow — NEVER LOADED)
    └── ExtractSheets.md                   (PDF extraction steps — NEVER LOADED)
```

**Needs investigation:**
- Should workflows be auto-loaded when the skill is loaded?
- Should the three tools be consolidated into one?
- Should the skill file explicitly instruct Claude to load the relevant workflow?
- Are the workflow files actually useful, or is the skill file sufficient on its own?
- Do the `CoordinationReview` and `FullAnalysis` enum values need corresponding skill files, or should they be removed from the enum?

---

## Next Steps: Improving Image Resolution

The image quality limitation is the critical blocker preventing accurate takeoffs. Claude needs to read small dimension callouts that are currently illegible at ~43 effective DPI. The recommended approach is a tiling strategy, progressing from simple to hybrid.

### Phase 1: Basic Tiling (Recommended First Implementation)

Split each page into tiles so each tile gets the full 1568px treatment from Anthropic's auto-resize.

**How it works:**
1. Render page at 150 DPI (3600x5400 pixels for a 24x36" sheet)
2. Split into 4 quadrants: top-left, top-right, bottom-left, bottom-right
3. Each quadrant is ~1800x2700 pixels
4. Downscale each to fit 1568px max dimension (~1045x1568 pixels per tile)
5. Send tiles to Claude with position labels (e.g., "Page 250 - top-left quadrant")

**Effective resolution:** ~87 DPI (2x improvement over current full-page). Most text including dimension callouts should be readable at this resolution.

**Impact on batching:**
- Current: 5 full-page images per batch = 5 pages per batch
- With 4 tiles per page: 5 images per batch = ~1 page per batch (4 tiles + possible overflow)
- Alternative: Increase batch size to 8 images = 2 pages per batch (8 tiles)
- The `MAX_PAGES_PER_BATCH` and batch logic in `extractPdfPagesForClaude()` would need to change to think in terms of images rather than pages

**Changes needed:**
- `pdf-extractor.ts`: Add tiling logic after rendering — split the rendered canvas into quadrants, downscale each independently, return multiple images per page
- `tools.ts`: Update `extractPdfPagesForClaude()` to handle multiple images per page. Update batch limit logic (cap by total images, not pages). Update status messages to label tile positions.
- `CLAUDE.md`: Update working notes guidance to account for tiles (Claude will see each page as 4 separate images)
- Consider: Should the tool API change? Options:
  - Keep `extract_pdf_pages([page_numbers])` but return 4x more images (transparent to Claude)
  - Add a `resolution` parameter: `extract_pdf_pages([pages], "tiled")` vs `extract_pdf_pages([pages], "overview")`
  - Add a separate tool: `extract_pdf_page_tiles(page_number)` for detail views

**Tile count options:**
- 4 tiles (2x2 grid): Best resolution improvement, but 4x the images
- 2 tiles (top/bottom halves): Moderate improvement (~65 effective DPI), only 2x the images
- Starting with 2 tiles may be a good middle ground

### Phase 2: Hybrid Approach (Overview + Detail Tiles)

Combine a full-page overview with tiled detail views. This mimics how a human estimator works: zoom out to understand the layout, then zoom in to read specific values.

**How it works:**
1. First pass: Send full page at current resolution (1045x1568) for layout context
2. Claude identifies which regions need detail reading (e.g., "I need to read the riser callout in the section view on the left side of page 250")
3. Second pass: Send tiled or cropped versions of those specific regions
4. Claude uses the overview for spatial understanding and the detail images for accurate value extraction

**This requires:**
- A way for Claude to request detail views of specific page regions
- Either automatic tiling (always send overview + tiles) or on-demand cropping (Claude requests specific areas)
- A new tool like `extract_pdf_region(page, quadrant)` where quadrant is "top-left", "top-right", etc.

**Advantages over basic tiling:**
- Claude gets layout context from the overview (which tiles lose when content is split across tile boundaries)
- Only detailed views are sent for pages that need them (simple pages like elevator sheets don't need tiles)
- More efficient token usage — not every page needs 4x the images

**Disadvantages:**
- More complex implementation
- Requires two passes per page (overview first, then detail)
- More API round-trips and higher latency per page

### Phase 3: Smart Cropping (If Needed)

Instead of fixed quadrant tiles, crop to specific regions of interest at maximum resolution. A 12x12" crop at 150 DPI = 1800x1800 pixels, which fits in 1568px with minimal downscaling (~108 effective DPI). A 6x6" crop gives ~261 effective DPI — every character would be readable.

This would require Claude to specify crop coordinates or named regions, and a tool like:
```
extract_pdf_region(page_number, x, y, width, height)
```

This is the highest-quality approach but also the most complex. Only worth implementing if Phase 1-2 tiling doesn't achieve sufficient readability.

### Recommended Implementation Order

```
Phase 1:  Basic tiling (4 quadrants per page)
          → 2x resolution, automatic, simplest change
          → Test if dimension callouts become readable

Phase 2:  Hybrid (overview + tiles on demand)
          → Layout context preserved, efficient token usage
          → Only if Phase 1 tiles lose too much spatial context

Phase 3:  Smart cropping (targeted high-res regions)
          → Maximum quality where it matters
          → Only if Phase 1-2 don't achieve sufficient accuracy
```

### Key Numbers Reference

For a typical 24x36 inch construction drawing:

| Approach | Pixels Claude Sees | Effective DPI | Readability |
|----------|-------------------|---------------|-------------|
| Full page (current) | 1045 x 1568 | ~43 | Large text only |
| 2 tiles (top/bottom) | 1045 x 1568 each | ~65 | Moderate improvement |
| 4 tiles (quadrants) | 1045 x 1568 each | ~87 | Most text readable |
| Targeted crop 12x12" | ~1300 x 1300 | ~108 | Fine text readable |
| Targeted crop 6x6" | ~1568 x 1568 | ~261 | Everything readable |

---

## File Reference

All files modified during this development phase:

| File | Changes |
|------|---------|
| `src/main/core/tools.ts` | Batch limit, session directory, image saving, notes reminders |
| `src/main/core/agent-loop.ts` | Removed cache_control from images, cleanup points to notes file |
| `src/main/core/pdf-extractor.ts` | Image resize to 1568px max (supersampling) |
| `src/main/ipc-handlers.ts` | Session temp directory, working notes path in initial message |
| `resources/knowledge-base/CLAUDE.md` | Working notes system, structured notes format |
| `docs/image-strategy.md` | Image strategy options documentation (created) |
| `docs/development-log.md` | This file (created) |
