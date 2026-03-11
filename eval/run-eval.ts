#!/usr/bin/env bun
/**
 * CLI runner for eval — runs the orchestrated takeoff without Electron
 *
 * Usage:
 *   bun run eval/run-eval.ts                     # Single run
 *   bun run eval/run-eval.ts --runs 3            # Multiple runs for reliability testing
 */

import * as path from 'path';
import * as fs from 'fs';
// Load API key from .env (custom format: "CLAUDE API KEY = sk-...")
function loadApiKey(): string {
  const envPath = path.resolve(import.meta.dir, '../.env');
  if (!fs.existsSync(envPath)) return '';
  const content = fs.readFileSync(envPath, 'utf-8');
  const match = content.match(/=\s*(.+)/);
  return match ? match[1].trim() : '';
}

// The orchestrator imports need the compiled JS
const ROOT = path.resolve(import.meta.dir, '..');
const DIST = path.join(ROOT, 'dist', 'main');

// Default config
const PDF_PATH = "/Users/nicholashorton/Documents/takeoff-ai-poc/files/2024-06-14_Volume 2_CSPermit_Addendum 03_OHWC.pdf";
const OUTPUTS_DIR = path.join(ROOT, 'outputs');
const KNOWLEDGE_BASE_PATH = path.join(ROOT, 'resources', 'knowledge-base');
const USER_MESSAGE = "Analyze pages 250-270 for metal stairs. These pages contain stair plans, sections, and details for the OhioHealth Women's Center.";

async function main() {
  const args = process.argv.slice(2);
  const runsFlag = args.indexOf('--runs');
  const numRuns = runsFlag >= 0 ? parseInt(args[runsFlag + 1]) || 1 : 1;

  // Validate API key
  const apiKey = process.env.ANTHROPIC_API_KEY || loadApiKey();
  if (!apiKey) {
    console.error('❌ No API key found. Set ANTHROPIC_API_KEY in .env');
    process.exit(1);
  }
  process.env.ANTHROPIC_API_KEY = apiKey;

  // Validate PDF exists
  if (!fs.existsSync(PDF_PATH)) {
    console.error(`❌ PDF not found: ${PDF_PATH}`);
    process.exit(1);
  }

  // Validate knowledge base exists
  if (!fs.existsSync(KNOWLEDGE_BASE_PATH)) {
    console.error(`❌ Knowledge base not found: ${KNOWLEDGE_BASE_PATH}`);
    process.exit(1);
  }

  // Load the base system prompt
  const baseSystemPrompt = fs.readFileSync(
    path.join(KNOWLEDGE_BASE_PATH, 'CLAUDE.md'),
    'utf-8'
  );

  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  EVAL RUNNER — ${numRuns} run(s)`);
  console.log(`${'═'.repeat(80)}`);
  console.log(`  PDF: ${path.basename(PDF_PATH)}`);
  console.log(`  Outputs: ${OUTPUTS_DIR}`);
  console.log(`${'═'.repeat(80)}\n`);

  // Dynamically import the orchestrator from compiled dist
  const orchestratorPath = path.join(DIST, 'core', 'orchestrator.js');
  if (!fs.existsSync(orchestratorPath)) {
    console.error(`❌ Compiled orchestrator not found at ${orchestratorPath}`);
    console.error('   Run "bun run build:main" first.');
    process.exit(1);
  }

  const { runOrchestratedTakeoff } = await import(orchestratorPath);

  // Set the outputs directory so write_file resolves paths correctly
  const toolsPath = path.join(DIST, 'core', 'tools.js');
  const { setConfiguredOutputsDir } = await import(toolsPath);
  setConfiguredOutputsDir(OUTPUTS_DIR);

  const results: Array<{ runId: string; success: boolean; cost: number; tokens: number; durationMs: number }> = [];

  for (let i = 0; i < numRuns; i++) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`  RUN ${i + 1}/${numRuns}`);
    console.log(`${'─'.repeat(80)}\n`);

    const startTime = Date.now();

    try {
      const result = await runOrchestratedTakeoff({
        pdfPath: PDF_PATH,
        userMessage: USER_MESSAGE,
        baseSystemPrompt,
        outputsDir: OUTPUTS_DIR,
        knowledgeBasePath: KNOWLEDGE_BASE_PATH,
        onPhaseStart: (phase: string, detail?: string) => {
          console.log(`  ▶ Phase: ${phase}${detail ? ` (${detail})` : ''}`);
        },
        onPhaseComplete: (phase: string) => {
          console.log(`  ✓ Phase complete: ${phase}`);
        },
        onError: (phase: string, error: Error) => {
          console.error(`  ✗ Phase error: ${phase} — ${error.message}`);
        },
      });

      const durationMs = Date.now() - startTime;

      results.push({
        runId: result.sessionId || 'unknown',
        success: result.success,
        cost: result.stats.totalCost,
        tokens: result.stats.totalTokens,
        durationMs,
      });

      console.log(`\n  Run ${i + 1} complete: ${result.sessionId}`);
      console.log(`  Cost: $${result.stats.totalCost.toFixed(4)}`);
      console.log(`  Tokens: ${result.stats.totalTokens.toLocaleString()}`);
      console.log(`  Duration: ${(durationMs / 1000).toFixed(1)}s`);

      if (!result.success) {
        console.error(`  ⚠️  Run failed: ${result.error}`);
      }
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      console.error(`  ❌ Run ${i + 1} crashed: ${err.message}`);
      results.push({
        runId: 'crashed',
        success: false,
        cost: 0,
        tokens: 0,
        durationMs,
      });
    }

    // Brief pause between runs to avoid rate limits
    if (i < numRuns - 1) {
      console.log(`\n  Waiting 5s before next run...`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  EVAL SUMMARY — ${numRuns} run(s)`);
  console.log(`${'═'.repeat(80)}`);

  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    console.log(`  ${status} ${r.runId.padEnd(24)} $${r.cost.toFixed(4).padEnd(10)} ${(r.durationMs / 1000).toFixed(1)}s`);
  }

  const totalCost = results.reduce((s, r) => s + r.cost, 0);
  console.log(`\n  Total cost: $${totalCost.toFixed(4)}`);
  console.log(`${'═'.repeat(80)}\n`);

  // Now score the new runs
  console.log('Scoring new runs...\n');

  // Import and run the scorer for just the new runs
  const { execSync } = await import('child_process');
  for (const r of results) {
    if (r.runId !== 'crashed') {
      try {
        const output = execSync(`bun run eval/score-runs.ts ${r.runId}`, { cwd: ROOT, encoding: 'utf-8' });
        console.log(output);
      } catch (e: any) {
        console.error(`Failed to score ${r.runId}: ${e.message}`);
      }
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
