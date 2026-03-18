# Specialized Agent Architecture Plan

## Problem Statement

The current system uses a single counting agent that handles tread and riser counting per stair. As requirements scale to 6-7+ measurement types per stair (landings, stringers, dimensions, etc.), a single agent approach will:

- **Degrade accuracy** — prompt stuffing multiple measurement skills into one agent dilutes focus
- **Be hard to debug** — when a measurement is wrong, unclear which part of the prompt failed
- **Be hard to tune** — improving one measurement type risks regressing others
- **Hit context limits** — each measurement type needs its own instructions, examples, and edge cases

Current single-agent accuracy is strong (~100% on standard stairs for treads/risers), so the goal is to **scale without losing that accuracy**.

---

## Proposed Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────┐
│                   DISCOVERY AGENT                    │
│  (existing — identifies stairs, pages, locations)    │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│                  ROUTING LAYER                        │
│  Determines which views/pages contain what info      │
│  (plan views, section views, detail views)            │
│  Assigns image inputs per specialist agent            │
└─────────────────────┬───────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
   ┌────────────┐ ┌────────────┐ ┌────────────┐
   │ Specialist │ │ Specialist │ │ Specialist │  ... (N agents)
   │  Agent 1   │ │  Agent 2   │ │  Agent N   │
   │ (e.g.      │ │ (e.g.      │ │ (e.g.      │
   │  risers/   │ │  stringers)│ │  landings) │
   │  treads)   │ │            │ │            │
   └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
         │               │               │
         ▼               ▼               ▼
┌─────────────────────────────────────────────────────┐
│                COMPILATION AGENT                      │
│  - Receives all specialist outputs                    │
│  - Cross-validates interdependent measurements        │
│  - Flags inconsistencies                              │
│  - Assembles final structured output                  │
└─────────────────────────────────────────────────────┘
```

### Phase Descriptions

#### Phase 1: Discovery (Existing)
- Identifies all stairs in the drawing set
- Returns page numbers, locations, stair identifiers
- No changes needed here

#### Phase 2: Routing Layer (New)
- Examines the drawing set to determine **which views contain which information**
- Key challenge: measurement data is spread across different view types (plan views, section views, detail callouts)
- A stringer length might be on a section view while landing dimensions are on a different detail
- Outputs a **routing map**: for each stair, which pages/regions feed into which specialist agents
- May use a hybrid approach (OCR + image analysis) to classify view types

#### Phase 3: Specialist Agents (New — Parallel)
- Each agent has a **single focused skill** (one measurement type)
- Each agent gets its own skill file with:
  - What to look for (visual examples, terminology)
  - How to extract it (OCR vs image analysis vs hybrid)
  - Expected output schema
  - Edge cases and gotchas
- **All specialist agents run in parallel per stair** for speed
- Each outputs a structured result (JSON) with confidence scores

##### Known Specialist Types (Pending Full List)
| Specialist | What It Measures | Likely Input View |
|-----------|-----------------|-------------------|
| Riser/Tread Counter | Riser count, tread count | Section view |
| Stringer Agent | Stringer count, stringer lengths | Section view |
| Landing Agent | Landing count, landing dimensions | Section/plan view |
| TBD | TBD | TBD |
| TBD | TBD | TBD |
| TBD | TBD | TBD |

> **Note:** Full measurement list pending. Architecture is designed to support N specialist agents — adding a new measurement type means adding a new skill file and registering the agent.

#### Phase 4: Compilation (Enhanced)
- Receives structured outputs from all specialist agents
- Cross-validates where measurements are interdependent (e.g., riser count vs stringer length consistency)
- Flags any conflicts or low-confidence results
- Assembles the final takeoff output

---

## Key Design Decisions

### 1. One Skill File Per Measurement Type
Each specialist agent gets its own skill/prompt file. This means:
- Tuning stringer measurement doesn't risk breaking riser counting
- Each skill file can include measurement-specific examples and edge cases
- Easy to A/B test different prompting strategies per measurement type

### 2. Hybrid Extraction (OCR + Vision)
Different measurements may require different extraction strategies:
- **OCR-heavy**: Dimension text, callout labels, stringer lengths annotated on drawings
- **Vision-heavy**: Counting physical elements (risers, treads), identifying landing areas
- **Hybrid**: Using OCR to find the right region, then vision to interpret it

Each specialist agent determines its own extraction strategy.

### 3. Image Cropping and Input Selection
- The routing layer determines which page regions are relevant to each specialist
- Specialists may receive **cropped regions** rather than full pages to reduce noise and improve focus
- This builds on the existing cropping infrastructure

### 4. Parallel Execution
- All specialist agents for a given stair run simultaneously
- This keeps total latency roughly equal to the slowest single specialist (not the sum of all)
- Critical for keeping the system fast as measurement types scale

### 5. Structured Output Schema
Every specialist agent outputs the same envelope:
```json
{
  "stairId": "S1",
  "measurementType": "stringers",
  "confidence": 0.92,
  "results": { ... },
  "sourcePages": [3, 7],
  "notes": "Stringer length partially obscured, estimated from scale"
}
```

---

## Cost Considerations

Running 6-7 parallel vision agents per stair multiplies API costs significantly. Strategies to manage this:

| Strategy | Description |
|----------|-------------|
| **Model tiering** | Simpler counting tasks (risers/treads) may work with cheaper/faster models; complex measurement tasks (stringer lengths, landing dims) may need more capable models |
| **OpenRouter integration** | Use cheaper models via OpenRouter for appropriate specialist tasks |
| **Cropped inputs** | Smaller image regions = fewer tokens = lower cost |
| **Conditional specialists** | Only run agents for measurement types that exist in the drawing (not every stair has landings) |
| **Experimentation-driven** | Run eval comparisons across model tiers to find the accuracy/cost sweet spot per specialist |

> Final model selection per specialist will be determined through experimentation once the eval framework supports multi-model comparison.

---

## Open Questions

1. **Full measurement list** — What are all 6-7+ measurement types? (Pending from stakeholder input)
2. **Interdependencies** — Which measurements can cross-validate each other? Need to map this out to build compilation validation logic
3. **View type classification** — How reliable can the routing layer be at identifying section vs plan vs detail views? May need its own eval dataset
4. **Accuracy baselines** — Need to establish per-measurement-type accuracy targets before splitting agents
5. **Drawing variability** — How much do drawing conventions vary across different architectural firms / drawing sets?

---

## Implementation Phases

### Phase A: Foundation
- [ ] Get full measurement list from stakeholder
- [ ] Document which view types each measurement typically appears on
- [ ] Map interdependencies between measurement types
- [ ] Design the structured output schema for all specialists

### Phase B: First Specialist Split
- [ ] Extract current riser/tread counting into its own specialist agent with dedicated skill file
- [ ] Build the routing layer (even if simple/hardcoded initially)
- [ ] Build the compilation agent that consumes specialist outputs
- [ ] Validate that the split doesn't regress riser/tread accuracy

### Phase C: Add Specialists
- [ ] Add stringer specialist agent + skill file
- [ ] Add landing specialist agent + skill file
- [ ] Add remaining specialist agents as measurement list is finalized
- [ ] Run parallel execution and validate end-to-end

### Phase D: Optimize
- [ ] Run cost/accuracy experiments across model tiers per specialist
- [ ] Tune image cropping strategy per specialist
- [ ] Build cross-validation logic in compilation agent
- [ ] Establish eval datasets per measurement type

---

## Relationship to Existing Architecture

This plan extends the current orchestrator pattern:
- **Discovery → Counting → Compilation** becomes **Discovery → Routing → Specialists (parallel) → Compilation**
- The existing `orchestrator.ts` already supports per-phase provider selection, which maps well to per-specialist model selection
- The eval framework (`run-eval.ts`) will need to support per-specialist accuracy tracking
- The OpenRouter integration provides the model variety needed for cost optimization experiments
