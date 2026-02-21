/**
 * Orchestrator for multi-phase takeoff execution
 *
 * Manages the three phases of a takeoff:
 * 1. Discovery - Scan PDF, identify stairs, read specs
 * 2. Counting - Count each stair (parallel agents)
 * 3. Compilation - Generate final CSV and summary
 *
 * Each phase runs as a fresh conversation to avoid context compounding costs.
 */

import { runAgentLoop, AgentLoopResult } from './agent-loop.js';
import { TOOL_DEFINITIONS, setGlobalPdfPath, setGlobalSessionDir, setGlobalSessionId, generateSessionId, setGlobalTextData } from './tools.js';
import type { AgentLoopStats } from './types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getPdfPageCount } from './pdf-extractor.js';
import { extractAllPagesText } from './pdf-text-extractor.js';

// Phase-specific skill subdirectory
const SKILLS_SUBDIR = 'skills';

export interface OrchestratorResult {
  success: boolean;
  csvPath?: string;
  summaryPath?: string;
  sessionId?: string;
  sessionDir?: string;
  error?: string;
  stats: {
    totalCost: number;
    totalTokens: number;
    phases: {
      discovery: AgentLoopStats;
      counting: AgentLoopStats[];
      compilation: AgentLoopStats;
    };
  };
}

export interface OrchestratorOptions {
  pdfPath: string;
  userMessage: string;  // User's original request with page hints
  baseSystemPrompt: string;
  outputsDir: string;
  knowledgeBasePath: string;  // Path to knowledge-base directory
  onSessionCreated?: (sessionId: string, sessionDir: string) => void;
  onPhaseStart?: (phase: string, detail?: string) => void;
  onPhaseComplete?: (phase: string, result: any) => void;
  onError?: (phase: string, error: Error) => void;
}

interface DiscoveryOutput {
  projectName: string;
  architect: string;
  drawingDate: string;
  stairs: Array<{
    stairId: string;
    pages: number[];
    sheets: string[];
    levelsServed: string[];
    configuration: string;
  }>;
  detailSheets: {
    pages: number[];
    sheets: string[];
  };
  constructionSpecs: {
    treadType: string;
    treadGauge: string;
    treadDepth: string;
    stringerSize: string;
    stringerGrade: string;
    railPipeSize: string;
    railGrade: string;
    postSpacing: string;
    specSections: string[];
  };
  notes: string[];
}

interface CountOutput {
  stairId: string;
  sheets: string[];
  levelsServed: string[];
  flights: Array<{
    flightNumber: number;
    fromLevel: string;
    toLevel: string;
    risers: number;
    riserHeight: string;
    treads: number;
    treadDepth: string;
  }>;
  landings: number;
  totalRisers: number;
  totalTreads: number;
  anomalies: string[];
  confidence: string;
  notes: string;
}

/**
 * Load a phase-specific skill file
 */
function loadPhaseSkill(skillName: string, knowledgeBasePath: string): string {
  const skillPath = path.join(knowledgeBasePath, SKILLS_SUBDIR, `${skillName}.md`);
  if (!fs.existsSync(skillPath)) {
    throw new Error(`Skill file not found: ${skillPath}`);
  }
  return fs.readFileSync(skillPath, 'utf-8');
}

/**
 * Build system prompt for a specific phase
 */
function buildPhasePrompt(basePrompt: string, phaseSkill: string, phaseName: string): string {
  return `${basePrompt}

---

# Current Phase: ${phaseName}

${phaseSkill}`;
}

/**
 * Run the full orchestrated takeoff
 */
export async function runOrchestratedTakeoff(options: OrchestratorOptions): Promise<OrchestratorResult> {
  const {
    pdfPath,
    userMessage,
    baseSystemPrompt,
    outputsDir,
    knowledgeBasePath,
    onSessionCreated,
    onPhaseStart,
    onPhaseComplete,
    onError
  } = options;

  // Create session
  const sessionId = generateSessionId();
  const sessionDir = path.join(os.tmpdir(), `takeoff-session-${sessionId}`);
  fs.mkdirSync(sessionDir, { recursive: true });
  setGlobalSessionDir(sessionDir);
  setGlobalSessionId(sessionId);
  setGlobalPdfPath(pdfPath);

  const sessionOutputDir = path.join(outputsDir, sessionId);
  fs.mkdirSync(sessionOutputDir, { recursive: true });

  // Notify caller of session creation so they can update tracking
  onSessionCreated?.(sessionId, sessionDir);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🎭 ORCHESTRATED TAKEOFF STARTING`);
  console.log(`${'='.repeat(80)}`);
  console.log(`   Session: ${sessionId}`);
  console.log(`   Session Dir: ${sessionDir}`);
  console.log(`   PDF: ${path.basename(pdfPath)}`);
  console.log(`   Output: ${sessionOutputDir}`);
  console.log(`${'='.repeat(80)}\n`);

  // Extract text from PDF at session start
  let textAvailableMsg = '';
  try {
    const textData = await extractAllPagesText(pdfPath);
    setGlobalTextData(textData);
    const textDataPath = path.join(sessionDir, 'pdf-text-data.json');
    fs.writeFileSync(textDataPath, JSON.stringify(textData, null, 2));
    console.log(`   📝 Text data saved to: ${textDataPath}`);

    if (textData.isEmpty) {
      textAvailableMsg = '\nText extraction returned no useful text — this PDF appears scanned. Use image-based workflow.';
    } else {
      textAvailableMsg = `\nText extraction data is available. Use get_page_text([page_numbers]) to read sheet titles, annotations, and material specs BEFORE extracting images. Use search_pdf_text("term") to find values across pages. Text reading costs zero image tokens.`;
    }
  } catch (textErr) {
    console.error(`   ⚠️ Text extraction failed (non-fatal):`, textErr);
    textAvailableMsg = '\nText extraction was not available for this PDF. Use image-based workflow.';
  }

  // knowledgeBasePath is passed in from ipc-handlers

  // Initialize stats
  const stats: OrchestratorResult['stats'] = {
    totalCost: 0,
    totalTokens: 0,
    phases: {
      discovery: { iterations: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, estimatedCost: 0 },
      counting: [],
      compilation: { iterations: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, estimatedCost: 0 }
    }
  };

  try {
    // =========================================================================
    // PHASE 1: DISCOVERY
    // =========================================================================
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📍 PHASE 1: DISCOVERY`);
    console.log(`${'─'.repeat(80)}\n`);

    onPhaseStart?.('discovery');

    const discoverySkill = loadPhaseSkill('DiscoveryPhase', knowledgeBasePath);
    const discoveryPrompt = buildPhasePrompt(baseSystemPrompt, discoverySkill, 'Discovery');

    const pageCount = await getPdfPageCount(pdfPath);

    const discoveryMessage = `Analyze this construction PDF (${pageCount} pages) and find all stairs.

USER REQUEST: ${userMessage}
${textAvailableMsg}

Your output file should be: discovery.json

Remember:
- Find all stair-related sheets (use page hints from user request if provided)
- Identify each unique stair
- Extract construction specifications from detail sheets
- Write discovery.json when complete`;

    const discoveryResult = await runAgentLoop(
      discoveryMessage,
      [],
      discoveryPrompt,
      TOOL_DEFINITIONS
    );

    stats.phases.discovery = discoveryResult.stats;
    stats.totalCost += discoveryResult.stats.estimatedCost;
    stats.totalTokens += discoveryResult.stats.totalTokens;

    console.log(`\n   ${'─'.repeat(40)}`);
    console.log(`   📊 DISCOVERY PHASE SUMMARY`);
    console.log(`   ${'─'.repeat(40)}`);
    console.log(`   Turns: ${discoveryResult.stats.iterations}`);
    console.log(`   Tokens: ${discoveryResult.stats.totalTokens.toLocaleString()}`);
    console.log(`   Cost: $${discoveryResult.stats.estimatedCost.toFixed(4)}`);

    // Read discovery output — check session dir first, then outputs dir
    // (agent may use relative path which routes to outputs dir)
    let discoveryPath = path.join(sessionDir, 'discovery.json');
    if (!fs.existsSync(discoveryPath)) {
      const altPath = path.join(sessionOutputDir, 'discovery.json');
      if (fs.existsSync(altPath)) {
        // Copy to session dir so counting agents can find it
        fs.copyFileSync(altPath, discoveryPath);
        console.log(`   📋 Found discovery.json in outputs dir, copied to session dir`);
      } else {
        throw new Error('Discovery phase did not produce discovery.json');
      }
    }

    const discovery: DiscoveryOutput = JSON.parse(fs.readFileSync(discoveryPath, 'utf-8'));
    console.log(`   Found ${discovery.stairs.length} stairs to count`);

    onPhaseComplete?.('discovery', discovery);

    // =========================================================================
    // PHASE 2: COUNTING (LIMITED PARALLELISM TO AVOID OOM)
    // =========================================================================
    const MAX_PARALLEL_COUNTERS = 2; // Limit to 2 at a time to avoid memory issues

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📍 PHASE 2: COUNTING (${discovery.stairs.length} stairs, ${MAX_PARALLEL_COUNTERS} at a time)`);
    console.log(`${'─'.repeat(80)}\n`);

    onPhaseStart?.('counting', `${discovery.stairs.length} stairs`);

    const countingSkill = loadPhaseSkill('CountingPhase', knowledgeBasePath);

    // Helper function to count a single stair
    const countStair = async (stair: DiscoveryOutput['stairs'][0]) => {
      console.log(`\n   ${'·'.repeat(40)}`);
      console.log(`   🔢 COUNTER: ${stair.stairId}`);
      console.log(`   ${'·'.repeat(40)}`);

      const countingPrompt = buildPhasePrompt(baseSystemPrompt, countingSkill, `Counting - ${stair.stairId}`);

      const countMessage = `Count this specific stair:

Stair ID: ${stair.stairId}
Pages: ${stair.pages.join(', ')}
Sheets: ${stair.sheets.join(', ')}
Levels Served: ${stair.levelsServed.join(' → ')}
Configuration: ${stair.configuration}
${textAvailableMsg}

Construction Specs:
${JSON.stringify(discovery.constructionSpecs, null, 2)}

Your output file should be: ${stair.stairId.replace(/\s+/g, '_').toLowerCase()}.json

Count all flights, risers, treads, and landings. Be precise.`;

      try {
        const result = await runAgentLoop(
          countMessage,
          [],
          countingPrompt,
          TOOL_DEFINITIONS
        );

        console.log(`   ✅ ${stair.stairId} complete (${result.stats.iterations} turns, $${result.stats.estimatedCost.toFixed(4)})`);
        return { stairId: stair.stairId, result, success: true };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`   ❌ ${stair.stairId} failed: ${errorMsg}`);
        return { stairId: stair.stairId, error, success: false };
      }
    };

    // Run counting agents in batches to limit memory usage
    const countingResults: Array<{ stairId: string; result?: AgentLoopResult; error?: any; success: boolean }> = [];

    for (let i = 0; i < discovery.stairs.length; i += MAX_PARALLEL_COUNTERS) {
      const batch = discovery.stairs.slice(i, i + MAX_PARALLEL_COUNTERS);
      console.log(`\n   📦 Batch ${Math.floor(i / MAX_PARALLEL_COUNTERS) + 1}: ${batch.map(s => s.stairId).join(', ')}`);

      const batchResults = await Promise.all(batch.map(countStair));
      countingResults.push(...batchResults);

      // Force garbage collection hint between batches
      if (global.gc) {
        global.gc();
      }
    }

    // Aggregate counting stats
    for (const cr of countingResults) {
      if (cr.success && cr.result) {
        stats.phases.counting.push(cr.result.stats);
        stats.totalCost += cr.result.stats.estimatedCost;
        stats.totalTokens += cr.result.stats.totalTokens;
      }
    }

    const successfulCounts = countingResults.filter(r => r.success).length;
    const countingTotalCost = stats.phases.counting.reduce((sum, s) => sum + s.estimatedCost, 0);
    const countingTotalTokens = stats.phases.counting.reduce((sum, s) => sum + s.totalTokens, 0);

    console.log(`\n   ${'─'.repeat(40)}`);
    console.log(`   📊 COUNTING PHASE SUMMARY`);
    console.log(`   ${'─'.repeat(40)}`);
    console.log(`   Stairs completed: ${successfulCounts}/${discovery.stairs.length}`);
    console.log(`   Total tokens: ${countingTotalTokens.toLocaleString()}`);
    console.log(`   Phase cost: $${countingTotalCost.toFixed(4)}`);

    onPhaseComplete?.('counting', countingResults);

    // =========================================================================
    // PHASE 3: COMPILATION
    // =========================================================================
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📍 PHASE 3: COMPILATION`);
    console.log(`${'─'.repeat(80)}\n`);

    onPhaseStart?.('compilation');

    const compilationSkill = loadPhaseSkill('CompilationPhase', knowledgeBasePath);
    const compilationPrompt = buildPhasePrompt(baseSystemPrompt, compilationSkill, 'Compilation');

    // List all JSON files in session directory AND outputs directory
    // (agents may write to either location depending on path handling)
    const sessionJsonFiles = fs.readdirSync(sessionDir)
      .filter(f => f.endsWith('.json') && f !== 'pdf-text-data.json')
      .map(f => path.join(sessionDir, f));
    const outputJsonFiles = fs.existsSync(sessionOutputDir)
      ? fs.readdirSync(sessionOutputDir)
          .filter(f => f.endsWith('.json'))
          .map(f => path.join(sessionOutputDir, f))
      : [];
    // Merge, preferring session dir if same filename exists in both
    const sessionNames = new Set(sessionJsonFiles.map(f => path.basename(f)));
    const jsonFiles = [
      ...sessionJsonFiles,
      ...outputJsonFiles.filter(f => !sessionNames.has(path.basename(f)))
    ];

    const compilationMessage = `Compile the takeoff from these files:

Discovery data: ${path.join(sessionDir, 'discovery.json')}

Stair count files:
${jsonFiles.filter(f => !f.includes('discovery')).map(f => `- ${f}`).join('\n')}

Generate final outputs:
- CSV: ${path.join(sessionOutputDir, 'takeoff.csv')}
- Summary: ${path.join(sessionOutputDir, 'summary.md')}
- Detailed Text Summary: ${path.join(sessionOutputDir, 'takeoff_summary.txt')}`;

    const compilationResult = await runAgentLoop(
      compilationMessage,
      [],
      compilationPrompt,
      TOOL_DEFINITIONS
    );

    stats.phases.compilation = compilationResult.stats;
    stats.totalCost += compilationResult.stats.estimatedCost;
    stats.totalTokens += compilationResult.stats.totalTokens;

    console.log(`\n   ${'─'.repeat(40)}`);
    console.log(`   📊 COMPILATION PHASE SUMMARY`);
    console.log(`   ${'─'.repeat(40)}`);
    console.log(`   Turns: ${compilationResult.stats.iterations}`);
    console.log(`   Tokens: ${compilationResult.stats.totalTokens.toLocaleString()}`);
    console.log(`   Cost: $${compilationResult.stats.estimatedCost.toFixed(4)}`);

    onPhaseComplete?.('compilation', compilationResult);

    // =========================================================================
    // COMPLETE
    // =========================================================================
    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ ORCHESTRATED TAKEOFF COMPLETE`);
    console.log(`${'='.repeat(80)}`);
    console.log(`   Total cost: $${stats.totalCost.toFixed(4)}`);
    console.log(`   Total tokens: ${stats.totalTokens.toLocaleString()}`);
    console.log(`${'='.repeat(80)}\n`);

    return {
      success: true,
      csvPath: path.join(sessionOutputDir, 'takeoff.csv'),
      summaryPath: path.join(sessionOutputDir, 'summary.md'),
      sessionId,
      sessionDir,
      stats
    };

  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    console.error('\n❌ Orchestrated takeoff failed:', errorObj.message);
    onError?.('unknown', errorObj);

    return {
      success: false,
      error: errorObj.message,
      sessionId,
      sessionDir,
      stats
    };
  }
}
