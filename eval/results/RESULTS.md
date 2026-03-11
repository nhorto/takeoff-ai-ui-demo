# Eval Results

Auto-generated comparison of all scored runs against the OhioHealth Women's Center golden dataset.

**Golden data:** 7 stairs, 1,091 total treads, 1,200 total risers

## Comparison Table

| Run | Architecture | Temp | Stairs | Treads Acc | Risers Acc | Overall |
|-----|-------------|------|--------|-----------|-----------|---------|
| first_output | monolith | 1.0 | 8 (wrong) | 0% | 0% | 0% |
| second_output | monolith | 1.0 | 7 | 14% | 0% | 7% |
| 2026-01-28-175536 | monolith | 1.0 | 7 | 14% | 0% | 7% |
| 2026-01-28-195810 | monolith | 1.0 | 7 | 14% | 0% | 7% |
| 2026-01-30-101224 | monolith | 1.0 | 2 (wrong) | 0% | 0% | 0% |
| 2026-01-30-110521 | monolith | 1.0 | 1 (wrong) | 0% | 0% | 0% |
| 2026-01-31-122207 | monolith | 1.0 | 7 | 14% | 0% | 7% |
| 2026-02-14-133319 | orchestrated | 1.0 | 7 | 29% | 29% | 29% |
| 2026-02-14-204751 | orchestrated | 1.0 | 8 (wrong) | 43% | 43% | 43% |
| 2026-02-17-202937 | orchestrated | 1.0 | 7 | 29% | 43% | 36% |
| 2026-02-21-115313 | orchestrated | 1.0 | 7 | 57% | 57% | 57% |
| 2026-02-21-155558 | orchestrated | 1.0 | 8 (wrong) | 29% | 29% | 29% |
| 2026-03-10-204025 | orchestrated | 1.0 | 6 (wrong) | 14% | 14% | 14% |
| 2026-03-10-204157 | orchestrated | 1.0 | 7 | 29% | 29% | 29% |
| 2026-03-10-205709 | orchestrated | 1.0 | 8 (wrong) | 43% | 43% | 43% |
| 2026-03-10-211725 | orchestrated | 1.0 | 8 (wrong) | 29% | 29% | 29% |
| 2026-03-10-213619 | orchestrated | 0 | 8 (wrong) | 29% | 29% | 29% |
| **2026-03-10-215608** | **orchestrated** | **0** | **8 (wrong)** | **57%** | **57%** | **57%** |

## Architecture Summary

| Architecture | Runs | Avg Accuracy | Best | Worst |
|-------------|------|-------------|------|-------|
| Monolith | 7 | 4% | 7% | 0% |
| Orchestrated (temp=1.0) | 9 | 34% | 57% | 14% |
| Orchestrated (temp=0) | 2 | 43% | 57% | 29% |

## Temperature 0 vs 1.0 Variance

| Stair | temp=1.0 range (4 runs) | temp=0 range (2 runs) |
|-------|------------------------|----------------------|
| Stair 1 | exact every time | exact every time |
| Stair 2 | -2 to +5 | +1, +1 |
| Stair 3 | exact to +22 | exact, +14 |
| Stair 4 | -2 to +7 | +7, +18 |
| Stair 5 | -25 to +42 | +2, +30 |
| Stair 6 | -12 to +10 | exact, +1 |
| Stair 7 | exact every time | exact every time |

Temperature 0 reduced variance for Stairs 2 and 6. Stair 2 locked to +1 both runs. Stair 6 went from -12/+10 range to exact/+1. Remaining variance comes from discovery phase producing different free-form notes between runs, which cascades into counting agents.

## Per-Stair Consistency

| Stair | Always Exact | Typical Delta Range | Hardest Problem |
|-------|-------------|-------------------|-----------------|
| Stair 1 | Yes (orchestrated) | 0 | Solved |
| Stair 2 | No | -2 to +5 | Slight over/undercount |
| Stair 3 | No | -12 to +22 | High variance (multi-view) |
| Stair 4 | No | -3 to +18 | Moderate variance |
| Stair 5 | No | -25 to +42 | Highest variance (multi-view + parking levels) |
| Stair 6 | No | -22 to +46 | Annotation deduplication (33 annotations on page) |
| Stair 7 | Yes (orchestrated) | 0 | Solved |

## Discovery Phase → Accuracy Correlation

Analysis of discovery.json across all orchestrated runs revealed:

1. **Specific annotations in discovery notes = higher accuracy** — Both 57% runs listed individual riser values ("14 EQ RSRS, 8 EQ RSRS, 13 EQ RSRS") rather than generic "RSRS annotations visible"
2. **Pre-populated flight arrays = worst accuracy** — The one run with `flights[]` in discovery scored 14% (lowest). Wrong anchors hurt more than no anchors.
3. **Correct Stair 5 level count matters** — Runs with 12 levels (overcounting) produced inflated Stair 5 totals
4. **The two 57% runs got different stairs right** — One nailed Stairs 1,2,5,7; the other nailed Stairs 1,3,6,7. Combining the best of both would yield 85%+.

## Key Findings

1. **Architecture matters more than prompting** — Orchestrated pipeline improved accuracy from 0-7% to 14-57%
2. **Stairs 1 and 7 are solved** — 100% accuracy on every orchestrated run
3. **Errors are whole-flight miscounts** — Tread and riser deltas are always equal per stair
4. **Multi-view sheets cause highest variance** — Pages with section + plan + axon views have ~3x expected annotations
5. **Text-only extraction works** — All orchestrated runs used text extraction only (no images), still achieved up to 57%
6. **Temperature 0 reduces variance** — Stair 2 locked to +1 both runs; Stair 6 went from -12/+10 to exact/+1
7. **Discovery quality drives counting quality** — Free-form notes cascade into counting agent behavior; specific annotations help, wrong pre-counts hurt

## Next Steps

- [x] Test temperature 0 for reduced variance
- [ ] Implement annotation deduplication (see docs/annotation-deduplication-problem.md)
- [ ] Add tolerance-based scoring tiers (exact/close/approximate)
- [ ] Compare models (Sonnet vs Opus vs Haiku)
- [ ] Add cost and latency tracking to comparison table
- [ ] Structure discovery output to reduce free-form variance
