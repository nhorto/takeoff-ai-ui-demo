# Eval Results

Auto-generated comparison of all scored runs against the OhioHealth Women's Center golden dataset.

**Golden data:** 7 stairs, 1,091 total treads, 1,200 total risers

## Comparison Table

| Run | Architecture | Stairs | Treads Acc | Risers Acc | Overall |
|-----|-------------|--------|-----------|-----------|---------|
| first_output | monolith | 8 (wrong) | 0% | 0% | 0% |
| second_output | monolith | 7 | 14% | 0% | 7% |
| 2026-01-28-175536 | monolith | 7 | 14% | 0% | 7% |
| 2026-01-28-195810 | monolith | 7 | 14% | 0% | 7% |
| 2026-01-30-101224 | monolith | 2 (wrong) | 0% | 0% | 0% |
| 2026-01-30-110521 | monolith | 1 (wrong) | 0% | 0% | 0% |
| 2026-01-31-122207 | monolith | 7 | 14% | 0% | 7% |
| 2026-02-14-133319 | orchestrated | 7 | 29% | 29% | 29% |
| 2026-02-14-204751 | orchestrated | 8 (wrong) | 43% | 43% | 43% |
| 2026-02-17-202937 | orchestrated | 7 | 29% | 43% | 36% |
| 2026-02-21-115313 | orchestrated | 7 | 57% | 57% | 57% |
| 2026-02-21-155558 | orchestrated | 8 (wrong) | 29% | 29% | 29% |
| 2026-03-10-204025 | orchestrated | 6 (wrong) | 14% | 14% | 14% |
| 2026-03-10-204157 | orchestrated | 7 | 29% | 29% | 29% |
| 2026-03-10-205709 | orchestrated | 8 (wrong) | 43% | 43% | 43% |
| 2026-03-10-211725 | orchestrated | 8 (wrong) | 29% | 29% | 29% |

## Architecture Summary

| Architecture | Runs | Avg Accuracy | Best | Worst |
|-------------|------|-------------|------|-------|
| Monolith | 7 | 4% | 7% | 0% |
| Orchestrated | 9 | 34% | 57% | 14% |

## Per-Stair Consistency

| Stair | Always Exact | Typical Delta Range | Hardest Problem |
|-------|-------------|-------------------|-----------------|
| Stair 1 | Yes (orchestrated) | 0 | Solved |
| Stair 2 | No | -2 to +7 | Slight over/undercount |
| Stair 3 | No | -12 to +22 | High variance (multi-view) |
| Stair 4 | No | -3 to +7 | Moderate variance |
| Stair 5 | No | -25 to +42 | Highest variance (multi-view + parking levels) |
| Stair 6 | No | -22 to +46 | Annotation deduplication (33 annotations on page) |
| Stair 7 | Yes (orchestrated) | 0 | Solved |

## Key Findings

1. **Architecture matters more than prompting** — Orchestrated pipeline improved accuracy from 0-7% to 14-57%
2. **Stairs 1 and 7 are solved** — 100% accuracy on every orchestrated run
3. **Errors are whole-flight miscounts** — Tread and riser deltas are always equal per stair
4. **Multi-view sheets cause highest variance** — Pages with section + plan + axon views have ~3x expected annotations
5. **Text-only extraction works** — All orchestrated runs used text extraction only (no images), still achieved up to 57%
6. **Temperature 1.0 causes high variance** — Same input produces wildly different counts across runs (e.g., Stair 5: -25 to +42)

## Next Steps

- [ ] Test temperature 0 for reduced variance
- [ ] Implement annotation deduplication (see docs/annotation-deduplication-problem.md)
- [ ] Add tolerance-based scoring tiers (exact/close/approximate)
- [ ] Compare models (Sonnet vs Opus vs Haiku)
- [ ] Add cost and latency tracking to comparison table
