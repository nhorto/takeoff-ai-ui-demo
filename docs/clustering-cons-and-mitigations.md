# Spatial Clustering: Known Cons & Mitigation Strategies

The X-gap clustering approach (implemented March 2026) works well for the OhioHealth Women's Center drawing set, achieving 78.6% accuracy. This document captures known risks and mitigation strategies for future development.

## 1. Threshold Sensitivity (10% page width)

**Risk:** The 10% page-width threshold (346 pts on a 48" sheet) is tuned for OhioHealth drawings. Different firms with different sheet layouts or scales could have views that don't separate at this threshold.

**Mitigations:**
- **Adaptive threshold:** Analyze the distribution of X-gaps and find the natural breakpoint (largest gap) using Jenks natural breaks / 1D k-means instead of a fixed percentage.
- **Multi-threshold validation:** Run clustering at 8%, 10%, 12% and pick the one where the primary cluster's riser total best matches `levelCount × expected-flights-per-level`.
- **Confidence flag:** If the largest X-gap is only marginally above threshold, flag as low-confidence and let the agent fall back to manual deduplication.

## 2. Vertically Stacked Views

**Risk:** The algorithm tries X-gap first, then falls back to Y-gap. Some sheets stack views vertically (section on top, plan on bottom). If both views have riser annotations at similar X-coordinates, X-gap won't separate them and the Y-gap fallback might not pick the right primary cluster.

**Mitigations:**
- **Combined 2D clustering:** Use DBSCAN with tuned epsilon and mutual nearest-neighbor linkage (prevents chaining) instead of sequential X-then-Y.
- **View title anchoring:** Detect view titles like "SECTION - STAIR 6" or "AXONOMETRIC" in the text, use their positions to anchor cluster centroids. Handles any layout arrangement. (This is Solution 3 from `annotation-deduplication-problem.md`.)

## 3. Multi-Page Stairs

**Risk:** Already hit with Stair 5 — the agent needs to ADD primary clusters from ALL pages. The per-page note helps, but the agent still has to mentally combine results. If one page has deduplication guides and the other doesn't, the agent might get confused.

**Mitigations:**
- **Cross-page aggregation in the tool:** Generate a COMBINED guide when the agent requests multiple pages in one `get_page_text` call. Sum primary clusters across pages and present one unified count.
- **Orchestrator-level hint:** Pass `expectedRiserTotal` (computed by summing primary clusters across all assigned pages) to the counting agent, giving it a target to validate against.

## 4. Non-Standard Annotation Formats

**Risk:** The regex pattern covers "EQ RSRS", "RISERS @", and "TREADS @". Other firms may use: "18R/17T", "9R @ 7\"", non-English labels, or completely different notation.

**Mitigations:**
- **Progressive regex expansion:** Add formats as encountered. The eval framework makes this easy — add a new golden dataset, run evals, see what patterns are missed.
- **LLM-assisted pattern detection:** Before clustering, ask the agent to scan text and report annotation formats. Use those patterns for clustering. Adds one API call but handles arbitrary formats.

## 5. Different Views Showing Different Floors (HIGHEST RISK)

**Risk:** The assumption is that all views show the SAME flights (duplicates). But some drawings have a section view of floors 1-5 and a separate section view of floors 6-10 on the same page. Both are legitimate, non-duplicate annotations that should BOTH be counted. The current algorithm would drop one entirely.

**Mitigations:**
- **Annotation value comparison:** After clustering, compare values between clusters. If two clusters have completely DIFFERENT values (no overlap), they likely represent different floor ranges, not duplicate views. Only flag as duplicates if clusters share similar patterns.
- **Level range cross-check:** If the primary cluster's riser total seems too low for `levelCount` (e.g., covers 5 levels when 10 expected), check if combining two clusters gets closer to expected total.

## 6. Transferability to Other Drawing Sets

**Risk:** Only tested on one drawing set (OhioHealth Women's Center). The threshold, the "risers cluster separately from treads" pattern, and the "section view is leftmost" assumption might not hold universally.

**Mitigations:**
- **Multi-dataset eval:** Add 2-3 golden datasets from different firms/projects. If clustering works across all, we have confidence. If it breaks, we know where.
- **Graceful degradation:** If clustering detects 1 cluster, it already silently passes through. If clusters don't make sense, emit a warning instead of a recommendation and let the agent decide.

## Priority Order

| Priority | Issue | Reason |
|----------|-------|--------|
| 1 | Annotation value comparison (#5) | Highest risk of wrong answers — dropping a legitimate section view |
| 2 | Cross-page aggregation (#3) | Straightforward engineering, removes agent ambiguity |
| 3 | Adaptive threshold (#1) | Natural breaks algorithm is simple, eliminates magic number |
| 4 | Multi-dataset eval (#6) | Validates everything before investing in edge cases |
| 5 | View title anchoring (#2) | Robust long-term solution but more complex |
| 6 | Annotation format expansion (#4) | Handle as encountered, not proactively |

None are urgent — the current implementation handles OhioHealth at 78.6% and the architecture is clean enough to extend incrementally.

## Related Files

- `docs/spatial-clustering-improvement.md` — How the clustering was implemented and validated
- `docs/annotation-deduplication-problem.md` — Original problem analysis with 4 proposed solutions
- `src/main/core/tools.ts` — Clustering implementation (`clusterAnnotationsIntoViews`, `generateDeduplicationGuide`)
- `resources/knowledge-base/skills/CountingPhase.md` — Agent prompt referencing VIEW DEDUPLICATION
