# Sub-Agent Architecture Options

> **STATUS: DECIDED — Implemented Option 1 (TypeScript orchestrator) with parallel counting. See `src/main/core/orchestrator.ts`.** Discovery and Detail agents were merged into a single Discovery phase. The 3-phase flow (Discovery → Counting → Compilation) is now the production architecture.

This document explores different approaches to implementing a multi-agent architecture for TakeoffAI. The goal is to reduce API costs, enable parallel execution, and improve reliability through failure recovery.

---

## Why Sub-Agents?

The current single-agent approach has these problems:

1. **Context Compounding** - Every turn includes ALL previous context, so early tokens are paid for repeatedly
2. **No Parallelism** - Counting 5 stairs happens sequentially, even though they're independent
3. **All-or-Nothing** - If the agent fails at turn 45, all work is lost
4. **Cost Scaling** - A 50-turn conversation costs much more than 5 separate 10-turn conversations

Sub-agents address these by breaking the monolithic takeoff into phases with fresh context.

---

## Current Architecture (Single Agent)

```
┌──────────────────────────────────────────────────────────┐
│                   SINGLE AGENT LOOP                      │
│                                                          │
│  Turn 1:   Load skill, scan PDF index                    │
│  Turn 5:   Extract detail sheets                         │
│  Turn 10:  Start counting Stair 1                        │
│  Turn 20:  Start counting Stair 2                        │
│  Turn 30:  Start counting Stair 3                        │
│  Turn 40:  Compile final output                          │
│                                                          │
│  Context grows with every turn...                        │
│  Images accumulate...                                    │
│  Costs compound...                                       │
└──────────────────────────────────────────────────────────┘
```

**Problems:**
- Turn 40 pays for all context from turns 1-39
- Can't parallelize stair counting
- One failure = start over

---

## Option 1: Phase-Based Fresh Conversations

Each phase is a **completely separate API conversation**. State passes between phases via JSON files on disk.

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR (Node.js)                │
│  - TypeScript code, NOT an AI agent                      │
│  - Manages phase transitions                             │
│  - Loads/saves state.json between phases                 │
│  - Decides when to move to next phase                    │
└──────────────────────────────────────────────────────────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │Discovery│   │ Detail  │   │Counting │   │ Compile │
   │  Agent  │   │  Agent  │   │ Agents  │   │  Agent  │
   └─────────┘   └─────────┘   └─────────┘   └─────────┘
   Fresh conv.   Fresh conv.   Fresh conv.   Fresh conv.
   ~5 turns      ~10 turns     ~5 turns ea.  ~3 turns
```

### How It Works

1. **Orchestrator** (TypeScript) calls `runAgentLoop()` for Discovery phase
2. Discovery Agent scans PDF, identifies stair sheets, writes `sheet_list.json`
3. Orchestrator reads output, calls `runAgentLoop()` for Detail phase
4. Detail Agent reads detail sheets, extracts specs, writes `construction_details.json`
5. Orchestrator spawns multiple Counting Agents (one per stair) via `Promise.all()`
6. Each Counting Agent writes `stair_N.json`
7. Orchestrator calls Compilation Agent with all JSON files
8. Compilation Agent generates final CSV and summary

### Phase Contracts (What Each Agent Receives/Produces)

| Phase | Input | Output |
|-------|-------|--------|
| Discovery | PDF path, page count | `sheet_list.json`: relevant pages, stair IDs |
| Detail | `sheet_list.json`, PDF | `construction_details.json`: tread type, stringer size, etc. |
| Counting | `construction_details.json`, stair ID, pages | `stair_N.json`: flights, risers, treads |
| Compilation | All JSON files | `takeoff.csv`, `summary.txt` |

### Pros

- **Fresh context per phase** - No compounding costs
- **Simple implementation** - Reuse existing `runAgentLoop()` function
- **Easy failure recovery** - Retry just the failed phase
- **Clear separation** - Each agent has a focused job
- **Predictable** - Orchestrator controls flow, no surprises

### Cons

- **Rigid structure** - Can't adapt if PDF structure is unusual
- **Hardcoded orchestration** - Phase transitions are in TypeScript, not AI-driven
- **Parallel counting requires extra work** - Need to manage multiple agent instances
- **Inter-phase handoff** - Need to carefully design JSON contracts

### Implementation Effort: Medium

---

## Option 2: Single Conversation with Phase Markers

Keep one continuous conversation, but **inject phase transitions** that trim old context and refocus the agent.

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                 SINGLE AGENT LOOP                        │
│                                                          │
│  Turn 1-10:  Discovery phase (scan PDF)                  │
│              ↓                                           │
│  Turn 11:    [PHASE TRANSITION]                          │
│              - Old messages summarized/removed           │
│              - State.json injected as context            │
│              - System prompt updated for Detail phase    │
│              ↓                                           │
│  Turn 12-25: Detail phase (read specs)                   │
│              ↓                                           │
│  Turn 26:    [PHASE TRANSITION]                          │
│              ↓                                           │
│  Turn 27-50: Counting phase                              │
│              ↓                                           │
│  Turn 51:    [PHASE TRANSITION]                          │
│              ↓                                           │
│  Turn 52-55: Compilation phase                           │
└──────────────────────────────────────────────────────────┘
```

### How It Works

1. Agent runs normally through discovery
2. When agent signals "discovery complete" (or we detect it), inject a phase transition:
   - Remove old messages (keep only summary)
   - Inject state.json contents as a "you have completed discovery, here's what you found" message
   - Update system prompt to focus on next phase
3. Continue in same conversation with reduced context
4. Repeat at each phase boundary

### Pros

- **Simpler architecture** - No orchestrator needed
- **Claude controls transitions** - More adaptive to unusual PDFs
- **Single conversation** - Easier to debug in one log
- **Flexible** - Claude can decide when it's "done" with a phase

### Cons

- **Context trimming is tricky** - What to keep vs. discard?
- **No parallelism** - Still one conversation = sequential counting
- **Phase discipline** - Claude might not respect boundaries
- **Harder recovery** - Can't easily retry just one phase
- **Context still grows within phases** - Just slower

### Implementation Effort: Medium

---

## Option 3: Tool-Based Sub-Agent Spawning

The main agent **spawns sub-agents via tool calls**. Each sub-agent is a fresh conversation.

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    MAIN AGENT                            │
│                                                          │
│  "I've identified 3 stairs. Spawning counting agents..." │
│                                                          │
│  → spawn_counter("Stair 1", pages=[250,251])             │
│  → spawn_counter("Stair 2", pages=[252,253])             │
│  → spawn_counter("Stair 3", pages=[254,255])             │
│                                                          │
│  [Parallel execution, results returned as tool results]  │
│                                                          │
│  "All counters complete. Compiling final output..."      │
└──────────────────────────────────────────────────────────┘
        │              │              │
        ▼              ▼              ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │Counter 1│   │Counter 2│   │Counter 3│
   │(fresh)  │   │(fresh)  │   │(fresh)  │
   └─────────┘   └─────────┘   └─────────┘
```

### How It Works

1. Add a new tool: `spawn_counting_agent(stair_id, pages, context)`
2. Main agent runs discovery and detail extraction
3. Main agent decides to spawn sub-agents for counting
4. Tool implementation calls `runAgentLoop()` with a counting-specific prompt
5. Sub-agent results returned as tool result to main agent
6. Main agent compiles everything

### New Tool Definition

```typescript
{
  name: 'spawn_counting_agent',
  description: 'Spawn a fresh agent to count a specific stair. The agent will have access to the specified PDF pages and construction details. Returns the stair data when complete.',
  input_schema: {
    type: 'object',
    properties: {
      stair_id: { type: 'string' },
      pages: { type: 'array', items: { type: 'number' } },
      construction_details: { type: 'object' }
    },
    required: ['stair_id', 'pages']
  }
}
```

### Pros

- **Most flexible** - Claude decides when and what to spawn
- **Natural parallelism** - Multiple tool calls can execute in parallel
- **Adaptive** - Can spawn more agents if it discovers more stairs
- **Fresh context for sub-agents** - Each counter starts clean

### Cons

- **Main agent context still grows** - Discovery/detail phases accumulate
- **Complex implementation** - Nested agent loops, harder to debug
- **Unpredictable spawning** - Claude might spawn too many or too few
- **Error handling** - What if a sub-agent fails mid-run?
- **Cost uncertainty** - Hard to predict how many sub-agents Claude will spawn

### Implementation Effort: High

---

## Option 4: Hybrid Approach (Recommended)

Combine **Option 1** (orchestrator for main phases) with **Option 3** (tool-based spawning for parallel counting).

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                 ORCHESTRATOR (TypeScript)                │
│  - Controls the 4 main phases                            │
│  - Provides checkpoints between phases                   │
│  - Counting phase has special parallel capability        │
└──────────────────────────────────────────────────────────┘
        │
        ▼
   ┌─────────┐
   │Discovery│  Fresh conversation
   │  Agent  │  Output: sheet_list.json
   └─────────┘
        │
        ▼
   ┌─────────┐
   │ Detail  │  Fresh conversation
   │  Agent  │  Output: construction_details.json
   └─────────┘
        │
        ▼
   ┌─────────────────────────────────────────────┐
   │           COUNTING AGENT                    │
   │                                             │
   │  Has spawn_stair_counter tool               │
   │  Decides how to parallelize                 │
   │                                             │
   │  → spawn_stair_counter("Stair 1", ...)     │
   │  → spawn_stair_counter("Stair 2", ...)     │
   │  → spawn_stair_counter("Stair 3", ...)     │
   │                                             │
   │  [Sub-agents run in parallel]               │
   └─────────────────────────────────────────────┘
        │
        ▼
   ┌─────────┐
   │ Compile │  Fresh conversation
   │  Agent  │  Output: final CSV + summary
   └─────────┘
```

### How It Works

1. **Orchestrator** (TypeScript) manages the 4 main phases
2. **Discovery Agent** (fresh conv) → scans PDF, outputs `sheet_list.json`
3. **Detail Agent** (fresh conv) → reads specs, outputs `construction_details.json`
4. **Counting Agent** (fresh conv) → has `spawn_stair_counter` tool
   - Receives list of stairs to count
   - Can spawn sub-agents in parallel for each stair
   - Each sub-agent is a fresh conversation
   - Aggregates results
5. **Compilation Agent** (fresh conv) → generates final outputs

### Why This Is the Best of Both Worlds

| Benefit | How It's Achieved |
|---------|-------------------|
| Fresh context per phase | Orchestrator creates new conversations |
| Parallelism where it matters | Counting agent spawns sub-agents |
| Failure recovery | Checkpoint after each phase |
| Predictable flow | Orchestrator controls main phases |
| Flexibility | Counting agent decides parallelization |
| Debuggability | Each phase has its own log |

### Pros

- **Clear phase boundaries** with fresh context
- **Parallel counting** via sub-agent spawning
- **Checkpoints** for failure recovery
- **Flexible counting** - Claude can adapt to what it finds
- **Best cost efficiency** - Fresh context + parallelism

### Cons

- **Most code to write** - Orchestrator + sub-agent tool + phase prompts
- **Complexity** - Multiple moving parts
- **Needs careful design** - Inter-phase contracts must be solid

### Implementation Effort: High (but worth it)

---

## Comparison Summary

| Aspect | Option 1 | Option 2 | Option 3 | Option 4 |
|--------|----------|----------|----------|----------|
| Fresh context | ✅ Per phase | ⚠️ Trimmed | ⚠️ Sub-agents only | ✅ All phases |
| Parallel counting | ⚠️ Manual | ❌ No | ✅ Yes | ✅ Yes |
| Failure recovery | ✅ Easy | ❌ Hard | ⚠️ Medium | ✅ Easy |
| Implementation | Medium | Medium | High | High |
| Flexibility | ❌ Rigid | ✅ Adaptive | ✅ Adaptive | ✅ Balanced |
| Predictability | ✅ High | ⚠️ Medium | ❌ Low | ✅ High |
| Cost reduction | ✅ Good | ⚠️ Medium | ⚠️ Medium | ✅ Best |

---

## Recommendation: Option 4 (Hybrid)

**Why Option 4?**

1. **Cost is the main driver** - Fresh context per phase gives the biggest cost reduction
2. **Parallel counting is valuable** - Stairs are independent, should count in parallel
3. **Reliability matters** - Checkpoints let you retry failed phases
4. **Predictability + Flexibility** - Orchestrator controls flow, but counting can adapt

**Implementation order:**

1. First, implement **Option 1** (orchestrator with sequential phases)
   - This gives you fresh context and checkpoints immediately
   - Easiest to build and debug

2. Then, add **parallel counting** (upgrade to Option 4)
   - Add `spawn_stair_counter` tool to Counting Agent
   - Implement parallel execution

This incremental approach lets you get value quickly while building toward the full hybrid architecture.

---

## Next Steps

1. **Design phase prompts** - What does each agent need to know?
2. **Define JSON contracts** - What does each phase produce/consume?
3. **Build orchestrator** - TypeScript code to manage phases
4. **Test with Option 1** - Validate the phase approach works
5. **Add parallel counting** - Upgrade to Option 4

---

## Open Questions

1. Should the orchestrator be completely hardcoded, or should it have some adaptive logic?
2. How do we handle edge cases (e.g., PDF with unusual structure)?
3. What's the maximum number of parallel counting agents to spawn?
4. Should sub-agents have access to all tools, or a restricted set?
