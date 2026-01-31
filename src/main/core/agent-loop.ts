// Core agent loop implementation using Claude API
import Anthropic from '@anthropic-ai/sdk';
import type {
  Message,
  ContentBlock,
  ToolUseContent,
  ToolDefinition,
  ImageData,
  AgentLoopStats
} from './types.js';
import { executeTool, getGlobalSessionDir } from './tools.js';
import * as path from 'path';

const DEFAULT_MAX_ITERATIONS = 100;

// Token pricing for Claude Sonnet
const PRICING = {
  input: 3.00 / 1_000_000,   // $3 per million input tokens
  output: 15.00 / 1_000_000  // $15 per million output tokens
};

/**
 * Result of running the agent loop, including conversation history for continuation
 */
export interface AgentLoopResult {
  result: string;
  stats: AgentLoopStats;
  messages: Message[];  // Full conversation history for continuation
}

export interface AgentLoopOptions {
  initialMessage: string;
  images?: ImageData[];
  systemPrompt: string;
  tools: ToolDefinition[];
  onUpdate?: (update: any) => void;
  existingMessages?: Message[];
  maxTurns?: number;  // Phase-specific iteration limit
}

/**
 * Run the agent loop with Claude
 *
 * @param initialMessage - The user's initial message/request
 * @param images - Array of images to include in the first message
 * @param systemPrompt - System prompt defining Claude's role and capabilities
 * @param tools - Tool definitions available to Claude
 * @param onUpdate - Optional callback for streaming updates
 * @param existingMessages - Optional existing conversation to continue from
 * @param maxTurns - Optional max iterations for phase-specific limits
 * @returns The final text response, stats, and full conversation history
 */
export async function runAgentLoop(
  initialMessage: string,
  images: ImageData[],
  systemPrompt: string,
  tools: ToolDefinition[],
  onUpdate?: (update: any) => void,
  existingMessages?: Message[],
  maxTurns?: number
): Promise<AgentLoopResult> {

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable not set');
  }

  const anthropic = new Anthropic({ apiKey });

  // Use existing messages or start fresh
  let messages: Message[];
  if (existingMessages && existingMessages.length > 0) {
    // Continue existing conversation - add new user message
    messages = [...existingMessages];
    messages.push(buildInitialMessage(initialMessage, images));
    console.log(`   Continuing conversation with ${existingMessages.length} existing messages`);
  } else {
    // Start new conversation
    messages = [buildInitialMessage(initialMessage, images)];
  }

  const stats: AgentLoopStats = {
    iterations: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0
  };

  let iterationCount = 0;
  const maxIterations = maxTurns || DEFAULT_MAX_ITERATIONS;

  while (iterationCount < maxIterations) {
    iterationCount++;
    stats.iterations = iterationCount;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📤 Turn ${iterationCount}/${maxIterations}: Calling Claude API...`);
    console.log(`${'='.repeat(80)}\n`);

    try {
      // Add cache_control to the last tool to cache all tool definitions
      const toolsWithCache = tools.map((tool, index) => {
        if (index === tools.length - 1) {
          return { ...tool, cache_control: { type: "ephemeral" } };
        }
        return tool;
      });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 64000,
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" }
          } as any
        ],
        messages: messages as Anthropic.MessageCreateParams['messages'],
        tools: toolsWithCache as Anthropic.Tool[]
      });

      // Update token stats
      stats.inputTokens += response.usage.input_tokens;
      stats.outputTokens += response.usage.output_tokens;
      stats.totalTokens = stats.inputTokens + stats.outputTokens;
      stats.estimatedCost =
        (stats.inputTokens * PRICING.input) +
        (stats.outputTokens * PRICING.output);

      console.log(`📊 Tokens this turn: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`);
      console.log(`💰 Running cost: $${stats.estimatedCost.toFixed(4)}\n`);

      // Pace requests to avoid rate limits (2 second delay between calls)
      if (iterationCount < maxIterations) {
        await sleep(2000);
      }

      // Add assistant's response to conversation
      messages.push({
        role: 'assistant',
        content: response.content as ContentBlock[]
      });

      // Check stop reason
      if (response.stop_reason === 'end_turn') {
        console.log('✅ Claude finished - extracting final response...\n');
        const finalText = extractTextContent(response.content as ContentBlock[]);
        return { result: finalText, stats, messages };
      }

      if (response.stop_reason === 'max_tokens') {
        console.log('⚠️  Warning: Hit max tokens limit\n');
        const finalText = extractTextContent(response.content as ContentBlock[]);
        return { result: finalText + '\n\n[Response truncated - hit max tokens]', stats, messages };
      }

      if (response.stop_reason === 'tool_use') {
        console.log('🔧 Claude is using tools...\n');

        // Execute all tool calls
        const toolResults = await executeToolCalls(
          response.content as ContentBlock[]
        );

        // Clean up old images before adding new ones to prevent request size limit
        cleanupOldImages(messages, 0); // Remove ALL images after processing - notes are the memory

        // Add tool results to conversation
        messages.push({
          role: 'user',
          content: toolResults
        });

        continue;
      }

      // Unexpected stop reason
      console.log(`⚠️  Unexpected stop reason: ${response.stop_reason}\n`);
      const finalText = extractTextContent(response.content as ContentBlock[]);
      return { result: finalText, stats, messages };

    } catch (error) {
      // Handle API errors with retry logic
      if (error instanceof Anthropic.APIError) {
        if (error.status === 429) {
          console.log('⏳ Rate limited - waiting 10 seconds before retry...\n');
          await sleep(10000);
          continue;
        }

        if (error.status === 529) {
          console.log('⏳ API overloaded - waiting 5 seconds before retry...\n');
          await sleep(5000);
          continue;
        }
      }

      // Re-throw other errors
      throw error;
    }
  }

  throw new Error(`Maximum iterations (${maxIterations}) reached without completion`);
}

/**
 * Build the initial user message with text + images
 */
function buildInitialMessage(text: string, images: ImageData[]): Message {
  const content: ContentBlock[] = [
    { type: 'text', text }
  ];

  // Add all images (no cache_control — see note in executeToolCalls)
  images.forEach((image) => {
    content.push(image);
  });

  return {
    role: 'user',
    content
  };
}

/**
 * Extract all text content from content blocks
 */
function extractTextContent(content: ContentBlock[]): string {
  return content
    .filter(block => block.type === 'text')
    .map(block => (block as { text: string }).text)
    .join('\n\n');
}

/**
 * Execute all tool calls from Claude's response in parallel
 * Uses a concurrency limit to avoid overwhelming the system
 */
const MAX_PARALLEL_TOOLS = 5;

async function executeToolCalls(content: ContentBlock[]): Promise<ContentBlock[]> {
  const toolUses = content.filter(
    block => block.type === 'tool_use'
  ) as ToolUseContent[];

  if (toolUses.length === 0) {
    return [];
  }

  const isParallel = toolUses.length > 1;
  console.log(`   Executing ${toolUses.length} tool call(s)${isParallel ? ' in parallel' : ''}...\n`);

  // Execute tools in parallel with concurrency limit
  const executeOne = async (toolUse: ToolUseContent): Promise<ContentBlock> => {
    const result = await executeTool(
      toolUse.name,
      toolUse.input,
      toolUse.id
    );

    // Check if result content is an array (e.g., from extract_pdf_pages with images)
    if (Array.isArray(result.content)) {
      // Tool returned multiple content blocks (text + images)
      // NOTE: Do not add cache_control here — Anthropic limits cache_control
      // markers to 4 per request. The system prompt already uses one, and
      // each image batch would add another, causing a 400 error after 4 batches.
      // System prompt caching is the main win; images change every turn anyway.
      return {
        type: 'tool_result',
        tool_use_id: result.tool_use_id,
        content: result.content,
        is_error: result.is_error
      } as any;
    } else {
      // Simple string result
      return {
        type: 'tool_result',
        tool_use_id: result.tool_use_id,
        content: result.content,
        is_error: result.is_error
      };
    }
  };

  // If only a few tools, just run them all in parallel
  if (toolUses.length <= MAX_PARALLEL_TOOLS) {
    return Promise.all(toolUses.map(executeOne));
  }

  // For many tools, batch them to limit concurrency
  const results: ContentBlock[] = [];
  for (let i = 0; i < toolUses.length; i += MAX_PARALLEL_TOOLS) {
    const batch = toolUses.slice(i, i + MAX_PARALLEL_TOOLS);
    const batchResults = await Promise.all(batch.map(executeOne));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clean up old images from conversation history to prevent request size limit
 * Replaces image content with text summaries, keeping only the most recent images
 */
function cleanupOldImages(messages: Message[], keepRecentCount: number = 1): void {
  let imageGroupCount = 0;

  // Iterate through messages in reverse to find image-containing tool results
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];

    if (message.role === 'user' && Array.isArray(message.content)) {
      // Check if this message contains images
      const hasImages = message.content.some((block: any) =>
        block.type === 'image' ||
        (block.type === 'tool_result' && Array.isArray(block.content) &&
         block.content.some((c: any) => c.type === 'image'))
      );

      if (hasImages) {
        imageGroupCount++;

        // If this is an older image group (beyond keepRecentCount), replace with summary
        if (imageGroupCount > keepRecentCount) {
          const imageCount = message.content.filter((block: any) => {
            if (block.type === 'image') return true;
            if (block.type === 'tool_result' && Array.isArray(block.content)) {
              return block.content.some((c: any) => c.type === 'image');
            }
            return false;
          }).length;

          // Replace image content with text summary
          message.content = message.content.map((block: any) => {
            if (block.type === 'tool_result' && Array.isArray(block.content)) {
              const imageBlocks = block.content.filter((c: any) => c.type === 'image');
              if (imageBlocks.length > 0) {
                // Replace images with a summary pointing to working notes
                const sessionDir = getGlobalSessionDir();
                const notesPath = sessionDir ? path.join(sessionDir, 'working-notes.md') : '';
                const noteHint = notesPath
                  ? ` Your analysis of these images should be in your working notes: ${notesPath} — use read_file to review them instead of re-extracting.`
                  : '';
                return {
                  ...block,
                  content: `[${imageBlocks.length} images previously processed and removed from conversation to save memory.${noteHint}]`
                };
              }
            }
            return block;
          });

          console.log(`   🧹 Cleaned up ${imageCount} old images from conversation history`);
        }
      }
    }
  }
}

/**
 * Print final statistics
 */
export function printStats(stats: AgentLoopStats): void {
  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL STATISTICS');
  console.log('='.repeat(80));
  console.log(`Total iterations: ${stats.iterations}`);
  console.log(`Total tokens: ${stats.totalTokens.toLocaleString()}`);
  console.log(`  - Input tokens: ${stats.inputTokens.toLocaleString()}`);
  console.log(`  - Output tokens: ${stats.outputTokens.toLocaleString()}`);
  console.log(`Estimated cost: $${stats.estimatedCost.toFixed(4)}`);
  console.log('='.repeat(80) + '\n');
}
