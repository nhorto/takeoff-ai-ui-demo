# TakeoffAI: Cloudflare Implementation Roadmap

> Concrete step-by-step plan for migrating TakeoffAI from Electron to Cloudflare Edge. This is the "how" and "in what order" companion to `cloudflare-edge-architecture.md` (the "what" and "why").

---

## Current State (as of 2026-04-11)

- **App:** Electron desktop app (Node.js main process + React renderer)
- **Core files:**
  - `src/main/core/agent-loop.ts` (446 lines) — the agent while-loop calling Claude API
  - `src/main/core/tools.ts` — tool definitions (get_page_text, extract_pdf_pages, extract_pdf_region, write_file, read_file, list_directory, ask_user)
  - `src/main/core/orchestrator.ts` — multi-phase orchestration (Discovery → Counting → Compilation)
  - `src/main/core/pdf-extractor.ts` + `pdf-text-extractor.ts` — PDF rendering and text extraction
  - `src/renderer/` — React frontend (App.tsx, components, Zustand stores)
  - `resources/knowledge-base/` — CLAUDE.md system prompts, skills, workflows
- **Dependencies to keep:** @anthropic-ai/sdk, React, Zustand, Tailwind, TypeScript, Vite
- **Dependencies to drop:** electron, electron-store, electron-builder, pdfjs-dist (partially — replaced by unpdf), @napi-rs/canvas

---

## Implementation Steps

### Step 0: Validation Spike — COMPLETE

**Goal:** Answer 3 critical unknowns before committing to the full migration.

**Status:** **Complete** (2026-04-12). Spike project deployed at `https://takeoff-spike.mirrorquiz-com.workers.dev`. Full results in `docs/spike-results.md`.

**The core architecture is validated.** The two architectural blockers both passed. PDF rendering is unblocked conceptually but needs an implementation decision before Step 1.

#### Test 1: PDF → PNG Rendering — BLOCKED ON IMPLEMENTATION CHOICE

**What we tested:** Three approaches to rendering PDF pages to images inside Cloudflare.

**What we found:**
- **Cloudflare Browser Rendering (Puppeteer):** Browser sessions acquire successfully but the CDP protocol connection times out on every call (`Browser.getVersion timed out`). Tried v0.0.15 and v1.0.7 of `@cloudflare/puppeteer`. The service shows as available (4 max sessions, 0 active) but something on this specific account/environment prevents CDP from connecting. History shows 10+ sessions provisioned, each running ~60s before idle timeout, but never usable.
- **Browser Rendering Quick Actions REST API:** Not accessible through the `env.BROWSER` Worker binding. Returns 404. The REST API requires a Cloudflare API token and runs over the public internet, not the binding.
- **mupdf WASM (pure JS rendering):** The `mupdf` npm package exists and has a WASM build, but its loader uses `createRequire(import.meta.url)` which fails in Workers with `nodejs_compat` enabled. Solvable with a custom WASM loader (~half day of work) but not working out of the box.

**Decision needed before Step 1:** Pick a PDF rendering approach. Four viable options:
1. **External API (ConvertAPI or similar)** — ~$0.003/page, proven reliable, minimal effort. **Recommended for Phase 1.** Cost is negligible vs Claude API cost per takeoff.
2. **Retry Browser Rendering later** — may require a Cloudflare support ticket. No action required to keep this option open.
3. **Custom mupdf WASM loader** — afternoon of work, results in $0/month rendering. Good candidate for Phase 6 optimization.
4. **Cloudflare Containers with Poppler** — still in beta, highest effort, keeps it in the Cloudflare ecosystem.

**Current recommendation:** Ship Phase 1-5 with an external API (Option 1) since the rendering interface is one function (`renderPdfPage(pdfKey, pageNum) → imageKey`) that can be swapped later as a pure optimization.

#### Test 2: unpdf Text Extraction — PASS

**What we tested:** Extract text from a real construction PDF using `unpdf` running inside a Cloudflare Worker.

**What we found:**
- **352 text items** extracted from page 1 in **186ms**
- Every item captured with spatial coordinates (x, y, width, height, fontSize)
- Spatial zone classification (top-left, center, title-block, etc.) works the same as the Electron app
- All critical construction data captured: stair identifiers (STAIR 1, ST027-00), tread counts ("13 TREADS @ 11\""), riser equations ("14 EQ RSRS"), dimensions (7'-0 7/8"), materials ("055113 - METAL PAN STAIRS", "MC12x10.6", "C6s"), level markers, sheet references, title block info

**Implication:** The text-first strategy is confirmed viable. Most agent operations can use text instead of images, which is ~80% cheaper in tokens and faster for Claude to process.

**Limitation found:** Workers have a 128MB memory limit. Our full 81MB drawing set exceeded this as a single buffer. Solution: split large PDFs on upload, or process pages individually. Not a blocker — just means we can't load huge PDFs as a single operation.

#### Test 3: Prompt Caching Across Workflow Steps — PASS

**What we tested:** Verify Anthropic's prompt caching works when Claude API calls come from separate Cloudflare Workflow step invocations (different isolates, different step runs).

**Results (3-step Workflow, same ~2,200-token system prompt):**

| Step | Cache Creation | Cache Read | Output |
|------|---------------|------------|--------|
| 1 | 1,657 | 0 | 566 |
| 2 | 0 | **1,657** | 198 |
| 3 | 0 | **1,657** | 434 |

**Implication:** The entire cost model holds. A 100-iteration agent loop will get 99 cache hits after the first call, keeping per-takeoff API cost around $0.05-0.15 as estimated in the architecture doc.

**Critical learning:** Anthropic requires a **minimum 1,024 tokens** for prompt caching. Our first test with a smaller prompt (~684 tokens) showed 0 cache hits. The production CLAUDE.md at ~2,200 tokens is comfortably above this threshold, but we should never create a cached prompt smaller than 1,024 tokens.

#### Spike Project

Located at `spike/` in this repo. Deployed to Cloudflare at `https://takeoff-spike.mirrorquiz-com.workers.dev`.

```
spike/
├── src/
│   ├── index.ts              # Worker entry point + diagnostic endpoints
│   ├── test-browser-render.ts # Test 1: Browser Rendering (blocked)
│   ├── test-unpdf.ts          # Test 2: Text extraction (PASS)
│   ├── test-prompt-cache.ts   # Test 3: Prompt caching (PASS)
│   ├── test-mupdf.ts          # Bonus: mupdf WASM (blocked on loader)
│   └── types.ts
├── wrangler.jsonc
├── package.json
└── README.md
```

**Artifacts in R2 (bucket: `takeoff-spike-files`):**
- `test-pdfs/test-5-pages.pdf` — 12MB test PDF (5 pages, upload-safe)
- `test-pdfs/combined-stair-drawings.pdf` — 81MB full drawing set
- `test-text/page-1.json` — Full unpdf extraction output
- `test-renders/` — Rendered images (will be populated when rendering works)

**Cleanup note:** The spike project is throwaway. Once Step 1 is complete, the spike Worker and R2 bucket can be deleted. Keep the code in the repo for reference.

---

### Step 1: Project Scaffolding

**Goal:** Set up the real Cloudflare project with all bindings configured and a "hello world" deployed.

**Status:** Not started — unblocked once PDF rendering approach is chosen (see Step 0 decision)

**Pre-requisite decision:** Pick the PDF rendering approach from Step 0. Default: external API (ConvertAPI). If going with external API, sign up and get an API key before starting this step.

**Tasks:**
- [ ] **Decide on PDF rendering approach** (external API / mupdf WASM / revisit Browser Rendering)
- [ ] Create new Cloudflare project from agents-starter template
- [ ] Configure wrangler.jsonc with all bindings:
  - Durable Object (TakeoffAgent)
  - Workflows (DiscoveryWorkflow, DetailWorkflow, StairWorkflow)
  - R2 bucket (takeoff-files)
  - D1 database (takeoff-db)
  - KV namespace
  - Browser Rendering binding (optional — include only if using that path)
- [ ] Create D1 database and run initial migration (jobs, stairs, agent_iterations, tool_calls tables)
- [ ] Create R2 bucket
- [ ] Store `ANTHROPIC_API_KEY` as Wrangler secret
- [ ] If using external PDF API: store that API key as a Wrangler secret too (e.g., `CONVERTAPI_KEY`)
- [ ] Set up TypeScript, Vite (for React frontend build), Tailwind
- [ ] Deploy hello-world Worker to `*.workers.dev`
- [ ] Verify all bindings work (write/read R2, query D1, call the chosen PDF renderer)

---

### Step 2: Port the Agent Loop

**Goal:** Get one stair processing end-to-end on Cloudflare. This is the core of the migration.

**Status:** Not started — blocked on Step 1

**Tasks:**
- [ ] Create StairWorkflow class (port agent-loop.ts logic into Workflow steps)
- [ ] Port tool execution logic (tools.ts → Cloudflare-compatible tools)
  - `get_page_text` → reads pre-extracted text from R2
  - `extract_pdf_pages` → reads pre-rendered images from R2, returns as base64 for Claude
  - `extract_pdf_region` → crop via Browser Rendering or pre-rendered from R2
  - `write_file` → writes to R2 (CSV rows, notes)
  - `ask_user` → placeholder for now (becomes waitForApproval later)
- [ ] Port the Anthropic API client wrapper (prompt caching, token tracking)
- [ ] Bundle knowledge-base files (CLAUDE.md, skills) into the Worker
- [ ] Implement D1 logging (every iteration, every tool call)
- [ ] Implement R2 raw transcript logging (full request/response JSON per iteration)
- [ ] Test: manually trigger StairWorkflow with a known PDF + page assignments, verify CSV output matches Electron app output

**Key decision:** Start with the simplest possible version — no pre-processing, no parallel stairs, no pipeline overlap. Just one Workflow that processes one stair. Get the agent loop working correctly first, optimize later.

---

### Step 3: Add the TakeoffAgent (Durable Object)

**Goal:** Stateful orchestrator with WebSocket connection to the browser.

**Status:** Not started — blocked on Step 2

**Tasks:**
- [ ] Create TakeoffAgent class extending Agent
- [ ] Implement state management (job status, stair statuses, progress)
- [ ] Implement WebSocket handlers (onConnect, onMessage, onClose)
- [ ] Wire up Agent → Workflow launching (start StairWorkflow from Agent)
- [ ] Implement Workflow progress callbacks (onWorkflowProgress → broadcast to browser)
- [ ] Implement Workflow completion callbacks (onWorkflowComplete → update state)
- [ ] Create Worker entry point that routes HTTP/WebSocket to Agent
- [ ] Test: connect via WebSocket client, trigger a takeoff, observe real-time progress messages

---

### Step 4: Implement the Full Pipeline

**Goal:** Multi-stair pipeline with Discovery → Details → Per-Stair → Review → Compilation.

**Status:** Not started — blocked on Step 3

**Tasks:**
- [ ] Implement PreProcessWorkflow (parallel text extraction + image rendering)
- [ ] Implement DiscoveryWorkflow (identify stairs, page assignments)
- [ ] Implement DetailWorkflow (extract shared construction specs)
- [ ] Implement concurrent StairWorkflow launching (all stairs in parallel)
- [ ] Implement user review flow (waitForApproval in StairWorkflow)
- [ ] Implement compilation step (merge approved CSV rows, upload to R2)
- [ ] Implement PDF upload → R2 flow (presigned URLs for direct browser upload)
- [ ] Test: full end-to-end takeoff with a multi-stair PDF

---

### Step 5: Port the Frontend

**Goal:** React SPA adapted from Electron renderer, hosted on Cloudflare Pages.

**Status:** Not started — blocked on Step 4

**Tasks:**
- [ ] Set up Cloudflare Pages build (Vite → dist/client)
- [ ] Remove all Electron-specific imports and IPC calls
- [ ] Replace `window.electronAPI.*` with WebSocket communication via `useAgent` hook
- [ ] Implement PDF upload UI (drag-and-drop → presigned R2 URL)
- [ ] Implement job progress UI (stage indicators, per-stair progress bars)
- [ ] Implement live agent log view (streaming tool calls and outputs — the "terminal" view)
- [ ] Implement per-stair review UI (results display, approve/correct/skip buttons)
- [ ] Implement CSV download (presigned R2 URL)
- [ ] Remove Electron-specific settings (output directory, etc.)
- [ ] Test: full user flow in a browser — upload PDF, watch progress, review stairs, download CSV

---

### Step 6: Optimization Pass

**Goal:** Implement the performance optimizations from Section 16 of the architecture doc.

**Status:** Not started — blocked on Step 5

**Tasks (in priority order):**
- [ ] **P0:** Remove 2-second sleep (already done if using Workflow retries)
- [ ] **P0:** Verify parallel stair processing works at scale (already done in Step 4)
- [ ] **P1:** Implement text-first approach (modify tool set + system prompts)
- [ ] **P1:** Implement parallel pre-processing (PreProcessWorkflow with batched Browser Rendering)
- [ ] **P2:** Add batch tool execution prompt guidance (system prompt changes)
- [ ] **P2:** Implement pipeline overlap (launch stairs as discovered, don't wait for full discovery)
- [ ] Run benchmarks: compare Cloudflare vs Electron on the same PDFs for speed, cost, accuracy

---

### Step 7: Production Hardening

**Goal:** Ready for real users.

**Status:** Not started — blocked on Step 6

**Tasks:**
- [ ] Error handling (graceful failures, user-facing error messages)
- [ ] Rate limit management (concurrent Claude API calls across multiple users)
- [ ] Custom domain setup
- [ ] Observability (Cloudflare dashboard + D1 evaluation queries)
- [ ] Authentication (when needed — Cloudflare Access or custom)
- [ ] File lifecycle management (auto-delete old PDFs, images)
- [ ] Cost monitoring and alerting
- [ ] Load testing (multiple concurrent takeoffs)

---

## Decision Log

Track key decisions made during implementation so we remember why things are the way they are.

| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-04-11 | Cloudflare over Fly.io + Supabase | Get product to users fast, edge deployment, simpler ops, no VM management |
| 2026-04-11 | Workflows for agent loop (not raw DO) | Durable execution, automatic retry, crash recovery, same continuous loop but with autosave |
| 2026-04-11 | D1 for database (not Supabase Postgres) | Keep everything in Cloudflare ecosystem, sufficient for MVP, upgrade path via Hyperdrive + Neon |
| 2026-04-11 | Log EVERYTHING to D1 + R2 | Critical for evaluation and benchmarking. D1 for structured queries, R2 for full transcripts |
| 2026-04-12 | Text extraction via unpdf (validated) | Spike confirmed 352 text items extracted in 186ms from a real construction PDF with spatial zone classification matching the Electron app. Claude can work with this structured text for most operations. |
| 2026-04-12 | Prompt caching across Workflow steps works (validated) | Spike confirmed 1,657-token cache hits on steps 2 and 3 of a 3-step Workflow. Cost model holds. Minimum cacheable prompt size is 1,024 tokens — keep system prompts above this. |
| 2026-04-12 | Browser Rendering NOT used for PDF→PNG (initial plan reversed) | Spike's Puppeteer CDP connection timed out consistently on this account despite the service showing as available. Not worth waiting on. PDF rendering is an abstracted interface that can be swapped later. |
| 2026-04-12 | PDF rendering via external API for Phase 1 (pending final choice) | Lowest-risk, fastest path to shipping. ~$0.003/page is negligible vs Claude API cost per takeoff. Interface is one function that can be swapped for mupdf WASM or revisited Browser Rendering later as a pure optimization. |

---

## References

- Architecture design: `docs/cloudflare-edge-architecture.md`
- Spike results (Step 0 findings): `docs/spike-results.md`
- Spike project: `spike/`
- Prior web architecture plan (superseded): `docs/production-web-architecture.md`
- Current agent loop: `src/main/core/agent-loop.ts`
- Current tools: `src/main/core/tools.ts`
- Current orchestrator: `src/main/core/orchestrator.ts`
- Cloudflare Agents docs: https://developers.cloudflare.com/agents/
- Cloudflare Workflows docs: https://developers.cloudflare.com/workflows/
- Cloudflare Browser Rendering docs: https://developers.cloudflare.com/browser-rendering/
