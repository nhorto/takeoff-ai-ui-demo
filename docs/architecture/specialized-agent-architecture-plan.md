# Specialized Agent Architecture Plan

## Problem Statement

The current system uses a single counting agent that handles tread and riser counting per stair. As requirements scale to 4+ measurement types per stair (landings, stringers, handrails, etc.), a single agent approach will:

- **Degrade accuracy** — prompt stuffing multiple measurement skills into one agent dilutes focus
- **Be hard to debug** — when a measurement is wrong, unclear which part of the prompt failed
- **Be hard to tune** — improving one measurement type risks regressing others
- **Hit context limits** — each measurement type needs its own instructions, examples, and edge cases

Current single-agent accuracy is strong (~100% on standard stairs for treads/risers), so the goal is to **scale without losing that accuracy**.

---

## Proposed Architecture

### High-Level Flow

```
┌──────────────────────────────────────────────────────────┐
│                    DISCOVERY AGENT                        │
│  - Identifies stairs, pages, locations                    │
│  - Captures stair type/material (steel pan, concrete,     │
│    metal grate, etc.)                                     │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│                   ROUTING LAYER                           │
│  Determines which views/pages contain what info           │
│  (plan views, section views, detail views)                │
│  Assigns image inputs per specialist agent                │
└──────────────────────┬───────────────────────────────────┘
                       │
           ┌───────────┼───────────┬───────────┐
           ▼           ▼           ▼           ▼
    ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
    │  Risers &  │ │            │ │            │ │ Handrails  │
    │  Treads    │ │  Stringers │ │  Landings  │ │ & Guard-   │
    │  Agent     │ │  Agent     │ │  Agent     │ │ rails Agent│
    └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
          │               │               │               │
          ▼               ▼               ▼               ▼
┌──────────────────────────────────────────────────────────┐
│                 COMPILATION AGENT                          │
│  - Receives all specialist outputs                        │
│  - Cross-validates interdependent measurements            │
│  - Flags inconsistencies                                  │
│  - Assembles structured output for this stair             │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│               USER REVIEW (per stair)                     │
│  - Presents compiled results for the current stair        │
│  - User approves (👍) or provides corrections             │
│  - If corrections needed: agent adjusts and re-presents   │
│  - Once approved: moves to next stair                     │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
                 [Next stair...]
```

### Phase Descriptions

#### Phase 1: Discovery (Enhanced)
- Identifies all stairs in the drawing set
- Returns page numbers, locations, stair identifiers
- **NEW: Captures stair type/material** (steel pan, concrete, metal grate, etc.)
  - Metal grate stairs get the same takeoff format but are flagged as metal grate
  - This is lightweight info (usually a note/callout) so discovery handles it rather than a separate agent

#### Phase 2: Routing Layer (New)
- Examines the drawing set to determine **which views contain which information**
- Key challenge: measurement data is spread across different view types (plan views, section views, detail callouts)
- A stringer length might be on a section view while landing dimensions are on a different detail
- **Every drawing set is different** — cannot assume standard sheet naming (e.g., A0500 is typical but not guaranteed)
- Detail sheets are NOT universal — each set has its own details, agents must read what's actually on the sheet
- Outputs a **routing map**: for each stair, which pages/regions feed into which specialist agents
- May use a hybrid approach (OCR + image analysis) to classify view types

#### Phase 3: Specialist Agents (Parallel)
Each agent has a **single focused skill** and runs in parallel with the others for a given stair.

| Specialist | What It Extracts | Likely Input View | Output |
|-----------|-----------------|-------------------|--------|
| **Risers & Treads** | Riser count, tread count per flight | Section view | Count per flight/run |
| **Stringers** | Stringer count, stringer lengths | Section view, details | Count + length |
| **Landings** | Landing count, landing dimensions | Section + plan views | Count + dimensions (L x W) |
| **Handrails & Guardrails** | Rail count, linear footage | Section + plan views, details | Count + total linear footage |

Each agent gets its own skill file with:
- What to look for (visual examples, terminology)
- How to extract it (OCR vs image analysis vs hybrid)
- Expected output schema
- Edge cases and gotchas

Each outputs a structured result (JSON) with confidence scores.

#### Phase 4: Compilation
- Receives structured outputs from all specialist agents
- Cross-validates where measurements are interdependent (e.g., riser count vs stringer length consistency)
- Flags any conflicts or low-confidence results
- Includes stair type/material from discovery
- Assembles the final takeoff output **for this single stair**

#### Phase 5: User Review (New — Per Stair)
- After compilation, the system **presents results to the user for the current stair**
- The user reviews and either:
  - **Approves** — system moves on to the next stair
  - **Provides corrections** — tells the agent what's wrong (e.g., "there are 3 stringers not 2", "landing is 5'-0\" x 4'-6\"")
- If corrections are provided:
  - The agent takes the feedback and adjusts the results
  - Re-presents the corrected output for approval
  - This loop continues until the user approves
- Once approved, the system proceeds to the next stair

**Why per-stair review matters:**
- Catches errors early instead of at the end when you have 8+ stairs to dig through
- User corrections can inform the agents on subsequent stairs (learning from feedback)
- Builds trust in the system — the user stays in control
- Much easier to correct one stair at a time than review a massive final output

---

## Key Design Decisions

### 1. One Skill File Per Measurement Type
Each specialist agent gets its own skill/prompt file. This means:
- Tuning stringer measurement doesn't risk breaking riser counting
- Each skill file can include measurement-specific examples and edge cases
- Easy to A/B test different prompting strategies per measurement type

### 2. Stair Type Captured by Discovery (Not a Separate Agent)
- Stair type/material is lightweight info (usually a note or callout on the drawing)
- Not worth a dedicated agent call — discovery captures it during initial identification
- Metal grate stairs, ship ladders, etc. are flagged but use the same takeoff format

### 3. Handrails & Guardrails Combined
- One agent handles both handrails and guardrails together
- Outputs total count and linear footage
- These elements are visually co-located on drawings, so one agent reading the same views makes sense

### 4. Hybrid Extraction (OCR + Vision)
Different measurements may require different extraction strategies:
- **OCR-heavy**: Dimension text, callout labels, stringer lengths annotated on drawings
- **Vision-heavy**: Counting physical elements (risers, treads), identifying landing areas
- **Hybrid**: Using OCR to find the right region, then vision to interpret it

Each specialist agent determines its own extraction strategy.

### 5. Image Cropping and Input Selection
- The routing layer determines which page regions are relevant to each specialist
- Specialists may receive **cropped regions** rather than full pages to reduce noise and improve focus
- This builds on the existing cropping infrastructure

### 6. Parallel Execution
- All 4 specialist agents for a given stair run simultaneously
- This keeps total latency roughly equal to the slowest single specialist (not the sum of all)
- Critical for keeping the system fast as measurement types scale

### 7. No Universal Detail Assumptions
- Every drawing set is different — detail sheets vary between architectural firms and projects
- Agents must read what's actually on the sheet, not assume "typical" details
- Sheet naming conventions (e.g., A0500 series for stairs) are common but not guaranteed

### 8. Structured Output Schema
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

### 9. Human-in-the-Loop Per Stair
- Results are presented to the user after each stair, not batched at the end
- User approval gates progression to the next stair
- Correction loop allows the agent to fix mistakes before moving on
- This is a core design principle, not an optional feature

---

## Cost Considerations

Running 4 parallel vision agents per stair multiplies API costs. Strategies to manage this:

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

1. **Interdependencies** — Which measurements can cross-validate each other? Need to map this out to build compilation validation logic
2. **View type classification** — How reliable can the routing layer be at identifying section vs plan vs detail views? May need its own eval dataset
3. **Accuracy baselines** — Need to establish per-measurement-type accuracy targets before splitting agents
4. **Drawing variability** — How much do drawing conventions vary across different architectural firms / drawing sets?
5. **Correction propagation** — When a user corrects a stair, should that feedback inform how agents handle subsequent stairs in the same set?

---

## Implementation Phases

### Phase A: Foundation
- [ ] Document which view types each measurement typically appears on
- [ ] Map interdependencies between measurement types
- [ ] Design the structured output schema for all specialists
- [ ] Design the user review UI/interaction flow

### Phase B: First Specialist Split
- [ ] Extract current riser/tread counting into its own specialist agent with dedicated skill file
- [ ] Enhance discovery agent to capture stair type/material
- [ ] Build the routing layer (even if simple/hardcoded initially)
- [ ] Build the compilation agent that consumes specialist outputs
- [ ] Build the per-stair user review step
- [ ] Validate that the split doesn't regress riser/tread accuracy

### Phase C: Add Specialists
- [ ] Add stringer specialist agent + skill file
- [ ] Add landing specialist agent + skill file
- [ ] Add handrails & guardrails specialist agent + skill file
- [ ] Run parallel execution and validate end-to-end

### Phase D: Optimize
- [ ] Run cost/accuracy experiments across model tiers per specialist
- [ ] Tune image cropping strategy per specialist
- [ ] Build cross-validation logic in compilation agent
- [ ] Establish eval datasets per measurement type
- [ ] Implement correction propagation (if valuable)

---

## Relationship to Existing Architecture

This plan extends the current orchestrator pattern:
- **Discovery → Counting → Compilation** becomes **Discovery → Routing → Specialists (parallel) → Compilation → User Review**
- The existing `orchestrator.ts` already supports per-phase provider selection, which maps well to per-specialist model selection
- The eval framework (`run-eval.ts`) will need to support per-specialist accuracy tracking
- The OpenRouter integration provides the model variety needed for cost optimization experiments
- The per-stair review loop is a new interaction pattern that will need UI support in the Electron app
