# Parallel Tool Execution & Conversation Continuity

**Date:** 2025-01-28
**Branch:** `feature/hybrid-image-strategy`

This document describes improvements made to address performance and UX issues identified during development testing.

---

## Overview

Four issues were prioritized and fixed:

1. **Parallel Tool Execution** - Tools now execute concurrently instead of sequentially
2. **Session-Based Output Organization** - Outputs are organized into timestamped session folders
3. **Post-Completion Conversation** - Users can ask follow-up questions after takeoff completes
4. **ask_user Timeout Removal** - The 5-minute timeout on user prompts was removed

---

## 1. Parallel Tool Execution

### Problem
Tools were executing one at a time (sequential), making multi-page PDF analysis extremely slow during development and testing.

### Solution
Changed `executeToolCalls` in `agent-loop.ts` to use `Promise.all` with a concurrency limit.

### Implementation
**File:** `src/main/core/agent-loop.ts:220-280`

```typescript
const MAX_PARALLEL_TOOLS = 5;

async function executeToolCalls(content: ContentBlock[]): Promise<ContentBlock[]> {
  const toolUses = content.filter(block => block.type === 'tool_use') as ToolUseContent[];

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
```

### Behavior
- Up to 5 tools execute simultaneously
- If Claude requests more than 5 tools, they're batched
- Console logs now show "Executing N tool call(s) in parallel"

---

## 2. Session-Based Output Organization

### Problem
Output files (CSVs, summaries) were being written to inconsistent locations, making them hard to find during development.

### Solution
Introduced timestamp-based session IDs. All outputs for a session go to `<userData>/outputs/<sessionId>/`.

### Implementation

**File:** `src/main/core/tools.ts`

```typescript
let globalSessionId: string = '';

export function generateSessionId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
}

function getSessionOutputDir(): string {
  const baseOutputsDir = getOutputsDir();
  const sessionId = globalSessionId || 'default';
  const sessionOutputDir = path.join(baseOutputsDir, sessionId);
  if (!fs.existsSync(sessionOutputDir)) {
    fs.mkdirSync(sessionOutputDir, { recursive: true });
  }
  return sessionOutputDir;
}
```

**File:** `src/main/ipc-handlers.ts:70-80`

```typescript
currentSessionId = generateSessionId();
currentSessionDir = path.join(os.tmpdir(), `takeoff-session-${currentSessionId}`);
setGlobalSessionDir(sessionDir);
setGlobalSessionId(currentSessionId!);
```

### Output Structure
```
~/Library/Application Support/takeoff-ai-electron/outputs/
├── 2025-01-28-143052/
│   ├── takeoff.csv
│   └── summary.txt
├── 2025-01-28-151230/
│   └── stair-takeoff.csv
```

---

## 3. Post-Completion Conversation Continuity

### Problem
After Claude delivered the takeoff results, the app became unresponsive. Users couldn't ask follow-up questions like "Can you also count the doors?" or "Export that as JSON instead."

### Solution
Added a `continue-conversation` IPC handler that preserves the full conversation history. The renderer tracks whether a conversation is active and routes follow-up messages appropriately.

### Implementation

**File:** `src/main/core/agent-loop.ts:42-68`

```typescript
export interface AgentLoopResult {
  result: string;
  stats: AgentLoopStats;
  messages: Message[];  // Full conversation history for continuation
}

export async function runAgentLoop(
  initialMessage: string,
  images: ImageData[],
  systemPrompt: string,
  tools: ToolDefinition[],
  onUpdate?: (update: any) => void,
  existingMessages?: Message[]  // NEW: for conversation continuation
): Promise<AgentLoopResult>
```

**File:** `src/main/ipc-handlers.ts:175-237`

```typescript
// Store conversation history for follow-up messages
let conversationMessages: Message[] = [];
let currentSystemPrompt: string = '';

ipcMain.handle('continue-conversation', async (_event, { userMessage }) => {
  // ... validation ...

  const result = await runAgentLoop(
    userMessage,
    [],
    currentSystemPrompt,
    TOOL_DEFINITIONS,
    (update) => { /* stream to renderer */ },
    conversationMessages  // Pass existing conversation
  );

  conversationMessages = result.messages;
  return { success: true, result: result.result, stats: result.stats };
});
```

**File:** `src/main/preload.ts:13`

```typescript
continueConversation: (params: { userMessage: string }) =>
  ipcRenderer.invoke('continue-conversation', params),
```

**File:** `src/renderer/stores/agent-store.ts:30,65-98`

```typescript
interface AgentStore {
  // ...
  hasActiveConversation: boolean;  // True after first successful takeoff
}

sendMessage: async (userMessage: string) => {
  const { attachedPdf, hasActiveConversation } = get();

  if (hasActiveConversation) {
    // Continue existing conversation
    result = await window.electronAPI.continueConversation({ userMessage });
  } else {
    // Start new takeoff with PDF
    result = await window.electronAPI.startTakeoff({ pdfPath, systemPrompt, userMessage });
  }

  set({ hasActiveConversation: true });
}
```

### Behavior
- After initial takeoff completes, `hasActiveConversation` becomes `true`
- Subsequent messages route to `continue-conversation` instead of `start-takeoff`
- Claude retains access to PDF tools and can reference previous analysis
- Attaching a new PDF resets the conversation state

---

## 4. ask_user Timeout Removal

### Problem
The `ask_user` tool had a 5-minute timeout that would reject the promise if the user didn't respond quickly enough. This was unnecessary and disruptive.

### Solution
Removed the `setTimeout` block entirely. The promise now waits indefinitely for user response.

### Implementation

**File:** `src/main/core/tools.ts` (in `askUser` function)

```typescript
// Before: Had setTimeout that rejected after 5 minutes
// After: Simple promise that waits for user response
return new Promise<string>((resolve, reject) => {
  pendingUserResponse = { resolve, reject };
  // No timeout - wait indefinitely for user response
});
```

---

## Files Changed

| File | Changes |
|------|---------|
| `src/main/core/agent-loop.ts` | Parallel execution, conversation continuation support |
| `src/main/core/tools.ts` | Session ID system, timeout removal, configurable output dir |
| `src/main/ipc-handlers.ts` | Session management, continue-conversation handler, settings handlers |
| `src/main/preload.ts` | Exposed continueConversation and settings APIs |
| `src/renderer/stores/agent-store.ts` | hasActiveConversation state, routing logic |
| `src/renderer/App.tsx` | Updated placeholder text, settings button, Settings modal |
| `src/renderer/components/Settings.tsx` | New settings panel component |
| `resources/knowledge-base/CLAUDE.md` | Added parallel execution guidance |

---

---

## 5. Settings Panel (Output Directory Configuration)

### Problem
Users couldn't choose where output files are saved - they went to a hardcoded location in the app's userData directory.

### Solution
Added a Settings panel accessible via a gear icon in the header. Users can configure their preferred output directory.

### Implementation

**File:** `src/renderer/components/Settings.tsx` (new file)
- Modal dialog with output directory configuration
- Browse button to select folder
- Reset to default option
- Persists selection to electron-store

**File:** `src/main/ipc-handlers.ts:285-330`
```typescript
ipcMain.handle('get-output-directory', async () => {
  return store.get('outputDirectory') as string || '';
});

ipcMain.handle('set-output-directory', async (_event, directory: string) => {
  store.set('outputDirectory', directory);
  setConfiguredOutputsDir(directory);
  return true;
});

ipcMain.handle('browse-output-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Output Directory',
    properties: ['openDirectory', 'createDirectory']
  });
  return result.filePaths[0] || null;
});
```

**File:** `src/main/core/tools.ts:19-28`
```typescript
let configuredOutputsDir: string = '';

export function setConfiguredOutputsDir(dir: string): void {
  configuredOutputsDir = dir;
}

function getOutputsDir(): string {
  if (configuredOutputsDir && configuredOutputsDir.length > 0) {
    return configuredOutputsDir;
  }
  return path.join(app.getPath('userData'), 'outputs');
}
```

### Behavior
- Settings accessible via gear icon in header
- Output directory persists across sessions
- Each session still creates a timestamped subfolder within the configured directory
- Reset option returns to default (app userData)

---

## 6. Parallel Execution Guidance in System Prompt

### Problem
The code supported parallel execution, but Claude was choosing to call tools one at a time (sequential reasoning).

### Solution
Added explicit guidance in CLAUDE.md to encourage Claude to batch tool calls when operations are independent.

### Implementation

**File:** `resources/knowledge-base/CLAUDE.md:50-90`

Added new section "IMPORTANT: Parallel Tool Execution" with:
- Examples of slow (sequential) vs fast (parallel) patterns
- Rules for when to batch vs when to stay sequential
- Specific guidance for PDF extraction, file operations, and region crops

```markdown
## IMPORTANT: Parallel Tool Execution

**You can call multiple tools in a single response.** When you know you need
multiple operations that don't depend on each other, request them ALL in one
message.

### When to Batch Tool Calls:

**PDF Extraction:** If you know you need pages 250-270, don't request them
one batch at a time. Request multiple batches in parallel:

// SLOW - one at a time:
Turn 1: extract_pdf_pages([250,251,252,253,254])
Turn 2: extract_pdf_pages([255,256,257,258,259])

// FAST - parallel batches in ONE turn:
Turn 1: extract_pdf_pages([250-254]) AND extract_pdf_pages([255-259])
```

---

## Testing

To verify these changes:

1. **Parallel Execution:** Watch console for "Executing N tool call(s) in parallel" messages when Claude batches requests
2. **Session Outputs:** Check configured directory (or default `~/Library/Application Support/takeoff-ai-electron/outputs/`) for timestamped folders
3. **Conversation Continuity:** After takeoff completes, type a follow-up question and verify Claude responds with context
4. **No Timeout:** During an `ask_user` prompt, wait longer than 5 minutes and verify it still accepts input
5. **Settings Panel:** Click gear icon, configure output directory, verify files save to new location
