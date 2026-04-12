/**
 * TakeoffAI Cloudflare Validation Spike
 *
 * Three tests to validate before committing to the full migration:
 *   POST /test/render?page=N    — Browser Rendering PDF quality
 *   POST /test/text?page=N      — unpdf text extraction quality
 *   POST /test/cache            — Prompt caching across Workflow steps
 *   POST /upload                — Upload a test PDF to R2
 *   GET  /                      — Health check / usage instructions
 */

import { handleBrowserRenderTest } from './test-browser-render';
import { handleUnpdfTest } from './test-unpdf';
import { handleMupdfTest } from './test-mupdf';
import { handlePromptCacheTest, PromptCacheTestWorkflow } from './test-prompt-cache';
import type { Env } from './types';

// Re-export the Workflow class so wrangler can find it
export { PromptCacheTestWorkflow };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(JSON.stringify({
        name: 'TakeoffAI Cloudflare Validation Spike',
        tests: {
          '/test/render?page=N': 'POST — Render PDF page N via Browser Rendering, returns PNG',
          '/test/text?page=N': 'POST — Extract text from page N via unpdf, returns JSON',
          '/test/cache': 'POST — Run 3-step Workflow testing prompt cache hits',
          '/upload': 'POST — Upload a PDF to R2 (multipart form, field: "pdf")',
        },
        setup: [
          '1. Upload a test PDF:  curl -F "pdf=@drawings.pdf" https://your-worker.workers.dev/upload',
          '2. Test rendering:     curl -X POST "https://your-worker.workers.dev/test/render?page=1" --output page1.png',
          '3. Test text extract:  curl -X POST "https://your-worker.workers.dev/test/text?page=1"',
          '4. Test prompt cache:  curl -X POST "https://your-worker.workers.dev/test/cache"',
        ],
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Upload PDF to R2
    if (url.pathname === '/upload' && request.method === 'POST') {
      return handleUpload(request, env);
    }

    // Test 1: Browser Rendering
    if (url.pathname === '/test/render' && request.method === 'POST') {
      return handleBrowserRenderTest(request, env);
    }

    // Test 4: mupdf WASM rendering (alternative to Browser Rendering)
    if (url.pathname === '/test/mupdf' && request.method === 'POST') {
      return handleMupdfTest(request, env);
    }

    // Test 2: unpdf text extraction
    if (url.pathname === '/test/text' && request.method === 'POST') {
      return handleUnpdfTest(request, env);
    }

    // Test 3: Prompt caching across Workflow steps
    if (url.pathname === '/test/cache' && request.method === 'POST') {
      return handlePromptCacheTest(request, env);
    }

    // Diagnostic: check Browser Rendering availability
    if (url.pathname === '/test/browser-check') {
      return handleBrowserCheck(env);
    }

    // Simple browser launch test with example.com
    if (url.pathname === '/test/browser-simple') {
      return handleBrowserSimple(env);
    }

    // Test different REST API endpoint paths
    if (url.pathname === '/test/browser-endpoints') {
      return handleBrowserEndpoints(env);
    }

    // Internal: serve PDF from R2 for Browser Rendering to fetch
    if (url.pathname.startsWith('/_internal/pdf/')) {
      return handleInternalPdf(request, env);
    }

    return new Response('Not found', { status: 404 });
  },
};

async function handleBrowserEndpoints(env: Env): Promise<Response> {
  // Try various endpoint paths to find the screenshot API
  const paths = [
    '/screenshot',
    '/v1/screenshot',
    '/api/screenshot',
    '/content',
    '/v1/content',
  ];
  const results: Record<string, any> = {};

  for (const path of paths) {
    try {
      const res = await env.BROWSER.fetch(`https://fake.host${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com' }),
      });
      results[path] = { status: res.status, statusText: res.statusText };
      if (res.status !== 200) {
        results[path].body = (await res.text()).slice(0, 200);
      } else {
        results[path].contentType = res.headers.get('content-type');
        results[path].bodySize = (await res.arrayBuffer()).byteLength;
      }
    } catch (error: any) {
      results[path] = { error: error.message };
    }
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleBrowserSimple(env: Env): Promise<Response> {
  const puppeteer = (await import('@cloudflare/puppeteer')).default;
  try {
    // Step 1: Check current state
    const sessions = await puppeteer.sessions(env.BROWSER);
    const limits = await puppeteer.limits(env.BROWSER);

    // Step 2: Try to acquire a new session directly
    const acquireStart = Date.now();
    const acquired = await puppeteer.acquire(env.BROWSER);
    const acquireTime = Date.now() - acquireStart;

    // Step 3: Try to connect to it
    const connectStart = Date.now();
    const browser = await puppeteer.connect(env.BROWSER, acquired.sessionId);
    const connectTime = Date.now() - connectStart;

    const page = await browser.newPage();
    await page.goto('https://example.com', { waitUntil: 'networkidle0' });
    const screenshot = await page.screenshot({ type: 'png' });
    await browser.close();

    const totalTime = Date.now() - acquireStart;
    return new Response(JSON.stringify({
      success: true,
      sessionsBefore: sessions.length,
      limits,
      acquiredSessionId: acquired.sessionId,
      acquireTimeMs: acquireTime,
      connectTimeMs: connectTime,
      totalTimeMs: totalTime,
      screenshotSize: (screenshot as Buffer).byteLength,
      message: 'Browser launched and took screenshot successfully!',
    }, null, 2), { headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    // On failure, also report diagnostic info
    let diagnostics: any = {};
    try {
      diagnostics.sessions = await puppeteer.sessions(env.BROWSER);
      diagnostics.limits = await puppeteer.limits(env.BROWSER);
      diagnostics.history = await puppeteer.history(env.BROWSER);
    } catch { /* ignore */ }

    return new Response(JSON.stringify({
      error: error.message,
      diagnostics,
    }, null, 2), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleBrowserCheck(env: Env): Promise<Response> {
  const puppeteer = (await import('@cloudflare/puppeteer')).default;
  try {
    // Check sessions/limits before trying to launch
    const limits = await puppeteer.limits(env.BROWSER);
    const sessions = await puppeteer.sessions(env.BROWSER);

    return new Response(JSON.stringify({
      limits,
      activeSessions: sessions.length,
      sessions,
      message: 'Browser Rendering is available. Try launching a browser next.',
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack,
      hint: 'Browser Rendering may not be enabled. Check: Cloudflare Dashboard → Workers & Pages → your worker → Settings → ensure you are on Workers Paid plan.',
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function handleInternalPdf(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pdfKey = decodeURIComponent(url.pathname.replace('/_internal/pdf/', ''));
  const pdfObj = await env.BUCKET.get(pdfKey);
  if (!pdfObj) {
    return new Response('PDF not found', { status: 404 });
  }
  return new Response(pdfObj.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(pdfObj.size),
    },
  });
}

async function handleUpload(request: Request, env: Env): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get('pdf') as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No "pdf" field in form data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const key = `test-pdfs/${file.name}`;
    const buffer = await file.arrayBuffer();
    await env.BUCKET.put(key, buffer, {
      httpMetadata: { contentType: 'application/pdf' },
    });

    // Also store the key as the "active" test PDF for convenience
    await env.BUCKET.put('test-pdfs/_active.txt', key);

    return new Response(JSON.stringify({
      success: true,
      key,
      size: buffer.byteLength,
      sizeHuman: `${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB`,
      message: `PDF uploaded to R2 as "${key}". You can now run the tests.`,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
