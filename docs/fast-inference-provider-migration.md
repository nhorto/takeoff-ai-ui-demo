# Fast Inference Provider Migration Plan

**Date:** 2026-02-14
**Status:** Research Complete / Implementation Proposed
**Goal:** Replace Claude Sonnet 4.5 with faster, cheaper open-source vision models for production scale

---

## Table of Contents

1. [Current Architecture](#current-architecture)
2. [Provider Comparison](#provider-comparison)
3. [Recommended Providers](#recommended-providers)
4. [Implementation Plan](#implementation-plan)
5. [Code Changes Required](#code-changes-required)
6. [Risk Assessment](#risk-assessment)
7. [Testing Strategy](#testing-strategy)
8. [Production Scaling Considerations](#production-scaling-considerations)

---

## Current Architecture

### How the App Calls Claude Today

| Component | Detail |
|-----------|--------|
| **SDK** | `@anthropic-ai/sdk` v0.32.1 |
| **Model** | `claude-sonnet-4-5-20250929` |
| **Max tokens** | 64,000 per response |
| **Image format** | Base64 JPEG, max 1568px, 150 DPI |
| **Max images/request** | 5 (per `extract_pdf_pages`) |
| **Caching** | Ephemeral cache on system prompt + last tool definition |
| **Tool count** | 11 tools (PDF extraction, file I/O, user interaction) |
| **Agent loop** | While loop with tool_use/end_turn stop reasons, max 5 parallel tool executions |
| **Pricing** | $3/M input, $15/M output |

### Key Files That Need Changes

```
src/main/core/agent-loop.ts    — API client init, message creation, response handling
src/main/core/types.ts         — Message and content block type definitions
src/main/core/tools.ts         — Tool definitions and execution
src/main/core/orchestrator.ts  — Multi-phase agent orchestration
src/main/ipc-handlers.ts       — Settings storage, API key management
package.json                   — SDK dependency
```

### Current API Call (agent-loop.ts:110-122)

```typescript
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
```

---

## Provider Comparison

### Cerebras — NOT VIABLE

No vision model support. Text-only inference (Llama 3.1/3.3, Qwen 3). Despite being the fastest text inference provider (~2,200-3,000 tok/s), they cannot process images.

### Groq — VIABLE (Preview)

| Feature | Detail |
|---------|--------|
| **Vision models** | Llama 4 Scout (17Bx16E), Llama 4 Maverick (17Bx128E) |
| **Speed** | 460-750 tok/s |
| **Pricing** | Scout: $0.11/M input, $0.34/M output. Maverick: $0.20/M input, $0.60/M output |
| **Max images/req** | 5 |
| **Max image size** | 4MB base64, 20MB URL |
| **Max resolution** | 33 megapixels |
| **Context window** | 131,072 tokens |
| **API** | OpenAI-compatible (`https://api.groq.com/openai/v1/`) |
| **Tool use** | Supported |
| **Status** | Vision models in **Preview** (not production) |
| **Rate limits** | Tiered — Free tier ~30 RPM; Developer/Enterprise much higher |

**Pros:** Fastest price-to-speed ratio, familiar API, tool use works.
**Cons:** Vision is Preview status, 5 image limit, free tier rate limits are very low.

### Together AI — VIABLE

| Feature | Detail |
|---------|--------|
| **Vision models** | Qwen2.5-VL-72B, Qwen3-VL-32B, Llama 4 Maverick, Llama 3.2 11B/90B Vision |
| **Speed** | Moderate (not benchmarked as fast as Groq/SambaNova) |
| **Pricing** | Llama 4 Maverick: $0.27/M. Qwen2.5-VL-72B: $1.95/M input, $8.00/M output |
| **Max images/req** | Multiple (no hard limit published) |
| **Image tokenization** | 1,601-6,404 tokens per image depending on resolution |
| **API** | OpenAI-compatible |
| **Tool use** | Supported |
| **Batch API** | 30B token capacity, 3,000x higher rate limits |
| **Rate limits** | Scale and Enterprise plans; batch API for massive throughput |

**Pros:** Best model variety, Qwen2.5-VL-72B is highest quality open-source vision model, batch API is killer for production.
**Cons:** Not the fastest latency, Qwen2.5-VL-72B pricing approaches Claude.

### Fireworks AI — VIABLE (Top Recommendation)

| Feature | Detail |
|---------|--------|
| **Vision models** | Qwen2.5-VL-3B/32B/72B, Qwen3-VL-30B, Llama 3.2 11B/90B, Llama 4 Scout/Maverick, GLM-5, Kimi K2.5, InternVL3, RolmOCR |
| **Speed** | 4x lower latency than vLLM, FireAttention engine |
| **Pricing** | Qwen3-VL-30B: $0.15/M in, $0.60/M out. Qwen2.5-VL-72B: $0.90/M |
| **Max images/req** | **30** |
| **Max base64 size** | 10MB combined |
| **Image formats** | PNG, JPG, JPEG, GIF, BMP, TIFF, PPM |
| **API** | OpenAI-compatible (drop-in replacement) |
| **Tool use** | Supported |
| **Prompt caching** | Up to 80% reduction in TTFT |
| **Rate limits** | Enterprise tiers with custom limits |

**Pros:** Widest model selection, 30 images/request (6x our current max), prompt caching, mature platform, RolmOCR for text extraction.
**Cons:** Speed is "fast" but not Groq/SambaNova-level tok/s.

### SambaNova — VIABLE (Limited)

| Feature | Detail |
|---------|--------|
| **Vision models** | Llama 4 Scout, Llama 4 Maverick |
| **Speed** | **697 tok/s** (fastest published) |
| **Pricing** | Maverick: $0.63/M input, $1.80/M output |
| **Max images/req** | **2** (Maverick) |
| **API** | OpenAI-compatible |
| **Rate limits** | Developer tier pay-as-you-go, Enterprise unlimited |

**Pros:** Absolute fastest tok/s.
**Cons:** 2 image limit is a dealbreaker for our multi-image workflow.

### OpenRouter — META-LAYER (Worth Considering)

Routes requests to 500+ models across 60+ providers. Adds ~15ms latency. Lets you switch providers without code changes. Could serve as an abstraction layer so the app isn't locked to one provider.

---

## Recommended Providers

### Tier 1: Fireworks AI (Primary Recommendation)

**Why:** Best combination of model variety, image limits, prompt caching, and production readiness. The 30 images/request ceiling gives us massive headroom. Qwen2.5-VL-72B offers the closest quality to Claude for visual reasoning tasks.

**Best model for our use case:** `Qwen2.5-VL-72B` ($0.90/M — 70% cheaper than Claude input, 94% cheaper than Claude output)

### Tier 2: Groq (Speed Priority)

**Why:** When vision exits Preview status, Groq will offer the best speed-to-cost ratio. Llama 4 Scout at $0.11/M is 27x cheaper than Claude input pricing.

**Best model for our use case:** `Llama 4 Maverick` ($0.20/M input — once out of Preview)

### Tier 3: Together AI (Batch/Scale Priority)

**Why:** The batch API with 3,000x rate limits is unmatched for production at scale. When processing hundreds of PDFs for many users simultaneously, this is the scaling play.

---

## Implementation Plan

### Phase 1: Add Provider Abstraction Layer

Create an abstraction that lets us swap providers without changing the agent loop. All providers use OpenAI-compatible APIs, so the translation layer is thin.

**New files to create:**

```
src/main/core/providers/
├── types.ts           — Provider-agnostic types
├── provider.ts        — Provider interface + factory
├── anthropic.ts       — Current Claude implementation (preserved)
├── openai-compat.ts   — Generic OpenAI-compatible provider (Fireworks, Groq, Together, SambaNova)
└── config.ts          — Provider configuration and model registry
```

### Phase 2: Implement OpenAI-Compatible Provider

Since Fireworks, Groq, Together AI, and SambaNova all use the OpenAI chat completions API format, a single adapter handles all of them.

**Key translation points:**

| Anthropic Format | OpenAI Format |
|-----------------|---------------|
| `anthropic.messages.create()` | `openai.chat.completions.create()` |
| `system: [{ type: "text", text, cache_control }]` | `messages: [{ role: "system", content: text }]` |
| `{ type: "image", source: { type: "base64", media_type, data } }` | `{ type: "image_url", image_url: { url: "data:{media_type};base64,{data}" } }` |
| `stop_reason: "tool_use"` | `finish_reason: "tool_calls"` |
| `stop_reason: "end_turn"` | `finish_reason: "stop"` |
| `content: [{ type: "tool_use", id, name, input }]` | `tool_calls: [{ id, type: "function", function: { name, arguments } }]` |
| `{ type: "tool_result", tool_use_id, content }` | `{ role: "tool", tool_call_id, content }` |
| `tools: [{ name, description, input_schema }]` | `tools: [{ type: "function", function: { name, description, parameters } }]` |
| `cache_control: { type: "ephemeral" }` | Not supported (remove) |

### Phase 3: Update Settings UI

Add provider selection to the Electron settings:

- Provider dropdown (Claude / Fireworks / Groq / Together AI / SambaNova)
- Model dropdown (filtered by selected provider)
- API key field (per provider)
- Show pricing info per model

### Phase 4: Update Agent Loop

Modify `agent-loop.ts` to use the provider abstraction instead of the Anthropic SDK directly.

### Phase 5: Prompt Adaptation

The system prompt in `CLAUDE.md` is heavily Claude-specific. Each provider/model may need prompt adjustments:

- Remove Claude-specific instructions (e.g., "You are Claude")
- Adjust tool use instructions for models that handle tools differently
- May need to simplify prompt for smaller models
- Test and tune crop planning instructions per model

---

## Code Changes Required

### 1. New Provider Types (`src/main/core/providers/types.ts`)

```typescript
export interface ProviderConfig {
  provider: 'anthropic' | 'fireworks' | 'groq' | 'together' | 'sambanova';
  apiKey: string;
  model: string;
  baseUrl?: string;  // For OpenAI-compatible providers
  maxTokens: number;
}

export interface ProviderResponse {
  content: ContentBlock[];
  stopReason: 'end_turn' | 'tool_use';
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
  };
}

export interface Provider {
  createMessage(params: {
    systemPrompt: string;
    messages: Message[];
    tools: ToolDefinition[];
  }): Promise<ProviderResponse>;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  inputPrice: number;   // per million tokens
  outputPrice: number;  // per million tokens
  maxTokens: number;
  maxImages: number;
  supportsToolUse: boolean;
  supportsCaching: boolean;
  contextWindow: number;
}
```

### 2. Provider Registry (`src/main/core/providers/config.ts`)

```typescript
export const MODELS: Record<string, ModelInfo> = {
  // Anthropic
  'claude-sonnet-4-5-20250929': {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    inputPrice: 3.00,
    outputPrice: 15.00,
    maxTokens: 64000,
    maxImages: 5,
    supportsToolUse: true,
    supportsCaching: true,
    contextWindow: 200000,
  },
  // Fireworks
  'accounts/fireworks/models/qwen2p5-vl-72b-instruct': {
    id: 'accounts/fireworks/models/qwen2p5-vl-72b-instruct',
    name: 'Qwen2.5-VL-72B (Fireworks)',
    provider: 'fireworks',
    inputPrice: 0.90,
    outputPrice: 0.90,
    maxTokens: 16384,
    maxImages: 30,
    supportsToolUse: true,
    supportsCaching: true,
    contextWindow: 32768,
  },
  // Groq
  'meta-llama/llama-4-scout-17b-16e-instruct': {
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout (Groq)',
    provider: 'groq',
    inputPrice: 0.11,
    outputPrice: 0.34,
    maxTokens: 16384,
    maxImages: 5,
    supportsToolUse: true,
    supportsCaching: false,
    contextWindow: 131072,
  },
  // Together AI
  'Qwen/Qwen2.5-VL-72B-Instruct': {
    id: 'Qwen/Qwen2.5-VL-72B-Instruct',
    name: 'Qwen2.5-VL-72B (Together)',
    provider: 'together',
    inputPrice: 1.95,
    outputPrice: 8.00,
    maxTokens: 16384,
    maxImages: 10,
    supportsToolUse: true,
    supportsCaching: false,
    contextWindow: 32768,
  },
};

export const PROVIDER_BASE_URLS: Record<string, string> = {
  fireworks: 'https://api.fireworks.ai/inference/v1',
  groq: 'https://api.groq.com/openai/v1',
  together: 'https://api.together.xyz/v1',
  sambanova: 'https://api.sambanova.ai/v1',
};
```

### 3. OpenAI-Compatible Provider (`src/main/core/providers/openai-compat.ts`)

```typescript
import OpenAI from 'openai';
import { Provider, ProviderConfig, ProviderResponse } from './types';
import { Message, ContentBlock } from '../types';

export class OpenAICompatProvider implements Provider {
  private client: OpenAI;
  private model: string;
  private maxTokens: number;

  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
    this.model = config.model;
    this.maxTokens = config.maxTokens;
  }

  async createMessage(params: {
    systemPrompt: string;
    messages: Message[];
    tools: ToolDefinition[];
  }): Promise<ProviderResponse> {
    // Convert Anthropic message format to OpenAI format
    const openaiMessages = this.convertMessages(params.systemPrompt, params.messages);
    const openaiTools = this.convertTools(params.tools);

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: openaiMessages,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
    });

    return this.convertResponse(response);
  }

  private convertMessages(systemPrompt: string, messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt }
    ];

    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        result.push({ role: msg.role, content: msg.content });
        continue;
      }

      // Convert content blocks
      const parts: OpenAI.ChatCompletionContentPart[] = [];
      const toolCalls: OpenAI.ChatCompletionMessageToolCall[] = [];
      const toolResults: { tool_call_id: string; content: string }[] = [];

      for (const block of msg.content) {
        if (block.type === 'text') {
          parts.push({ type: 'text', text: block.text });
        } else if (block.type === 'image') {
          // Convert base64 image to OpenAI data URL format
          const dataUrl = `data:${block.source.media_type};base64,${block.source.data}`;
          parts.push({
            type: 'image_url',
            image_url: { url: dataUrl }
          });
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
          });
        } else if (block.type === 'tool_result') {
          toolResults.push({
            tool_call_id: block.tool_use_id,
            content: this.extractToolResultText(block.content),
          });
        }
      }

      if (toolCalls.length > 0) {
        result.push({
          role: 'assistant',
          content: parts.length > 0 ? parts : null,
          tool_calls: toolCalls,
        } as any);
      } else if (toolResults.length > 0) {
        for (const tr of toolResults) {
          result.push({
            role: 'tool',
            tool_call_id: tr.tool_call_id,
            content: tr.content,
          } as any);
        }
      } else {
        result.push({ role: msg.role, content: parts } as any);
      }
    }

    return result;
  }

  private convertTools(tools: ToolDefinition[]): OpenAI.ChatCompletionTool[] {
    return tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));
  }

  private convertResponse(response: OpenAI.ChatCompletion): ProviderResponse {
    const choice = response.choices[0];
    const content: ContentBlock[] = [];

    // Convert text content
    if (choice.message.content) {
      content.push({ type: 'text', text: choice.message.content });
    }

    // Convert tool calls
    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      }
    }

    return {
      content,
      stopReason: choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn',
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
    };
  }

  private extractToolResultText(content: any): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n');
    }
    return JSON.stringify(content);
  }
}
```

### 4. Modify Agent Loop (`src/main/core/agent-loop.ts`)

The core change is replacing the direct Anthropic SDK call with the provider abstraction:

```typescript
// BEFORE (current):
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic({ apiKey });
const response = await anthropic.messages.create({ ... });

// AFTER (with provider abstraction):
import { createProvider } from './providers/provider';
const provider = createProvider(providerConfig);
const response = await provider.createMessage({
  systemPrompt,
  messages,
  tools,
});

// Stop reason check changes:
// BEFORE: response.stop_reason === 'end_turn'
// AFTER:  response.stopReason === 'end_turn'  (normalized by provider)
```

The agent loop's while-loop structure, tool execution, image cleanup, and parallel batching all remain the same. Only the API call and response parsing change.

### 5. Update Pricing (`src/main/core/agent-loop.ts`)

```typescript
// BEFORE: Hardcoded Claude pricing
const PRICING = {
  input: 3.00 / 1_000_000,
  output: 15.00 / 1_000_000
};

// AFTER: Dynamic pricing from model config
import { MODELS } from './providers/config';
function getPricing(modelId: string) {
  const model = MODELS[modelId];
  return {
    input: model.inputPrice / 1_000_000,
    output: model.outputPrice / 1_000_000,
  };
}
```

### 6. Update Settings Store (`src/main/ipc-handlers.ts`)

```typescript
// Add to electron-store defaults:
const store = new Store({
  name: 'takeoff-ai-config',
  defaults: {
    apiKey: '',                    // Legacy — kept for Claude
    provider: 'anthropic',         // NEW
    model: 'claude-sonnet-4-5-20250929',  // NEW
    providerApiKeys: {},           // NEW — { fireworks: 'key', groq: 'key', ... }
    outputDirectory: '',
    maxImageDimension: 1568,
    renderDpi: 150,
  }
});
```

### 7. Update Package Dependencies

```bash
# Add OpenAI SDK for compatible providers
bun add openai

# Anthropic SDK stays for Claude support
# No other dependency changes needed
```

---

## Risk Assessment

### Quality Risk: HIGH

This is the biggest concern. The app's value depends on accurate vision analysis of construction drawings.

| Capability | Claude Sonnet 4.5 | Qwen2.5-VL-72B | Llama 4 Maverick |
|-----------|-------------------|-----------------|------------------|
| Counting objects in dense drawings | Excellent | Good (untested on construction) | Moderate |
| Reading text/dimensions on plans | Excellent | Good (OCR strong in Qwen) | Moderate |
| Multi-step reasoning (crop planning) | Excellent | Good | Moderate |
| Tool use reliability | Excellent | Good | Good |
| Following complex system prompts | Excellent | Good | Moderate |

**Mitigation:** Run head-to-head comparison tests before committing (see Testing Strategy).

### Technical Risk: LOW

All providers use OpenAI-compatible APIs. The translation layer is straightforward. The biggest technical nuance is handling differences in tool use behavior (some models are less reliable at structured tool calls).

### Rate Limit Risk: MEDIUM

Free tiers are very restrictive. Production will require paid plans. Fireworks and Together AI offer enterprise tiers with custom limits. Budget for this.

### Vendor Lock-in Risk: LOW (with abstraction layer)

The provider abstraction means you can switch providers with a config change. OpenRouter as a meta-layer reduces this further.

---

## Testing Strategy

### Phase 1: Benchmark Test Suite

Create a set of 5-10 reference PDFs with known correct takeoff results. For each PDF, record:
- Correct stair count
- Correct tread counts per stair
- Correct riser heights and tread depths
- Correct materials and finishes

### Phase 2: Head-to-Head Comparison

Run each reference PDF through:
1. Claude Sonnet 4.5 (baseline)
2. Qwen2.5-VL-72B via Fireworks
3. Llama 4 Scout via Groq
4. Llama 4 Maverick via Groq

For each run, measure:
- **Accuracy:** Stair count, tread count, dimension accuracy
- **Speed:** Time to complete full takeoff
- **Cost:** Total tokens used x pricing
- **Reliability:** Did it follow the crop workflow? Did tool calls work?

### Phase 3: Prompt Tuning

For the best-performing alternative model, iterate on the system prompt:
- Simplify instructions that the model struggles with
- Add examples for tasks where accuracy drops
- Test with and without specific crop planning instructions

### Phase 4: Production Pilot

Run the alternative provider alongside Claude for real user sessions:
- Claude produces the "official" result
- Alternative provider runs in shadow mode
- Compare outputs, track accuracy delta over time

---

## Production Scaling Considerations

### For Many Concurrent Users

| Provider | Best Scaling Option | Rate Limit Strategy |
|----------|-------------------|---------------------|
| Fireworks | Enterprise tier + custom limits | Contact sales for production SLAs |
| Groq | Enterprise plan | Custom rate limits per org |
| Together AI | **Batch API** (3,000x rate limits, 30B token capacity) | Best for async processing |
| OpenRouter | Auto-routes to fastest available provider | Built-in load balancing |

### Recommended Production Architecture

```
User Request
    │
    ▼
┌─────────────────────┐
│   Provider Router    │  ← Selects provider based on:
│   (OpenRouter or     │     - Model quality needed
│    custom logic)     │     - Current rate limits
│                      │     - Cost budget
└─────────┬───────────┘
          │
    ┌─────┼─────────────┐
    ▼     ▼             ▼
 Claude  Fireworks    Groq
 (best   (balanced)  (fastest/
 quality)            cheapest)
```

### Hybrid Strategy (Recommended for Production)

Instead of fully replacing Claude, use a tiered approach:

1. **Fast scan (cheap model):** Use Llama 4 Scout via Groq for the Discovery phase — identifying which pages have stairs, reading schedules. This is fast and cheap ($0.11/M).

2. **Precision counting (quality model):** Use Qwen2.5-VL-72B via Fireworks or Claude for the Counting phase — this is where accuracy matters most.

3. **Compilation (cheap model):** Use any fast model for the Compilation phase — it's mostly text processing, no vision needed.

This hybrid approach could reduce costs by 60-80% while maintaining accuracy where it matters.

### Cost Comparison at Scale

Assuming 1M input tokens + 200K output tokens per PDF takeoff:

| Provider/Model | Cost per Takeoff | 100 Takeoffs/day | 1000 Takeoffs/day |
|----------------|-----------------|-------------------|---------------------|
| Claude Sonnet 4.5 | $6.00 | $600/day | $6,000/day |
| Qwen2.5-VL-72B (Fireworks) | $1.08 | $108/day | $1,080/day |
| Llama 4 Scout (Groq) | $0.18 | $18/day | $180/day |
| Hybrid (Groq scan + Fireworks count + Groq compile) | ~$0.50 | $50/day | $500/day |

---

## Next Steps

1. **Immediate:** Run benchmark tests with Fireworks (Qwen2.5-VL-72B) and Groq (Llama 4 Scout) on 3-5 reference PDFs
2. **If quality is acceptable:** Implement the provider abstraction layer (Phase 1-2 of implementation plan)
3. **If quality needs work:** Focus on prompt tuning for the best-performing model
4. **For production:** Implement the hybrid strategy with provider routing
5. **Long-term:** Monitor open-source vision model improvements — quality is improving rapidly quarter over quarter
