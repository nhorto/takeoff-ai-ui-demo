#!/usr/bin/env bun
/**
 * Eval Scoring Script
 *
 * Scores existing agent runs against golden data.
 * Handles both orchestrated (stair_N.json) and monolith (CSV) output formats.
 *
 * Scoring categories:
 *   1. Treads & Risers — exact match per stair
 *   2. Structural — flights, width, landing count, landing dimensions
 *      - Dimensions compared in inches with ±1" tolerance
 *      - Null golden values are skipped (not penalized)
 *
 * Usage:
 *   bun run eval/score-runs.ts                    # Score all runs
 *   bun run eval/score-runs.ts 2026-02-21-155558  # Score specific run
 *   bun run eval/score-runs.ts --table             # Output comparison table
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Constants ──────────────────────────────────────────────────────────────

const DIMENSION_TOLERANCE_INCHES = 1;

// ─── Types ───────────────────────────────────────────────────────────────────

interface GoldenLanding {
  length_inches: number | null;
  depth_inches: number | null;
}

interface GoldenStair {
  id: string;
  total_treads: number;
  total_risers: number;
  flights?: number;
  width_inches?: number;
  landing_count?: number;
  landings?: GoldenLanding[];
  notes?: string;
}

interface GoldenData {
  id: string;
  project: string;
  scoring_notes?: string;
  expected: {
    stair_count: number;
    stairs: GoldenStair[];
  };
}

interface ExtractedLanding {
  length_inches: number | null;
  depth_inches: number | null;
}

interface ExtractedStair {
  id: string;
  total_treads: number | null;
  total_risers: number | null;
  flights: number | null;
  width_inches: number | null;
  landing_count: number | null;
  landings: ExtractedLanding[];
}

interface RunOutput {
  stair_count: number;
  stairs: ExtractedStair[];
  format: 'orchestrated' | 'monolith';
}

interface LandingScore {
  index: number;
  length_expected: number | null;
  length_actual: number | null;
  length_correct: boolean | null; // null = skipped (no golden value)
  depth_expected: number | null;
  depth_actual: number | null;
  depth_correct: boolean | null;
}

interface StairScore {
  stair_id: string;
  // Treads & Risers
  treads_expected: number;
  treads_actual: number | null;
  treads_delta: number | null;
  treads_correct: boolean;
  risers_expected: number;
  risers_actual: number | null;
  risers_delta: number | null;
  risers_correct: boolean;
  // Structural
  flights_expected: number | null;
  flights_actual: number | null;
  flights_correct: boolean | null;
  width_expected: number | null;
  width_actual: number | null;
  width_correct: boolean | null;
  landing_count_expected: number | null;
  landing_count_actual: number | null;
  landing_count_correct: boolean | null;
  landing_scores: LandingScore[];
}

interface RunScore {
  run_id: string;
  format: 'orchestrated' | 'monolith';
  golden_id: string;
  stair_count_expected: number;
  stair_count_actual: number;
  stair_count_correct: boolean;
  stairs: StairScore[];
  summary: {
    // Treads & Risers (legacy — always scored)
    total_tr_fields: number;
    correct_tr_fields: number;
    treads_risers_accuracy: number;
    treads_accuracy: number;
    risers_accuracy: number;
    // Structural (new — may not be present in older runs)
    total_structural_fields: number;
    correct_structural_fields: number;
    structural_accuracy: number;
    flights_accuracy: number;
    width_accuracy: number;
    landing_count_accuracy: number;
    landing_dimensions_accuracy: number;
    // Overall
    hallucinated_stairs: string[];
    missed_stairs: string[];
  };
}

// ─── Paths ───────────────────────────────────────────────────────────────────

const ROOT = path.resolve(import.meta.dir, '..');
const OUTPUTS_DIR = path.join(ROOT, 'outputs');
const GOLDEN_DIR = path.join(ROOT, 'eval', 'golden');
const RUNS_DIR = path.join(ROOT, 'eval', 'runs');
const RESULTS_DIR = path.join(ROOT, 'eval', 'results');

// ─── Golden Data Loading ─────────────────────────────────────────────────────

function loadGolden(): GoldenData {
  const goldenPath = path.join(GOLDEN_DIR, 'ohiohealth-womens-center.json');
  return JSON.parse(fs.readFileSync(goldenPath, 'utf-8'));
}

// ─── Dimension Helpers ──────────────────────────────────────────────────────

/**
 * Parse a dimension string like "4'-6\"" or "48" to inches.
 * Returns null if unparseable.
 */
function parseDimensionToInches(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;

  const s = value.trim();
  if (!s) return null;

  // Already a plain number (inches)
  const plain = parseFloat(s);
  if (!isNaN(plain) && /^[\d.]+$/.test(s)) return plain;

  // Feet-inches format: 4'-6", 4'-6 1/2", etc.
  const match = s.match(/(\d+)'\s*-?\s*(\d+)?(?:\s+(\d+)\/(\d+))?\s*"?/);
  if (match) {
    const feet = parseInt(match[1]);
    const inches = match[2] ? parseInt(match[2]) : 0;
    const fracNum = match[3] ? parseInt(match[3]) : 0;
    const fracDen = match[4] ? parseInt(match[4]) : 1;
    return feet * 12 + inches + fracNum / fracDen;
  }

  return null;
}

/**
 * Compare two inch values within tolerance. Returns null if either is null.
 */
function dimensionsMatch(expected: number | null, actual: number | null): boolean | null {
  if (expected === null || actual === null) return null;
  return Math.abs(expected - actual) <= DIMENSION_TOLERANCE_INCHES;
}

// ─── Output Extraction ───────────────────────────────────────────────────────

/**
 * Extract stair data from an orchestrated run (stair_N.json files)
 */
function extractOrchestrated(runDir: string): RunOutput {
  const stairs: ExtractedStair[] = [];

  const files = fs.readdirSync(runDir).filter(f =>
    f.match(/^stair_\d+\.json$/)
  );

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(runDir, file), 'utf-8'));

    // Extract flights count
    let flightCount: number | null = null;
    if (Array.isArray(data.flights)) {
      flightCount = data.flights.length;
    } else if (typeof data.flights === 'number') {
      flightCount = data.flights;
    } else if (typeof data.flightCount === 'number') {
      flightCount = data.flightCount;
    }

    // Extract width
    let widthInches: number | null = null;
    if (data.width_inches != null) {
      widthInches = typeof data.width_inches === 'number' ? data.width_inches : parseDimensionToInches(data.width_inches);
    } else if (data.widthInches != null) {
      widthInches = typeof data.widthInches === 'number' ? data.widthInches : parseDimensionToInches(data.widthInches);
    } else if (data.width != null) {
      widthInches = parseDimensionToInches(data.width);
    } else if (data.stairWidth != null) {
      widthInches = parseDimensionToInches(data.stairWidth);
    }

    // Extract landing count
    let landingCount: number | null = null;
    if (typeof data.landings === 'number') {
      landingCount = data.landings;
    } else if (typeof data.landing_count === 'number') {
      landingCount = data.landing_count;
    } else if (typeof data.landingCount === 'number') {
      landingCount = data.landingCount;
    } else if (Array.isArray(data.landings)) {
      landingCount = data.landings.length;
    }

    // Extract landing dimensions
    const landings: ExtractedLanding[] = [];
    const landingsData = Array.isArray(data.landings) ? data.landings
      : Array.isArray(data.landingDimensions) ? data.landingDimensions
      : Array.isArray(data.landing_dimensions) ? data.landing_dimensions
      : [];

    for (const landing of landingsData) {
      if (typeof landing !== 'object' || landing === null) continue;
      landings.push({
        length_inches: parseDimensionToInches(landing.length_inches ?? landing.lengthInches ?? landing.length ?? null),
        depth_inches: parseDimensionToInches(landing.depth_inches ?? landing.depthInches ?? landing.depth ?? landing.width ?? null),
      });
    }

    stairs.push({
      id: data.stairId || data.stair_id || `Unknown`,
      total_treads: data.totalTreads ?? data.total_treads ?? null,
      total_risers: data.totalRisers ?? data.total_risers ?? null,
      flights: flightCount,
      width_inches: widthInches,
      landing_count: landingCount,
      landings,
    });
  }

  // Check for elevator file
  const hasElevator = fs.readdirSync(runDir).some(f =>
    f.toLowerCase().includes('elevator')
  );

  stairs.sort((a, b) => {
    const numA = parseInt(a.id.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.id.match(/\d+/)?.[0] || '0');
    return numA - numB;
  });

  return {
    stair_count: stairs.length + (hasElevator ? 1 : 0),
    stairs,
    format: 'orchestrated',
  };
}

/**
 * Extract stair data from a monolith run (CSV file)
 */
function extractMonolith(runDir: string): RunOutput {
  const csvFile = fs.readdirSync(runDir).find(f => f.endsWith('.csv'));
  if (!csvFile) {
    throw new Error(`No CSV file found in ${runDir}`);
  }

  const csvContent = fs.readFileSync(path.join(runDir, csvFile), 'utf-8');
  const lines = csvContent.trim().split('\n');

  const header = parseCSVLine(lines[0]);
  const stairIdx = header.findIndex(h => h.toLowerCase() === 'stair');
  const componentIdx = header.findIndex(h => h.toLowerCase() === 'component');
  const qtyIdx = header.findIndex(h => h.toLowerCase() === 'qty');
  const categoryIdx = header.findIndex(h => h.toLowerCase() === 'category');

  if (stairIdx === -1 || qtyIdx === -1) {
    throw new Error(`CSV missing required columns (Stair, Qty) in ${csvFile}`);
  }

  const stairTreads: Record<string, number> = {};
  const stairRisers: Record<string, number> = {};
  const allStairs = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length <= Math.max(stairIdx, qtyIdx)) continue;

    const stairName = fields[stairIdx].trim();
    const component = (componentIdx >= 0 ? fields[componentIdx] : '').trim().toLowerCase();
    const category = (categoryIdx >= 0 ? fields[categoryIdx] : '').trim().toLowerCase();
    const qty = parseInt(fields[qtyIdx]);

    if (!stairName || isNaN(qty)) continue;
    allStairs.add(stairName);

    const isTread = (component.includes('tread') || category.includes('tread')) &&
                    !component.includes('nosing');
    const isRiser = component.includes('riser') || category.includes('riser');

    if (isTread) {
      stairTreads[stairName] = (stairTreads[stairName] || 0) + qty;
    }
    if (isRiser) {
      stairRisers[stairName] = (stairRisers[stairName] || 0) + qty;
    }
  }

  const stairs: ExtractedStair[] = [];
  for (const name of allStairs) {
    if (name.toLowerCase().includes('elevator') || name === 'Stair 8') continue;

    stairs.push({
      id: name,
      total_treads: stairTreads[name] ?? null,
      total_risers: stairRisers[name] ?? null,
      flights: null,
      width_inches: null,
      landing_count: null,
      landings: [],
    });
  }

  stairs.sort((a, b) => {
    const numA = parseInt(a.id.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.id.match(/\d+/)?.[0] || '0');
    return numA - numB;
  });

  return {
    stair_count: allStairs.size,
    stairs,
    format: 'monolith',
  };
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function extractRunOutput(runDir: string): RunOutput | null {
  const files = fs.readdirSync(runDir);
  if (files.length === 0) return null;

  const hasStairJsons = files.some(f => f.match(/^stair_\d+\.json$/));
  if (hasStairJsons) {
    return extractOrchestrated(runDir);
  }

  const hasCsv = files.some(f => f.endsWith('.csv'));
  if (hasCsv) {
    return extractMonolith(runDir);
  }

  return null;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

function scoreLandings(goldenLandings: GoldenLanding[], actualLandings: ExtractedLanding[]): LandingScore[] {
  const scores: LandingScore[] = [];
  const maxLen = Math.max(goldenLandings.length, actualLandings.length);

  for (let i = 0; i < maxLen; i++) {
    const golden = goldenLandings[i] ?? { length_inches: null, depth_inches: null };
    const actual = actualLandings[i] ?? { length_inches: null, depth_inches: null };

    scores.push({
      index: i,
      length_expected: golden.length_inches,
      length_actual: actual.length_inches,
      length_correct: dimensionsMatch(golden.length_inches, actual.length_inches),
      depth_expected: golden.depth_inches,
      depth_actual: actual.depth_inches,
      depth_correct: dimensionsMatch(golden.depth_inches, actual.depth_inches),
    });
  }

  return scores;
}

function scoreRun(runId: string, output: RunOutput, golden: GoldenData): RunScore {
  const stairScores: StairScore[] = [];
  const goldenStairMap = new Map(golden.expected.stairs.map(s => [s.id, s]));
  const actualStairMap = new Map(output.stairs.map(s => [s.id, s]));

  // Treads & Risers tracking
  let totalTRFields = 0;
  let correctTRFields = 0;
  let treadsTotal = 0;
  let treadsCorrect = 0;
  let risersTotal = 0;
  let risersCorrect = 0;

  // Structural tracking
  let totalStructuralFields = 0;
  let correctStructuralFields = 0;
  let flightsTotal = 0;
  let flightsCorrect = 0;
  let widthTotal = 0;
  let widthCorrect = 0;
  let landingCountTotal = 0;
  let landingCountCorrect = 0;
  let landingDimTotal = 0;
  let landingDimCorrect = 0;

  for (const goldenStair of golden.expected.stairs) {
    const actual = actualStairMap.get(goldenStair.id);

    // --- Treads & Risers ---
    const treadCorrect = actual?.total_treads === goldenStair.total_treads;
    const riserCorrect = actual?.total_risers === goldenStair.total_risers;

    totalTRFields += 2;
    treadsTotal++;
    risersTotal++;
    if (treadCorrect) { correctTRFields++; treadsCorrect++; }
    if (riserCorrect) { correctTRFields++; risersCorrect++; }

    // --- Flights ---
    let flightsResult: boolean | null = null;
    if (goldenStair.flights != null) {
      if (actual?.flights != null) {
        flightsResult = actual.flights === goldenStair.flights;
        flightsTotal++;
        totalStructuralFields++;
        if (flightsResult) { flightsCorrect++; correctStructuralFields++; }
      }
      // If actual is null (agent didn't output flights), skip — don't penalize
    }

    // --- Width ---
    let widthResult: boolean | null = null;
    if (goldenStair.width_inches != null) {
      if (actual?.width_inches != null) {
        widthResult = dimensionsMatch(goldenStair.width_inches, actual.width_inches) ?? false;
        widthTotal++;
        totalStructuralFields++;
        if (widthResult) { widthCorrect++; correctStructuralFields++; }
      }
    }

    // --- Landing Count ---
    let landingCountResult: boolean | null = null;
    if (goldenStair.landing_count != null) {
      if (actual?.landing_count != null) {
        landingCountResult = actual.landing_count === goldenStair.landing_count;
        landingCountTotal++;
        totalStructuralFields++;
        if (landingCountResult) { landingCountCorrect++; correctStructuralFields++; }
      }
    }

    // --- Landing Dimensions ---
    const landingScores = scoreLandings(
      goldenStair.landings ?? [],
      actual?.landings ?? []
    );

    // Count only non-null golden dimension fields that have actual values
    for (const ls of landingScores) {
      if (ls.length_correct !== null) {
        landingDimTotal++;
        totalStructuralFields++;
        if (ls.length_correct) { landingDimCorrect++; correctStructuralFields++; }
      }
      if (ls.depth_correct !== null) {
        landingDimTotal++;
        totalStructuralFields++;
        if (ls.depth_correct) { landingDimCorrect++; correctStructuralFields++; }
      }
    }

    stairScores.push({
      stair_id: goldenStair.id,
      treads_expected: goldenStair.total_treads,
      treads_actual: actual?.total_treads ?? null,
      treads_delta: actual?.total_treads != null ? actual.total_treads - goldenStair.total_treads : null,
      treads_correct: treadCorrect,
      risers_expected: goldenStair.total_risers,
      risers_actual: actual?.total_risers ?? null,
      risers_delta: actual?.total_risers != null ? actual.total_risers - goldenStair.total_risers : null,
      risers_correct: riserCorrect,
      flights_expected: goldenStair.flights ?? null,
      flights_actual: actual?.flights ?? null,
      flights_correct: flightsResult,
      width_expected: goldenStair.width_inches ?? null,
      width_actual: actual?.width_inches ?? null,
      width_correct: widthResult,
      landing_count_expected: goldenStair.landing_count ?? null,
      landing_count_actual: actual?.landing_count ?? null,
      landing_count_correct: landingCountResult,
      landing_scores: landingScores,
    });
  }

  const hallucinated = output.stairs
    .filter(s => !goldenStairMap.has(s.id))
    .map(s => s.id);

  const missed = golden.expected.stairs
    .filter(s => !actualStairMap.has(s.id))
    .map(s => s.id);

  return {
    run_id: runId,
    format: output.format,
    golden_id: golden.id,
    stair_count_expected: golden.expected.stair_count,
    stair_count_actual: output.stair_count,
    stair_count_correct: output.stair_count === golden.expected.stair_count,
    stairs: stairScores,
    summary: {
      total_tr_fields: totalTRFields,
      correct_tr_fields: correctTRFields,
      treads_risers_accuracy: totalTRFields > 0 ? correctTRFields / totalTRFields : 0,
      treads_accuracy: treadsTotal > 0 ? treadsCorrect / treadsTotal : 0,
      risers_accuracy: risersTotal > 0 ? risersCorrect / risersTotal : 0,
      total_structural_fields: totalStructuralFields,
      correct_structural_fields: correctStructuralFields,
      structural_accuracy: totalStructuralFields > 0 ? correctStructuralFields / totalStructuralFields : 0,
      flights_accuracy: flightsTotal > 0 ? flightsCorrect / flightsTotal : 0,
      width_accuracy: widthTotal > 0 ? widthCorrect / widthTotal : 0,
      landing_count_accuracy: landingCountTotal > 0 ? landingCountCorrect / landingCountTotal : 0,
      landing_dimensions_accuracy: landingDimTotal > 0 ? landingDimCorrect / landingDimTotal : 0,
      hallucinated_stairs: hallucinated,
      missed_stairs: missed,
    },
  };
}

// ─── Output ──────────────────────────────────────────────────────────────────

function printRunScore(score: RunScore): void {
  console.log(`\n${'═'.repeat(90)}`);
  console.log(`  ${score.run_id}  (${score.format})`);
  console.log(`${'═'.repeat(90)}`);

  // Stair count
  const countIcon = score.stair_count_correct ? '✅' : '❌';
  console.log(`\n  Stair Count: ${countIcon} ${score.stair_count_actual} (expected ${score.stair_count_expected})`);

  if (score.summary.hallucinated_stairs.length > 0) {
    console.log(`  ⚠️  Hallucinated: ${score.summary.hallucinated_stairs.join(', ')}`);
  }
  if (score.summary.missed_stairs.length > 0) {
    console.log(`  ⚠️  Missed: ${score.summary.missed_stairs.join(', ')}`);
  }

  // Per-stair treads/risers table
  console.log(`\n  TREADS & RISERS`);
  console.log(`  ${'Stair'.padEnd(10)} ${'Treads'.padEnd(22)} ${'Risers'.padEnd(22)}`);
  console.log(`  ${'─'.repeat(10)} ${'─'.repeat(22)} ${'─'.repeat(22)}`);

  for (const s of score.stairs) {
    const tIcon = s.treads_correct ? '✅' : '❌';
    const rIcon = s.risers_correct ? '✅' : '❌';

    const tStr = s.treads_actual != null
      ? `${tIcon} ${s.treads_actual} (${s.treads_delta! >= 0 ? '+' : ''}${s.treads_delta})`
      : '❌ N/A';
    const rStr = s.risers_actual != null
      ? `${rIcon} ${s.risers_actual} (${s.risers_delta! >= 0 ? '+' : ''}${s.risers_delta})`
      : '❌ N/A';

    console.log(`  ${s.stair_id.padEnd(10)} ${tStr.padEnd(22)} ${rStr.padEnd(22)}`);
  }

  // Per-stair structural table
  const hasStructural = score.summary.total_structural_fields > 0;
  if (hasStructural) {
    console.log(`\n  STRUCTURAL`);
    console.log(`  ${'Stair'.padEnd(10)} ${'Flights'.padEnd(14)} ${'Width'.padEnd(14)} ${'Landings'.padEnd(14)}`);
    console.log(`  ${'─'.repeat(10)} ${'─'.repeat(14)} ${'─'.repeat(14)} ${'─'.repeat(14)}`);

    for (const s of score.stairs) {
      const fStr = s.flights_correct === null ? '—'
        : s.flights_correct ? `✅ ${s.flights_actual}`
        : `❌ ${s.flights_actual ?? 'N/A'} (exp ${s.flights_expected})`;

      const wStr = s.width_correct === null ? '—'
        : s.width_correct ? `✅ ${s.width_actual}"`
        : `❌ ${s.width_actual ?? 'N/A'}" (exp ${s.width_expected}")`;

      const lStr = s.landing_count_correct === null ? '—'
        : s.landing_count_correct ? `✅ ${s.landing_count_actual}`
        : `❌ ${s.landing_count_actual ?? 'N/A'} (exp ${s.landing_count_expected})`;

      console.log(`  ${s.stair_id.padEnd(10)} ${fStr.padEnd(14)} ${wStr.padEnd(14)} ${lStr.padEnd(14)}`);
    }

    // Landing dimensions detail (only if any were scored)
    const hasLandingDims = score.stairs.some(s =>
      s.landing_scores.some(ls => ls.length_correct !== null || ls.depth_correct !== null)
    );

    if (hasLandingDims) {
      console.log(`\n  LANDING DIMENSIONS (±${DIMENSION_TOLERANCE_INCHES}" tolerance)`);
      for (const s of score.stairs) {
        const scoredLandings = s.landing_scores.filter(ls =>
          ls.length_correct !== null || ls.depth_correct !== null
        );
        if (scoredLandings.length === 0) continue;

        const correct = scoredLandings.reduce((sum, ls) => {
          if (ls.length_correct === true) sum++;
          if (ls.depth_correct === true) sum++;
          return sum;
        }, 0);
        const total = scoredLandings.reduce((sum, ls) => {
          if (ls.length_correct !== null) sum++;
          if (ls.depth_correct !== null) sum++;
          return sum;
        }, 0);

        console.log(`  ${s.stair_id}: ${correct}/${total} dimensions correct`);
      }
    }
  }

  // Summary
  console.log(`\n  ── ACCURACY ──`);
  console.log(`  Treads & Risers: ${(score.summary.treads_risers_accuracy * 100).toFixed(1)}% (${score.summary.correct_tr_fields}/${score.summary.total_tr_fields} fields)`);
  console.log(`    Treads:  ${(score.summary.treads_accuracy * 100).toFixed(1)}%`);
  console.log(`    Risers:  ${(score.summary.risers_accuracy * 100).toFixed(1)}%`);

  if (hasStructural) {
    console.log(`  Structural:      ${(score.summary.structural_accuracy * 100).toFixed(1)}% (${score.summary.correct_structural_fields}/${score.summary.total_structural_fields} fields)`);
    if (score.summary.flights_accuracy >= 0) console.log(`    Flights: ${(score.summary.flights_accuracy * 100).toFixed(1)}%`);
    if (score.summary.width_accuracy >= 0) console.log(`    Width:   ${(score.summary.width_accuracy * 100).toFixed(1)}%`);
    if (score.summary.landing_count_accuracy >= 0) console.log(`    Landing Count: ${(score.summary.landing_count_accuracy * 100).toFixed(1)}%`);
    if (score.summary.landing_dimensions_accuracy >= 0) console.log(`    Landing Dims:  ${(score.summary.landing_dimensions_accuracy * 100).toFixed(1)}%`);
  } else {
    console.log(`  Structural:      N/A (agent output does not include structural data)`);
  }
}

function printComparisonTable(scores: RunScore[]): void {
  console.log(`\n${'═'.repeat(110)}`);
  console.log('  COMPARISON TABLE');
  console.log(`${'═'.repeat(110)}\n`);

  const header = [
    'Run'.padEnd(24),
    'Format'.padEnd(14),
    'Stairs'.padEnd(8),
    'Treads'.padEnd(10),
    'Risers'.padEnd(10),
    'T&R'.padEnd(8),
    'Struct'.padEnd(10),
  ].join(' ');

  console.log(`  ${header}`);
  console.log(`  ${'─'.repeat(24)} ${'─'.repeat(14)} ${'─'.repeat(8)} ${'─'.repeat(10)} ${'─'.repeat(10)} ${'─'.repeat(8)} ${'─'.repeat(10)}`);

  for (const score of scores) {
    const countStr = score.stair_count_correct ? '✅' : `❌ ${score.stair_count_actual}`;
    const structStr = score.summary.total_structural_fields > 0
      ? `${(score.summary.structural_accuracy * 100).toFixed(0)}%`
      : 'N/A';
    const row = [
      score.run_id.padEnd(24),
      score.format.padEnd(14),
      countStr.padEnd(8),
      `${(score.summary.treads_accuracy * 100).toFixed(0)}%`.padEnd(10),
      `${(score.summary.risers_accuracy * 100).toFixed(0)}%`.padEnd(10),
      `${(score.summary.treads_risers_accuracy * 100).toFixed(0)}%`.padEnd(8),
      structStr.padEnd(10),
    ].join(' ');
    console.log(`  ${row}`);
  }

  // Per-stair breakdown across runs
  console.log(`\n\n${'═'.repeat(110)}`);
  console.log('  PER-STAIR DELTA BREAKDOWN');
  console.log(`${'═'.repeat(110)}\n`);

  const golden = loadGolden();
  for (const gs of golden.expected.stairs) {
    console.log(`  ${gs.id} (expected: ${gs.total_treads}T / ${gs.total_risers}R)`);
    for (const score of scores) {
      const stair = score.stairs.find(s => s.stair_id === gs.id);
      if (!stair) {
        console.log(`    ${score.run_id.padEnd(24)} MISSING`);
        continue;
      }
      const tDelta = stair.treads_delta != null ? `${stair.treads_delta >= 0 ? '+' : ''}${stair.treads_delta}` : 'N/A';
      const rDelta = stair.risers_delta != null ? `${stair.risers_delta >= 0 ? '+' : ''}${stair.risers_delta}` : 'N/A';
      console.log(`    ${score.run_id.padEnd(24)} T: ${tDelta.padEnd(6)} R: ${rDelta.padEnd(6)}`);
    }
    console.log('');
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  const showTable = args.includes('--table');
  const specificRun = args.find(a => !a.startsWith('--'));

  const golden = loadGolden();

  fs.mkdirSync(RUNS_DIR, { recursive: true });
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  let runDirs: string[];
  if (specificRun) {
    runDirs = [specificRun];
  } else {
    runDirs = fs.readdirSync(OUTPUTS_DIR)
      .filter(d => {
        const fullPath = path.join(OUTPUTS_DIR, d);
        return fs.statSync(fullPath).isDirectory() && d !== '.DS_Store';
      })
      .sort();
  }

  const allScores: RunScore[] = [];

  for (const runId of runDirs) {
    const runDir = path.join(OUTPUTS_DIR, runId);

    if (!fs.existsSync(runDir) || !fs.statSync(runDir).isDirectory()) {
      console.log(`⚠️  Skipping ${runId}: not a directory`);
      continue;
    }

    try {
      const output = extractRunOutput(runDir);
      if (!output) {
        console.log(`⏭️  Skipping ${runId}: empty or unrecognized format`);
        continue;
      }

      const score = scoreRun(runId, output, golden);
      allScores.push(score);

      const scoreDir = path.join(RUNS_DIR, runId);
      fs.mkdirSync(scoreDir, { recursive: true });
      fs.writeFileSync(
        path.join(scoreDir, 'score.json'),
        JSON.stringify(score, null, 2)
      );

      if (!showTable) {
        printRunScore(score);
      }
    } catch (err: any) {
      console.log(`❌ Error scoring ${runId}: ${err.message}`);
    }
  }

  if (showTable && allScores.length > 0) {
    printComparisonTable(allScores);
  }

  if (allScores.length > 0) {
    const summaryPath = path.join(RESULTS_DIR, 'comparison.json');
    fs.writeFileSync(summaryPath, JSON.stringify(allScores, null, 2));
    console.log(`\n📁 Scores saved to eval/runs/`);
    console.log(`📊 Comparison saved to eval/results/comparison.json`);
  }
}

main();
