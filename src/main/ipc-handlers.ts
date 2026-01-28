// IPC handlers for TakeoffAI Electron
import { ipcMain, dialog, shell, app } from 'electron';
import { getMainWindow } from './window.js';
import { runAgentLoop } from './core/agent-loop.js';
import { TOOL_DEFINITIONS, setGlobalPdfPath, setGlobalSessionDir, resolveUserResponse } from './core/tools.js';
import * as os from 'os';
import { getPdfPageCount } from './core/pdf-extractor.js';
import Store from 'electron-store';
import * as fs from 'fs';
import * as path from 'path';

// Persistent store for API key and settings
const store = new Store({
  name: 'takeoff-ai-config',
  defaults: {
    apiKey: ''
  }
});

function getKnowledgeBasePath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'knowledge-base');
  } else {
    return path.join(app.getAppPath(), 'resources', 'knowledge-base');
  }
}

function getOutputsDir(): string {
  return path.join(app.getPath('userData'), 'outputs');
}

// Track the current session directory so follow-up messages reuse it
let currentSessionDir: string | null = null;

export function setupIPCHandlers() {
  console.log('⚙️  Setting up IPC handlers...');

  // =============================================================================
  // Takeoff Session Management
  // =============================================================================

  /**
   * Start a takeoff session
   */
  ipcMain.handle('start-takeoff', async (event, { pdfPath, systemPrompt, userMessage }) => {
    console.log(`\n💬 Starting conversation...`);
    console.log(`   User message: ${userMessage}`);
    if (pdfPath) {
      console.log(`   PDF attached: ${path.basename(pdfPath)}`);
    }

    try {
      // Get API key from store
      const apiKey = store.get('apiKey') as string;
      if (!apiKey) {
        throw new Error('API key not set. Please configure your Anthropic API key.');
      }

      // Set environment variable for Anthropic SDK
      process.env.ANTHROPIC_API_KEY = apiKey;

      // Reuse existing session directory if one is active, otherwise create new
      if (!currentSessionDir || !fs.existsSync(currentSessionDir)) {
        const sessionId = Date.now().toString();
        currentSessionDir = path.join(os.tmpdir(), `takeoff-session-${sessionId}`);
        fs.mkdirSync(currentSessionDir, { recursive: true });
        console.log(`   New session directory: ${currentSessionDir}`);
      } else {
        console.log(`   Reusing session directory: ${currentSessionDir}`);
      }
      const sessionDir = currentSessionDir;
      setGlobalSessionDir(sessionDir);

      // Build initial message with PDF context if provided
      let initialMessage = userMessage;
      const notesPath = path.join(sessionDir, 'working-notes.md');

      if (pdfPath && fs.existsSync(pdfPath)) {
        // Set global PDF path for tools
        setGlobalPdfPath(pdfPath);

        // Get page count
        const pageCount = await getPdfPageCount(pdfPath);
        console.log(`   Total pages: ${pageCount}`);

        // Add PDF context to the message
        initialMessage = `I have a construction drawing PDF with ${pageCount} pages (${path.basename(pdfPath)}).

The user asks: "${userMessage}"

You can use the extract_pdf_pages([page_numbers]) tool to view specific pages (max 5 per call).

IMPORTANT - Working Notes:
To avoid losing your analysis when older images are removed from the conversation, you MUST maintain a working notes file. After analyzing each batch of images, use write_file to save your findings to: ${notesPath}
If you need to reference findings from earlier pages, use read_file to read your working notes instead of re-extracting pages you already analyzed.

Save final outputs to the outputs/ directory.
Output files will be saved to: ${getOutputsDir()}`;
      }

      // Run agent loop with streaming updates
      const result = await runAgentLoop(
        initialMessage,
        [], // Empty array - no images upfront, Claude will request them
        systemPrompt,
        TOOL_DEFINITIONS,
        (update) => {
          // Stream updates to renderer
          const mainWindow = getMainWindow();
          if (mainWindow) {
            mainWindow.webContents.send('agent-update', update);
          }
        }
      );

      console.log('\n✅ Takeoff complete!');

      return {
        success: true,
        result: result.result,
        stats: result.stats
      };

    } catch (error) {
      console.error('\n❌ Takeoff failed:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  /**
   * Start a new session explicitly (e.g., when uploading a new PDF)
   */
  ipcMain.handle('new-session', async () => {
    const sessionId = Date.now().toString();
    currentSessionDir = path.join(os.tmpdir(), `takeoff-session-${sessionId}`);
    fs.mkdirSync(currentSessionDir, { recursive: true });
    setGlobalSessionDir(currentSessionDir);
    console.log(`   New session created: ${currentSessionDir}`);
    return currentSessionDir;
  });

  // =============================================================================
  // API Key Management
  // =============================================================================

  /**
   * Get stored API key
   */
  ipcMain.handle('get-api-key', async () => {
    const apiKey = store.get('apiKey') as string;
    return apiKey || '';
  });

  /**
   * Save API key
   */
  ipcMain.handle('set-api-key', async (_event, apiKey: string) => {
    try {
      console.log('🔑 Saving API key...');
      console.log(`   API key length: ${apiKey.length}`);
      store.set('apiKey', apiKey);
      console.log('   ✅ Stored to disk');
      process.env.ANTHROPIC_API_KEY = apiKey;
      console.log('   ✅ Set environment variable');
      return true;
    } catch (error) {
      console.error('❌ Error saving API key:', error);
      throw error;
    }
  });

  // =============================================================================
  // Knowledge Base
  // =============================================================================

  /**
   * Load system prompt: CLAUDE.md + baked-in ConstructionTakeoff skill
   * Baking the skill into the system prompt means it benefits from
   * ephemeral caching (90% discount on subsequent turns) instead of
   * being re-sent as an uncached tool_result every turn.
   */
  ipcMain.handle('load-knowledge-base', async () => {
    const knowledgeBasePath = getKnowledgeBasePath();
    const claudeMdPath = path.join(knowledgeBasePath, 'CLAUDE.md');
    const skillPath = path.join(knowledgeBasePath, 'skills', 'ConstructionTakeoff.md');

    if (!fs.existsSync(claudeMdPath)) {
      throw new Error(`CLAUDE.md not found at: ${claudeMdPath}`);
    }

    let content = fs.readFileSync(claudeMdPath, 'utf-8');

    // Bake the ConstructionTakeoff skill into the system prompt
    if (fs.existsSync(skillPath)) {
      const skillContent = fs.readFileSync(skillPath, 'utf-8');
      content += '\n\n---\n\n# ConstructionTakeoff Skill\n\n' + skillContent;
      console.log(`📚 Loaded knowledge base with baked-in skill (${content.length} characters)`);
    } else {
      console.log(`📚 Loaded knowledge base (${content.length} characters) — skill file not found, Claude will need to load it via read_skill`);
    }

    return content;
  });

  // =============================================================================
  // File Operations
  // =============================================================================

  /**
   * Open file dialog to select PDF
   */
  ipcMain.handle('select-pdf-file', async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      return null;
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Construction Drawing PDF',
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  /**
   * Open output file in default application
   */
  ipcMain.handle('open-output-file', async (_event, filePath: string) => {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    await shell.openPath(filePath);
  });

  /**
   * Get outputs directory path
   */
  ipcMain.handle('get-outputs-directory', async () => {
    return getOutputsDir();
  });

  /**
   * Open outputs folder in system file manager
   */
  ipcMain.handle('open-outputs-folder', async () => {
    const outputsDir = getOutputsDir();
    if (!fs.existsSync(outputsDir)) {
      fs.mkdirSync(outputsDir, { recursive: true });
    }
    await shell.openPath(outputsDir);
    return outputsDir;
  });

  // =============================================================================
  // App Info
  // =============================================================================

  /**
   * Get app version
   */
  ipcMain.handle('get-app-version', async () => {
    return app.getVersion();
  });

  /**
   * Get app path
   */
  ipcMain.handle('get-app-path', async () => {
    return app.getAppPath();
  });

  /**
   * Send user response to agent
   */
  ipcMain.handle('send-user-response', async (_event, response: string) => {
    console.log(`💬 User response received: ${response}`);
    resolveUserResponse(response);
    return true;
  });

  console.log('✅ IPC handlers ready');
}
