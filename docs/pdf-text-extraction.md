# PDF Text Extraction

Text-first workflow for reading construction drawing annotations without image tokens.

---

## Problem

The agent relies entirely on visual image analysis to read construction drawings. Small text annotations like "18R/17T" (riser/tread counts) are frequently missed because they're tiny on overview images. Reading them requires expensive cropping — each crop costs ~$0.01-0.02 in image tokens and adds an API round trip.

But construction PDFs from CAD software (AutoCAD, Revit) embed text as actual text objects. pdf.js can extract this text natively using `page.getTextContent()` — no OCR needed, no image tokens consumed.

---

## Solution

Extract text from all PDF pages at upload time, give the agent tools to read that text, and change the workflow to **"read text first, images second."**

### What This Gets Us

| Before | After |
|--------|-------|
| Extract image → crop annotation → read "18R/17T" | `get_page_text([page])` → read "18R/17T" directly |
| ~$0.02 per annotation read (image tokens) | $0.00 per annotation read (text only) |
| 1 API round trip per crop | Zero round trips for text values |
| Medium confidence (visual read) | High confidence (machine-readable text) |

---

## Architecture

### Text Extraction Pipeline

```
PDF Upload
    │
    ▼
extractAllPagesText(pdfPath)          ← pdf-text-extractor.ts
    │
    ├── Hidden BrowserWindow + pdf.js CDN (same pattern as image extraction)
    ├── page.getTextContent() for every page
    ├── Transform matrix → (x, y) coordinates
    └── Spatial zone grouping
    │
    ▼
PDFTextData (structured JSON)
    │
    ├── Saved to {sessionDir}/pdf-text-data.json
    └── Stored in globalTextData (tools.ts)
    │
    ▼
Agent tools: get_page_text / search_pdf_text
```

### Spatial Zone Grouping

Each text item is classified into zones based on its x,y position on the page:

```
┌─────────────────┬─────────────────┐
│                 │                 │
│    top-left     │   top-right     │
│                 │                 │
├─────────────────┼─────────────────┤
│                 │                 │
│   bottom-left   │  bottom-right   │
│                 │                 │
│                 ├─────────────────┤
│                 │  title-block    │
│                 │  (bottom 15%,   │
│                 │   right 40%)    │
└─────────────────┴─────────────────┘
        center = middle 50% x 50%
```

Title block detection targets the bottom-right corner where architectural drawings place sheet info (sheet number, title, project name).

---

## Files

| File | Role |
|------|------|
| `src/main/core/pdf-text-extractor.ts` | Core extraction module — `extractAllPagesText()` |
| `src/main/core/types.ts` | `TextItem`, `SpatialZone`, `PageTextData`, `PDFTextData` interfaces |
| `src/main/core/tools.ts` | `get_page_text` and `search_pdf_text` tool definitions + execution |
| `src/main/ipc-handlers.ts` | Calls extraction on PDF upload (start-takeoff handler) |
| `src/main/core/orchestrator.ts` | Calls extraction on orchestrated takeoff, injects text info into phase messages |

### Knowledge Base Updates

| File | Change |
|------|--------|
| `resources/knowledge-base/CLAUDE.md` | Text-First Workflow section, new tool docs |
| `resources/knowledge-base/skills/DiscoveryPhase.md` | Workflow updated: text before images |
| `resources/knowledge-base/skills/CountingPhase.md` | "Step 0: Read Text First" added |

---

## Data Structures

```typescript
interface TextItem {
  text: string;       // The text content
  x: number;          // X position (points, top-down)
  y: number;          // Y position (points, top-down)
  fontSize: number;   // Font size from transform matrix
}

interface SpatialZone {
  zone: string;       // "top-left", "title-block", etc.
  text: string;       // All text in this zone, space-joined
}

interface PageTextData {
  pageNumber: number;
  zones: SpatialZone[];
  fullText: string;        // All text concatenated (for search)
  textItemCount: number;
}

interface PDFTextData {
  pageCount: number;
  pages: PageTextData[];
  isEmpty: boolean;        // true if avg < 50 chars/page
}
```

---

## Agent Tools

### `get_page_text(page_numbers)`

Returns extracted text for specified pages with zone grouping. Output format:

```
=== Page 250 (847 text items) ===

[top-left]
STAIR 1 SECTION A-A LEVEL 00 TO LEVEL 01 ...

[title-block]
A0500 STAIR 1 PLANS AND SECTIONS CANNONDESIGN ...

[full-text]
STAIR 1 SECTION A-A LEVEL 00 TO LEVEL 01 18R/17T 7" RISER (TYP) ...
```

### `search_pdf_text(query)`

Case-insensitive search across all pages. Returns page numbers and context snippets:

```
Found "MC12" on 3 page(s):

Page 260:
  • ...STRINGER: MC12 x 10.6 A36 STEEL...

Page 261:
  • ...TYP STRINGER MC12x10.6 SEE DETAIL 3/A0512...
```

---

## Scanned PDF Detection

Not all PDFs have embedded text. Scanned PDFs (photos/scans of paper drawings) have no text objects.

**Detection:** If average characters per page < 50, the PDF is flagged as `isEmpty: true`.

**Behavior when scanned:**
- Console log: `⚠️ SCANNED PDF DETECTED: Text extraction returned < 50 chars/page avg.`
- Agent message: "Text extraction returned no useful text — this PDF appears scanned. Use image-based workflow."
- Text tools return warning messages instead of empty results
- `pdf-text-data.json` is still saved (user can inspect what was found)
- No OCR fallback (Tesseract.js could be added later if needed)

---

## Performance

- **Extraction time:** ~50-100ms per page
- **Runs once:** At PDF upload, before the agent loop starts
- **Memory:** Text data is small (typically < 1MB even for 300-page PDFs)
- **No new dependencies:** Uses the same pdf.js CDN already loaded for image extraction

---

## Agent Workflow Changes

### Discovery Phase

```
BEFORE:                              AFTER:
1. Extract page images               1. get_page_text([pages])
2. Read sheet titles visually         2. Read sheet titles from text
3. Crop detail sheets for specs       3. search_pdf_text("MC12")
4. Write discovery.json               4. Extract images for layout context
                                      5. Crop ONLY if text missed a value
                                      6. Write discovery.json
```

### Counting Phase (Biggest Win)

```
BEFORE:                              AFTER:
1. Extract section view image         1. get_page_text([stair_pages])
2. Try to read "18R/17T" visually     2. Find "18R/17T" in text → done
3. Crop if too small                  3. ONE overview image to verify
4. Count treads visually              4. Crop ONLY if no text annotation
5. Crop again if unsure
```

**Expected savings:** 2-5 fewer crops per stair when annotations are present in text. For a 5-stair project, that's 10-25 fewer image round trips.

---

## Testing

1. Build: `npm run build`
2. Upload a CAD-generated PDF → check console for text extraction stats
3. Verify `pdf-text-data.json` exists in session temp dir
4. Agent should call `get_page_text` before `extract_pdf_pages`
5. Test with a scanned PDF → verify fallback warning appears
6. Compare token usage between text-first and image-only runs
