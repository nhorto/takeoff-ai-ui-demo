/**
 * Test 1: Browser Rendering PDF Quality
 *
 * Uses Cloudflare Browser Rendering's REST API (via env.BROWSER.fetch)
 * instead of Puppeteer. The BROWSER binding acts as a Fetcher.
 *
 * Current app settings for comparison:
 *   - Resolution: 150 DPI
 *   - Format: JPEG, quality 0.85
 *   - Max dimension: 1568px
 *
 * Pass criteria: Claude Vision API can extract the same information from
 * Browser Rendering screenshots as from pdfjs-dist renders.
 */

import type { Env } from './types';

export async function handleBrowserRenderTest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pageNum = parseInt(url.searchParams.get('page') || '1', 10);

  try {
    // Get the active test PDF key
    const activeKeyObj = await env.BUCKET.get('test-pdfs/_active.txt');
    if (!activeKeyObj) {
      return new Response(JSON.stringify({
        error: 'No test PDF uploaded. POST a PDF to /upload first.',
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const pdfKey = await activeKeyObj.text();

    // Verify PDF exists
    const pdfHead = await env.BUCKET.head(pdfKey);
    if (!pdfHead) {
      return new Response(JSON.stringify({
        error: `PDF not found at key: ${pdfKey}`,
      }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const startTime = Date.now();

    // Build the URL the browser will navigate to (served by our own Worker)
    const workerOrigin = new URL(request.url).origin;
    const pdfUrl = `${workerOrigin}/_internal/pdf/${encodeURIComponent(pdfKey)}#page=${pageNum}`;

    // Use the BROWSER binding's Quick Actions REST API
    // The binding uses https://fake.host as the base URL for all API calls
    const screenshotResponse = await env.BROWSER.fetch('https://fake.host/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: pdfUrl,
        options: {
          type: 'png',
          fullPage: false,
        },
        viewport: {
          width: 1568,
          height: 2048,
        },
        gotoOptions: {
          waitUntil: 'networkidle0',
          timeout: 60000,
        },
      }),
    });

    if (!screenshotResponse.ok) {
      const errorText = await screenshotResponse.text();
      return new Response(JSON.stringify({
        error: `Browser Rendering returned ${screenshotResponse.status}`,
        details: errorText,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const screenshot = await screenshotResponse.arrayBuffer();
    const renderTime = Date.now() - startTime;

    // Store the rendered image in R2 for comparison
    const imageKey = `test-renders/page-${pageNum}.png`;
    await env.BUCKET.put(imageKey, screenshot, {
      httpMetadata: { contentType: 'image/png' },
      customMetadata: {
        sourceKey: pdfKey,
        page: String(pageNum),
        renderTimeMs: String(renderTime),
        viewportWidth: '1568',
        viewportHeight: '2048',
      },
    });

    // If the request wants JSON metadata instead of the image
    if (url.searchParams.get('meta') === 'true') {
      return new Response(JSON.stringify({
        success: true,
        page: pageNum,
        imageKey,
        imageSize: screenshot.byteLength,
        imageSizeHuman: `${(screenshot.byteLength / 1024).toFixed(1)} KB`,
        renderTimeMs: renderTime,
        viewport: { width: 1568, height: 2048 },
        message: `Page ${pageNum} rendered in ${renderTime}ms. Image saved to R2 at "${imageKey}".`,
        nextStep: 'Compare this image to the same page rendered by the Electron app. Check text legibility, line clarity, and annotation readability.',
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Return the image directly
    return new Response(screenshot, {
      headers: {
        'Content-Type': 'image/png',
        'X-Render-Time-Ms': String(renderTime),
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
