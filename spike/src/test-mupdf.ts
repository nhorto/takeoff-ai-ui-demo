/**
 * Test 4: mupdf WASM-based PDF Rendering
 *
 * Validates that we can render PDF pages to PNG images entirely within
 * a Cloudflare Worker using WASM (no Canvas, no Browser, no external API).
 *
 * If this works, it's the simplest and cheapest solution for PDF → PNG
 * conversion in the Cloudflare edge architecture.
 *
 * Pass criteria: A PNG image of the requested PDF page is returned with
 * sufficient quality for Claude Vision API analysis.
 */

import * as mupdf from 'mupdf';
import type { Env } from './types';

export async function handleMupdfTest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pageNum = parseInt(url.searchParams.get('page') || '1', 10);
  const dpi = parseInt(url.searchParams.get('dpi') || '150', 10);

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

    const startTime = Date.now();
    const pdfBuffer = await pdfObj.arrayBuffer();
    const loadStart = Date.now();

    // Open the PDF from buffer
    const doc = mupdf.Document.openDocument(
      new Uint8Array(pdfBuffer),
      'application/pdf'
    );

    const totalPages = doc.countPages();
    if (pageNum < 1 || pageNum > totalPages) {
      return new Response(JSON.stringify({
        error: `Page ${pageNum} out of range (PDF has ${totalPages} pages)`,
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const loadTime = Date.now() - loadStart;

    // Load the requested page (0-indexed)
    const renderStart = Date.now();
    const page = doc.loadPage(pageNum - 1);

    // Render at the requested DPI
    // Matrix: scale factor (dpi / 72 points-per-inch)
    const scale = dpi / 72;
    const matrix = mupdf.Matrix.scale(scale, scale);

    // Render to pixmap (raw pixel buffer)
    const pixmap = page.toPixmap(
      matrix,
      mupdf.ColorSpace.DeviceRGB,
      false, // alpha
      true,  // showExtras
    );

    // Convert pixmap to PNG bytes
    const pngBytes = pixmap.asPNG();

    const renderTime = Date.now() - renderStart;
    const totalTime = Date.now() - startTime;

    // Clean up
    pixmap.destroy();
    page.destroy();
    doc.destroy();

    // Store the rendered image in R2
    const imageKey = `test-mupdf/page-${pageNum}-${dpi}dpi.png`;
    await env.BUCKET.put(imageKey, pngBytes, {
      httpMetadata: { contentType: 'image/png' },
      customMetadata: {
        sourceKey: pdfKey,
        page: String(pageNum),
        dpi: String(dpi),
        renderTimeMs: String(renderTime),
        renderer: 'mupdf-wasm',
      },
    });

    // If metadata requested, return JSON
    if (url.searchParams.get('meta') === 'true') {
      return new Response(JSON.stringify({
        success: true,
        renderer: 'mupdf-wasm',
        page: pageNum,
        totalPages,
        dpi,
        imageKey,
        imageSize: pngBytes.byteLength,
        imageSizeHuman: `${(pngBytes.byteLength / 1024).toFixed(1)} KB`,
        timing: {
          loadPdfMs: loadTime,
          renderMs: renderTime,
          totalMs: totalTime,
        },
        message: `Page ${pageNum} rendered in ${totalTime}ms using mupdf WASM.`,
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Return the image directly
    return new Response(pngBytes, {
      headers: {
        'Content-Type': 'image/png',
        'X-Render-Time-Ms': String(renderTime),
        'X-Total-Time-Ms': String(totalTime),
        'X-Renderer': 'mupdf-wasm',
        'X-R2-Key': imageKey,
      },
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
