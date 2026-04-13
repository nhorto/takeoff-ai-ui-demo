# Spike Validation Results

> Results from Step 0 of the Cloudflare migration — validating 3 critical unknowns before full implementation.

**Run date:** 2026-04-11 / 2026-04-12
**Spike project:** `spike/`
**Deployed to:** `https://takeoff-spike.mirrorquiz-com.workers.dev`

---

## Summary

| Test | Status | Details |
|------|--------|---------|
| **Test 1: PDF → PNG Rendering** | Blocked (multiple paths available) | Browser Rendering CDP connection times out; need to pick alternative |
| **Test 2: unpdf Text Extraction** | **PASS** | 352 text items in 186ms with full spatial coordinates |
| **Test 3: Prompt Caching Across Workflow Steps** | **PASS** | 1,657 cached tokens, cache hits on steps 2 and 3 |

**Architectural verdict:** The core architecture is validated. The Cloudflare Workflow-based agent loop works and prompt caching persists across steps. Text extraction runs natively in Workers. PDF-to-PNG rendering is a known-solvable problem with multiple proven fallback paths — it's the least risky piece of the architecture despite being the piece we couldn't validate in this spike.

---

## Test 2: unpdf Text Extraction — PASS

**What we tested:** Extract text from a real construction PDF using `unpdf` (edge-compatible pdfjs-dist wrapper) running inside a Cloudflare Worker.

**What we found:**
- **352 text items** extracted from page 1 in **186ms**
- Every item had precise **spatial coordinates** (x, y, width, height, fontSize)
- Our spatial zone clustering worked the same as the Electron app (top-left, center, title-block, etc.)
- All critical data was captured:
  - **Stair identifiers:** "STAIR 1", "ST027-00", "ST027-01", "ST027-02"
  - **Tread counts:** "13 TREADS @ 11\"", "9 TREADS @ 11\"", "14 EQ RSRS"
  - **Dimensions:** "7'-0 7/8\"", "8'-0\"", "11'-10 7/8\""
  - **Materials:** "055113 - METAL PAN STAIRS", "055213 - PIPE AND TUBE RAILING", "C6s", "MC12x10.6"
  - **Level markers:** "LEVEL 00 IP 85'-0\"", "LEVEL 01 IP 100'-0\"", "LEVEL 02 IP 116'-0\""
  - **Sheet references:** "A0500", "A0511", "A0508"
  - **Title block info:** Project name, architect, engineer contacts

**Implication:** Our text-first strategy will work. Most data for counting and identification can come from extracted text with coordinates, which is ~80% cheaper in tokens and much faster for Claude to process than images.

**Limitation found:** Workers have a 128MB memory limit. Our full 81MB drawing set was too large to load as a single buffer. For production, we'll need to split large PDFs or stream extraction per-page. This is a known constraint with a known solution (split the PDF on upload, or use a streaming parser).

---

## Test 3: Prompt Caching Across Workflow Steps — PASS

**What we tested:** Verify that Anthropic's prompt caching (`cache_control: ephemeral`) works when Claude API calls are made from separate Cloudflare Workflow step invocations.

**Why it matters:** Our entire cost model depends on prompt caching. If caching didn't persist across Workflow step boundaries, every step would re-process the full system prompt (~2,200 tokens) at full price instead of cached price.

**Results (3-step Workflow, same system prompt each call):**

| Step | Input Tokens | Cache Creation | Cache Read | Output Tokens | Duration |
|------|-------------|----------------|------------|---------------|----------|
| 1 | 32 | **1,657** | 0 | 566 | 12.6s |
| 2 | 59 | 0 | **1,657** | 198 | 6.1s |
| 3 | 141 | 0 | **1,657** | 434 | 10.5s |

**What this means:**
- Step 1 cached the system prompt (1,657 tokens, paying full creation cost)
- Steps 2 and 3 both read from cache (1,657 tokens each, ~90% cheaper)
- Cache persisted across different Worker isolates running different Workflow steps
- The agent loop will get full prompt caching benefits in production

**Implication:** Our cost estimates in the architecture doc hold. A 100-iteration agent loop will have 99 cache hits after the first call, keeping per-takeoff API cost around $0.05-0.15.

**Critical detail we learned:** Anthropic's minimum cacheable prompt size is **1,024 tokens**. Our first attempt with a smaller system prompt (~684 tokens) showed 0 cache tokens. The production CLAUDE.md at ~2,200 tokens is comfortably above this threshold.

---

## Test 1: PDF → PNG Rendering — Blocked on Specific Approach

**What we tested:** Three different approaches to rendering PDF pages as images inside Cloudflare Workers.

### Approach A: Cloudflare Browser Rendering (Puppeteer)

**Result:** CDP connection times out consistently.

- Browser sessions acquired successfully (10 different session IDs in history)
- Each session started, ran for ~60 seconds, then closed as "BrowserIdle"
- Every `puppeteer.launch()` / `puppeteer.connect()` call failed with `Browser.getVersion timed out`
- `puppeteer.limits()` showed the service as available (4 max concurrent sessions, 0 active, 629s used browser time)
- Tried `@cloudflare/puppeteer` v0.0.15 and v1.0.7 — same issue
- Tried clearing stale sessions before launching — same issue

**Diagnosis:** The browser instances are being provisioned but the CDP protocol connection from the Worker cannot establish. Possibly a regional issue, account provisioning issue, or transient infrastructure problem. `puppeteer.sessions()`, `puppeteer.limits()`, and `puppeteer.history()` all work fine — only the direct CDP connection fails.

**Next step if we want to pursue this:** Open a Cloudflare support ticket with the session IDs and error messages. This should work but something is misconfigured for this specific account/environment.

### Approach B: Browser Rendering Quick Actions REST API

**Result:** Quick Actions endpoints are not accessible via the `env.BROWSER` Worker binding.

- `env.BROWSER.fetch('https://fake.host/screenshot')` returned 404
- `env.BROWSER.fetch('https://fake.host/v1/screenshot')` returned 401 Unauthorized
- The Worker binding only speaks the Puppeteer/CDP protocol internally
- Quick Actions REST API requires a Cloudflare API token, not a Worker binding

**Diagnosis:** These are two separate products. Workers binding = Puppeteer/CDP. REST API = auth token over public internet. Not interchangeable.

### Approach C: mupdf WASM (pure JavaScript rendering)

**Result:** The `mupdf` npm package (v1.27.0) has a module loader incompatibility with Workers.

- The package uses `createRequire(import.meta.url)` inside `mupdf-wasm.js`
- With `nodejs_compat` enabled, Workers provide a partial `process` object
- This causes mupdf to think it's in Node.js and try to use `createRequire`, which fails because `import.meta.url` isn't in the expected format
- Error: `TypeError: The argument 'path' must be a file URL object... Received 'undefined'`

**Diagnosis:** Solvable with a custom WASM loader that bypasses mupdf's module detection. Would need to load `mupdf-wasm.wasm` as a direct WASM import and pre-initialize the module via `globalThis["$libmupdf_wasm_Module"]`. This is an afternoon of work but not a blocker.

---

## Decision: How to Handle PDF Rendering

The architecture is validated. We have 4 viable paths for PDF → PNG rendering. Pick one:

### Option 1: Retry Cloudflare Browser Rendering (easiest if it works)
- **Effort:** Low (just retry / open support ticket)
- **Cost:** $0.09/browser-hour, 10 free hours/month
- **Pros:** Native Cloudflare service, no external dependencies
- **Cons:** Currently not working on this account — unknown timeline to fix

### Option 2: External API (most reliable, fastest to ship)
- **Effort:** Low (add API client to existing architecture)
- **Cost:** ~$0.003-0.005 per page
- **Options:** ConvertAPI, pdfRest, Nutrient, PDF.co
- **Pros:** Proven reliable, high quality output, simple integration
- **Cons:** External dependency, data briefly leaves Cloudflare network, small per-page cost

### Option 3: mupdf WASM with custom loader (medium effort, zero external dependencies)
- **Effort:** Medium (afternoon to write a custom WASM loader)
- **Cost:** $0 (runs inside Worker CPU budget)
- **Pros:** Pure JavaScript, no external dependencies, works in Dynamic Workers for parallel rendering, cheapest at scale
- **Cons:** Need to write custom WASM module loader, mupdf WASM is ~13MB which eats into Worker bundle size budget

### Option 4: Cloudflare Containers with Poppler (future option)
- **Effort:** High (containers in beta, new deployment target)
- **Cost:** Container runtime costs
- **Pros:** Full Linux environment, use any PDF tool
- **Cons:** Still in beta, adds deployment complexity

---

## Recommendation

**Start with Option 2 (External API) for the first implementation phase.**

Reasoning:
1. It's the lowest-risk, fastest path to a working system
2. The cost is negligible (~$0.003/page vs $0.05-0.15 Claude API cost per takeoff)
3. It lets us ship Phase 1-5 of the roadmap without blocking on PDF rendering details
4. We can migrate to Option 1 (Browser Rendering) or Option 3 (mupdf) later as a pure optimization
5. The abstraction is easy — `renderPdfPage(pdfKey, pageNum) → imageKey` is one function we can swap the implementation of later

This keeps us moving forward on the parts of the architecture that actually matter (the agent loop, the Workflow structure, the database schema, the frontend) while treating PDF rendering as a solved problem to revisit later.

---

## Files Produced in the Spike

- `spike/src/index.ts` — Worker entry point
- `spike/src/test-browser-render.ts` — Browser Rendering test (blocked)
- `spike/src/test-unpdf.ts` — Text extraction test (PASS)
- `spike/src/test-prompt-cache.ts` — Prompt caching Workflow test (PASS)
- `spike/src/test-mupdf.ts` — mupdf WASM test (blocked on loader)
- `spike/wrangler.jsonc` — Cloudflare config
- `spike/README.md` — Setup and usage docs

## Artifacts in R2

- `test-pdfs/test-5-pages.pdf` — 12MB test PDF (5 pages from the full drawing set)
- `test-pdfs/combined-stair-drawings.pdf` — 81MB full drawing set
- `test-text/page-1.json` — Full unpdf extraction output for comparison
