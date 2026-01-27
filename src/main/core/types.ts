// TypeScript types for TakeoffAI PoC

export interface ImageData {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/png' | 'image/jpeg';
    data: string;
  };
}

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type ContentBlock = TextContent | ImageData | ToolUseContent | ToolResultContent;

export interface Message {
  role: 'user' | 'assistant';
  content: ContentBlock[] | string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface ToolExecutionResult {
  tool_use_id: string;
  content: string | any[]; // Support both string and array of content blocks
  is_error?: boolean;
}

export interface PDFPageImage {
  pageNumber: number;
  base64Data: string;
  mimeType: 'image/png' | 'image/jpeg';
}

export interface AgentLoopStats {
  iterations: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}
