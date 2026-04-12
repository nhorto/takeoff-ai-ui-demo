# TakeoffAI: Cloudflare Edge Architecture Plan

> Migrating from Electron desktop app to a fully edge-hosted web application on Cloudflare. No Fly.io. No Supabase. Pure Cloudflare stack.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [The Big Picture: How It All Fits Together](#2-the-big-picture)
3. [Solving the Agent Loop (The Core Problem)](#3-solving-the-agent-loop)
4. [PDF Processing on the Edge](#4-pdf-processing-on-the-edge)
5. [The Stair Pipeline on Cloudflare](#5-the-stair-pipeline-on-cloudflare)
6. [Real-Time Communication](#6-real-time-communication)
7. [Storage & Database](#7-storage--database)
8. [CPU Limits: Why They're Not a Blocker](#8-cpu-limits)
9. [Logging Everything (Evaluation Database)](#9-logging-everything)
10. [Authentication (Future)](#10-authentication)
11. [Deployment & Configuration](#11-deployment--configuration)
12. [Cost Analysis](#12-cost-analysis)
13. [What Changes From the Current Codebase](#13-what-changes)
14. [Migration Phases](#14-migration-phases)
15. [Open Questions & Risks](#15-open-questions--risks)
16. [Performance Optimizations: How to Run Faster](#16-performance-optimizations)

---

## 1. Architecture Overview

### Cloudflare Services Used

| Service | Role | Cost |
|---------|------|------|
| **Cloudflare Pages** | Host React frontend (SPA) | FREE |
| **Cloudflare Agent (Durable Object)** | Stateful orchestrator — WebSocket hub, job coordinator | ~$5/mo base |
| **Cloudflare Workflows** | Durable execution of agent loops — each Claude API call is a step | Included in Workers pricing |
| **Cloudflare R2** | Object storage — PDFs, rendered page images, output CSVs | ~FREE at early scale |
| **Cloudflare D1** | SQLite database — jobs, tool calls, agent outputs, evaluation logs | Included (25B reads/mo) |
| **Cloudflare Browser Rendering** | PDF-to-PNG conversion via headless Chrome | $0.09/browser-hr, 10hr/mo free |
| **Cloudflare KV** | Config, feature flags, API key caching | Included |
| **Workers (entry point)** | HTTP routing, triggers Agents and Workflows | Included |

### What We're NOT Using
- ~~Fly.io~~ → Cloudflare Workers/Agents handle the compute
- ~~Supabase~~ → D1 for database, Cloudflare Access (later) for auth
- ~~Docker/Kubernetes~~ → Durable Objects are our "servers"
- ~~External PDF service~~ → Cloudflare Browser Rendering (native)

---

## 2. The Big Picture

```
┌─────────────────────────────────────────────────────────┐
│  USER'S BROWSER                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  React SPA (Cloudflare Pages)                     │  │
│  │  - Upload PDF                                     │  │
│  │  - Start takeoff                                  │  │
│  │  - See live progress via WebSocket                │  │
│  │  - Review/approve each stair                      │  │
│  │  - Download CSV                                   │  │
│  └──────────────┬────────────────────────────────────┘  │
│                 │ WebSocket + HTTP                       │
└─────────────────┼───────────────────────────────────────┘
                  │
┌─────────────────┼───────────────────────────────────────┐
│  CLOUDFLARE EDGE                                        │
│                 │                                        │
│  ┌──────────────▼──────────────────────────────────┐    │
│  │  Worker (Entry Point)                            │    │
│  │  - Routes requests to Agent                      │    │
│  │  - Handles PDF upload → R2                       │    │
│  └──────────────┬──────────────────────────────────┘    │
│                 │                                        │
│  ┌──────────────▼──────────────────────────────────┐    │
│  │  TakeoffAgent (Durable Object)                   │    │
│  │  - One instance per job                          │    │
│  │  - WebSocket connection to browser               │    │
│  │  - Manages job state + progress                  │    │
│  │  - Launches Workflows                            │    │
│  │  - Handles user review (approve/correct)         │    │
│  │  - Own SQLite for per-job working state          │    │
│  └──────┬──────────┬───────────┬───────────────────┘    │
│         │          │           │                         │
│  ┌──────▼───┐ ┌────▼────┐ ┌───▼──────────────────┐     │
│  │Discovery │ │Detail   │ │StairWorkflow (×N)    │     │
│  │Workflow  │ │Workflow │ │- One per stair       │     │
│  │(1 step) │ │(1 step) │ │- Agent loop as steps │     │
│  └──────────┘ └─────────┘ │- Tool exec as steps  │     │
│                            │- Reports progress    │     │
│                            │- waitForApproval()   │     │
│                            └──────────┬───────────┘     │
│                                       │                  │
│  ┌────────────────────────────────────┼─────────────┐   │
│  │  Shared Services                   │             │   │
│  │  ┌─────┐ ┌────┐ ┌───────────────┐ │             │   │
│  │  │ R2  │ │ D1 │ │Browser Render │ │             │   │
│  │  │PDFs │ │Logs│ │PDF → PNG      │ │             │   │
│  │  │PNGs │ │Jobs│ │(headless      │ │             │   │
│  │  │CSVs │ │Eval│ │ Chrome)       │ │             │   │
│  │  └─────┘ └────┘ └───────────────┘ │             │   │
│  └────────────────────────────────────┘             │   │
│                                                         │
│                         ▼ Anthropic Claude API           │
└─────────────────────────────────────────────────────────┘
```

### How the Pieces Connect

1. **User opens site** → React SPA loads from Cloudflare Pages CDN (<100ms)
2. **User uploads PDF** → Worker streams it to R2, creates job record in D1
3. **User starts takeoff** → Worker creates a TakeoffAgent (Durable Object) for this job
4. **WebSocket opens** → Browser connects to TakeoffAgent for live updates
5. **Agent launches Discovery Workflow** → Identifies stairs, pages, project info
6. **Agent launches Detail Workflow** → Extracts shared construction specs
7. **Agent launches StairWorkflows (concurrent)** → One per stair, each runs its own agent loop
8. **Each StairWorkflow reports progress** → Agent broadcasts to browser via WebSocket
9. **StairWorkflow hits waitForApproval()** → User reviews in browser, approves/corrects
10. **Compilation** → Merge CSVs, upload to R2, user downloads

---

## 3. Solving the Agent Loop (The Core Problem)

### The Current Loop (Electron)

```typescript
// agent-loop.ts — runs as one continuous while loop
while (iterationCount < maxIterations) {  // maxIterations: 100
    const response = await anthropic.messages.create({...});
    if (response.stop_reason === 'tool_use') {
        const toolResults = await executeTools(response.content);
        messages.push(assistantMessage, toolResultsMessage);
    } else {
        break; // Agent is done
    }
    await sleep(2000); // Rate limit buffer
}
```

**Problem:** This loop can run for minutes. Cloudflare Workers have CPU time limits.

### The Solution: Cloudflare Workflows

Each iteration of the loop becomes **durable steps** in a Workflow. The key insight: **CPU time only counts active processing — waiting for the Claude API response is wall-clock time and is FREE.**

```typescript
import { WorkflowEntrypoint } from 'cloudflare:workflows';

interface StairJobParams {
    jobId: string;
    stairId: string;
    pdfKey: string;        // R2 key for the PDF
    pageAssignments: number[];
    sharedSpecs: object;
    systemPrompt: string;
}

export class StairWorkflow extends WorkflowEntrypoint<Env, StairJobParams> {
    async run(event: WorkflowEvent<StairJobParams>, step: WorkflowStep) {
        const { jobId, stairId, pdfKey, pageAssignments, sharedSpecs, systemPrompt } = event.payload;
        
        // Step 1: Render assigned PDF pages to images (via Browser Rendering)
        const imageKeys = await step.do('render-pages', {
            retries: { limit: 3, delay: '5 seconds', backoff: 'exponential' },
            timeout: '5 minutes',
        }, async () => {
            return await renderPagesToImages(this.env, pdfKey, pageAssignments);
        });

        // Step 2: Extract text from assigned pages (via unpdf)
        const pageTexts = await step.do('extract-text', {
            retries: { limit: 2, delay: '3 seconds' },
            timeout: '2 minutes',
        }, async () => {
            return await extractTextFromPages(this.env, pdfKey, pageAssignments);
        });

        // Build initial messages
        let messages = buildInitialMessages(systemPrompt, sharedSpecs, pageTexts, imageKeys);
        let isDone = false;
        let iteration = 0;

        // The agent loop — each iteration is 1-2 durable steps
        while (!isDone && iteration < 100) {
            // Step N: Call Claude API
            // CPU time: ~10-50ms (serialize request + parse response)
            // Wall time: 10-60 seconds (waiting for Claude) — FREE, doesn't count
            const apiResponse = await step.do(`claude-${iteration}`, {
                retries: { limit: 5, delay: '5 seconds', backoff: 'exponential' },
                timeout: '5 minutes',
            }, async () => {
                const response = await anthropic.messages.create({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 8096,
                    messages: messages,
                    tools: toolDefinitions,
                });
                return {
                    content: response.content,
                    stopReason: response.stop_reason,
                    usage: response.usage,
                };
            });

            // Log to D1 (every iteration)
            await step.do(`log-${iteration}`, async () => {
                await logAgentIteration(this.env.DB, jobId, stairId, iteration, apiResponse);
            });

            // If agent wants to use tools, execute them
            if (apiResponse.stopReason === 'tool_use') {
                const toolResults = await step.do(`tools-${iteration}`, {
                    retries: { limit: 2, delay: '3 seconds' },
                    timeout: '5 minutes',
                }, async () => {
                    return await executeToolCalls(this.env, apiResponse.content, pdfKey);
                });

                // Build next messages from step results (deterministic)
                messages = [...messages,
                    { role: 'assistant', content: apiResponse.content },
                    { role: 'user', content: toolResults },
                ];
            } else {
                isDone = true;
            }

            iteration++;
        }

        // Return final results (CSV rows, counts, notes)
        return extractResults(messages);
    }
}
```

### Why This Works Within Cloudflare Limits

| Concern | Reality |
|---------|---------|
| **CPU time per step** | Each step uses ~10-50ms of CPU. The Claude API wait is wall time (free). Well under the 30s default / 5min max. |
| **Total steps** | 100 iterations × 3 steps each = ~300 steps. Well under 25,000 max. |
| **Step result size** | Each Claude response is ~2-10KB JSON. Well under 1 MiB limit. |
| **Automatic retries** | Claude API rate limits (429) are handled automatically with exponential backoff. |
| **Crash recovery** | If the workflow dies at iteration 50, it resumes from there — completed steps are cached. |
| **Concurrent stairs** | Each stair is a separate Workflow instance. 10,000 concurrent instances allowed. |
| **Wall time** | Unlimited per step. A step waiting 60s for Claude is fine. |

### Conversation History Size Concern

As the agent loop progresses, `messages` grows. By iteration 50+, it could be large. Two strategies:

**Strategy A: Reconstruct from step results (preferred for reliability)**
Each step returns its portion of the conversation. On replay, messages are rebuilt from all prior step results. Since step results are cached, this is fast.

**Strategy B: Store in R2 for very large conversations**
If messages exceed 1 MiB, serialize to R2 after each iteration and pass the R2 key between steps.

---

## 4. PDF Processing on the Edge

### The Problem

Current app uses `pdfjs-dist` + HTML canvas to render PDF pages to PNG images for Claude Vision. **pdfjs-dist cannot render images in Cloudflare Workers** (no canvas/DOM).

### The Solution: Two-Pronged Approach

#### Text Extraction: `unpdf` (runs natively in Workers)

```typescript
import { extractText } from 'unpdf';

async function extractTextFromPages(env: Env, pdfKey: string, pages: number[]) {
    const pdfBuffer = await env.BUCKET.get(pdfKey);
    const { text, pages: pageTexts } = await extractText(await pdfBuffer.arrayBuffer());
    return pages.map(p => pageTexts[p - 1]); // 0-indexed
}
```

- Works in Cloudflare Workers natively
- Used by Cloudflare's own R2 tutorials
- Extracts text with spatial coordinates for CAD-generated PDFs (80%+ of construction drawings)
- ~80% cheaper than sending images to Claude (text tokens vs. image tokens)

#### Image Rendering: Cloudflare Browser Rendering (headless Chrome)

For pages that need visual analysis (counting treads, verifying stair configuration):

```typescript
import puppeteer from '@cloudflare/puppeteer';

async function renderPagesToImages(env: Env, pdfKey: string, pages: number[]): Promise<string[]> {
    const pdfUrl = await getPresignedUrl(env, pdfKey);
    const browser = await puppeteer.launch(env.BROWSER);
    const imageKeys: string[] = [];

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1568, height: 2048 });

        for (const pageNum of pages) {
            // Chrome's built-in PDF viewer renders the page
            await page.goto(`${pdfUrl}#page=${pageNum}`, { waitUntil: 'networkidle0' });
            
            const screenshot = await page.screenshot({
                type: 'png',
                fullPage: true,
            });

            // Store in R2
            const imageKey = `jobs/${jobId}/pages/page-${pageNum}.png`;
            await env.BUCKET.put(imageKey, screenshot);
            imageKeys.push(imageKey);
        }
    } finally {
        await browser.close();
    }

    return imageKeys;
}
```

**Browser Rendering Specs:**
- $0.09/browser-hour, **10 free hours/month** on paid plan
- Up to 10 concurrent browsers
- 600 requests/minute rate limit
- GA, production-ready

**Cost estimate:** Rendering 20 pages at ~5 seconds each = ~100 seconds of browser time. At $0.09/hr, that's ~$0.0025 per takeoff. Negligible.

#### Hybrid Strategy (Text-First, Image-on-Demand)

1. Extract text from all pages using `unpdf` (free, instant)
2. Send text to Claude first — if the text has embedded coordinates and annotations, Claude can work with text alone
3. Only render to images when Claude requests visual verification (via a tool call)
4. This reduces image rendering to ~30-50% of pages, cutting cost and time

---

## 5. The Stair Pipeline on Cloudflare

The pipeline from the existing architecture doc maps cleanly to Cloudflare primitives:

### Stage 1: Discovery (DiscoveryWorkflow)

**Trigger:** Agent receives "start takeoff" from browser
**Steps:**
1. Extract text from all pages (unpdf)
2. Render table-of-contents / index pages to images
3. Call Claude: "Scan this PDF and identify all stairs, their page assignments, and project info"
4. Parse structured response (stair manifest)
5. Save manifest to D1 + Agent state

**Output:** `{ stairs: [{ id, name, pages, type }], projectInfo: {...} }`
**Broadcast:** `{ type: 'discovery_complete', stairs: [...] }`

### Stage 2: Detail Extraction (DetailWorkflow)

**Trigger:** Discovery complete
**Steps:**
1. Render detail/section sheets to images
2. Call Claude: "Extract construction details — stringer size, tread gauge, handrail specs"
3. Parse structured response

**Output:** `{ sharedSpecs: { stringerSize, treadGauge, ... } }`
**Broadcast:** `{ type: 'details_complete', specs: {...} }`

### Stage 3: Per-Stair Processing (StairWorkflow × N — concurrent)

**Trigger:** Details complete → launch one StairWorkflow per stair
**Steps:** The full agent loop as described in Section 3
**Concurrency:** 2-3 concurrent stair workflows (rate-limit-aware)

**Progress broadcasts:**
```typescript
// From within StairWorkflow, report to Agent
await this.reportProgress({
    stairId,
    iteration,
    totalIterations: maxIterations,
    lastAction: 'Counting treads on page 12',
    percent: iteration / estimatedTotal,
});
// Agent.onWorkflowProgress() broadcasts to browser via WebSocket
```

### Stage 4: User Review (waitForApproval — per stair)

As each stair completes, the workflow pauses for user review:

```typescript
// End of StairWorkflow, after agent loop completes
const results = extractResults(messages);

// Report results to Agent → browser shows review UI
await step.updateAgentState({
    stairs: { [stairId]: { status: 'review', results } }
});

// Pause and wait for user approval (up to 7 days)
const approval = await this.waitForApproval(step, { timeout: '7 days' });

if (approval.approved) {
    return { status: 'approved', results };
} else {
    // User provided corrections — rerun with feedback
    const correctedResults = await step.do('correction-loop', async () => {
        return await rerunWithCorrections(this.env, messages, approval.corrections);
    });
    return { status: 'corrected', results: correctedResults };
}
```

**Browser side:**
- User sees flight count, riser count, tread count, CSV preview
- User clicks [Approve], [Correct] (with notes), or [Skip]
- Browser calls `agent.approveWorkflow(workflowId, { approved: true })` or `.rejectWorkflow(workflowId, { reason: corrections })`

### Stage 5: Compilation (deterministic, no Claude needed)

```typescript
// Agent method, not a Workflow (it's fast and deterministic)
async compileResults(jobId: string) {
    const approvedStairs = this.sql`
        SELECT * FROM stair_results WHERE job_id = ${jobId} AND status = 'approved'
    `;
    
    const csv = mergeCSVRows(approvedStairs);
    const summary = generateSummary(approvedStairs);
    
    // Upload to R2
    await this.env.BUCKET.put(`outputs/${jobId}/takeoff.csv`, csv);
    await this.env.BUCKET.put(`outputs/${jobId}/summary.txt`, summary);
    
    // Broadcast download links
    this.broadcast(JSON.stringify({
        type: 'job_complete',
        csvUrl: await getPresignedUrl(this.env, `outputs/${jobId}/takeoff.csv`),
        summaryUrl: await getPresignedUrl(this.env, `outputs/${jobId}/summary.txt`),
    }));
}
```

---

## 6. Real-Time Communication

### WebSocket via Cloudflare Agent

The TakeoffAgent maintains WebSocket connections with the browser. All progress, results, and questions flow through this channel.

```typescript
import { Agent } from 'agents';

interface TakeoffState {
    jobId: string;
    status: 'idle' | 'discovery' | 'details' | 'processing' | 'review' | 'complete' | 'error';
    stairs: Record<string, StairState>;
    projectInfo: object;
    sharedSpecs: object;
}

export class TakeoffAgent extends Agent<Env, TakeoffState> {
    initialState: TakeoffState = {
        jobId: '',
        status: 'idle',
        stairs: {},
        projectInfo: {},
        sharedSpecs: {},
    };

    // Called when browser connects via WebSocket
    async onConnect(connection: Connection, ctx: ConnectionContext) {
        // Send current state so browser catches up
        connection.send(JSON.stringify({
            type: 'state_sync',
            state: this.state,
        }));
    }

    // Called when browser sends a message
    async onMessage(connection: Connection, message: string) {
        const msg = JSON.parse(message);
        
        switch (msg.type) {
            case 'start_takeoff':
                await this.startTakeoff(msg.pdfKey, msg.prompt);
                break;
            case 'approve_stair':
                await this.approveWorkflow(msg.workflowId, {
                    reason: 'approved',
                    metadata: { approvedBy: 'user' },
                });
                break;
            case 'correct_stair':
                await this.rejectWorkflow(msg.workflowId, {
                    reason: msg.corrections,
                });
                break;
        }
    }

    // Workflow progress → broadcast to browser
    async onWorkflowProgress(workflowName: string, instanceId: string, progress: any) {
        this.broadcast(JSON.stringify({
            type: 'workflow_progress',
            workflowName,
            instanceId,
            ...progress,
        }));
    }

    // Workflow complete → update state, broadcast
    async onWorkflowComplete(workflowName: string, instanceId: string, result: any) {
        if (workflowName === 'STAIR_WORKFLOW') {
            this.setState({
                ...this.state,
                stairs: {
                    ...this.state.stairs,
                    [result.stairId]: { status: 'complete', results: result },
                },
            });
        }
        this.broadcast(JSON.stringify({
            type: 'workflow_complete',
            workflowName,
            result,
        }));
    }
}
```

### Key Benefits
- **Auto-reconnect:** If browser disconnects, Agent keeps running. On reconnect, sends full state via `onConnect`.
- **Hibernation-safe:** Agent state persists. WebSocket connections stay open during hibernation.
- **Resumable streaming:** If Claude is mid-response when browser reconnects, the AIChatAgent layer can catch up.
- **20:1 billing ratio:** 100 WebSocket messages = 5 billed requests. Very cost-efficient for progress updates.

---

## 7. Storage & Database

### R2 (Object Storage)

**Structure:**
```
uploads/{jobId}/{filename}.pdf          # Original uploaded PDF
jobs/{jobId}/pages/page-{N}.png         # Rendered page images
jobs/{jobId}/text/page-{N}.txt          # Extracted text per page
outputs/{jobId}/takeoff.csv             # Final CSV output
outputs/{jobId}/summary.txt             # Summary report
```

**Upload flow:** Browser → presigned PUT URL → direct to R2 (no Worker in the middle for large files)

**Lifecycle:**
- Uploaded PDFs: keep 30 days
- Rendered page images: keep 7 days (re-renderable from PDF)
- Output CSVs: keep indefinitely

**Cost:** Essentially free at early scale. 1,000 takeoffs × 20MB avg = 20GB = ~$0.30/month.

### D1 (SQLite Database)

**Schema:**

```sql
-- Jobs table
CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'uploaded',
    pdf_key TEXT NOT NULL,
    pdf_filename TEXT,
    prompt TEXT,
    project_info TEXT,       -- JSON
    shared_specs TEXT,       -- JSON
    stair_manifest TEXT,     -- JSON
    total_tokens_used INTEGER DEFAULT 0,
    total_cost_usd REAL DEFAULT 0,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Stairs table
CREATE TABLE stairs (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id),
    name TEXT,
    stair_type TEXT,
    assigned_pages TEXT,     -- JSON array
    status TEXT NOT NULL DEFAULT 'pending',
    workflow_instance_id TEXT,
    results TEXT,            -- JSON (flight count, risers, treads, CSV rows)
    user_corrections TEXT,   -- JSON
    tokens_used INTEGER DEFAULT 0,
    iterations INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
);

-- Agent iterations log (EVERYTHING gets logged here)
CREATE TABLE agent_iterations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL REFERENCES jobs(id),
    stair_id TEXT REFERENCES stairs(id),
    workflow_name TEXT,
    iteration INTEGER,
    request_messages TEXT,    -- JSON (what was sent to Claude)
    response_content TEXT,    -- JSON (what Claude returned)
    stop_reason TEXT,
    tool_calls TEXT,          -- JSON array of tool calls
    tool_results TEXT,        -- JSON array of tool results
    input_tokens INTEGER,
    output_tokens INTEGER,
    cache_read_tokens INTEGER,
    cache_creation_tokens INTEGER,
    cost_usd REAL,
    duration_ms INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Tool call log (individual tool executions)
CREATE TABLE tool_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    iteration_id INTEGER REFERENCES agent_iterations(id),
    job_id TEXT NOT NULL,
    stair_id TEXT,
    tool_name TEXT NOT NULL,
    tool_input TEXT,          -- JSON
    tool_output TEXT,         -- JSON
    duration_ms INTEGER,
    error TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
```

**Why D1 works for MVP:**
- 25B rows read/month included — more than enough
- 50M rows written/month included — at 100 tool calls per takeoff, that's 500K takeoffs
- 10 GB max per database — monitor this, especially if logging full Claude responses
- SQLite JSON functions for querying JSON columns

**Size management:** If full Claude responses push toward the 10GB limit, store the large `request_messages` and `response_content` blobs in R2, keep only a reference key in D1.

### Upgrade Path: Hyperdrive + Neon Postgres

When D1's 10GB cap or SQLite limitations become a bottleneck:
- **Neon Postgres** (serverless, generous free tier, scales to zero)
- **Cloudflare Hyperdrive** (free connection pooler, eliminates cold-connection latency)
- Drop-in replacement via Drizzle ORM — same queries, different driver

### KV (Key-Value Store)

- Feature flags and configuration
- Cached API responses
- Rate limit counters (with atomic increments)
- NOT for job state or logging (eventually consistent)

### Agent Embedded SQLite (`this.sql`)

Each TakeoffAgent instance has its own SQLite database, co-located with the Agent's compute (zero latency). Use this for:
- Per-job working state during the takeoff
- Temporary conversation history cache
- WebSocket connection metadata

This is SEPARATE from D1. Think of it as the Agent's scratchpad; D1 is the permanent record.

---

## 8. CPU Limits: Why They're Not a Blocker

This was the biggest concern going in. Here's why it's actually fine:

### The Key Insight

**CPU time ≠ wall-clock time.** On Cloudflare, you're only billed/limited on active computation. Waiting for network I/O (fetch calls, API responses, database reads) is FREE.

### Per-Step CPU Usage Breakdown

| Operation | CPU Time | Wall Time | Notes |
|-----------|----------|-----------|-------|
| Call Claude API | ~10-50ms | 10-60s | Serialize request + parse response = CPU. Waiting for Claude = free. |
| Execute tool (extract text) | ~50-200ms | ~200ms | Text processing is CPU-bound but fast |
| Execute tool (get image from R2) | ~5ms | ~50ms | Just a fetch to R2 |
| Execute tool (render PDF page) | ~20ms | 2-5s | Launching browser is wall time, screenshot is fast |
| Log to D1 | ~5ms | ~20ms | SQL insert |

**Worst case per iteration:** ~300ms CPU time. Over 100 iterations = ~30 seconds total CPU. That's within a SINGLE step's 30s default limit, let alone spread across 300 separate steps.

### Configuration

```jsonc
// wrangler.jsonc — probably won't even need this
{
    "limits": {
        "cpu_ms": 300000  // 5 minutes max, but we'll use <1% of this per step
    }
}
```

### The One Edge Case: PDF Image Rendering

If we use `unpdf` for text extraction, that's light CPU. But if we add any image manipulation (resizing, format conversion) in-Worker, that could be heavier. **Solution:** Offload all image rendering to Browser Rendering (headless Chrome), which runs in its own isolated environment with its own resource budget.

---

## 9. Logging Everything (Evaluation Database)

You want to log ALL outputs, tool calls, and everything for evaluation. Here's the approach:

### What Gets Logged

Every single interaction:
1. **Job-level:** Job ID, PDF info, prompt, status transitions, total cost
2. **Stair-level:** Stair ID, page assignments, iteration count, final results
3. **Iteration-level:** Full request/response to Claude, stop reason, token usage, cost
4. **Tool-level:** Each tool call input/output, duration, errors

### Logging Implementation

```typescript
// Inside each Workflow step, after calling Claude
await step.do(`log-${iteration}`, async () => {
    // Log the iteration
    await this.env.DB.prepare(`
        INSERT INTO agent_iterations 
        (job_id, stair_id, workflow_name, iteration, response_content, 
         stop_reason, tool_calls, input_tokens, output_tokens, 
         cache_read_tokens, cost_usd, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        jobId, stairId, 'StairWorkflow', iteration,
        JSON.stringify(apiResponse.content),
        apiResponse.stopReason,
        JSON.stringify(extractToolCalls(apiResponse.content)),
        apiResponse.usage.input_tokens,
        apiResponse.usage.output_tokens,
        apiResponse.usage.cache_read_input_tokens || 0,
        calculateCost(apiResponse.usage),
        stepDuration,
    ).run();
    
    // Log individual tool calls
    if (toolResults) {
        const batch = toolResults.map(tr => 
            this.env.DB.prepare(`
                INSERT INTO tool_calls (job_id, stair_id, tool_name, tool_input, tool_output, duration_ms, error)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(jobId, stairId, tr.name, JSON.stringify(tr.input), JSON.stringify(tr.output), tr.duration, tr.error)
        );
        await this.env.DB.batch(batch); // Atomic batch insert
    }
});
```

### Querying for Evaluation

```sql
-- Accuracy by stair type
SELECT s.stair_type, 
       AVG(CASE WHEN s.status = 'approved' THEN 1.0 ELSE 0.0 END) as approval_rate,
       AVG(s.iterations) as avg_iterations,
       AVG(s.tokens_used) as avg_tokens
FROM stairs s
GROUP BY s.stair_type;

-- Cost breakdown by job
SELECT j.id, j.pdf_filename,
       COUNT(DISTINCT s.id) as stair_count,
       SUM(ai.input_tokens) as total_input_tokens,
       SUM(ai.output_tokens) as total_output_tokens,
       SUM(ai.cost_usd) as total_cost
FROM jobs j
JOIN stairs s ON s.job_id = j.id
JOIN agent_iterations ai ON ai.job_id = j.id
GROUP BY j.id;

-- Tool usage frequency
SELECT tool_name, COUNT(*) as call_count, AVG(duration_ms) as avg_duration
FROM tool_calls
GROUP BY tool_name
ORDER BY call_count DESC;
```

---

## 10. Authentication (Future)

Not needed for day one, but the path is clear:

**Phase 1 (Now):** Single company API key stored as Wrangler secret. No user accounts.

**Phase 2 (When needed):**
- **Cloudflare Access** for SSO/identity
- **D1** for user profiles and job ownership
- **JWT tokens** for API authentication
- Row-level filtering on all D1 queries (WHERE user_id = ?)
- R2 path prefixing with user ID

---

## 11. Deployment & Configuration

### wrangler.jsonc

```jsonc
{
    "$schema": "node_modules/wrangler/config-schema.json",
    "name": "takeoff-ai",
    "main": "src/worker.ts",
    "compatibility_date": "2026-04-11",
    "compatibility_flags": ["nodejs_compat"],
    
    // Frontend
    "assets": {
        "directory": "dist/client",
        "binding": "ASSETS"
    },
    
    // Durable Objects (Agents)
    "durable_objects": {
        "bindings": [
            { "name": "TAKEOFF_AGENT", "class_name": "TakeoffAgent" }
        ]
    },
    
    // Workflows
    "workflows": [
        { "name": "discovery-workflow", "binding": "DISCOVERY_WORKFLOW", "class_name": "DiscoveryWorkflow" },
        { "name": "detail-workflow", "binding": "DETAIL_WORKFLOW", "class_name": "DetailWorkflow" },
        { "name": "stair-workflow", "binding": "STAIR_WORKFLOW", "class_name": "StairWorkflow" }
    ],
    
    // Migrations
    "migrations": [
        { "tag": "v1", "new_sqlite_classes": ["TakeoffAgent"] }
    ],
    
    // Storage
    "r2_buckets": [
        { "binding": "BUCKET", "bucket_name": "takeoff-files" }
    ],
    
    "d1_databases": [
        { "binding": "DB", "database_name": "takeoff-db", "database_id": "..." }
    ],
    
    "kv_namespaces": [
        { "binding": "KV", "id": "..." }
    ],
    
    // Browser Rendering
    "browser": {
        "binding": "BROWSER"
    },
    
    // Observability
    "observability": { "enabled": true },
    
    // Limits (probably don't need to override defaults)
    "limits": {
        "cpu_ms": 30000  // 30s default is plenty
    }
}
```

### Secrets

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

### Deploy

```bash
# Development
npm run dev  # wrangler dev --local

# Production
npx wrangler deploy
npx wrangler d1 migrations apply takeoff-db --remote
```

### Project Structure (proposed)

```
takeoff-ai/
├── src/
│   ├── worker.ts                 # Entry point — routes requests
│   ├── agents/
│   │   └── takeoff-agent.ts      # TakeoffAgent (Durable Object)
│   ├── workflows/
│   │   ├── discovery.ts          # DiscoveryWorkflow
│   │   ├── detail-extraction.ts  # DetailWorkflow
│   │   └── stair-processing.ts   # StairWorkflow (the agent loop)
│   ├── tools/
│   │   ├── index.ts              # Tool definitions
│   │   ├── extract-pdf-text.ts   # unpdf text extraction
│   │   ├── render-pdf-page.ts    # Browser Rendering → R2
│   │   ├── get-page-image.ts     # Fetch from R2 for Claude
│   │   └── write-csv-rows.ts     # Append CSV data
│   ├── lib/
│   │   ├── anthropic.ts          # Claude API client wrapper
│   │   ├── logging.ts            # D1 logging helpers
│   │   └── pdf.ts                # PDF utilities
│   ├── knowledge/                # System prompts, skills (carried over)
│   │   ├── CLAUDE.md
│   │   └── skills/
│   └── types.ts                  # Shared types
├── client/                       # React frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   │   └── useAgent.ts       # Cloudflare Agent WebSocket hook
│   │   └── stores/               # Zustand (carried over)
│   └── index.html
├── migrations/                   # D1 SQL migrations
│   └── 0001_initial.sql
├── wrangler.jsonc
├── package.json
└── tsconfig.json
```

---

## 12. Cost Analysis

### Per-Takeoff Cost (3 stairs, ~20 pages)

| Component | Cost | Notes |
|-----------|------|-------|
| Claude API (Sonnet) | $0.05-0.15 | With prompt caching (~90% reduction) |
| Browser Rendering | ~$0.003 | ~2 min browser time × $0.09/hr |
| R2 storage | ~$0.0001 | 50MB files, cheap |
| D1 writes | ~$0.0001 | ~300 rows logged |
| Workers/DO compute | ~$0.001 | Mostly idle (waiting on Claude) |
| **Total per takeoff** | **~$0.05-0.16** | Claude API is 95%+ of cost |

### Monthly Infrastructure Cost

| Scale | Workers | D1 | R2 | Browser Render | Total Infra |
|-------|---------|----|----|----------------|-------------|
| 10 users / 100 takeoffs | $5 (base) | $0 (included) | $0 (included) | $0 (10hr free) | **~$5** |
| 50 users / 500 takeoffs | $5 | $0 | ~$0.50 | ~$1 | **~$7** |
| 100 users / 1,500 takeoffs | $5 | $0 | ~$2 | ~$5 | **~$12** |
| 500 users / 10,000 takeoffs | $5 | ~$5 | ~$10 | ~$30 | **~$50** |

**Claude API cost dominates.** At 500 takeoffs/month × $0.10 avg = $50/month in API costs vs ~$7 in infrastructure.

### Compared to Previous Fly.io Plan

The existing architecture doc estimated $0-10/month at early scale with Fly.io. Cloudflare is comparable but with:
- No VM to manage
- Auto-scaling to zero (hibernation)
- Global edge deployment (lower latency)
- Simpler deployment (one `wrangler deploy`)

---

## 13. What Changes From the Current Codebase

### Stays (~60-70%)

| Component | Status | Notes |
|-----------|--------|-------|
| Agent system prompts (CLAUDE.md, skills) | **Keep as-is** | Load from bundled files |
| Tool definitions (types, schemas) | **Keep as-is** | Same tool interface |
| Agent loop logic | **Adapt** | Same logic, wrapped in Workflow steps |
| React components | **Adapt** | Replace `window.electronAPI` with WebSocket calls |
| Zustand stores | **Adapt** | Drive from Agent state sync instead of IPC |
| Types/interfaces | **Keep mostly** | Add Cloudflare-specific types |
| PDF text extraction logic | **Adapt** | Switch from pdfjs-dist to unpdf |
| Prompt caching strategy | **Keep** | Same Anthropic API, same caching |

### Changes

| Component | What Changes | Why |
|-----------|-------------|-----|
| `agent-loop.ts` | Becomes `stair-processing.ts` Workflow | Durable steps instead of while loop |
| `main/index.ts` (Electron main) | Becomes `worker.ts` + `takeoff-agent.ts` | Durable Object instead of Electron process |
| `main/ipc-handlers.ts` | Becomes WebSocket messages in Agent | WebSocket instead of Electron IPC |
| PDF rendering | Becomes Browser Rendering calls | No canvas in Workers |
| File storage | Local fs → R2 | Edge-native storage |
| Session state | electron-store → Agent state + D1 | Persistent, distributed |
| React entry point | Electron renderer → Cloudflare Pages SPA | Standard web app |

### Removed

- All Electron-specific code (main process, preload, window management)
- `electron-store` dependency
- `@napi-rs/canvas` dependency (replaced by Browser Rendering)
- Electron build/packaging config
- Local file system operations

---

## 14. Migration Phases

### Phase 1: Foundation (Week 1-2)

**Goal:** Get the basic Cloudflare stack running with a single hardcoded stair.

- [ ] Set up Cloudflare project (`wrangler init`, configure bindings)
- [ ] Create TakeoffAgent (Durable Object) with WebSocket support
- [ ] Create simple Worker entry point (route to Agent)
- [ ] Set up R2 bucket for file storage
- [ ] Set up D1 database with initial schema
- [ ] Implement PDF upload → R2 flow
- [ ] Implement PDF text extraction using `unpdf`
- [ ] Implement PDF image rendering via Browser Rendering
- [ ] Port the agent loop into a single StairWorkflow
- [ ] Test: upload PDF, run single-stair takeoff, get CSV back
- [ ] Deploy to `*.workers.dev`

### Phase 2: Pipeline (Week 3-4)

**Goal:** Full multi-stair pipeline with concurrent processing.

- [ ] Implement DiscoveryWorkflow
- [ ] Implement DetailWorkflow
- [ ] Implement concurrent StairWorkflow launching
- [ ] Implement user review flow (waitForApproval)
- [ ] Implement compilation step (merge CSVs)
- [ ] Add D1 logging for all agent iterations and tool calls
- [ ] Progress reporting from Workflows → Agent → Browser

### Phase 3: Frontend (Week 5-6)

**Goal:** React frontend adapted from Electron renderer.

- [ ] Set up Cloudflare Pages for React SPA
- [ ] Port React components (remove Electron dependencies)
- [ ] Implement `useAgent` WebSocket hook for real-time state
- [ ] PDF upload UI → presigned R2 URL
- [ ] Job progress UI (stage indicators, per-stair progress)
- [ ] Per-stair review UI (approve/correct/skip)
- [ ] CSV download from R2

### Phase 4: Polish & Optimize (Week 7+)

- [ ] Hybrid text-first strategy (reduce image usage)
- [ ] Prompt caching optimization (same system prompt across stairs)
- [ ] Error handling and edge cases
- [ ] Rate limit management for concurrent Claude API calls
- [ ] Observability (Cloudflare dashboard + custom D1 queries)
- [ ] Performance tuning (concurrent stair count, page batch sizes)
- [ ] Custom domain setup

---

## 15. Open Questions & Risks

### Must Resolve Before Starting

1. **Browser Rendering PDF quality** — Does headless Chrome render construction PDFs with the same fidelity as our current pdfjs-dist + canvas approach? Need to test with real drawings. If quality is insufficient, fall back to ConvertAPI ($0.0035/conversion).

2. **Conversation history size** — The 1 MiB step result limit in Workflows means we can't store the full conversation as a single step result if it gets large. Strategy: store conversation in R2 or D1 after each iteration, pass only a reference key between steps.

3. **`unpdf` text extraction quality** — Need to verify that unpdf extracts text with spatial coordinates comparable to our current pdfjs-dist spatial clustering approach. If not, we may need to send more images to Claude.

### Medium-Term Risks

4. **D1 10GB cap** — If we're logging full Claude responses for every iteration, we could approach 10GB with thousands of takeoffs. Monitor and plan Hyperdrive + Neon migration.

5. **Browser Rendering concurrency** — 10 concurrent browsers max. If we're rendering 20 pages per takeoff with multiple concurrent users, we need to queue rendering requests. Browser Rendering has a built-in queue, but monitor for bottlenecks.

6. **Prompt caching across Workflow steps** — Currently, prompt caching works because we send the full conversation each time within one long-running process. In the Workflow model, each Claude API call is a separate step. Need to verify that Anthropic's prompt caching still works when calls come from different Worker invocations (it should — caching is based on message prefix, not client identity).

### Nice-to-Have Explorations

7. **Dynamic Workers for parallel tool execution** — Within a single iteration, if Claude requests multiple tool calls, we could fan them out to Dynamic Workers for true parallel execution. This is an optimization, not a requirement.

8. **Cloudflare Queues for rendering pipeline** — Instead of Browser Rendering inline within the Workflow, queue page-rendering tasks and process them asynchronously. Decouples the rendering bottleneck from the agent loop.

9. **Code-mode pattern** — The existing architecture doc describes having Claude write TypeScript scripts that chain multiple operations. This could reduce API round-trips even further. Worth implementing after the basic pipeline works.

---

## 16. Performance Optimizations: How to Run Faster

The current Electron app processes a 3-stair, 20-page takeoff in roughly **5-7 minutes**. The Cloudflare architecture, with the optimizations below, can bring that down to **~1.5-2.5 minutes** — roughly a 3x improvement. This section documents every optimization, why it helps, and how to implement it.

### Current Bottlenecks (Why It's Slow Now)

| Bottleneck | Impact | Root Cause |
|-----------|--------|------------|
| Sequential page scanning | ~2-3 min wasted | Agent asks for pages one at a time, each is a Claude round-trip |
| 2 stairs max in parallel | ~1-2 min wasted | Artificial concurrency limit in Electron |
| 2-second sleep between iterations | ~100s wasted over 50 iterations | Crude rate-limit buffer |
| Images for every page | Slow Claude responses | ~1,500 tokens per image vs ~300 for text |
| One-at-a-time tool calls | Extra round-trips | Agent asks for one tool, waits, asks for next |

### Optimization 1: Parallel Pre-Processing (Biggest Win)

**What:** Before the agent loop starts, extract text and render images for ALL pages simultaneously.

**Why:** Eliminates the per-page render-wait-send cycle. By the time the agent makes its first Claude call, every page's text and images are already in R2, ready for instant retrieval.

**Current flow (sequential):**
```
Agent: "Show me page 1"     → 2s render + 15s Claude = 17s
Agent: "Show me page 2"     → 2s render + 15s Claude = 17s
Agent: "Show me page 3"     → 2s render + 15s Claude = 17s
...20 pages = ~5-6 minutes just scanning
```

**Optimized flow (parallel upfront):**
```
Upload complete → kick off in parallel:
  ├── Extract text from ALL pages (unpdf)        ~500ms
  ├── Render pages 1-5 to images (Browser)       ~5s
  ├── Render pages 6-10 to images (concurrent)   ~5s
  ├── Render pages 11-15 to images (concurrent)  ~5s
  └── Render pages 16-20 to images (concurrent)  ~5s
Total: ~5 seconds for EVERYTHING
```

**Implementation:**

```typescript
// Pre-processing Workflow — runs once at job start, before any agent loop
export class PreProcessWorkflow extends WorkflowEntrypoint<Env, PreProcessParams> {
    async run(event: WorkflowEvent<PreProcessParams>, step: WorkflowStep) {
        const { pdfKey, totalPages } = event.payload;

        // Extract text from all pages at once (unpdf, ~500ms)
        const allText = await step.do('extract-all-text', async () => {
            const pdf = await this.env.BUCKET.get(pdfKey);
            const buffer = await pdf!.arrayBuffer();
            const { pages } = await extractText(buffer);
            
            // Store each page's text in R2 for instant retrieval
            await Promise.all(pages.map((text, i) =>
                this.env.BUCKET.put(`${pdfKey}/text/page-${i + 1}.txt`, text)
            ));
            return pages.map((_, i) => `${pdfKey}/text/page-${i + 1}.txt`);
        });

        // Render all pages to images in batches of 4 (Browser Rendering limit)
        const batches = chunkArray(range(1, totalPages), 4);
        const allImageKeys: string[] = [];

        for (let b = 0; b < batches.length; b++) {
            const batchKeys = await step.do(`render-batch-${b}`, {
                retries: { limit: 3, delay: '5 seconds', backoff: 'exponential' },
                timeout: '3 minutes',
            }, async () => {
                const browser = await puppeteer.launch(this.env.BROWSER);
                const keys: string[] = [];
                try {
                    const page = await browser.newPage();
                    await page.setViewport({ width: 1568, height: 2048 });
                    const pdfUrl = await getPresignedUrl(this.env, pdfKey);

                    for (const pageNum of batches[b]) {
                        await page.goto(`${pdfUrl}#page=${pageNum}`, {
                            waitUntil: 'networkidle0'
                        });
                        const screenshot = await page.screenshot({ type: 'png' });
                        const imageKey = `${pdfKey}/images/page-${pageNum}.png`;
                        await this.env.BUCKET.put(imageKey, screenshot);
                        keys.push(imageKey);
                    }
                } finally {
                    await browser.close();
                }
                return keys;
            });
            allImageKeys.push(...batchKeys);
        }

        return { textKeys: allText, imageKeys: allImageKeys };
    }
}
```

**Time saved:** ~2-3 minutes per takeoff. Tool calls that previously triggered a render+wait now resolve in ~50ms (R2 read).

### Optimization 2: True N-Way Parallel Stair Processing

**What:** Run ALL stairs concurrently as separate Workflow instances, not capped at 2.

**Why:** Each stair is independent — different pages, different agent conversation. No reason to serialize them.

**Current flow (2 at a time):**
```
Stair A: ████████████████ (90s)
Stair B: ████████████████ (85s)
                          Stair C: ████████████████ (80s)
Total wall time: ~170 seconds
```

**Optimized flow (all parallel):**
```
Stair A: ████████████████ (90s)
Stair B: ████████████████ (85s)
Stair C: ████████████████ (80s)
Total wall time: ~90 seconds (limited by slowest stair)
```

**Implementation:**

```typescript
// Inside TakeoffAgent, after discovery completes
async launchStairWorkflows(stairs: StairManifest[], sharedSpecs: object) {
    const workflowPromises = stairs.map(stair =>
        this.runWorkflow('STAIR_WORKFLOW', {
            jobId: this.state.jobId,
            stairId: stair.id,
            pdfKey: this.state.pdfKey,
            pageAssignments: stair.pages,
            sharedSpecs,
        })
    );

    // Launch all stair workflows at once
    const instanceIds = await Promise.all(workflowPromises);
    
    this.setState({
        ...this.state,
        stairs: Object.fromEntries(
            stairs.map((s, i) => [s.id, {
                status: 'processing',
                workflowInstanceId: instanceIds[i],
            }])
        ),
    });
}
```

**Concurrency constraint:** The Anthropic API rate limit, not Cloudflare. With prompt caching, cached input tokens have a lower rate-limit impact. On a standard API tier, 3-5 concurrent stair workflows is safe. Workflow retries with exponential backoff handle any rate limit hits automatically.

**Time saved:** ~1-2 minutes for a 3-stair takeoff (eliminates sequential stair waiting).

### Optimization 3: Text-First, Images On-Demand

**What:** Send extracted text to Claude by default. Only send images when Claude specifically requests visual verification.

**Why:** Claude processes text much faster than images. Text tokens are ~80% cheaper. Most construction PDFs (80%+) have embedded text with coordinates — Claude can work with structured text for counting, identification, and extraction. Images are only needed for visual verification (counting drawn lines, verifying stair configuration).

**Current flow (all images):**
```
Send 5 page images = ~7,500 input tokens
Claude processes images = ~15-20 seconds response time
```

**Optimized flow (text-first):**
```
Send 5 pages as structured text = ~1,500 input tokens
Claude processes text = ~5-8 seconds response time
If needed: Claude calls render_pdf_page tool for visual check
Send 1 image = ~1,500 tokens, ~8-10 seconds
```

**Implementation — modified tool set:**

```typescript
// Tool: extract_pdf_text — fast, default for all data extraction
const extractPdfTextTool = {
    name: 'extract_pdf_text',
    description: 'Extract text content from PDF pages with spatial layout. Returns structured text with coordinates. Use this FIRST for reading annotations, schedules, and notes. Only request images if you need visual verification.',
    input_schema: {
        type: 'object',
        properties: {
            pages: { type: 'array', items: { type: 'number' }, description: 'Page numbers to extract' },
        },
        required: ['pages'],
    },
};

// Tool: render_pdf_page — expensive, only for visual verification
const renderPdfPageTool = {
    name: 'render_pdf_page',
    description: 'Get a rendered image of a PDF page. Use ONLY when you need visual verification — counting drawn lines (treads, risers), verifying stair configuration (scissor/switchback), or checking handrail extensions. Always try extract_pdf_text first.',
    input_schema: {
        type: 'object',
        properties: {
            page: { type: 'number', description: 'Page number to render' },
            region: {
                type: 'object',
                description: 'Optional: crop to a specific region',
                properties: {
                    x: { type: 'number' }, y: { type: 'number' },
                    width: { type: 'number' }, height: { type: 'number' },
                },
            },
        },
        required: ['page'],
    },
};
```

**System prompt guidance:**
```
When analyzing construction drawings:
1. ALWAYS start with extract_pdf_text to read annotations, schedules, and dimension text
2. Only use render_pdf_page when you need to:
   - Count physical elements drawn as lines (treads, risers, balusters)
   - Verify stair configuration that can't be determined from text alone
   - Read handwritten notes or stamps
3. You can request multiple tools in a single response — request all pages you need at once
```

**Impact estimates:**
- ~60-70% of pages won't need image rendering at all
- Claude response time drops from ~15-20s to ~5-8s for text-only iterations
- Token cost drops ~70-80% per takeoff

**Time saved:** ~30-60 seconds per stair (fewer iterations, faster Claude responses).

### Optimization 4: Batch Tool Execution (Multiple Tools Per Response)

**What:** Tell Claude it can request multiple tools in a single response. Execute all of them in parallel.

**Why:** Eliminates the "ask for one thing → wait → ask for the next thing" pattern that currently adds unnecessary round-trips.

**Current flow (one tool at a time):**
```
Claude: "extract text from page 5"        → execute → 15s round-trip
Claude: "extract text from page 6"        → execute → 15s round-trip
Claude: "extract text from page 7"        → execute → 15s round-trip
Claude: "now render page 5"               → execute → 15s round-trip
Claude: "count the treads"                → thinks  → 15s
Claude: "write CSV rows"                  → execute → 15s round-trip
= 6 API calls × ~15s = ~90 seconds
```

**Optimized flow (batched tools):**
```
Claude: [extract_text(5), extract_text(6), extract_text(7)]
  → all 3 execute in parallel → 15s round-trip (one call)
Claude: [render_page(5), write_csv_rows(...)]
  → both execute in parallel → 15s round-trip (one call)
= 2 API calls × ~15s = ~30 seconds
```

**Implementation — parallel tool execution in Workflow step:**

```typescript
// Inside the agent loop, when Claude returns multiple tool_use blocks
if (apiResponse.stopReason === 'tool_use') {
    const toolCalls = apiResponse.content.filter(
        (block: any) => block.type === 'tool_use'
    );

    const toolResults = await step.do(`tools-${iteration}`, async () => {
        // Execute ALL tool calls in parallel
        return await Promise.all(
            toolCalls.map(async (tc: any) => {
                const startTime = Date.now();
                try {
                    const result = await executeTool(this.env, tc.name, tc.input);
                    return {
                        type: 'tool_result',
                        tool_use_id: tc.id,
                        content: result,
                        duration: Date.now() - startTime,
                    };
                } catch (error) {
                    return {
                        type: 'tool_result',
                        tool_use_id: tc.id,
                        content: `Error: ${error.message}`,
                        is_error: true,
                        duration: Date.now() - startTime,
                    };
                }
            })
        );
    });
}
```

**Time saved:** Depends on tool call patterns, but typically ~30-40% fewer API round-trips per stair.

### Optimization 5: Pipeline Overlap (Don't Wait for Full Phase Completion)

**What:** Start the next phase as soon as enough data is available, rather than waiting for the current phase to fully complete.

**Why:** Discovery identifies stairs one at a time during its conversation. As soon as it identifies Stair A and its pages, we can start processing Stair A — we don't need to wait until all stairs are discovered.

**Current flow (strictly sequential):**
```
Pre-process  ██ (5s)
Discovery    ████████████ (40s, identifies all 3 stairs)
                          Detail ████████ (20s)
                                          Stair A ██████████ (70s)
                                          Stair B ██████████ (65s)
                                          Stair C ██████████ (60s)
Total: ~195 seconds to first stair result
```

**Optimized flow (overlapping):**
```
Pre-process  ██ (5s)
Discovery    ████████████ (40s)
       Detail ████████ (20s, starts when detail pages identified mid-discovery)
          Stair A ██████████ (70s, starts as soon as pages assigned)
            Stair B ██████████ (65s, starts a few seconds later)
              Stair C ██████████ (60s, starts last)
Total: ~80-90 seconds to first stair result
```

**Implementation — streaming stair discovery:**

```typescript
// DiscoveryWorkflow can emit partial results as stairs are found
export class DiscoveryWorkflow extends AgentWorkflow<TakeoffAgent, DiscoveryParams> {
    async run(event: AgentWorkflowEvent<DiscoveryParams>, step: AgentWorkflowStep) {
        // ... Claude identifies stairs in its response ...

        // As each stair is identified, notify the Agent immediately
        for (const stair of identifiedStairs) {
            await step.mergeAgentState({
                stairs: { [stair.id]: { status: 'discovered', pages: stair.pages } },
            });
            
            // Agent can listen for state changes and launch stair workflows early
            await this.reportProgress({
                type: 'stair_discovered',
                stair,
            });
        }

        return { stairs: identifiedStairs, projectInfo };
    }
}

// In TakeoffAgent — launch stair workflows as soon as they're discovered
async onWorkflowProgress(workflowName: string, instanceId: string, progress: any) {
    if (progress.type === 'stair_discovered' && this.state.preProcessComplete) {
        // Don't wait for full discovery — start this stair now
        await this.launchSingleStairWorkflow(progress.stair);
    }
    // ... broadcast to browser ...
}
```

**Time saved:** ~30-60 seconds (eliminates dead time between phases).

### Optimization 6: Eliminate the 2-Second Sleep

**What:** Remove the `await sleep(2000)` between agent loop iterations.

**Why:** This was a crude rate-limit buffer in the Electron app. On Cloudflare Workflows, rate limit handling is built in — if a Claude API call gets a 429 response, the step automatically retries with exponential backoff. No need to preemptively slow down every iteration.

```typescript
// BEFORE (Electron) — 2s delay on EVERY iteration, even when not rate-limited
while (iterationCount < maxIterations) {
    const response = await anthropic.messages.create({...});
    // ... process response ...
    await sleep(2000);  // 2 seconds wasted 50+ times = 100+ seconds
}

// AFTER (Cloudflare Workflow) — retry only when actually rate-limited
const apiResponse = await step.do(`claude-${iteration}`, {
    retries: {
        limit: 5,
        delay: '5 seconds',     // Only waits if the call actually fails
        backoff: 'exponential',  // 5s → 10s → 20s → 40s → 80s
    },
    timeout: '5 minutes',
}, async () => {
    return await anthropic.messages.create({...});
});
// No sleep — immediately proceed to next step
```

**Time saved:** ~100 seconds over 50 iterations. This is pure waste elimination.

### Combined Impact: Time Comparison

For a typical 3-stair, 20-page takeoff:

| Phase | Current (Electron) | Optimized (Cloudflare) | Savings |
|-------|-------------------|----------------------|---------|
| Pre-processing | N/A (on-demand) | **5s** (parallel upfront) | Enables all other optimizations |
| Discovery | 60-90s | **25-35s** | Text-first, fewer round-trips |
| Detail extraction | 30-45s | **15-20s** | Overlaps with discovery, text-first |
| Per-stair (×3) | 180-270s (2 parallel) | **60-80s** (all parallel) | N-way parallel + text-first + no sleep |
| Compilation | <1s | <1s | Same |
| **Total** | **~5-7 minutes** | **~1.5-2.5 minutes** | **~3x faster** |
| **Time to first stair result** | **~4-5 minutes** | **~80-90 seconds** | **~3-4x faster** |

### Combined Impact: Cost Comparison

| Metric | Current | Optimized | Savings |
|--------|---------|-----------|---------|
| Input tokens per takeoff | 50K-100K | 15K-30K | ~70% fewer (text-first) |
| Output tokens per takeoff | 5K-15K | 4K-12K | ~10-20% fewer (fewer round-trips) |
| API calls per takeoff | 30-80 | 15-40 | ~50% fewer (batched tools) |
| Cost per takeoff | $0.10-0.30 | $0.03-0.08 | **~60-75% cheaper** |
| Browser Rendering time | N/A | ~2 min | ~$0.003 (negligible) |

### Optimization Priority Order

Not all optimizations need to ship at once. Here's the recommended order, from highest impact to lowest:

| Priority | Optimization | Impact | Difficulty |
|----------|-------------|--------|------------|
| **P0** | Eliminate 2-second sleep | ~100s saved, zero effort | Trivial (just remove the sleep) |
| **P0** | Parallel stair processing | ~1-2 min saved | Easy (Workflows are naturally parallel) |
| **P1** | Parallel pre-processing | ~2-3 min saved | Medium (new PreProcessWorkflow) |
| **P1** | Text-first approach | ~30-60s saved + 70% cost reduction | Medium (new tool, prompt changes) |
| **P2** | Batch tool execution | ~30-40% fewer round-trips | Easy (already supported, just prompt engineering) |
| **P2** | Pipeline overlap | ~30-60s saved | Medium (Agent coordination logic) |
| **P3** | Code-mode pattern | Further round-trip reduction | Hard (runtime sandbox needed) |

P0 items are essentially free — they come naturally from the Cloudflare architecture. P1 items should be implemented in Phase 2 of the migration. P2 items are Phase 4 polish. P3 is a future exploration.
