#!/usr/bin/env bun
/**
 * Eval Scoring Script
 *
 * Scores existing agent runs against golden data.
 * Handles both orchestrated (stair_N.json) and monolith (CSV) output formats.
 *
 * Usage:
 *   bun run eval/score-runs.ts                    # Score all runs
 *   bun run eval/score-runs.ts 2026-02-21-155558  # Score specific run
 *   bun run eval/score-runs.ts --table             # Output comparison table
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GoldenStair {
  id: string;
  total_treads: number;
  total_risers: number;
}

interface GoldenData {
  id: string;
  project: string;
  expected: {
    stair_count: number;
    stairs: GoldenStair[];
  };
}

interface ExtractedStair {
  id: string;
  total_treads: number | null;
  total_risers: number | null;
}

interface RunOutput {
  stair_count: number;
  stairs: ExtractedStair[];
  format: 'orchestrated' | 'monolith';
}

interface StairScore {
  stair_id: string;
  treads_expected: number;
  treads_actual: number | null;
  treads_delta: number | null;
  treads_correct: boolean;
  risers_expected: number;
  risers_actual: number | null;
  risers_delta: number | null;
  risers_correct: boolean;
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
    total_fields: number;
    correct_fields: number;
    accuracy: number;
    treads_accuracy: number;
    risers_accuracy: number;
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
  // For now, we only have one golden file
  const goldenPath = path.join(GOLDEN_DIR, 'ohiohealth-womens-center.json');
  return JSON.parse(fs.readFileSync(goldenPath, 'utf-8'));
}

// ─── Output Extraction ───────────────────────────────────────────────────────

/**
 * Extract stair data from an orchestrated run (stair_N.json files)
 */
function extractOrchestrated(runDir: string): RunOutput {
  const stairs: ExtractedStair[] = [];

  // Find all stair_*.json files (exclude elevator)
  const files = fs.readdirSync(runDir).filter(f =>
    f.match(/^stair_\d+\.json$/)
  );

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(runDir, file), 'utf-8'));
    stairs.push({
      id: data.stairId || data.stair_id || `Unknown`,
      total_treads: data.totalTreads ?? data.total_treads ?? null,
      total_risers: data.totalRisers ?? data.total_risers ?? null,
    });
  }

  // Check if there's also an elevator file (counts toward stair_count detection)
  const hasElevator = fs.readdirSync(runDir).some(f =>
    f.toLowerCase().includes('elevator')
  );

  // Sort by stair number
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
  // Find the CSV file
  const csvFile = fs.readdirSync(runDir).find(f => f.endsWith('.csv'));
  if (!csvFile) {
    throw new Error(`No CSV file found in ${runDir}`);
  }

  const csvContent = fs.readFileSync(path.join(runDir, csvFile), 'utf-8');
  const lines = csvContent.trim().split('\n');

  // Parse header
  const header = parseCSVLine(lines[0]);
  const stairIdx = header.findIndex(h => h.toLowerCase() === 'stair');
  const componentIdx = header.findIndex(h => h.toLowerCase() === 'component');
  const qtyIdx = header.findIndex(h => h.toLowerCase() === 'qty');
  const categoryIdx = header.findIndex(h => h.toLowerCase() === 'category');

  if (stairIdx === -1 || qtyIdx === -1) {
    throw new Error(`CSV missing required columns (Stair, Qty) in ${csvFile}`);
  }

  // Collect treads and risers per stair
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

    // Match treads: component or category contains "tread" (but not "nosing")
    const isTread = (component.includes('tread') || category.includes('tread')) &&
                    !component.includes('nosing');
    // Match risers: component or category contains "riser"
    const isRiser = component.includes('riser') || category.includes('riser');

    if (isTread) {
      stairTreads[stairName] = (stairTreads[stairName] || 0) + qty;
    }
    if (isRiser) {
      stairRisers[stairName] = (stairRisers[stairName] || 0) + qty;
    }
  }

  // Build stairs array (exclude elevator/stair 8)
  const stairs: ExtractedStair[] = [];
  for (const name of allStairs) {
    // Skip elevator entries
    if (name.toLowerCase().includes('elevator') || name === 'Stair 8') continue;

    stairs.push({
      id: name,
      total_treads: stairTreads[name] ?? null,
      total_risers: stairRisers[name] ?? null,
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

/**
 * Simple CSV line parser that handles quoted fields
 */
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

/**
 * Detect format and extract data from a run directory
 */
function extractRunOutput(runDir: string): RunOutput | null {
  const files = fs.readdirSync(runDir);

  // Empty directory
  if (files.length === 0) return null;

  // Orchestrated: has stair_*.json files
  const hasStairJsons = files.some(f => f.match(/^stair_\d+\.json$/));
  if (hasStairJsons) {
    return extractOrchestrated(runDir);
  }

  // Monolith: has a CSV file
  const hasCsv = files.some(f => f.endsWith('.csv'));
  if (hasCsv) {
    return extractMonolith(runDir);
  }

  // Neither — skip
  return null;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

function scoreRun(runId: string, output: RunOutput, golden: GoldenData): RunScore {
  const stairScores: StairScore[] = [];
  const goldenStairMap = new Map(golden.expected.stairs.map(s => [s.id, s]));
  const actualStairMap = new Map(output.stairs.map(s => [s.id, s]));

  let totalFields = 0;
  let correctFields = 0;
  let treadsTotal = 0;
  let treadsCorrect = 0;
  let risersTotal = 0;
  let risersCorrect = 0;

  // Score each expected stair
  for (const goldenStair of golden.expected.stairs) {
    const actual = actualStairMap.get(goldenStair.id);

    const treadCorrect = actual?.total_treads === goldenStair.total_treads;
    const riserCorrect = actual?.total_risers === goldenStair.total_risers;

    totalFields += 2; // treads + risers
    treadsTotal++;
    risersTotal++;

    if (treadCorrect) { correctFields++; treadsCorrect++; }
    if (riserCorrect) { correctFields++; risersCorrect++; }

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
    });
  }

  // Find hallucinated stairs (in output but not in golden)
  const hallucinated = output.stairs
    .filter(s => !goldenStairMap.has(s.id))
    .map(s => s.id);

  // Find missed stairs (in golden but not in output)
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
      total_fields: totalFields,
      correct_fields: correctFields,
      accuracy: totalFields > 0 ? correctFields / totalFields : 0,
      treads_accuracy: treadsTotal > 0 ? treadsCorrect / treadsTotal : 0,
      risers_accuracy: risersTotal > 0 ? risersCorrect / risersTotal : 0,
      hallucinated_stairs: hallucinated,
      missed_stairs: missed,
    },
  };
}

// ─── Output ──────────────────────────────────────────────────────────────────

function printRunScore(score: RunScore): void {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  ${score.run_id}  (${score.format})`);
  console.log(`${'═'.repeat(80)}`);

  // Stair count
  const countIcon = score.stair_count_correct ? '✅' : '❌';
  console.log(`\n  Stair Count: ${countIcon} ${score.stair_count_actual} (expected ${score.stair_count_expected})`);

  if (score.summary.hallucinated_stairs.length > 0) {
    console.log(`  ⚠️  Hallucinated: ${score.summary.hallucinated_stairs.join(', ')}`);
  }
  if (score.summary.missed_stairs.length > 0) {
    console.log(`  ⚠️  Missed: ${score.summary.missed_stairs.join(', ')}`);
  }

  // Per-stair table
  console.log(`\n  ${'Stair'.padEnd(10)} ${'Treads'.padEnd(22)} ${'Risers'.padEnd(22)}`);
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

  // Summary
  console.log(`\n  Overall Accuracy: ${(score.summary.accuracy * 100).toFixed(1)}%`);
  console.log(`  Treads Accuracy:  ${(score.summary.treads_accuracy * 100).toFixed(1)}% (${Math.round(score.summary.treads_accuracy * score.stairs.length)}/${score.stairs.length} stairs correct)`);
  console.log(`  Risers Accuracy:  ${(score.summary.risers_accuracy * 100).toFixed(1)}% (${Math.round(score.summary.risers_accuracy * score.stairs.length)}/${score.stairs.length} stairs correct)`);
}

function printComparisonTable(scores: RunScore[]): void {
  console.log(`\n${'═'.repeat(100)}`);
  console.log('  COMPARISON TABLE');
  console.log(`${'═'.repeat(100)}\n`);

  const header = [
    'Run'.padEnd(24),
    'Format'.padEnd(14),
    'Stairs'.padEnd(8),
    'Treads'.padEnd(10),
    'Risers'.padEnd(10),
    'Overall'.padEnd(10),
  ].join(' ');

  console.log(`  ${header}`);
  console.log(`  ${'─'.repeat(24)} ${'─'.repeat(14)} ${'─'.repeat(8)} ${'─'.repeat(10)} ${'─'.repeat(10)} ${'─'.repeat(10)}`);

  for (const score of scores) {
    const countStr = score.stair_count_correct ? '✅' : `❌ ${score.stair_count_actual}`;
    const row = [
      score.run_id.padEnd(24),
      score.format.padEnd(14),
      countStr.padEnd(8),
      `${(score.summary.treads_accuracy * 100).toFixed(0)}%`.padEnd(10),
      `${(score.summary.risers_accuracy * 100).toFixed(0)}%`.padEnd(10),
      `${(score.summary.accuracy * 100).toFixed(0)}%`.padEnd(10),
    ].join(' ');
    console.log(`  ${row}`);
  }

  // Per-stair breakdown across runs
  console.log(`\n\n${'═'.repeat(100)}`);
  console.log('  PER-STAIR DELTA BREAKDOWN');
  console.log(`${'═'.repeat(100)}\n`);

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

  // Ensure runs output dir exists
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  // Get list of run directories
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

      // Save score to eval/runs/
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

  // Always save comparison summary
  if (allScores.length > 0) {
    const summaryPath = path.join(RESULTS_DIR, 'comparison.json');
    fs.writeFileSync(summaryPath, JSON.stringify(allScores, null, 2));
    console.log(`\n📁 Scores saved to eval/runs/`);
    console.log(`📊 Comparison saved to eval/results/comparison.json`);
  }
}

main();
