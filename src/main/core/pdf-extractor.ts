/**
 * PDF Extraction using pdfjs-dist with Electron renderer
 *
 * This approach:
 * - Uses pdfjs-dist to parse PDFs
 * - Renders in Electron's renderer process (has full canvas support)
 * - No native module dependencies
 */

import { PDFDocument } from 'pdf-lib';
import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { PDFPageImage } from './types.js';

/**
 * Extract specific pages from a PDF and convert them to PNG images (base64 encoded)
 * Uses Electron renderer process with pdfjs-dist for rendering
 *
 * @param pdfPath - Absolute path to the PDF file
 * @param pageNumbers - Array of page numbers to extract (1-indexed)
 * @param dpi - Resolution for rendering (default: 150)
 * @returns Array of extracted page images with base64 data
 */
export async function extractPdfPages(
  pdfPath: string,
  pageNumbers: number[],
  dpi: number = 150
): Promise<PDFPageImage[]> {

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  console.log(`📄 Extracting ${pageNumbers.length} pages from PDF at ${dpi} DPI...`);

  // Read PDF file as base64
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  // Create a hidden window with proper web preferences
  const win = new BrowserWindow({
    width: 1200,
    height: 1600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  try {
    // Load a blank page
    await win.loadURL('about:blank');

    // Inject PDF.js and render pages in the renderer process
    const results = await win.webContents.executeJavaScript(`
      (async () => {
        const pdfBase64 = '${pdfBase64}';
        const pageNumbers = ${JSON.stringify(pageNumbers)};
        const dpi = ${dpi};

        // Convert base64 to Uint8Array
        const binaryString = atob(pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Load pdfjs-dist from CDN
        const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.mjs');
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.mjs';

        // Load PDF document
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;

        const results = [];

        // Render each page
        for (const pageNum of pageNumbers) {
          const page = await pdf.getPage(pageNum);

          // Calculate scale
          const scale = dpi / 72;
          const viewport = page.getViewport({ scale });

          // Create canvas
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext('2d');

          // Render PDF page to canvas
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;

          // Resize to fit within Anthropic's optimal dimensions (1568px max)
          // This avoids the 5MB per-image limit and matches what Anthropic
          // would resize to internally, so Claude sees the same quality.
          const MAX_DIM = 1568;
          let outputCanvas = canvas;
          if (canvas.width > MAX_DIM || canvas.height > MAX_DIM) {
            const scaleFactor = Math.min(MAX_DIM / canvas.width, MAX_DIM / canvas.height);
            const newW = Math.round(canvas.width * scaleFactor);
            const newH = Math.round(canvas.height * scaleFactor);
            const resized = document.createElement('canvas');
            resized.width = newW;
            resized.height = newH;
            const resizedCtx = resized.getContext('2d');
            resizedCtx.drawImage(canvas, 0, 0, newW, newH);
            outputCanvas = resized;
          }

          // Convert canvas to base64 JPEG (smaller payload than PNG, reduces API token cost)
          const base64Data = outputCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];

          results.push({
            pageNumber: pageNum,
            base64Data: base64Data,
            mimeType: 'image/jpeg'
          });
        }

        return results;
      })();
    `);

    console.log(`✅ Extracted ${results.length} pages successfully\n`);
    return results as PDFPageImage[];

  } catch (error) {
    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    win.close();
  }
}

/**
 * Parse a page range string like "100-150" or "10,20,30-40"
 */
export function parsePageRange(rangeStr: string): number[] {
  const pages: number[] = [];
  const parts = rangeStr.split(',').map(s => s.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(s => parseInt(s.trim(), 10));
      if (isNaN(start) || isNaN(end)) {
        throw new Error(`Invalid page range: ${part}`);
      }
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    } else {
      const num = parseInt(part, 10);
      if (isNaN(num)) {
        throw new Error(`Invalid page number: ${part}`);
      }
      pages.push(num);
    }
  }

  return [...new Set(pages)].sort((a, b) => a - b);
}

/**
 * Get PDF page count using pdf-lib
 */
export async function getPdfPageCount(pdfPath: string): Promise<number> {
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  return pdfDoc.getPageCount();
}
