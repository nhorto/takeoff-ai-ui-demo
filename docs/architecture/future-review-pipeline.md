# Future Feature: Review Pipeline Phase

## Status: Planned (not yet implemented)

## Problem

The current orchestrator runs as a one-shot pipeline:
```
Discovery → Counting (parallel) → Compilation → Done
```

When counting agents produce incomplete or uncertain results, there's no way for the user to review, provide guidance, and have the agent retry specific stairs before final deliverables are generated.

## Proposed Solution

Add a **Review Phase** between Counting and Compilation:

```
Discovery → Counting → REVIEW → Compilation → Done
```

### Review Phase Flow

1. After all counting agents finish, the orchestrator collects results and checks for:
   - Stairs with `coverage.percentCovered` below a threshold (e.g., 90%)
   - Stairs with `confidence: "low"` or `confidence: "medium"`
   - Stairs with unresolved anomalies

2. If all stairs pass review automatically → skip to Compilation (no user interaction needed)

3. If any stairs are flagged:
   - Present the user with a summary of what was found and what's incomplete
   - Show per-stair coverage data (e.g., "Stair 1: 51% of building rise accounted for")
   - Give the user options:
     - **Investigate**: User can look at the drawings themselves and provide specific guidance (e.g., "Stair 1 has 8 flights, the section view annotations at Y=200-400 are the correct ones")
     - **Re-run**: Trigger a re-count for specific stairs with updated instructions
     - **Accept as-is**: Finalize with current data, flagging incomplete items in deliverables
     - **Abort**: Cancel the takeoff

4. After user provides guidance:
   - Re-run counting agents ONLY for flagged stairs, injecting user's guidance into the prompt
   - Merge updated results with existing good results
   - Re-check coverage

5. When user approves (or all stairs pass automatically) → proceed to Compilation

### Architecture Changes Needed

- **Orchestrator**: Add review phase loop with user interaction support
- **IPC layer**: New IPC channel for review phase UI (present results, accept user input)
- **UI**: Review screen showing per-stair results with coverage visualization
- **CountOutput interface**: Add `coverage` field (already implemented in Option C)
- **Counting phase**: Support "re-run with guidance" mode where previous attempt's results and user notes are injected

### UI Mockup (rough)

```
┌─────────────────────────────────────────────────┐
│ Review: 6/7 stairs complete, 1 needs attention  │
├─────────────────────────────────────────────────┤
│                                                 │
│ ✅ Stair 1    52 risers    48 treads   100%    │
│ ✅ Stair 2   281 risers   257 treads   100%    │
│ ⚠️ Stair 3   150 risers   136 treads    76%    │
│ ✅ Stair 4   240 risers   220 treads   100%    │
│ ✅ Stair 5   203 risers   183 treads   100%    │
│ ✅ Stair 6   202 risers   183 treads   100%    │
│ ✅ Stair 7    26 risers    24 treads   100%    │
│                                                 │
│ [Investigate Stair 3]  [Accept All]  [Abort]   │
└─────────────────────────────────────────────────┘
```

### Key Design Principles

- **Don't block on good results**: If everything passes, go straight to compilation
- **User is in control**: They decide whether to investigate, re-run, or accept
- **Incremental**: Only re-run what's needed, don't redo the whole takeoff
- **Context preservation**: Re-run agents get the previous attempt's results + user guidance so they don't start from scratch

## Dependencies

- Coverage field in CountOutput JSON (implemented)
- Floor-to-floor sanity check in CountingPhase (implemented)

## Date Created: 2026-02-17
