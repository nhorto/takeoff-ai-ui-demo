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

### Step 0: Validation Spike (DO THIS FIRST)

**Goal:** Answer 3 critical unknowns before committing to the full migration. This is a throwaway proof-of-concept — minimal code, maximum learning.

**Status:** Spike project scaffolded at `spike/` — ready to deploy and test.

**The 3 things we need to validate:**

#### Test 1: Browser Rendering PDF Quality

Does Cloudflare's headless Chrome render construction PDFs with the same fidelity as our current pdfjs-dist + canvas approach?

**What to do:**
1. Create a minimal Cloudflare Worker with Browser Rendering binding
2. Upload one of our real construction PDFs to R2
3. Render 2-3 pages via headless Chrome (`page.screenshot()`)
4. Compare output to what the current Electron app produces for the same pages
5. Check: text legibility, line clarity, dimension accuracy, annotation readability

**Pass criteria:** Claude Vision API can extract the same information from Browser Rendering screenshots as it can from our current pdfjs-dist renders. Doesn't need to be pixel-identical — just needs to carry the same information.

**Fail plan:** If Browser Rendering quality is insufficient, fall back to ConvertAPI ($0.0035/conversion) or a small Cloudflare Container running Poppler/Ghostscript.

#### Test 2: unpdf Text Extraction Quality

Does `unpdf` (edge-compatible pdfjs-dist wrapper) extract text with spatial layout comparable to our current pdfjs-dist spatial clustering?

**What to do:**
1. In the same spike Worker, add unpdf as a dependency
2. Extract text from the same construction PDF pages
3. Compare the output to what our current `pdf-text-extractor.ts` produces
4. Specifically check: annotation text, dimension callouts, schedule tables, notes

**Pass criteria:** Text extraction captures the same annotations and spatial relationships that our current approach does. Key thing: Claude should be able to identify stair names, page references, and dimension text from the unpdf output.

**Fail plan:** If unpdf text quality is poor, we rely more heavily on images (which still works, just costs more in tokens). Or, investigate whether we can bundle a custom pdfjs-dist build for Workers.

#### Test 3: Prompt Caching Across Workflow Steps

Does Anthropic's prompt caching work when Claude API calls come from different Cloudflare Workflow step invocations?

**What to do:**
1. Create a simple 3-step Workflow
2. Step 1: Call Claude with a ~5,000 token system prompt + user message, check `cache_creation_input_tokens` in the response
3. Step 2: Call Claude with the SAME system prompt + extended conversation, check `cache_read_input_tokens`
4. Step 3: Same again, check cache hits

**Pass criteria:** Steps 2 and 3 show `cache_read_input_tokens > 0`, meaning the prompt prefix was cached from the previous step's call.

**Fail plan:** If caching doesn't work across steps (unlikely — Anthropic caches by content hash, not client), we can still run the agent loop inside a Durable Object (single long-lived process) instead of a Workflow. Caching would work there since it's one continuous process. We'd lose automatic crash recovery but keep everything else.

#### Spike Project Structure

```
takeoff-spike/
├── src/
│   ├── index.ts              # Worker entry point — routes to test endpoints
│   ├── test-browser-render.ts # Test 1: PDF → PNG via Browser Rendering
│   ├── test-unpdf.ts          # Test 2: PDF text extraction via unpdf
│   └── test-prompt-cache.ts   # Test 3: Workflow with 3 Claude calls
├── wrangler.jsonc
├── package.json
└── tsconfig.json
```

**Endpoints:**
- `POST /test/render?page=5` — renders a page from the test PDF, returns PNG
- `POST /test/text?page=5` — extracts text from a page, returns JSON with text + coordinates
- `POST /test/cache` — runs the 3-step workflow, returns cache hit/miss stats for each step

**Time estimate:** ~1 day to build and test. Most of the time is in setting up the Cloudflare account bindings (R2 bucket, Browser Rendering, Workflow, secrets).

---

### Step 1: Project Scaffolding

**Goal:** Set up the real Cloudflare project with all bindings configured and a "hello world" deployed.

**Status:** Not started — blocked on Step 0 passing

**Tasks:**
- [ ] Create new Cloudflare project from agents-starter template
- [ ] Configure wrangler.jsonc with all bindings:
  - Durable Object (TakeoffAgent)
  - Workflows (DiscoveryWorkflow, DetailWorkflow, StairWorkflow)
  - R2 bucket (takeoff-files)
  - D1 database (takeoff-db)
  - Browser Rendering
  - KV namespace
- [ ] Create D1 database and run initial migration (jobs, stairs, agent_iterations, tool_calls tables)
- [ ] Create R2 bucket
- [ ] Store ANTHROPIC_API_KEY as Wrangler secret
- [ ] Set up TypeScript, Vite (for React frontend build), Tailwind
- [ ] Deploy hello-world Worker to `*.workers.dev`
- [ ] Verify all bindings work (write/read R2, query D1, launch Browser Rendering)

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
| 2026-04-11 | Browser Rendering for PDF→PNG (not external API) | Native Cloudflare service, cheap, keeps data in-network — pending validation in Step 0 |
| 2026-04-11 | Log EVERYTHING to D1 + R2 | Critical for evaluation and benchmarking. D1 for structured queries, R2 for full transcripts |

---

## References

- Architecture design: `docs/cloudflare-edge-architecture.md`
- Prior web architecture plan (superseded): `docs/production-web-architecture.md`
- Current agent loop: `src/main/core/agent-loop.ts`
- Current tools: `src/main/core/tools.ts`
- Current orchestrator: `src/main/core/orchestrator.ts`
- Cloudflare Agents docs: https://developers.cloudflare.com/agents/
- Cloudflare Workflows docs: https://developers.cloudflare.com/workflows/
- Cloudflare Browser Rendering docs: https://developers.cloudflare.com/browser-rendering/
