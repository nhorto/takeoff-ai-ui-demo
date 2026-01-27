# API Token Cost Analysis

**Date:** January 27, 2026
**Scope:** Full workflow token cost audit of TakeoffAI Electron agent loop

---

## Executive Summary

The current workflow uses Claude Opus 4.5 with a multi-turn agent loop that extracts construction drawing pages as images and iteratively analyzes them. The primary cost drivers are vision tokens from PNG images and the compounding effect of conversation history being re-sent on every API call. The displayed cost estimates in the terminal are **5x lower than actual costs** due to a pricing constant mismatch. A typical 21-page takeoff likely costs **$5-10**, not the ~$0.08 shown.

---

## 1. Highest Cost Drivers (Ranked)

### 1.1 Vision Tokens from PDF Page Images

**The single largest cost.** Each construction drawing page is rendered at 150 DPI, resized to a max dimension of 1568px, and sent as a base64 PNG image inside a `tool_result` content block.

- Each image: ~1,500-2,000 input tokens
- 5 pages per batch: ~8,000-10,000 tokens per extraction call
- With `keepRecentCount: 5`, up to 25 images can be in conversation history simultaneously
- At peak: ~40,000-50,000 tokens from images alone

**Key files:**
- `src/main/core/pdf-extractor.ts` — renders pages via pdfjs-dist, resizes to 1568px max, outputs PNG base64
- `src/main/core/tools.ts:400-462` — `extractPdfPagesForClaude()`, enforces 5-page batch limit, builds image content blocks

### 1.2 Conversation History Accumulation (Compounding Cost)

The Anthropic Messages API requires the **entire conversation history** on every call. This means every previous turn (assistant responses, tool calls, tool results, skill file contents) gets re-sent as input tokens.

Token growth per turn (approximate):

| Turn | Cumulative Input Tokens | Notes |
|------|------------------------|-------|
| 1 | ~3,000 | System prompt + user message + tool definitions |
| 2 | ~10,000 | + skill file (17KB) loaded via read_skill |
| 3 | ~20,000 | + first 5-page image batch + responses |
| 5 | ~40,000 | + 10 more images + responses |
| 10 | ~60,000+ | Cleanup active, but text history still grows |
| 20 | ~80,000-100,000+ | Old images replaced with text summaries, but history is large |

At Opus 4.5 pricing ($15/million input tokens), turn 20 alone costs ~$1.50 in input. The cumulative cost across all 20 turns is far higher.

**Key file:** `src/main/core/agent-loop.ts:62-137` — the `while` loop that accumulates messages and calls the API each iteration.

### 1.3 Skill File Loaded as Uncached Tool Result

The `ConstructionTakeoff.md` skill file (17,421 bytes / ~4,500 tokens) is loaded via `read_skill` as a `tool_result` on the first or second turn. Once in conversation history, it gets re-sent on **every subsequent API call** without any caching benefit.

Over a 20-turn conversation: ~4,500 tokens x 19 turns = ~85,500 redundant input tokens = ~$1.28 at Opus pricing.

**Key files:**
- `resources/knowledge-base/skills/ConstructionTakeoff.md` — 17KB skill definition
- `src/main/core/tools.ts:244-253` — `readSkill()` reads entire file into tool_result

### 1.4 Incorrect Pricing Constants (Reporting Issue)

The cost tracking in the agent loop uses Sonnet pricing but the model is Opus 4.5:

```
agent-loop.ts:16-20    →  $3 input / $15 output per million (Sonnet pricing)
agent-loop.ts:72       →  model: 'claude-opus-4-5-20251101' (Opus 4.5)
Actual Opus 4.5 rates  →  $15 input / $75 output per million
```

All cost estimates displayed in the terminal are **5x too low**. The `$0.08` shown in the 21-turn stairway run was actually ~$0.40-0.50 minimum, and likely higher due to the compounding history.

---

## 2. Why the Code Works This Way

### 2.1 Agent Loop Pattern (Multi-Turn Tool Use)

The agent loop is the standard pattern for giving Claude iterative, autonomous tool access. Claude decides what to do, calls tools, sees results, and decides the next step. For construction takeoffs that require scanning multiple pages and cross-referencing details, this is the correct architectural choice. There is no single-shot alternative that would work for this task.

**Reference:** `src/main/core/agent-loop.ts:32-166`

### 2.2 Five-Page Batch Limit

Anthropic enforces a maximum request body size. Sending 21 full construction drawing pages (each a ~1568px PNG as base64) in a single request would exceed this limit and return a 413 error. The 5-page batch was chosen as a safe maximum.

**Reference:** `src/main/core/tools.ts:400` — `MAX_PAGES_PER_BATCH = 5`

### 2.3 Image Cleanup Strategy

Without cleanup, all extracted images would accumulate in conversation history. After 21 pages across 5 batches, every subsequent API call would re-send all 21 images (~30,000-42,000 tokens). The cleanup function removes older images and replaces them with text summaries. The `keepRecentCount: 5` setting keeps the 5 most recent image-bearing messages.

The tradeoff: Claude loses visual access to cleaned-up pages. If it needs to reference them, it must rely on its working notes file or re-extract (which caused the infinite loop bug prior to the cleanup parameter fix).

**Reference:** `src/main/core/agent-loop.ts:259-312` — `cleanupOldImages()`

### 2.4 Working Notes File

To compensate for image cleanup, the system instructs Claude to write analysis findings to a working notes file (`working-notes.md` in the session temp directory) after each batch. When older images are evicted, the cleanup summary tells Claude to read its notes instead of re-extracting.

This works in theory but depends on Claude consistently writing notes before moving on. If Claude doesn't write notes and later needs to reference evicted pages, it re-extracts them.

**Reference:** `src/main/ipc-handlers.ts:85-87` — working notes instruction in initial message

### 2.5 System Prompt Caching

The system prompt (CLAUDE.md, 7,912 bytes) is sent with `cache_control: { type: "ephemeral" }`. This enables Anthropic's prompt caching:

- First call: writes to cache (25% premium)
- Subsequent calls within 5-minute window: 90% discount on cached tokens

This is the one cost optimization already working well.

**Reference:** `src/main/core/agent-loop.ts:74-79`

---

## 3. Optimization Recommendations

### 3.1 Switch to Sonnet for Takeoff Work (High Impact)

**Estimated savings: ~80% of total cost**

Opus 4.5 costs 5x more than Sonnet. For construction takeoff work — reading dimensions, counting items, identifying materials from drawings — Sonnet is more than capable. Opus should be reserved for complex architectural analysis or ambiguous judgment calls.

**Change in `agent-loop.ts:72`:**
```typescript
// Before
model: 'claude-opus-4-5-20251101'

// After
model: 'claude-sonnet-4-20250514'
```

| Metric | Opus 4.5 | Sonnet | Savings |
|--------|----------|--------|---------|
| Input | $15/M tokens | $3/M tokens | 80% |
| Output | $75/M tokens | $15/M tokens | 80% |
| 20-turn run | ~$5-10 | ~$1-2 | ~$4-8 |

### 3.2 Use JPEG Instead of PNG (High Impact)

**Estimated savings: 30-50% of vision token cost**

Construction drawings as PNG produce unnecessarily large base64 payloads. JPEG at quality 80-85 would be 3-5x smaller in bytes while retaining all readable text and line detail.

**Change in `pdf-extractor.ts`** — where the canvas converts to base64:
```typescript
// Before
canvas.toDataURL('image/png')

// After
canvas.toDataURL('image/jpeg', 0.85)
```

Also update the media_type in the content block from `image/png` to `image/jpeg`.

### 3.3 Lower Default DPI (Medium Impact)

**Estimated savings: 20-40% of vision token cost**

150 DPI renders fine detail that's often unnecessary for AI vision analysis. Claude can read text and identify elements at 100 DPI for most construction drawings. Reserve 150 DPI for detail-heavy sheets where Claude requests a closer look.

**Change in `tools.ts:401`:**
```typescript
// Before
const RENDER_DPI = 150;

// After
const RENDER_DPI = 100;
```

### 3.4 Bake Skill File into System Prompt (Medium Impact)

**Estimated savings: ~$1.00-1.50 per 20-turn Opus conversation, ~$0.20-0.30 for Sonnet**

Concatenate `ConstructionTakeoff.md` into the system prompt so it benefits from ephemeral caching. Currently it's loaded as a tool_result and re-sent uncached on every turn.

**Change in `ipc-handlers.ts`** — when building the system prompt:
```typescript
const systemPrompt = claudeMd + '\n\n' + constructionTakeoffSkill;
```

Then remove the `read_skill` tool call overhead from the first turn entirely.

### 3.5 Fix Pricing Constants (Reporting Fix)

Update the pricing to match the actual model in use:

```typescript
// For Opus 4.5
const PRICING = {
  input: 15.00 / 1_000_000,
  output: 75.00 / 1_000_000
};

// Or for Sonnet (if switching per recommendation 3.1)
const PRICING = {
  input: 3.00 / 1_000_000,
  output: 15.00 / 1_000_000
};
```

Consider making this dynamic based on the model string.

### 3.6 Two-Pass Architecture: Scan with Sonnet, Analyze with Opus (Lower Priority)

For complex projects where Opus-level reasoning is genuinely needed, use a two-pass approach:

1. **Pass 1 (Sonnet):** Scan all pages, extract raw data (dimensions, counts, materials, notes) into a structured text file. No deep analysis — just data extraction.
2. **Pass 2 (Opus):** Read the text-only data file and perform analysis, cross-referencing, and final takeoff generation. No images sent to Opus at all.

This eliminates the cost of sending images to the expensive model.

### 3.7 Summarize Old Conversation Turns (Lower Priority)

In addition to removing old images, compress old assistant responses and tool results into shorter summaries after N turns. By turn 15, the detailed text from turns 1-5 is mostly redundant. Replacing those messages with a summary paragraph would reduce the growing conversation history.

### 3.8 Per-Page Text Cache Across Sessions (Lower Priority)

If the same PDF is analyzed multiple times (e.g., different divisions or revisiting the stairway pages), cache the extracted text findings per page. On subsequent sessions, load the cached text instead of re-extracting and re-sending images.

---

## 4. Estimated Cost Comparison

For a typical 21-page takeoff (pages 250-270), ~20 turns:

| Configuration | Estimated Cost |
|---------------|---------------|
| Current (Opus 4.5, PNG, 150 DPI) | $5-10 |
| Sonnet + PNG + 150 DPI | $1-2 |
| Sonnet + JPEG + 100 DPI | $0.50-1.00 |
| Sonnet + JPEG + 100 DPI + baked skill | $0.40-0.80 |
| Two-pass (Sonnet scan + Opus analyze) | $0.80-1.50 |

---

## 5. File Reference

| Component | File | Key Lines |
|-----------|------|-----------|
| Agent loop & pricing | `src/main/core/agent-loop.ts` | 14-20, 62-137, 259-312 |
| Tool definitions & execution | `src/main/core/tools.ts` | 44-162, 400-462 |
| PDF extraction & rendering | `src/main/core/pdf-extractor.ts` | DPI and canvas output |
| IPC handlers & session setup | `src/main/ipc-handlers.ts` | 42-123 |
| System prompt | `resources/knowledge-base/CLAUDE.md` | 7,912 bytes |
| Skill file | `resources/knowledge-base/skills/ConstructionTakeoff.md` | 17,421 bytes |
| Workflow docs | `resources/knowledge-base/workflows/` | 56,120 bytes total |
