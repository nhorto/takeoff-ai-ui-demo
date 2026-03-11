# Counting Phase Skill Updates

Changes made to `resources/knowledge-base/skills/CountingPhase.md` to improve counting agent behavior based on live run observations.

---

## Problems Observed

### 1. Agent didn't understand scissor stair annotations

The Stair 1 counting agent found text annotations like `14 EQ RSRS 7'-0 7/8"` but couldn't reconcile them with the building height. It summed 4 flight rises (34'-6") and compared to the total building rise (49'-4"), panicked at the mismatch, and went on a 12+ crop spree trying to find "missing" flights.

The actual issue: scissor stairs have two interlocking stairways. The section view shows annotations for both stairways, so the individual flight rises don't sum to the full building height — they cover overlapping paths through the shaft.

### 2. Excessive sequential cropping

The Stair 1 agent made 12+ sequential crops of page 250 (one crop per turn), each costing ~$0.06 in tokens. It should have read the text annotations, extracted one overview image, and been done in 5-8 turns instead of 17+.

### 3. Working notes being overwritten instead of appended

Counting agents were writing working notes to the same `working-notes.md` file, overwriting each time. Since counting agents run in parallel (2 at a time), they'd stomp on each other's notes. More fundamentally, counting agents are short-lived (one stair, one conversation) and don't need working notes at all.

---

## Changes Made

### Removed working notes requirement

- **Before:** Agent was expected to write working notes like the single-agent flow
- **After:** Explicit instruction: "Do NOT write working notes — you are a short-lived agent counting one stair. Just output the JSON when done."
- **Why:** Counting agents process 1-2 pages for one stair. Working notes are designed for the discovery/single-agent flow where you process dozens of pages across many batches.

### Added "EQ RSRS" annotation format documentation

- **Before:** Only documented `18R/17T` and `9R @ 7"` formats
- **After:** Added the `N EQ RSRS H'-H"` format as the MOST COMMON format in CAD drawings, with explanation that "EQ RSRS" means "equal risers" and the dimension is the total rise for that flight
- **Why:** This is the format used in the actual construction drawings (AutoCAD/Revit output). The agent found these annotations but didn't know how to interpret them.

### Added scissor stair geometry explanation

- **Before:** No mention of scissor stairs
- **After:** Dedicated section explaining:
  - Two interlocking stairways share the same shaft
  - Section view shows annotations for BOTH stairways
  - Each level-to-level segment typically has 2 flights
  - DO NOT expect individual flight rises to sum to building height
  - How to map annotations to flights (list all, find adjacent level labels, group by segment)
- **Why:** The agent's confusion about rise totals not matching building height caused it to distrust the text annotations and fall back to expensive visual counting.

### Enforced strict 3-step methodology

- **Before:** Loose guidance — "read text first, then use images if needed"
- **After:** Three explicit steps:
  1. **Step 1: Read Text (MANDATORY)** — `get_page_text` for all assigned pages
  2. **Step 2: Extract ONE Overview Image** — to confirm configuration and map annotations to flights
  3. **Step 3: Crop ONLY If Needed** — maximum 2-3 crops, batch all in one turn
- **Why:** The agent was doing step 1, then immediately jumping to sequential cropping without analyzing the overview first.

### Added crop budget and turn target

- **Before:** No limits on crops or turns
- **After:**
  - "Maximum 3 crops per stair"
  - "Your target is 5-8 turns total"
  - "If you need more than 3 crops, you're doing something wrong — re-read the text output and overview image first"
- **Why:** Stair 1 used 12+ crops at ~$0.06 each. Stair 2 (which worked well) completed in 10 turns. With text extraction, most stairs should finish in 5-8.

### Added confidence level documentation

- **Before:** Just "note confidence"
- **After:** Three defined levels:
  - `text annotation` — High confidence (machine-readable CAD text)
  - `visual count from crop` — High confidence (counted from zoomed image)
  - `visual count from overview` — Medium confidence (small elements in full-page view)
- **Why:** The Stair 2 agent already used these naturally. Standardizing them ensures consistent output across all counting agents.

### Added cross-check rules

- Tread count = Risers - 1 for each flight (always)
- Sum of all flight rises should approximately equal total level-to-level height
- Plan view tread counts should match section view riser counts (e.g., 13 treads = 14 risers)

---

## Results Comparison

| Metric | Stair 2 (text worked) | Stair 1 (before fix) | Stair 1 (expected after fix) |
|--------|----------------------|---------------------|------------------------------|
| Turns | 10 | 17+ | 5-8 |
| Crops | ~5 | 12+ | 1-3 |
| Cost | $0.42 | $1.00+ | ~$0.30-0.50 |
| Confidence | High (text) | High (text + visual) | High (text + overview) |

---

## Domain Knowledge Added

These are construction domain facts now embedded in the skill. They should be validated by someone with construction drawing experience:

1. "EQ RSRS" = "equal risers" — standard CAD annotation format
2. Scissor stairs have two interlocking stairways in one shaft
3. Section views of scissor stairs show annotations for both stairways
4. Individual flight rises in a scissor stair don't sum to building height
5. Typical pattern: 2 flights per level-to-level segment in scissor stairs
6. Treads = Risers - 1 per flight (always)
