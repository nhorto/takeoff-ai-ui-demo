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
import type { PDFPageImage, CropArea, NamedRegion } from './types.js';

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
 * Resolve a named region to pixel crop coordinates given page dimensions
 */
export function resolveRegionToCrop(region: NamedRegion, pageWidth: number, pageHeight: number): CropArea {
  const hw = Math.floor(pageWidth / 2);
  const hh = Math.floor(pageHeight / 2);
  const qw = Math.floor(pageWidth / 4);
  const qh = Math.floor(pageHeight / 4);

  switch (region) {
    case 'top-left':     return { x: 0,  y: 0,  width: hw, height: hh };
    case 'top-right':    return { x: hw, y: 0,  width: hw, height: hh };
    case 'bottom-left':  return { x: 0,  y: hh, width: hw, height: hh };
    case 'bottom-right': return { x: hw, y: hh, width: hw, height: hh };
    case 'top-half':     return { x: 0,  y: 0,  width: pageWidth, height: hh };
    case 'bottom-half':  return { x: 0,  y: hh, width: pageWidth, height: hh };
    case 'left-half':    return { x: 0,  y: 0,  width: hw, height: pageHeight };
    case 'right-half':   return { x: hw, y: 0,  width: hw, height: pageHeight };
    case 'center':       return { x: qw, y: qh, width: hw, height: hh };
    default:
      throw new Error(`Unknown region: ${region}`);
  }
}

/**
 * Extract a cropped region of a single PDF page at higher resolution
 *
 * Renders the full page at the given DPI, crops to the specified area,
 * resizes the crop to fit within 1568px max dimension, and returns as JPEG.
 *
 * @param pdfPath - Absolute path to the PDF file
 * @param pageNumber - Page number to extract (1-indexed)
 * @param cropArea - Pixel coordinates for the crop (at render DPI)
 * @param dpi - Resolution for rendering (default: 150)
 * @returns Extracted cropped image with page dimension metadata
 */
export async function extractPdfRegion(
  pdfPath: string,
  pageNumber: number,
  cropArea: CropArea,
  dpi: number = 150
): Promise<PDFPageImage & { pageWidth: number; pageHeight: number }> {

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  console.log(`🔍 Extracting region from page ${pageNumber} at ${dpi} DPI (crop: ${cropArea.x},${cropArea.y} ${cropArea.width}x${cropArea.height})...`);

  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

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
    await win.loadURL('about:blank');

    const result = await win.webContents.executeJavaScript(`
      (async () => {
        const pdfBase64 = '${pdfBase64}';
        const pageNum = ${pageNumber};
        const dpi = ${dpi};
        const cropX = ${cropArea.x};
        const cropY = ${cropArea.y};
        const cropW = ${cropArea.width};
        const cropH = ${cropArea.height};

        // Convert base64 to Uint8Array
        const binaryString = atob(pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Load pdfjs-dist from CDN
        const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.mjs');
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.mjs';

        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageNum);

        // Render full page
        const scale = dpi / 72;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');

        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;

        // Crop to specified area
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        // Resize crop to fit within 1568px max dimension
        const MAX_DIM = 1568;
        let outputCanvas = cropCanvas;
        if (cropCanvas.width > MAX_DIM || cropCanvas.height > MAX_DIM) {
          const scaleFactor = Math.min(MAX_DIM / cropCanvas.width, MAX_DIM / cropCanvas.height);
          const newW = Math.round(cropCanvas.width * scaleFactor);
          const newH = Math.round(cropCanvas.height * scaleFactor);
          const resized = document.createElement('canvas');
          resized.width = newW;
          resized.height = newH;
          const resizedCtx = resized.getContext('2d');
          resizedCtx.drawImage(cropCanvas, 0, 0, newW, newH);
          outputCanvas = resized;
        }

        const base64Data = outputCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];

        return {
          pageNumber: pageNum,
          base64Data: base64Data,
          mimeType: 'image/jpeg',
          pageWidth: Math.round(viewport.width),
          pageHeight: Math.round(viewport.height)
        };
      })();
    `);

    console.log(`✅ Extracted region from page ${pageNumber} successfully\n`);
    return result;

  } catch (error) {
    throw new Error(`PDF region extraction failed: ${error instanceof Error ? error.message : String(error)}`);
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

/**
 * Get PDF page dimensions in pixels at a given DPI
 */
export async function getPdfPageDimensions(
  pdfPath: string,
  pageNumber: number,
  dpi: number = 150
): Promise<{ pageWidth: number; pageHeight: number; pageCount: number }> {
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pageCount = pdfDoc.getPageCount();

  if (pageNumber < 1 || pageNumber > pageCount) {
    throw new Error(`Page ${pageNumber} is out of range (PDF has ${pageCount} pages)`);
  }

  const page = pdfDoc.getPage(pageNumber - 1);
  const { width: ptWidth, height: ptHeight } = page.getSize();
  const scale = dpi / 72;

  return {
    pageWidth: Math.round(ptWidth * scale),
    pageHeight: Math.round(ptHeight * scale),
    pageCount
  };
}
