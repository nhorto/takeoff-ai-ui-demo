/**
 * Test 2: unpdf Text Extraction Quality
 *
 * Validates that unpdf (edge-compatible pdfjs-dist wrapper) extracts text
 * from construction PDFs with spatial layout comparable to our current
 * pdfjs-dist spatial clustering approach.
 *
 * Current app extracts:
 *   - Text items with (x, y, fontSize) coordinates
 *   - Spatial zones: top-left, top-right, bottom-left, bottom-right, title-block, center
 *   - Full text per page
 *
 * Pass criteria: Text extraction captures the same annotations, dimensions,
 * and spatial relationships. Claude should be able to identify stair names,
 * page references, and dimension text from the output.
 */

import { extractText, getDocumentProxy } from 'unpdf';
import type { Env } from './types';

export async function handleUnpdfTest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pageNum = parseInt(url.searchParams.get('page') || '1', 10);
  const allPages = url.searchParams.get('all') === 'true';

  try {
    // Get the active test PDF
    const activeKeyObj = await env.BUCKET.get('test-pdfs/_active.txt');
    if (!activeKeyObj) {
      return new Response(JSON.stringify({
        error: 'No test PDF uploaded. POST a PDF to /upload first.',
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const pdfKey = await activeKeyObj.text();

    const pdfObj = await env.BUCKET.get(pdfKey);
    if (!pdfObj) {
      return new Response(JSON.stringify({
        error: `PDF not found at key: ${pdfKey}`,
      }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Check PDF size — Workers have 128MB memory limit
    if (pdfObj.size > 50 * 1024 * 1024) {
      return new Response(JSON.stringify({
        error: `PDF is ${(pdfObj.size / 1024 / 1024).toFixed(1)} MB. Workers have 128MB memory limit. Upload a smaller PDF (under 50MB) for this test, or use individual drawing sheets. In production, large PDFs would be split before processing.`,
        suggestion: 'Try uploading a single sheet or a smaller subset of the drawing set.',
      }), { status: 413, headers: { 'Content-Type': 'application/json' } });
    }

    const startTime = Date.now();
    const pdfBuffer = await pdfObj.arrayBuffer();
    // Copy the buffer since unpdf consumes/detaches it
    const bufferCopy = pdfBuffer.slice(0);

    // Method 1: Simple text extraction (full document)
    const { text: fullText, totalPages } = await extractText(new Uint8Array(pdfBuffer));

    // Method 2: Per-page extraction with text item coordinates
    const doc = await getDocumentProxy(new Uint8Array(bufferCopy));
    const pagesToProcess = allPages
      ? Array.from({ length: totalPages }, (_, i) => i + 1)
      : [pageNum];

    const pageResults = [];

    for (const pNum of pagesToProcess) {
      if (pNum < 1 || pNum > totalPages) continue;

      const page = await doc.getPage(pNum);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1.0 });

      // Extract text items with coordinates (similar to current app)
      const textItems = textContent.items
        .filter((item: any) => item.str && item.str.trim().length > 0)
        .map((item: any) => {
          // item.transform = [scaleX, skewY, skewX, scaleY, translateX, translateY]
          const x = item.transform[4];
          const y = item.transform[5];
          const fontSize = Math.sqrt(
            item.transform[0] * item.transform[0] +
            item.transform[1] * item.transform[1]
          );

          return {
            text: item.str,
            x: Math.round(x * 100) / 100,
            y: Math.round(y * 100) / 100,
            width: Math.round(item.width * 100) / 100,
            height: Math.round(item.height * 100) / 100,
            fontSize: Math.round(fontSize * 100) / 100,
          };
        });

      // Classify into spatial zones (matching current app's zone logic)
      const pageWidth = viewport.width;
      const pageHeight = viewport.height;
      const zones = classifyIntoZones(textItems, pageWidth, pageHeight);

      // Build full text with spatial layout (sorted by Y then X)
      const sortedItems = [...textItems].sort((a, b) => {
        // Sort top-to-bottom (higher Y = higher on page in PDF coords)
        const yDiff = b.y - a.y;
        if (Math.abs(yDiff) > 5) return yDiff;
        // Within same row, sort left-to-right
        return a.x - b.x;
      });

      const layoutText = buildLayoutText(sortedItems, pageWidth);

      pageResults.push({
        pageNumber: pNum,
        pageWidth: Math.round(pageWidth),
        pageHeight: Math.round(pageHeight),
        textItemCount: textItems.length,
        zones,
        layoutText,
        textItems: textItems.slice(0, 100), // First 100 items for inspection
        hasMoreItems: textItems.length > 100,
      });
    }

    const extractionTime = Date.now() - startTime;

    // Store results in R2 for comparison
    const resultKey = allPages
      ? `test-text/all-pages.json`
      : `test-text/page-${pageNum}.json`;

    const result = {
      success: true,
      pdfKey,
      totalPages,
      extractionTimeMs: extractionTime,
      pagesProcessed: pagesToProcess.length,
      pages: pageResults,
      comparison: {
        note: 'Compare this output to the current Electron app text extraction.',
        checkFor: [
          'Stair names and identifiers (e.g., "STAIR A", "STR-1")',
          'Page references (e.g., "SEE SHEET S3.1")',
          'Dimension callouts (e.g., "7\'-11 1/2\\"", "14 GA")',
          'Schedule table content',
          'Annotation text near drawing elements',
          'Title block information',
        ],
      },
    };

    await env.BUCKET.put(resultKey, JSON.stringify(result, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });

    return new Response(JSON.stringify(result, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Classify text items into spatial zones matching the current app's logic:
 *   top-left, top-right, bottom-left, bottom-right, title-block, center
 */
function classifyIntoZones(
  items: Array<{ text: string; x: number; y: number; fontSize: number }>,
  pageWidth: number,
  pageHeight: number,
) {
  const zones: Record<string, string[]> = {
    'top-left': [],
    'top-right': [],
    'bottom-left': [],
    'bottom-right': [],
    'title-block': [],
    'center': [],
  };

  for (const item of items) {
    const nx = item.x / pageWidth;   // Normalized 0-1
    const ny = item.y / pageHeight;  // Normalized 0-1 (PDF coords: 0 = bottom)

    // Title block: bottom-right corner (ny < 0.15 in PDF coords = bottom, nx > 0.6)
    if (ny < 0.15 && nx > 0.6) {
      zones['title-block'].push(item.text);
    }
    // Center: middle 50% of page
    else if (nx > 0.25 && nx < 0.75 && ny > 0.25 && ny < 0.75) {
      zones['center'].push(item.text);
    }
    // Quadrants
    else if (nx <= 0.5 && ny >= 0.5) {
      zones['top-left'].push(item.text);
    } else if (nx > 0.5 && ny >= 0.5) {
      zones['top-right'].push(item.text);
    } else if (nx <= 0.5 && ny < 0.5) {
      zones['bottom-left'].push(item.text);
    } else {
      zones['bottom-right'].push(item.text);
    }
  }

  // Join zone texts for readability
  return Object.fromEntries(
    Object.entries(zones).map(([zone, texts]) => [
      zone,
      { count: texts.length, text: texts.join(' ') },
    ])
  );
}

/**
 * Build a spatial layout text representation.
 * Groups text items into rows (by Y coordinate proximity),
 * then orders left-to-right within each row.
 */
function buildLayoutText(
  sortedItems: Array<{ text: string; x: number; y: number }>,
  pageWidth: number,
): string {
  if (sortedItems.length === 0) return '';

  const rows: Array<{ y: number; items: Array<{ text: string; x: number }> }> = [];
  const ROW_THRESHOLD = 5; // Items within 5 units of Y are same row

  for (const item of sortedItems) {
    const existingRow = rows.find(r => Math.abs(r.y - item.y) < ROW_THRESHOLD);
    if (existingRow) {
      existingRow.items.push({ text: item.text, x: item.x });
    } else {
      rows.push({ y: item.y, items: [{ text: item.text, x: item.x }] });
    }
  }

  // Sort items within each row left-to-right, join with spacing
  return rows.map(row => {
    row.items.sort((a, b) => a.x - b.x);
    return row.items.map(i => i.text).join('  ');
  }).join('\n');
}
