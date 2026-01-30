// IPC handlers for TakeoffAI Electron
import { ipcMain, dialog, shell, app } from 'electron';
import { getMainWindow } from './window.js';
import { runAgentLoop, AgentLoopResult } from './core/agent-loop.js';
import type { Message } from './core/types.js';
import { TOOL_DEFINITIONS, setGlobalPdfPath, setGlobalSessionDir, setGlobalSessionId, generateSessionId, resolveUserResponse, setConfiguredOutputsDir, setImageSettings } from './core/tools.js';
import * as os from 'os';
import { getPdfPageCount } from './core/pdf-extractor.js';
import Store from 'electron-store';
import * as fs from 'fs';
import * as path from 'path';

// Persistent store for API key and settings
const store = new Store({
  name: 'takeoff-ai-config',
  defaults: {
    apiKey: '',
    outputDirectory: '',  // Empty means use default (app userData/outputs)
    maxImageDimension: 1568,  // Max dimension for images sent to Claude (pixels)
    renderDpi: 150  // DPI for PDF rendering
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
  // Use configured directory if set, otherwise use default
  const configuredDir = store.get('outputDirectory') as string;
  if (configuredDir && configuredDir.length > 0 && fs.existsSync(configuredDir)) {
    return configuredDir;
  }
  return path.join(app.getPath('userData'), 'outputs');
}

// Export for use by tools.ts
export function getConfiguredOutputsDir(): string {
  return getOutputsDir();
}

// Track the current session directory and ID so follow-up messages reuse them
let currentSessionDir: string | null = null;
let currentSessionId: string | null = null;

// Store conversation history for follow-up messages
let conversationMessages: Message[] = [];
let currentSystemPrompt: string = '';

export function setupIPCHandlers() {
  console.log('⚙️  Setting up IPC handlers...');

  // Initialize configured output directory from stored settings
  const storedOutputDir = store.get('outputDirectory') as string;
  if (storedOutputDir && storedOutputDir.length > 0 && fs.existsSync(storedOutputDir)) {
    setConfiguredOutputsDir(storedOutputDir);
    console.log(`📁 Using configured output directory: ${storedOutputDir}`);
  }

  // Initialize image quality settings from stored settings
  const maxDim = store.get('maxImageDimension') as number || 1568;
  const dpi = store.get('renderDpi') as number || 150;
  setImageSettings(maxDim, dpi);
  console.log(`🖼️  Image quality: ${maxDim}px max, ${dpi} DPI`);

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
        currentSessionId = generateSessionId();
        currentSessionDir = path.join(os.tmpdir(), `takeoff-session-${currentSessionId}`);
        fs.mkdirSync(currentSessionDir, { recursive: true });
        console.log(`   New session: ${currentSessionId}`);
        console.log(`   Session directory: ${currentSessionDir}`);
      } else {
        console.log(`   Reusing session: ${currentSessionId}`);
      }
      const sessionDir = currentSessionDir;
      setGlobalSessionDir(sessionDir);
      setGlobalSessionId(currentSessionId!);

      // Build initial message with PDF context if provided
      let initialMessage = userMessage;
      const notesPath = path.join(sessionDir, 'working-notes.md');

      if (pdfPath && fs.existsSync(pdfPath)) {
        // Set global PDF path for tools
        setGlobalPdfPath(pdfPath);

        // Get page count
        const pageCount = await getPdfPageCount(pdfPath);
        console.log(`   Total pages: ${pageCount}`);

        // Session output directory
        const sessionOutputDir = path.join(getOutputsDir(), currentSessionId!);

        // Add PDF context to the message
        initialMessage = `I have a construction drawing PDF with ${pageCount} pages (${path.basename(pdfPath)}).

The user asks: "${userMessage}"

You can use the extract_pdf_pages([page_numbers]) tool to view specific pages (max 5 per call).

IMPORTANT - Working Notes:
To avoid losing your analysis when older images are removed from the conversation, you MUST maintain a working notes file. After analyzing each batch of images, use write_file to save your findings to: ${notesPath}
If you need to reference findings from earlier pages, use read_file to read your working notes instead of re-extracting pages you already analyzed.

IMPORTANT - Output Files:
Save final outputs (CSV, summary reports) using write_file with relative paths like "takeoff.csv" or "summary.txt".
Files will be saved to session directory: ${sessionOutputDir}`;
      }

      // Store system prompt for follow-up conversations
      currentSystemPrompt = systemPrompt;

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

      // Store conversation history for follow-up messages
      conversationMessages = result.messages;
      console.log(`   Conversation history: ${conversationMessages.length} messages stored`);

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
    currentSessionId = generateSessionId();
    currentSessionDir = path.join(os.tmpdir(), `takeoff-session-${currentSessionId}`);
    fs.mkdirSync(currentSessionDir, { recursive: true });
    setGlobalSessionDir(currentSessionDir);
    setGlobalSessionId(currentSessionId);
    // Clear conversation history for new session
    conversationMessages = [];
    currentSystemPrompt = '';
    console.log(`   New session created: ${currentSessionId}`);
    console.log(`   Session directory: ${currentSessionDir}`);
    return { sessionId: currentSessionId, sessionDir: currentSessionDir };
  });

  /**
   * Continue an existing conversation with a follow-up message
   * This preserves the conversation history and allows the user to ask
   * follow-up questions after the initial takeoff is complete.
   */
  ipcMain.handle('continue-conversation', async (_event, { userMessage }) => {
    console.log(`\n💬 Follow-up message: ${userMessage}`);

    // Check if we have an existing conversation
    if (conversationMessages.length === 0) {
      return {
        success: false,
        error: 'No active conversation to continue. Please start a new takeoff first.'
      };
    }

    if (!currentSystemPrompt) {
      return {
        success: false,
        error: 'System prompt not found. Please start a new takeoff first.'
      };
    }

    try {
      // Get API key from store
      const apiKey = store.get('apiKey') as string;
      if (!apiKey) {
        throw new Error('API key not set. Please configure your Anthropic API key.');
      }
      process.env.ANTHROPIC_API_KEY = apiKey;

      console.log(`   Continuing conversation with ${conversationMessages.length} existing messages`);

      // Run agent loop with existing conversation
      const result = await runAgentLoop(
        userMessage,
        [], // No images for follow-up
        currentSystemPrompt,
        TOOL_DEFINITIONS,
        (update) => {
          const mainWindow = getMainWindow();
          if (mainWindow) {
            mainWindow.webContents.send('agent-update', update);
          }
        },
        conversationMessages // Pass existing conversation
      );

      // Update stored conversation history
      conversationMessages = result.messages;
      console.log(`   Conversation now has ${conversationMessages.length} messages`);

      console.log('\n✅ Follow-up complete!');

      return {
        success: true,
        result: result.result,
        stats: result.stats
      };

    } catch (error) {
      console.error('\n❌ Follow-up failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
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
  // Settings
  // =============================================================================

  /**
   * Get configured output directory
   */
  ipcMain.handle('get-output-directory', async () => {
    return store.get('outputDirectory') as string || '';
  });

  /**
   * Set output directory
   */
  ipcMain.handle('set-output-directory', async (_event, directory: string) => {
    console.log(`📁 Setting output directory: ${directory}`);
    store.set('outputDirectory', directory);
    // Update the tools module with the new directory
    if (directory && directory.length > 0) {
      setConfiguredOutputsDir(directory);
    } else {
      setConfiguredOutputsDir('');  // Reset to default
    }
    return true;
  });

  /**
   * Browse for output directory
   */
  ipcMain.handle('browse-output-directory', async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      return null;
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Output Directory',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  /**
   * Get default output directory (for display)
   */
  ipcMain.handle('get-default-output-directory', async () => {
    return path.join(app.getPath('userData'), 'outputs');
  });

  /**
   * Get image quality settings
   */
  ipcMain.handle('get-image-settings', async () => {
    return {
      maxImageDimension: store.get('maxImageDimension') as number || 1568,
      renderDpi: store.get('renderDpi') as number || 150
    };
  });

  /**
   * Set image quality settings
   */
  ipcMain.handle('set-image-settings', async (_event, settings: { maxImageDimension: number; renderDpi: number }) => {
    console.log(`🖼️  Setting image quality: ${settings.maxImageDimension}px max, ${settings.renderDpi} DPI`);
    store.set('maxImageDimension', settings.maxImageDimension);
    store.set('renderDpi', settings.renderDpi);
    // Update the tools module with new settings
    setImageSettings(settings.maxImageDimension, settings.renderDpi);
    return true;
  });

  /**
   * Open current session's images folder (so user can see what Claude sees)
   */
  ipcMain.handle('open-session-images', async () => {
    if (!currentSessionDir) {
      throw new Error('No active session');
    }
    const imagesDir = path.join(currentSessionDir, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    await shell.openPath(imagesDir);
    return imagesDir;
  });

  /**
   * Get current session directory path
   */
  ipcMain.handle('get-session-dir', async () => {
    return currentSessionDir;
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
