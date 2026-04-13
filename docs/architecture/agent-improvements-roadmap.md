# Agent Improvements Roadmap

> **STATUS: PARTIALLY COMPLETE.** Phase 1 quick wins (image retention, cropping protocol) are done. Phase 3 sub-agents are implemented (3-phase orchestrator with parallel counting). System reminders, structured JSON state files, incremental CSV, and failure recovery remain planned.

This document details planned improvements to the TakeoffAI agent based on analysis of live execution runs. These changes aim to reduce API costs, improve accuracy, and create a more disciplined execution flow.

## Table of Contents

1. [Current State](#current-state)
2. [System Reminders](#1-system-reminders)
3. [Sub-Agent Architecture](#2-sub-agent-architecture)
4. [Context Management](#3-context-management)
5. [Structured State Files](#4-structured-state-files)
6. [Phase-Based Workflow](#5-phase-based-workflow)
7. [Incremental Output](#6-incremental-output)
8. [Implementation Priority](#implementation-priority)

---

## Current State

After running the agent with improved cropping protocols, we observed:

**Working Well:**
- Parallel tool execution is functioning (multiple crops in one turn)
- Pixel coordinates are being used for precision counting
- Image cleanup (0 retained) forces reliance on working notes
- Prompt caching provides 90% discount on system prompt

**Still Needs Work:**
- Agent sometimes skips the "write plan first" step before cropping
- Agent occasionally asks about scope despite explicit instructions not to
- Named regions used too long before switching to pixel coordinates
- Context window compounds costs across turns

---

## 1. System Reminders

### What They Are

System reminders are short, rule-reinforcing messages injected at strategic points in the conversation. They remind the agent of critical protocols without requiring it to re-read the full system prompt.

### How Claude Code Uses Them

Claude Code injects `<system-reminder>` tags in tool results and user messages to reinforce rules throughout the conversation. These are not part of the tool output - they're injected by the system.

### Proposed Implementation

**Injection Points:**
- After `extract_pdf_pages` returns → Remind: "Write crop plan to notes BEFORE cropping"
- After `extract_pdf_region` returns → Remind: "Record findings to notes NOW"
- After `write_file` for notes → Remind: "Check if more crops needed for this batch"
- After `ask_user` returns → Remind: "Read working notes first, don't re-extract pages"

**Example Format:**
```typescript
// In tools.ts, after extract_pdf_pages execution:
const result = await extractPdfPages(pageNumbers);
const reminder = `<system-reminder>
CROPPING PROTOCOL: You just received overview images. Before ANY cropping:
1. Identify ALL areas needing crops with pixel coordinates
2. WRITE your crop plan to working notes
3. THEN execute ALL crops in ONE turn
Do NOT crop without writing your plan first.
</system-reminder>`;
return result + reminder;
```

### Expected Impact

- Forces the agent to follow the VIEW → PLAN → WRITE → EXECUTE sequence
- Reduces forgotten protocol steps mid-conversation
- Reinforces rules without adding full prompt tokens each turn

---

## 2. Sub-Agent Architecture

### The Problem

A single agent running a full takeoff accumulates context across all phases:
- Discovery phase context bleeds into detail phase
- Detail phase context bleeds into counting phase
- By compilation, context is massive and expensive

### Proposed Solution: Phase-Based Sub-Agents

Break the monolithic takeoff into specialized agents with fresh context:

```
┌─────────────────┐
│  Orchestrator   │ ← Manages phases, holds minimal state
└────────┬────────┘
         │
    ┌────┴────┬─────────────┬──────────────┐
    ▼         ▼             ▼              ▼
┌───────┐ ┌───────┐   ┌──────────┐   ┌────────────┐
│Discover│ │Detail │   │ Counting │   │ Compilation│
│ Agent  │ │ Agent │   │ Agents   │   │   Agent    │
└───────┘ └───────┘   │(parallel)│   └────────────┘
                      └──────────┘
```

### Agent Responsibilities

**1. Discovery Agent**
- Scans PDF index/TOC
- Identifies relevant sheets (structural plans, stair details)
- Outputs: List of sheets to examine, page ranges
- Context: Small (just overview pages)

**2. Detail Agent**
- Reads typical stair detail sheets
- Extracts construction specifications (tread type, stringer size, rail config)
- Outputs: Construction specs JSON
- Context: Medium (detail sheets only)

**3. Counting Agents (Parallel)**
- One agent per stair or per stair group
- Counts flights, treads, risers using pixel-coordinate crops
- Outputs: Per-stair quantity data
- Context: Small (just that stair's sheets)

**4. Compilation Agent**
- Receives all structured outputs
- Generates final CSV and summary
- Checks code compliance
- Context: Small (just structured data, no images)

### Benefits

- Each agent starts with fresh, relevant context
- Parallel counting agents can run simultaneously
- Failed agent can be re-run without repeating earlier work
- Total cost may be lower than one long-running agent

---

## 3. Context Management

### The Compounding Problem

Context accumulates across turns:

| Turn | New Content | Total Context | Cost Multiplier |
|------|-------------|---------------|-----------------|
| 1    | 10K tokens  | 10K           | 1x              |
| 2    | 5K tokens   | 15K           | 1.5x            |
| 3    | 8K tokens   | 23K           | 2.3x            |
| 10   | 5K tokens   | 80K+          | 8x+             |

Every new message includes ALL previous context, so early tokens are paid for repeatedly.

### Current Mitigations

1. **Prompt Caching** - 90% discount on system prompt and tools (cache_control: ephemeral)
2. **Image Cleanup** - Changed from 2 retained batches to 0 (all images removed after processing)
3. **Working Notes** - External memory that persists without consuming context

### Additional Strategies

**A. Aggressive Context Trimming**
- Summarize old tool results instead of keeping full content
- Replace detailed responses with "See working notes for details"
- Keep only last N messages in full detail

**B. Context Checkpointing**
- At phase boundaries, save state to file
- Start new conversation with minimal context + state file
- Eliminates accumulated history

**C. Tool Result Compression**
- Large tool outputs are summarized
- Images converted to text descriptions after analysis
- Lists shortened to counts + sample items

---

## 4. Structured State Files

### The Problem

Markdown working notes are good for human readability but:
- Hard for the agent to parse programmatically
- Difficult to merge partial results
- No schema validation
- Can drift from expected format

### Proposed Solution: JSON State Files

Replace or supplement markdown notes with structured JSON:

```json
{
  "project": {
    "name": "Example Project",
    "date": "2025-01-28",
    "sheets_processed": 15,
    "total_sheets": 47
  },
  "construction_details": {
    "tread_type": "bent plate pan",
    "tread_gauge": "14 ga",
    "stringer_type": "MC12 x 10.6",
    "source_sheet": "S5.01"
  },
  "stairs": {
    "Stair 1": {
      "status": "complete",
      "levels_served": ["00", "01", "02"],
      "flights": [
        {
          "id": 1,
          "from": "00",
          "to": "01",
          "risers": 17,
          "riser_height": "7-1/16\"",
          "treads": 16,
          "source_sheet": "S5.10",
          "source_page": 250
        }
      ]
    },
    "Stair 2": {
      "status": "in_progress",
      "flights": []
    }
  },
  "unresolved": [
    {
      "stair": "Stair 2",
      "issue": "Could not read riser height callout",
      "page": 252,
      "attempted_crops": ["top-left", "pixel:100,200,400,300"]
    }
  ]
}
```

### Benefits

- Machine-parseable for sub-agents
- Easy to validate completeness
- Can be loaded by compilation agent without re-reading images
- Enables incremental progress tracking

---

## 5. Phase-Based Workflow

### Current Flow

```
Start → (one long agent run) → End
```

Problems:
- All-or-nothing execution
- Can't resume from failure
- Context accumulates entire time

### Proposed Flow

```
Phase 1: Discovery
├── Scan PDF index
├── Identify stair sheets
└── Output: sheet_list.json

Phase 2: Detail Extraction
├── Read detail sheets
├── Extract construction specs
└── Output: construction_details.json

Phase 3: Quantity Counting (Parallel)
├── Stair 1 Agent → stair_1.json
├── Stair 2 Agent → stair_2.json
├── Stair 3 Agent → stair_3.json
└── (parallel execution)

Phase 4: Compilation
├── Load all JSON outputs
├── Generate CSV
├── Check code compliance
└── Output: final_takeoff.csv, summary.txt
```

### Checkpoint System

After each phase:
1. Save structured output to file
2. Validate output schema
3. Mark phase as complete in progress file
4. If failure, can restart from last checkpoint

---

## 6. Incremental Output

### The Problem

User waits for entire takeoff to complete before seeing any output. If agent fails at Turn 45, all work may be lost.

### Proposed Solution

**A. Per-Stair CSV Rows**
As each stair is completed, append rows to CSV immediately:
- User sees progress in real-time
- Partial output preserved on failure
- Can validate early results before full completion

**B. Progress Webhooks**
Emit structured progress events:
```json
{
  "event": "stair_complete",
  "stair_id": "Stair 1",
  "rows_added": 24,
  "total_rows": 24,
  "estimated_remaining": 3
}
```

**C. Live Dashboard**
- Show completed stairs with green checkmarks
- Show in-progress stairs with spinner
- Show pending stairs grayed out
- Real-time cost tracking

---

## Implementation Priority

### Phase 1: Quick Wins (Now)
1. ✅ Change image retention to 0 (completed)
2. ✅ Strengthen cropping protocol language (completed)
3. ⬜ Add system reminders after key tool calls
4. ⬜ Add structured JSON output alongside markdown notes

### Phase 2: Architecture
5. ✅ Implement phase-based workflow with checkpoints
6. ⬜ Add incremental CSV output
7. ⬜ Build progress tracking UI

### Phase 3: Sub-Agents (Complete)
8. ✅ Design sub-agent communication protocol (JSON files between phases)
9. ✅ Implement parallel counting agents (one per stair)
10. ✅ Build orchestrator to coordinate phases (`src/main/core/orchestrator.ts`)

### Phase 4: Production (Planned)
11. ⬜ Context trimming and compression
12. ⬜ Failure recovery and retry logic
13. ⬜ Cost estimation and budgeting

---

## Success Metrics

Track these metrics to measure improvement:

| Metric | Current | Target |
|--------|---------|--------|
| Cost per takeoff | $2.50-3.00 | <$1.00 |
| Turns per stair | ~5-6 | ~2-3 |
| Unnecessary crops | ~30% | <10% |
| Protocol compliance | ~70% | >95% |
| Time to first output | End of run | <2 minutes |

---

## Related Files

- `CLAUDE.md` - Main system prompt with cropping protocol
- `skills/ConstructionTakeoff.md` - Domain skill with counting instructions
- `agent-loop.ts` - Core agent loop implementation
- `tools.ts` - Tool implementations (injection point for reminders)
