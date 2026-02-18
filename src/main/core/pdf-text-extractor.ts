/**
 * PDF Text Extraction using pdfjs-dist getTextContent()
 *
 * Extracts embedded text from CAD-generated PDFs (AutoCAD/Revit)
 * without OCR. Uses the same hidden BrowserWindow + pdf.js pattern
 * as pdf-extractor.ts.
 *
 * Text is grouped into spatial zones (top-left, top-right, etc.)
 * based on transform matrix coordinates from pdf.js text items.
 */

import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { PDFTextData, PageTextData, TextItem, SpatialZone } from './types.js';

// Timeout for text extraction (60 seconds — large construction PDFs with 300+ pages
// can take 35-40s on first run due to pdf.js CDN load + page iteration)
const EXTRACTION_TIMEOUT_MS = 60_000;

/**
 * Classify a text item into a spatial zone based on its position
 * relative to the page dimensions.
 *
 * Zones:
 * - title-block: bottom 15% AND right 40% (architectural title block area)
 * - top-left, top-right, bottom-left, bottom-right: quadrants
 * - center: middle 50% x 50%
 *
 * Items can appear in multiple zones (center overlaps quadrants).
 * We assign each item to its most specific zone.
 */
function classifyZone(x: number, y: number, pageWidth: number, pageHeight: number): string {
  // Normalize to 0-1
  const nx = pageWidth > 0 ? x / pageWidth : 0;
  const ny = pageHeight > 0 ? y / pageHeight : 0;

  // Title block: bottom-right corner (typical architectural placement)
  // After our transform extraction, y is from top, so bottom = high y
  if (ny > 0.85 && nx > 0.6) {
    return 'title-block';
  }

  // Quadrants
  const isTop = ny < 0.5;
  const isLeft = nx < 0.5;

  if (isTop && isLeft) return 'top-left';
  if (isTop && !isLeft) return 'top-right';
  if (!isTop && isLeft) return 'bottom-left';
  return 'bottom-right';
}

/**
 * Group text items into spatial zones and produce zone summaries.
 */
function groupIntoZones(items: TextItem[], pageWidth: number, pageHeight: number): SpatialZone[] {
  const zoneMap: Record<string, string[]> = {
    'top-left': [],
    'top-right': [],
    'bottom-left': [],
    'bottom-right': [],
    'title-block': [],
    'center': [],
  };

  for (const item of items) {
    const zone = classifyZone(item.x, item.y, pageWidth, pageHeight);
    zoneMap[zone].push(item.text);

    // Also add to center if it's in the middle 50%
    const nx = pageWidth > 0 ? item.x / pageWidth : 0;
    const ny = pageHeight > 0 ? item.y / pageHeight : 0;
    if (nx > 0.25 && nx < 0.75 && ny > 0.25 && ny < 0.75) {
      zoneMap['center'].push(item.text);
    }
  }

  // Build zone summaries, skipping empty zones
  const zones: SpatialZone[] = [];
  for (const [zone, texts] of Object.entries(zoneMap)) {
    const joined = texts.join(' ').trim();
    if (joined.length > 0) {
      zones.push({ zone, text: joined });
    }
  }

  return zones;
}

/**
 * Extract text from all pages of a PDF using pdf.js getTextContent().
 *
 * Performance: ~50-100ms per page. Runs once at PDF upload.
 * Includes a 30-second timeout — if extraction hangs, it fails gracefully.
 *
 * @param pdfPath - Absolute path to the PDF file
 * @returns Structured text data with spatial zones per page
 */
export async function extractAllPagesText(pdfPath: string): Promise<PDFTextData> {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  console.log(`📝 Extracting text from PDF: ${pdfPath}`);
  const startTime = Date.now();

  // Read PDF as raw bytes (Buffer), NOT base64 — we'll write to a temp file
  // and load via file:// URL to avoid V8 string size limits with large PDFs
  const pdfBuffer = fs.readFileSync(pdfPath);

  // Create a hidden BrowserWindow (same pattern as pdf-extractor.ts)
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  try {
    await win.loadURL('about:blank');

    // Pass PDF data via a data URL approach, but chunk it to avoid
    // string literal limits. We use the same approach as pdf-extractor.ts
    // (inline base64) but with a timeout wrapper.
    const pdfBase64 = pdfBuffer.toString('base64');

    // Wrap extraction in a timeout
    const extractionPromise = win.webContents.executeJavaScript(`
      (async () => {
        const pdfBase64 = '${pdfBase64}';

        // Convert base64 to Uint8Array
        const binaryString = atob(pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Load pdf.js from CDN
        const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.mjs');
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.mjs';

        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;

        const results = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.0 });
          const textContent = await page.getTextContent();

          const items = [];
          for (const item of textContent.items) {
            if (!item.str || item.str.trim().length === 0) continue;

            // item.transform is [scaleX, skewY, skewX, scaleY, translateX, translateY]
            // pdf.js coordinate system: y=0 at bottom of page
            // Convert to top-down: y = pageHeight - translateY
            const tx = item.transform[4];
            const ty = viewport.height - item.transform[5];
            const fontSize = Math.abs(item.transform[0]) || 12;

            items.push({
              text: item.str,
              x: Math.round(tx * 100) / 100,
              y: Math.round(ty * 100) / 100,
              fontSize: Math.round(fontSize * 100) / 100,
            });
          }

          results.push({
            pageNumber: pageNum,
            pageWidth: viewport.width,
            pageHeight: viewport.height,
            items: items,
          });
        }

        return results;
      })();
    `);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Text extraction timed out after ${EXTRACTION_TIMEOUT_MS / 1000}s`)), EXTRACTION_TIMEOUT_MS);
    });

    const rawPages: Array<{
      pageNumber: number;
      pageWidth: number;
      pageHeight: number;
      items: Array<{ text: string; x: number; y: number; fontSize: number }>;
    }> = await Promise.race([extractionPromise, timeoutPromise]);

    // Process raw data into structured PageTextData with zones
    const pages: PageTextData[] = rawPages.map((raw) => {
      const textItems: TextItem[] = raw.items;
      const zones = groupIntoZones(textItems, raw.pageWidth, raw.pageHeight);
      const fullText = textItems.map((i) => i.text).join(' ');

      return {
        pageNumber: raw.pageNumber,
        zones,
        fullText,
        textItemCount: textItems.length,
        textItems,
        pageWidth: raw.pageWidth,
        pageHeight: raw.pageHeight,
      };
    });

    // Detect scanned PDFs: avg < 50 chars/page
    const totalChars = pages.reduce((sum, p) => sum + p.fullText.length, 0);
    const avgChars = pages.length > 0 ? totalChars / pages.length : 0;
    const isEmpty = avgChars < 50;

    const elapsed = Date.now() - startTime;
    console.log(`📝 Text extraction complete: ${pages.length} pages, ${totalChars} total chars, avg ${Math.round(avgChars)} chars/page, ${elapsed}ms`);

    if (isEmpty) {
      console.log(`⚠️  SCANNED PDF DETECTED: Text extraction returned < 50 chars/page avg. Agent will use image-only workflow.`);
    }

    return {
      pageCount: pages.length,
      pages,
      isEmpty,
    };
  } catch (error) {
    throw new Error(`PDF text extraction failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    // Ensure window is destroyed even if it's hanging
    try {
      if (!win.isDestroyed()) {
        win.destroy();
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
