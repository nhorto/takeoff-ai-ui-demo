# Eval System Design

Internal design doc for the takeoff agent evaluation system. Captures decisions from the planning conversation on March 9, 2026.

---

## Why This Exists

The takeoff agent works, but there's no way to measure HOW WELL it works. This eval system lets us:

1. Score agent output against known correct answers
2. Compare architectures (monolith vs orchestrated vs sub-agents-as-tools)
3. Compare models (Sonnet vs Opus vs Haiku)
4. Trace agent behavior to catch bad reasoning even when the output is correct
5. Track cost, latency, and reliability across runs

The career strategy angle: this turns "I built a tool" into "I designed and evaluated an agent system" — which is what AI labs want to see.

---

## MVP Scope

**Only two things matter for MVP:**

1. **Correct stair count** — did the agent find all the stairs in the PDF?
2. **Correct treads and risers per stair** — did the agent count them right?

Everything else (stringer sizes, rail specs, landing counts, material grades) comes later as extensions. The eval framework should be designed to support adding these, but MVP doesn't need them.

---

## Golden Dataset

### Format

One JSON file per drawing in `eval/golden/`. The filename should match the drawing/PDF identifier.

```json
{
  "id": "project-name-or-drawing-id",
  "pdf": "path/to/drawing.pdf",
  "pages": [250, 251, 252, 253],
  "notes": "Any context about this drawing that matters",
  "expected": {
    "stair_count": 3,
    "stairs": [
      {
        "id": "Stair 1",
        "flights": 2,
        "total_risers": 26,
        "total_treads": 24
      },
      {
        "id": "Stair 2",
        "flights": 1,
        "total_risers": 18,
        "total_treads": 17
      },
      {
        "id": "Stair 3",
        "flights": 2,
        "total_risers": 18,
        "total_treads": 16
      }
    ]
  }
}
```

### Current State

- Less than 10 drawings available
- Golden answers exist for 1 drawing (OhioHealth Women's Center) — see below
- Rest need to be manually created (doable, just takes time)
- **5-8 drawings is enough** to demonstrate the methodology and get meaningful comparisons

### First Golden File: OhioHealth Women's Center

**Correct stair count: 7** (Elevator 15 is excluded — it's not a stair)

| Stair | Actual Treads | Actual Risers |
|-------|--------------|---------------|
| Stair 1 | 48 | 52 |
| Stair 2 | 257 | 281 |
| Stair 3 | 176 | 196 |
| Stair 4 | 220 | 240 |
| Stair 5 | 183 | 203 |
| Stair 6 | 183 | 202 |
| Stair 7 | 24 | 26 |

### Existing Runs (Already in outputs/)

These runs can be scored retroactively — no need to re-run anything to get started.

**Monolith runs (main branch, pre-orchestrator):**
- `first_output/` — earliest run
- `second_output/` — second attempt
- `2026-01-28-175536/` — CSV + summary only
- `2026-01-28-195810/` — CSV + summary + working notes
- `2026-01-30-101224/` — CSV + summary
- `2026-01-30-110521/` — CSV + summary
- `2026-01-31-122207/` — CSV + summary + working notes

**Orchestrated runs (feature/sub-agents, has discovery.json + stair_N.json):**
- `2026-02-14-133319/` — 7 stair JSONs, no elevator 15
- `2026-02-14-204751/` — 7 stair JSONs + elevator_15_stair.json
- `2026-02-17-202937/` — 7 stair JSONs, no elevator 15
- `2026-02-21-115313/` — 7 stair JSONs, no elevator 15
- `2026-02-21-155558/` — 7 stair JSONs + elevator_15_stairs.json (the run we compared above)

**Partial/empty runs (skip for eval):**
- `2026-01-30-112921/` — single page only
- `2026-01-30-115723/`, `2026-01-30-154125/`, `2026-01-30-154828/`, `2026-01-30-160338/`, `2026-01-30-181619/` — empty
- `2026-02-14-132159/` — discovery only, no counting
- `2026-02-14-133117/`, `2026-02-14-145404/`, `2026-02-14-155611/` — empty

### Preliminary Comparison: Agent vs Actuals (2026-02-21-155558 run)

| Stair | Agent Treads | Actual Treads | Delta | Agent Risers | Actual Risers | Delta |
|-------|-------------|---------------|-------|-------------|---------------|-------|
| 1 | 48 | 48 | 0 | — | 52 | — |
| 2 | 264 | 257 | +7 | 288 | 281 | +7 |
| 3 | 164 | 176 | -12 | 184 | 196 | -12 |
| 4 | 225 | 220 | +5 | 245 | 240 | +5 |
| 5 | 198 | 183 | +15 | 218 | 203 | +15 |
| 6 | 171 | 183 | -12 | 189 | 202 | -13 |
| 7 | 24 | 24 | 0 | 26 | 26 | 0 |

**Key finding:** Tread and riser deltas are nearly identical per stair, suggesting the agent miscounts whole flights (over/undercounting levels served) rather than misreading individual annotations. This is the kind of qualitative insight the eval should surface.

**Stair count:** Agent found 8 (included Elevator 15). Correct answer is 7. This is a stair detection error.

### Future Extensions

When adding more eval dimensions, extend the `expected` object:

```json
{
  "expected": {
    "stair_count": 3,
    "stairs": [
      {
        "id": "Stair 1",
        "flights": 2,
        "total_risers": 26,
        "total_treads": 24,
        "stringer_size": "MC12x10.6",
        "tread_gauge": "14ga",
        "rail_spec": "1-1/2\" pipe rail",
        "landing_count": 1,
        "riser_height": "7.5\"",
        "tread_depth": "11\""
      }
    ]
  }
}
```

The scoring system should handle missing fields gracefully — if a golden file doesn't have `stringer_size`, just skip that field in scoring.

---

## What Gets Logged Per Run

Every eval run produces a run log. This is the raw data that both automated scoring and model-based evaluation consume.

### Run Log Contents

```json
{
  "run_id": "2026-03-09-143021",
  "drawing_id": "project-name",
  "architecture": "orchestrated",
  "model": "claude-sonnet-4-20250514",
  "tool_calls": [
    {
      "phase": "discovery",
      "turn": 1,
      "tool": "get_page_text",
      "args": { "pages": [250, 251, 252], "format": "compact" }
    },
    {
      "phase": "counting",
      "stair": "Stair 1",
      "turn": 1,
      "tool": "extract_pdf_region",
      "args": { "page": 250, "crop": { "x": 100, "y": 200, "w": 400, "h": 300 } }
    }
  ],
  "output": {
    "stair_count": 3,
    "stairs": [
      { "id": "Stair 1", "flights": 2, "total_risers": 26, "total_treads": 24 }
    ]
  },
  "metrics": {
    "total_tokens_in": 45000,
    "total_tokens_out": 3200,
    "image_tokens": 12000,
    "text_tokens": 33000,
    "cost_usd": 0.18,
    "latency_seconds": 34.5,
    "turns_per_phase": { "discovery": 3, "counting_stair1": 4, "counting_stair2": 2, "compilation": 2 }
  }
}
```

**Key point:** Tool call return values do NOT need to be logged. Just the tool name and arguments. This keeps logs small and is enough for model-based evaluation to assess agent behavior.

---

## Scoring

### Automated Scoring (Exact Match)

A script that compares agent output to golden data, field by field.

**MVP metrics:**

| Metric | How It's Calculated |
|--------|-------------------|
| Stair detection | Did the agent find the correct number of stairs? (binary) |
| Stair identification | Which stairs were correctly identified by name/location? |
| Riser accuracy | Per-stair: `correct_risers == expected_risers` |
| Tread accuracy | Per-stair: `correct_treads == expected_treads` |
| Overall field accuracy | `correct_fields / total_fields` across all stairs |
| Hallucination count | Fields in output that don't exist in golden data |
| Miss count | Fields in golden data that are missing from output |

**Output:** A score JSON per run + a summary across runs.

### Model-Based Evaluation

For things automated scoring can't catch. Feed Claude:
- The tool call trace (from run log)
- The correct answer (from golden data)
- A rubric

**What model-based eval checks:**

1. **Tool use quality** — Did the agent crop the right areas? Did it read the right pages? Did it use text extraction before resorting to images?
2. **Right answer, wrong reasoning** — Did it get 14 risers because it read the annotation, or because it guessed? If it got lucky, that's a reliability risk.
3. **Over-cropping** — Did it extract huge page regions when a targeted crop would suffice?
4. **Wasted turns** — Did it re-extract pages it already had? Did it hit the turn limit?
5. **Soft matches** — "MC12x10.6" vs "MC12" — is that close enough? (For future eval dimensions)

**Rubric format (draft):**

```
Given the following tool call trace and correct answer, evaluate the agent's behavior:

TOOL CALL TRACE:
{trace}

CORRECT ANSWER:
{golden}

AGENT OUTPUT:
{output}

Score each dimension 1-5:
1. Did the agent find the correct stairs?
2. Did the agent use appropriate tools (text-first, minimal image tokens)?
3. Did the agent crop/extract the right regions?
4. Did the agent reach the correct counts through sound reasoning (not luck)?
5. Were there any wasted or redundant tool calls?

Provide a brief explanation for each score and flag any concerning patterns.
```

---

## Architecture Comparison

The main point of this eval. Three architectures, same drawings, same scoring.

### Architectures to Compare

| Architecture | Branch/Location | Description |
|-------------|----------------|-------------|
| **Monolith** | `main` branch | Single agent, one long conversation, all tools available |
| **Orchestrated** | `feature/sub-agents` | Deterministic TypeScript orchestrator, 3 phases (discovery → counting → compilation), fresh context per phase, page sandboxing |
| **Sub-agents-as-tools** | Future (TBD) | Single coordinator agent that can spawn sub-agents via tool calls. Agent decides when/how to delegate. |

The sub-agents-as-tools architecture doesn't exist yet. The eval framework should be built architecture-agnostic so we can plug it in later.

### Model Comparison

Within any architecture, swap the model:
- Claude Sonnet
- Claude Opus
- Claude Haiku

Especially interesting for the counting phase — is Opus more accurate than Sonnet on tricky annotations? Is Haiku good enough and 10x cheaper?

### Comparison Table (What We Want to Produce)

```
| Architecture       | Model  | Stair Detection | Riser Accuracy | Tread Accuracy | Avg Cost | Avg Latency | Reliability |
|-------------------|--------|-----------------|----------------|----------------|----------|-------------|-------------|
| Monolith          | Sonnet | 100%            | 85%            | 85%            | $0.45    | 120s        | 4/5 runs ok |
| Orchestrated      | Sonnet | 100%            | 92%            | 90%            | $0.18    | 65s         | 5/5 runs ok |
| Sub-agents-tools  | Sonnet | 100%            | 88%            | 87%            | $0.35    | 90s         | 5/5 runs ok |
| Orchestrated      | Opus   | 100%            | 96%            | 95%            | $0.72    | 85s         | 5/5 runs ok |
| Orchestrated      | Haiku  | 67%             | 70%            | 68%            | $0.03    | 20s         | 3/5 runs ok |
```

(Numbers are illustrative, not real.)

### Qualitative Analysis

Beyond the table, write up:
- Where does each architecture fail? (e.g., monolith loses context on long PDFs)
- Where does multi-agent help vs hurt?
- What failure modes are unique to each approach?
- Cost/accuracy tradeoff — is orchestrated the sweet spot?

---

## Reliability Testing

Run the same drawing through the same architecture 3-5 times. Check:
- Does it produce the same stair count every time?
- Do the treads/risers vary between runs?
- If results vary, by how much?

This catches non-determinism, which is a real problem with LLM-based systems.

---

## Running Evals

### Separately (Default)

```bash
# Run one drawing through one architecture
eval run --drawing project-a --arch orchestrated --model sonnet

# Run all drawings through one architecture
eval run --all --arch orchestrated --model sonnet
```

### Full Comparison

```bash
# Run all drawings through all architectures and models, produce comparison table
eval run --all --compare
```

This is a nice-to-have. The important thing is that individual runs are easy and the results are stored so you can compare after the fact.

### Results Storage

```
eval/
├── golden/                     # Ground truth files
│   ├── project-a.json
│   ├── project-b.json
│   └── ...
├── runs/                       # Raw run logs
│   ├── 2026-03-09-143021/
│   │   ├── run-log.json        # Tool calls, output, metrics
│   │   ├── score.json          # Automated scoring result
│   │   └── model-eval.json     # Model-based evaluation result
│   └── ...
├── results/                    # Aggregated comparison data
│   ├── comparison-table.json
│   └── analysis.md             # Qualitative write-up
├── rubrics/                    # Scoring rubrics for model-based eval
│   └── default.md
└── run-eval.ts                 # Main entry point
```

---

## Implementation Order

1. **Define golden dataset format** and create golden files for available drawings
2. **Add tool call logging** to the agent loop (just tool name + args, per phase)
3. **Build automated scoring** — compare output JSON to golden JSON, produce score
4. **Build model-based evaluation** — feed trace + golden + output to Claude with rubric
5. **Run monolith vs orchestrated comparison** on available drawings
6. **Build sub-agents-as-tools architecture** (separate effort)
7. **Run full 3-way comparison** and produce table + analysis
8. **Add more eval dimensions** (stringer sizes, rail specs, etc.) as golden data expands

---

## Open Questions

- What's the best way to extract the agent output into the standardized format for scoring? Each architecture produces output differently (monolith = one big CSV, orchestrated = per-stair JSONs).
- Should reliability runs be automated (run 3x and report variance) or manual?
- For model-based eval, should we use the same model that ran the agent, or always use Opus as judge?
- How do we handle the sub-agents-as-tools architecture's output format if it differs from the other two?
