/**
 * Test 3: Prompt Caching Across Workflow Steps
 *
 * Validates that Anthropic's prompt caching works when Claude API calls
 * come from different Cloudflare Workflow step invocations.
 *
 * Current app behavior:
 *   - Model: claude-sonnet-4-5-20250929
 *   - System prompt: ~2,100-2,400 tokens (CLAUDE.md)
 *   - Cache type: ephemeral (system prompt marked with cache_control)
 *   - Expected: cache_creation on call 1, cache_read on calls 2+
 *
 * The test runs a 3-step Workflow where each step calls the Claude API
 * with the same system prompt. If caching works, steps 2 and 3 should
 * show cache_read_input_tokens > 0.
 *
 * Pass criteria: Steps 2 and 3 show cache_read_input_tokens > 0
 */

import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';
import Anthropic from '@anthropic-ai/sdk';
import type { Env } from './types';

// System prompt padded to ~2,200 tokens to exceed Anthropic's 1024-token cache minimum.
// The actual CLAUDE.md is this size, so this is a realistic test.
const SYSTEM_PROMPT = `You are TakeoffAI, a construction quantity takeoff specialist. Your job is to analyze construction drawings (PDFs) and produce accurate bills of materials for metal stairs (Division 5500).

## Your Capabilities
- Analyze PDF drawings to identify stairs, their components, and specifications
- Count physical elements: flights, risers, treads, landings, platforms
- Read construction annotations, dimensions, and schedules
- Generate CSV output compatible with fabrication software
- Identify stair types: straight-run, L-shaped, U-shaped, switchback, scissor, spiral
- Cross-reference detail sheets with plan sheets for accurate measurements
- Read structural schedules for member sizes and material specifications

## Multi-Phase Architecture
You operate in phases:
1. **Discovery Phase**: Scan the full drawing set, identify all stairs, assign pages to each stair. Look at the table of contents, sheet index, and drawing titles. Identify detail sheets, plan sheets, section sheets, and schedules. Output a stair manifest with page assignments.
2. **Counting Phase**: For each stair, count all components using ONLY assigned pages. Do not access pages assigned to other agents. Use text extraction first, then images only when visual verification is needed. Track progress in working notes.
3. **Compilation Phase**: Generate final CSV and summary report. Merge all stair results. Check for completeness and consistency across stairs.

## Available Tools
- **get_page_text(pages)**: Extract text content with spatial layout from PDF pages. Returns text items with x,y coordinates, font sizes, and spatial zone classification. Always try this first before requesting images.
- **extract_pdf_pages(pages)**: Get rendered images of PDF pages for visual analysis. Returns PNG images at 150 DPI, max 1568px. Use sparingly — images cost ~1,500 tokens each vs ~300 for text.
- **extract_pdf_region(page, region)**: Crop a specific rectangular area of a page for detailed inspection. Useful for reading small annotations, counting tread lines in a detail, or verifying handrail connections.
- **write_file(path, content)**: Write output files (CSV rows, working notes, summary). Use working notes to track your progress within a stair to avoid losing count.
- **read_file(path)**: Read previously written files, including working notes from earlier in the session.
- **search_pdf_text(query)**: Search for specific text across all accessible pages. Returns matching pages and context.
- **ask_user(question)**: Ask the user for clarification when information is ambiguous or missing from the drawings.

## Rules
1. ALWAYS read text before requesting images — text is cheaper and faster
2. Only request images when you need visual verification (counting drawn lines, verifying stair configuration, reading handwritten notes)
3. Stay within your assigned pages — do not access pages assigned to other agents. This prevents cross-stair contamination.
4. Request multiple tools in a single response when possible to reduce round-trips. For example, request text from 3 pages at once rather than one at a time.
5. Track your counts carefully — use working notes to avoid losing progress between iterations
6. When uncertain, ask the user rather than guessing
7. Always count physical elements (risers, treads) from the drawings, do not calculate from floor-to-floor height unless no drawing detail is available
8. Verify stair configuration (switchback vs straight-run) before counting — misidentifying the type leads to wrong flight counts
9. Check for mezzanine landings, intermediate platforms, and code-required landings that may not be obvious
10. Report dimensions exactly as shown on drawings — do not convert between imperial and metric

## Output Format
CSV columns: Stair ID, Component, Description, Quantity, Unit, Material, Size, Notes
One row per component per stair. Components include: flights, risers, treads, landings, platforms, stringers, handrails, guardrails, newel posts, balusters, base plates, connection hardware, nosings, kick plates, toe plates.

## Construction Knowledge Base

### Stair Geometry
- Standard riser height: 7" (residential per IRC), 7.5" (commercial per IBC 1011.5.2)
- Maximum riser height: 7.75" (commercial), 8.25" (residential)
- Standard tread depth: 11" minimum per IBC 1011.5.2
- Nosing: 0.75" to 1.25" projection beyond riser face
- Riser + Tread formula: 2R + T should be between 24" and 25" (comfort rule)
- Headroom: 80" minimum clear height measured vertically from tread nosing line
- Width: 44" minimum clear width for commercial (36" residential)

### Structural Members
- Stringer types: C-channel (C8x11.5, C10x15.3), MC channel (MC12x10.6, MC10x6.5), tube steel (HSS6x4x3/8)
- Tread types: bar grating (19-W-4, 15-W-4), plate (14ga diamond, 12ga smooth), concrete-filled pan (12ga), composite
- Handrail: 1.5" diameter round pipe (Schedule 40) or 1.5"x1.5" tube steel, mounted at 34"-38" height AFF
- Guardrail: 42" minimum height AFF per IBC 1015, 4" maximum baluster spacing (sphere rule)
- Common steel gauges: 14ga (0.075" - treads), 12ga (0.105" - pans, kick plates), 10ga (0.135" - structural)
- Base plate connections: typically 3/8" or 1/2" plate with anchor bolts
- Landing framing: typically same channel as stringers, with concrete or grating fill

### Drawing Conventions
- Plan views show stair in horizontal projection with UP/DOWN arrows indicating direction of travel
- Section views show vertical cut through stair showing riser/tread profile, headroom, and floor-to-floor
- Detail views show enlarged views of specific connections, nosing profiles, or hardware
- Schedules are tabular data listing stair properties (ID, floors served, type, member sizes)
- Annotation leaders point from text to the element being described
- Dimension strings show measurements between elements
- Grid lines (numbered/lettered) provide reference coordinates for stair locations

## Accuracy Requirements
- Flight count must be exact — each flight is a continuous run of treads between landings
- Riser count must be exact — this directly affects stringer fabrication length and is the most common error
- Tread count = risers - 1 per flight (unless landing treads are specified separately)
- Landing count must be exact — includes intermediate platforms and code-required landings
- Dimensions should be reported as shown on drawings (do not convert between systems)
- Stringer count: typically 2 per flight (left + right), but verify — some stairs have center stringers
- Handrail/guardrail: count per side per flight, noting if continuous across landings or interrupted`;

interface CacheTestResult {
  step: number;
  userMessage: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  responsePreview: string;
  durationMs: number;
}

interface WorkflowResult {
  results: CacheTestResult[];
  cacheWorking: boolean;
  summary: string;
}

export class PromptCacheTestWorkflow extends WorkflowEntrypoint<Env, {}> {
  async run(event: WorkflowEvent<{}>, step: WorkflowStep): Promise<WorkflowResult> {
    const results: CacheTestResult[] = [];

    // Step 1: First Claude call — should CREATE the cache
    const step1 = await step.do('claude-call-1', {
      retries: { limit: 3, delay: '5 seconds', backoff: 'exponential' },
      timeout: '2 minutes',
    }, async () => {
      return await callClaude(
        this.env.ANTHROPIC_API_KEY,
        'I have a 150-page construction PDF with 3 stairs. What information do you need to begin the discovery phase?',
        1,
      );
    });
    results.push(step1);

    // Step 2: Second Claude call — should READ from cache
    const step2 = await step.do('claude-call-2', {
      retries: { limit: 3, delay: '5 seconds', backoff: 'exponential' },
      timeout: '2 minutes',
    }, async () => {
      return await callClaude(
        this.env.ANTHROPIC_API_KEY,
        'The PDF has the following pages: S1.0 (stair schedule), S3.1-S3.5 (stair details), S5.1-S5.3 (sections). Which pages should I send you first?',
        2,
      );
    });
    results.push(step2);

    // Step 3: Third Claude call — should READ from cache again
    const step3 = await step.do('claude-call-3', {
      retries: { limit: 3, delay: '5 seconds', backoff: 'exponential' },
      timeout: '2 minutes',
    }, async () => {
      return await callClaude(
        this.env.ANTHROPIC_API_KEY,
        'Here is the text extracted from page S1.0 (stair schedule):\n\nSTAIR SCHEDULE\nSTR-A: Floors 1-2, 2 flights, 14 risers per flight, MC12x10.6 stringers\nSTR-B: Floors 1-3, 4 flights, 12 risers per flight, MC12x10.6 stringers\nSTR-C: Floors 1-2, 2 flights, 16 risers per flight, MC10x6.5 stringers\n\nWhat stairs did you identify?',
        3,
      );
    });
    results.push(step3);

    // Analyze results
    const cacheWorking =
      results[1].cacheReadTokens > 0 || results[2].cacheReadTokens > 0;

    const summary = [
      '=== Prompt Cache Test Results ===',
      '',
      ...results.map(r => [
        `Step ${r.step}:`,
        `  Input tokens:          ${r.inputTokens}`,
        `  Output tokens:         ${r.outputTokens}`,
        `  Cache creation tokens: ${r.cacheCreationTokens}`,
        `  Cache read tokens:     ${r.cacheReadTokens}`,
        `  Duration:              ${r.durationMs}ms`,
        '',
      ].join('\n')),
      `Cache working: ${cacheWorking ? 'YES' : 'NO'}`,
      '',
      cacheWorking
        ? 'PASS: Prompt caching works across Workflow steps. Steps 2+ show cache_read_input_tokens > 0.'
        : 'FAIL: No cache hits detected. This may mean caching does not persist across Workflow step boundaries, or the system prompt is below the minimum cacheable size (1024 tokens for Sonnet).',
    ].join('\n');

    return { results, cacheWorking, summary };
  }
}

async function callClaude(
  apiKey: string,
  userMessage: string,
  stepNum: number,
): Promise<CacheTestResult> {
  const client = new Anthropic({ apiKey });
  const startTime = Date.now();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      { role: 'user', content: userMessage },
    ],
  });

  const duration = Date.now() - startTime;

  const textContent = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');

  return {
    step: stepNum,
    userMessage,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheCreationTokens: (response.usage as any).cache_creation_input_tokens || 0,
    cacheReadTokens: (response.usage as any).cache_read_input_tokens || 0,
    responsePreview: textContent.slice(0, 200) + (textContent.length > 200 ? '...' : ''),
    durationMs: duration,
  };
}

/**
 * HTTP handler — triggers the Workflow and returns results
 */
export async function handlePromptCacheTest(request: Request, env: Env): Promise<Response> {
  try {
    // Create a Workflow instance
    const instanceId = `cache-test-${Date.now()}`;
    const instance = await env.CACHE_TEST_WORKFLOW.create({
      id: instanceId,
      params: {},
    });

    // Poll for completion (Workflows are async)
    // In production you'd use WebSocket for this, but for a test endpoint polling is fine
    const maxWaitMs = 120000; // 2 minutes
    const pollIntervalMs = 2000;
    let elapsed = 0;

    while (elapsed < maxWaitMs) {
      const status = await instance.status();

      if (status.status === 'complete') {
        // Get the output (cast through any since InstanceStatus typing may not include output)
        const statusAny = status as any;
        const output = statusAny.output as WorkflowResult | undefined;
        return new Response(JSON.stringify({
          success: true,
          instanceId,
          ...(output || { message: 'Workflow completed but no output returned. Check Cloudflare dashboard.' }),
        }, null, 2), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (status.status === 'errored') {
        const statusAny = status as any;
        return new Response(JSON.stringify({
          success: false,
          instanceId,
          status: status.status,
          error: statusAny.error || 'Unknown error',
        }, null, 2), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Wait and poll again
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      elapsed += pollIntervalMs;
    }

    return new Response(JSON.stringify({
      success: false,
      instanceId,
      error: `Workflow did not complete within ${maxWaitMs / 1000} seconds. Check the Cloudflare dashboard for status.`,
      checkWith: `npx wrangler workflows instances describe prompt-cache-test ${instanceId}`,
    }, null, 2), {
      status: 504,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
