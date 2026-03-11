// Tool implementations for TakeoffAI Electron
import { app, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { ToolDefinition, ToolExecutionResult, CropArea, NamedRegion, PDFTextData } from './types.js';
import { extractPdfPages, extractPdfRegion, resolveRegionToCrop, getPdfPageDimensions } from './pdf-extractor.js';

// Use Electron app paths instead of hardcoded paths
function getKnowledgeBasePath(): string {
  // In development, use resources/ next to src/
  // In production, use app.getAppPath()/resources/
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'knowledge-base');
  } else {
    return path.join(app.getAppPath(), 'resources', 'knowledge-base');
  }
}

// Configured output directory (set by IPC handler from user preferences)
let configuredOutputsDir: string = '';

export function setConfiguredOutputsDir(dir: string): void {
  configuredOutputsDir = dir;
}

// Image quality settings (configurable via settings panel)
let configuredMaxImageDimension: number = 1568;
let configuredRenderDpi: number = 150;

export function setImageSettings(maxDim: number, dpi: number): void {
  configuredMaxImageDimension = maxDim;
  configuredRenderDpi = dpi;
  console.log(`🖼️  Image settings updated: ${maxDim}px max, ${dpi} DPI`);
}

export function getImageSettings(): { maxImageDimension: number; renderDpi: number } {
  return {
    maxImageDimension: configuredMaxImageDimension,
    renderDpi: configuredRenderDpi
  };
}

function getOutputsDir(): string {
  // Use configured directory if set, otherwise use Electron userData directory
  if (configuredOutputsDir && configuredOutputsDir.length > 0) {
    return configuredOutputsDir;
  }
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'outputs');
}

// Store PDF path and session info globally (set by IPC handler)
let globalPdfPath: string = '';
let globalSessionDir: string = '';
let globalSessionId: string = '';

export function setGlobalPdfPath(pdfPath: string): void {
  globalPdfPath = pdfPath;
}

export function setGlobalSessionDir(sessionDir: string): void {
  globalSessionDir = sessionDir;
}

export function getGlobalSessionDir(): string {
  return globalSessionDir;
}

export function setGlobalSessionId(sessionId: string): void {
  globalSessionId = sessionId;
}

export function getGlobalSessionId(): string {
  return globalSessionId;
}

// Allowed pages for counting agents (null = no restriction, all pages accessible)
// Set by orchestrator before each counting agent runs; cleared after it finishes.
let allowedPages: number[] | null = null;

export function setAllowedPages(pages: number[] | null): void {
  allowedPages = pages;
  if (pages) {
    console.log(`   🔒 Page restriction active: only pages [${pages.join(', ')}] accessible`);
  } else {
    console.log(`   🔓 Page restriction cleared: all pages accessible`);
  }
}

export function getAllowedPages(): number[] | null {
  return allowedPages;
}

/**
 * Filter requested pages against allowedPages.
 * Returns { allowed, blocked } arrays.
 * If allowedPages is null, all pages are allowed.
 */
function filterPages(requestedPages: number[]): { allowed: number[]; blocked: number[] } {
  if (!allowedPages) {
    return { allowed: requestedPages, blocked: [] };
  }
  const allowed = requestedPages.filter(p => allowedPages!.includes(p));
  const blocked = requestedPages.filter(p => !allowedPages!.includes(p));
  return { allowed, blocked };
}

// Store PDF text extraction data globally (set after extraction in IPC handler)
let globalTextData: PDFTextData | null = null;

export function setGlobalTextData(textData: PDFTextData): void {
  globalTextData = textData;
}

export function getGlobalTextData(): PDFTextData | null {
  return globalTextData;
}

/**
 * Generate a timestamp-based session ID
 * Format: YYYY-MM-DD-HHmmss
 */
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

/**
 * Get the session-specific output directory
 * Creates it if it doesn't exist
 */
function getSessionOutputDir(): string {
  const baseOutputsDir = getOutputsDir();
  const sessionId = globalSessionId || 'default';
  const sessionOutputDir = path.join(baseOutputsDir, sessionId);

  if (!fs.existsSync(sessionOutputDir)) {
    fs.mkdirSync(sessionOutputDir, { recursive: true });
  }

  return sessionOutputDir;
}

/**
 * Tool definitions for Claude API
 */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'read_skill',
    description: 'Load a specialized skill. NOTE: The ConstructionTakeoff skill is already included in your system prompt — do not call this tool to load it again. This tool is only needed if additional skills become available in the future.',
    input_schema: {
      type: 'object',
      properties: {
        skill_name: {
          type: 'string',
          enum: ['ConstructionTakeoff'],
          description: 'The name of the skill to load'
        }
      },
      required: ['skill_name']
    }
  },
  {
    name: 'read_documentation',
    description: 'Read a workflow or reference document from the knowledge base. Use this to load detailed step-by-step procedures before starting a task. The ConstructionTakeoff skill in your system prompt tells you which workflow file to load based on the user\'s request.',
    input_schema: {
      type: 'object',
      properties: {
        doc_path: {
          type: 'string',
          description: 'Path to the documentation file relative to knowledge-base/ (e.g., "workflows/QuantityTakeoff.md")'
        }
      },
      required: ['doc_path']
    }
  },
  {
    name: 'list_available_skills',
    description: 'List all available skills in the knowledge base.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'write_file',
    description: 'Write content to a file. Use this to save CSV takeoff results or coordination reports.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The file path where the file should be written (relative paths will go to outputs/ directory)'
        },
        content: {
          type: 'string',
          description: 'The content to write to the file'
        }
      },
      required: ['file_path', 'content']
    }
  },
  {
    name: 'read_file',
    description: 'Read content from a file.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The absolute file path to read'
        }
      },
      required: ['file_path']
    }
  },
  {
    name: 'list_directory',
    description: 'List contents of a directory.',
    input_schema: {
      type: 'object',
      properties: {
        directory_path: {
          type: 'string',
          description: 'The absolute directory path to list'
        }
      },
      required: ['directory_path']
    }
  },
  {
    name: 'ask_user',
    description: 'Ask the user a clarifying question and wait for their response.',
    input_schema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask the user'
        },
        context: {
          type: 'string',
          description: 'Additional context about why you need this information'
        }
      },
      required: ['question']
    }
  },
  {
    name: 'extract_pdf_pages',
    description: 'Extract specific pages from the PDF as images. IMPORTANT: Request a maximum of 5 pages per call to avoid exceeding API size limits. If you need more pages, make multiple calls. Document your findings from each batch before requesting the next.',
    input_schema: {
      type: 'object',
      properties: {
        page_numbers: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of page numbers to extract (1-indexed). Maximum 5 pages per call.'
        }
      },
      required: ['page_numbers']
    }
  },
  {
    name: 'extract_pdf_region',
    description: 'Extract a cropped region of a PDF page at higher resolution for detailed reading. Use this after viewing the full page overview (via extract_pdf_pages) when you need to read small text, dimensions, or count individual elements like treads. You can specify either a named region OR exact pixel coordinates. **For counting tasks (treads, risers, items), use pixel coordinates to zoom into exactly the area you need** — this gives you surgical precision to target a single stair flight or detail area. Named regions (quadrants/halves) are convenient for general exploration but pixel coordinates let you zoom tighter.',
    input_schema: {
      type: 'object',
      properties: {
        page_number: {
          type: 'number',
          description: 'The page number to crop from (1-indexed)'
        },
        region: {
          type: 'string',
          enum: [
            'top-left', 'top-right', 'bottom-left', 'bottom-right',
            'top-half', 'bottom-half', 'left-half', 'right-half',
            'center'
          ],
          description: 'Named region to extract. Quadrants are 50% width x 50% height. Halves are 100% x 50% or 50% x 100%. Center is middle 50% x 50%. Good for general exploration, but use pixel coordinates when you need tighter zoom.'
        },
        crop: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X coordinate of crop origin (pixels, from top-left of the overview image)' },
            y: { type: 'number', description: 'Y coordinate of crop origin (pixels, from top-left of the overview image)' },
            width: { type: 'number', description: 'Width of crop area in pixels (in overview image coordinates)' },
            height: { type: 'number', description: 'Height of crop area in pixels (in overview image coordinates)' }
          },
          required: ['x', 'y', 'width', 'height'],
          description: 'Exact pixel coordinates for the crop area, relative to the overview image you received from extract_pdf_pages. **USE THIS for counting tasks** — target exactly the stair flight, detail, or text you need. The image dimensions are returned with extract_pdf_pages results. Coordinates are automatically scaled to full resolution internally. Example: If the overview image is 1045x1568 and the stair flight is in the middle-left area, request a crop like {x: 50, y: 500, width: 400, height: 400}.'
        }
      },
      required: ['page_number']
    }
  },
  {
    name: 'get_page_text',
    description: 'Get extracted text from specific PDF pages. Two formats available: "rows" (default) groups text by Y-coordinate into spatial rows with "|" separators — best for counting annotations like "14 EQ RSRS". "compact" returns zone summaries (title-block, quadrants) — best for discovery/reading sheet titles and specs, uses far fewer tokens. Always use BEFORE extracting images — zero image token cost.',
    input_schema: {
      type: 'object',
      properties: {
        page_numbers: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of page numbers to get text from (1-indexed)'
        },
        format: {
          type: 'string',
          enum: ['rows', 'compact'],
          description: 'Output format. "rows" = spatial rows with | separators (best for counting). "compact" = zone summaries (best for discovery, much smaller). Default: "rows"'
        }
      },
      required: ['page_numbers']
    }
  },
  {
    name: 'search_pdf_text',
    description: 'Search for a term across PDF pages. Returns page numbers and context snippets. Case-insensitive. Use to find specific values (e.g., "MC12", "18R", "STAIR"). Optionally limit search to specific pages to reduce cost.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search term (case-insensitive)'
        },
        pages: {
          type: 'array',
          items: { type: 'number' },
          description: 'Optional: limit search to these page numbers. If omitted, searches all pages.'
        }
      },
      required: ['query']
    }
  }
];

/**
 * Execute a tool and return the result
 */
export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  toolUseId: string
): Promise<ToolExecutionResult> {

  console.log(`🔧 Tool called: ${toolName}(${JSON.stringify(toolInput)})`);

  try {
    let result: string | any[]; // Support both string and array

    switch (toolName) {
      case 'read_skill':
        result = await readSkill(toolInput.skill_name as string);
        break;

      case 'read_documentation':
        result = await readDocumentation(toolInput.doc_path as string);
        break;

      case 'list_available_skills':
        result = await listAvailableSkills();
        break;

      case 'write_file':
        result = await writeFile(
          toolInput.file_path as string,
          toolInput.content as string
        );
        break;

      case 'read_file':
        result = await readFile(toolInput.file_path as string);
        break;

      case 'list_directory':
        result = await listDirectory(toolInput.directory_path as string);
        break;

      case 'ask_user':
        result = await askUser(
          toolInput.question as string,
          toolInput.context as string | undefined
        );
        break;

      case 'extract_pdf_pages': {
        // Filter pages against allowed list (counting agents are restricted)
        const reqPages = toolInput.page_numbers as number[];
        const { allowed: allowedExtract, blocked: blockedExtract } = filterPages(reqPages);
        if (allowedExtract.length === 0) {
          result = `Page restriction: pages [${blockedExtract.join(', ')}] are not assigned to this stair. You can only access your assigned pages.`;
        } else {
          if (blockedExtract.length > 0) {
            console.log(`   🔒 Blocked pages [${blockedExtract.join(', ')}] — not assigned to this stair`);
          }
          result = await extractPdfPagesForClaude(allowedExtract);
          if (blockedExtract.length > 0) {
            // Append warning to the result if it's a string
            const warning = `\n\nNote: Pages [${blockedExtract.join(', ')}] were skipped — they are not assigned to this stair and contain a different stair's data.`;
            if (typeof result === 'string') {
              result = result + warning;
            } else if (Array.isArray(result)) {
              result.push({ type: 'text', text: warning });
            }
          }
        }
        break;
      }

      case 'extract_pdf_region': {
        // Check if the requested page is allowed
        const regionPage = toolInput.page_number as number;
        const { blocked: blockedRegion } = filterPages([regionPage]);
        if (blockedRegion.length > 0) {
          result = `Page restriction: page ${regionPage} is not assigned to this stair. You can only access your assigned pages.`;
        } else {
          result = await extractPdfRegionForClaude(
            regionPage,
            toolInput.region as NamedRegion | undefined,
            toolInput.crop as CropArea | undefined
          );
        }
        break;
      }

      case 'get_page_text': {
        // Filter pages against allowed list
        const textPages = toolInput.page_numbers as number[];
        const { allowed: allowedText, blocked: blockedText } = filterPages(textPages);
        if (allowedText.length === 0) {
          result = `Page restriction: pages [${blockedText.join(', ')}] are not assigned to this stair. You can only access your assigned pages.`;
        } else {
          result = await getPageText(allowedText, (toolInput.format as string) || 'rows');
          if (blockedText.length > 0) {
            result = result + `\n\nNote: Pages [${blockedText.join(', ')}] were skipped — they are not assigned to this stair.`;
          }
        }
        break;
      }

      case 'search_pdf_text': {
        // If page restriction is active, force search to only allowed pages
        const searchPages = allowedPages
          ? (toolInput.pages as number[] | undefined)
            ? (toolInput.pages as number[]).filter(p => allowedPages!.includes(p))
            : allowedPages
          : (toolInput.pages as number[] | undefined);
        result = await searchPdfText(toolInput.query as string, searchPages);
        break;
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }

    console.log(`   ✅ Tool completed successfully\n`);

    return {
      tool_use_id: toolUseId,
      content: result // Can be string or array of content blocks
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Tool failed: ${errorMessage}\n`);

    return {
      tool_use_id: toolUseId,
      content: `Error: ${errorMessage}`,
      is_error: true
    };
  }
}

/**
 * Read a skill from the knowledge base
 */
async function readSkill(skillName: string): Promise<string> {
  const knowledgeBase = getKnowledgeBasePath();
  const skillPath = path.join(knowledgeBase, 'skills', `${skillName}.md`);

  if (!fs.existsSync(skillPath)) {
    throw new Error(`Skill not found: ${skillName}`);
  }

  const content = fs.readFileSync(skillPath, 'utf-8');
  return `Skill loaded: ${skillName}\n\n${content}`;
}

/**
 * Validate that a resolved path is within an allowed directory.
 * Resolves symlinks to prevent escaping via symlink attacks.
 */
function validatePathWithin(resolvedPath: string, allowedDir: string): void {
  // Normalize both paths to resolve .. and symlinks
  const normalizedPath = path.resolve(resolvedPath);
  const normalizedDir = path.resolve(allowedDir);

  if (!normalizedPath.startsWith(normalizedDir + path.sep) && normalizedPath !== normalizedDir) {
    throw new Error(`Access denied — path outside allowed directory`);
  }
}

/**
 * Read documentation from the knowledge base
 */
async function readDocumentation(docPath: string): Promise<string> {
  const knowledgeBase = getKnowledgeBasePath();

  // Prevent path traversal (../ escaping the knowledge base)
  const normalized = path.normalize(docPath);
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
    throw new Error('Access denied — path traversal not allowed');
  }

  const fullPath = path.join(knowledgeBase, normalized);
  validatePathWithin(fullPath, knowledgeBase);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Documentation not found: ${docPath}`);
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  return content;
}

/**
 * List available skills
 */
async function listAvailableSkills(): Promise<string> {
  const knowledgeBase = getKnowledgeBasePath();
  const skillsDir = path.join(knowledgeBase, 'skills');

  if (!fs.existsSync(skillsDir)) {
    return 'No skills directory found';
  }

  const files = fs.readdirSync(skillsDir);
  const skills = files.filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));

  return `Available skills:\n${skills.map(s => `- ${s}`).join('\n')}`;
}

/**
 * Write a file to the filesystem
 * ELECTRON ADAPTATION: Use session-specific directory under userData/outputs/
 */
async function writeFile(filePath: string, content: string): Promise<string> {
  let resolvedPath: string;
  const outputsDir = getOutputsDir();
  const sessionDir = globalSessionDir;

  if (path.isAbsolute(filePath)) {
    // Absolute paths must be within allowed directories (using path.resolve to prevent symlink escapes)
    resolvedPath = path.resolve(filePath);
    const inOutputs = outputsDir && resolvedPath.startsWith(path.resolve(outputsDir));
    const inSession = sessionDir && resolvedPath.startsWith(path.resolve(sessionDir));

    if (!inOutputs && !inSession) {
      throw new Error(`Access denied — can only write files within outputs or session directory`);
    }
  } else {
    // For relative paths, use session-specific output directory
    const sessionOutputDir = getSessionOutputDir();

    // Strip "outputs/" prefix if present (Claude sometimes includes it)
    const cleanPath = filePath.replace(/^outputs[/\\]/, '');
    resolvedPath = path.join(sessionOutputDir, cleanPath);

    // Verify resolved path didn't escape via ../
    validatePathWithin(resolvedPath, sessionOutputDir);
  }

  // Ensure parent directory exists
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(resolvedPath, content, 'utf-8');
  console.log(`   📁 Output saved: ${resolvedPath}`);
  return `File written successfully to: ${resolvedPath}`;
}

/**
 * Read a file from the filesystem.
 * SECURITY: Only allows reads within the outputs dir or session temp dir.
 */
async function readFile(filePath: string): Promise<string> {
  let resolvedPath: string;
  const outputsDir = getOutputsDir();
  const sessionDir = globalSessionDir;

  if (path.isAbsolute(filePath)) {
    // Absolute paths must be within allowed directories
    resolvedPath = path.resolve(filePath);
    const inOutputs = outputsDir && resolvedPath.startsWith(path.resolve(outputsDir));
    const inSession = sessionDir && resolvedPath.startsWith(path.resolve(sessionDir));

    if (!inOutputs && !inSession) {
      throw new Error(`Access denied — can only read files within outputs or session directory`);
    }
  } else {
    // Relative paths: resolve to session output directory
    const cleanPath = filePath.replace(/^outputs[/\\]/, '');
    resolvedPath = path.join(getSessionOutputDir(), cleanPath);

    // Verify resolved path didn't escape via ../
    validatePathWithin(resolvedPath, getSessionOutputDir());
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  return content;
}

/**
 * List directory contents.
 * SECURITY: Only allows listing within the outputs dir or session temp dir.
 */
async function listDirectory(directoryPath: string): Promise<string> {
  let resolvedPath: string;
  const outputsDir = getOutputsDir();
  const sessionDir = globalSessionDir;

  // Resolve "outputs" shorthand to session-specific output directory
  if (directoryPath === 'outputs' || directoryPath === 'outputs/') {
    resolvedPath = getSessionOutputDir();
  } else if (path.isAbsolute(directoryPath)) {
    resolvedPath = path.resolve(directoryPath);
    const inOutputs = outputsDir && resolvedPath.startsWith(path.resolve(outputsDir));
    const inSession = sessionDir && resolvedPath.startsWith(path.resolve(sessionDir));

    if (!inOutputs && !inSession) {
      throw new Error(`Access denied — can only list outputs or session directory`);
    }
  } else {
    // Relative paths resolve to session output dir
    resolvedPath = path.join(getSessionOutputDir(), directoryPath);
    validatePathWithin(resolvedPath, getSessionOutputDir());
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Directory not found: ${directoryPath}`);
  }

  const files = fs.readdirSync(resolvedPath);
  return `Contents of ${resolvedPath}:\n${files.join('\n')}`;
}

/**
 * Ask the user a question via Electron dialog
 * ELECTRON ADAPTATION: Replace readline with Electron dialog
 */
// Store for pending user questions
let pendingUserResponse: {
  resolve: (response: string) => void;
  reject: (error: Error) => void;
} | null = null;

export function resolveUserResponse(response: string) {
  if (pendingUserResponse) {
    pendingUserResponse.resolve(response);
    pendingUserResponse = null;
  }
}

async function askUser(question: string, context?: string): Promise<string> {
  console.log('\n❓ Claude is asking you a question:\n');

  if (context) {
    console.log(`Context: ${context}\n`);
  }

  console.log(`Question: ${question}\n`);

  const allWindows = BrowserWindow.getAllWindows();
  console.log(`   🪟 Found ${allWindows.length} windows`);

  const mainWindow = BrowserWindow.getFocusedWindow() || allWindows[0];

  if (!mainWindow) {
    console.error('   ❌ No active window to show dialog');
    throw new Error('No active window to show dialog');
  }

  console.log(`   📤 Sending agent-question to renderer...`);

  // Send question to renderer via IPC
  mainWindow.webContents.send('agent-question', {
    question,
    context: context || ''
  });

  console.log(`   ✅ Question sent to renderer`);

  // Wait for user's response (no timeout - wait indefinitely)
  return new Promise<string>((resolve, reject) => {
    pendingUserResponse = { resolve, reject };
  });
}

/**
 * Extract PDF pages and return them as images in tool result format
 * This allows Claude to request pages incrementally as needed
 *
 * Capped at MAX_PAGES_PER_BATCH to avoid 413 request_too_large errors.
 * If more pages are requested, only the first batch is returned with
 * a message telling Claude to request the remaining pages.
 */
const MAX_PAGES_PER_BATCH = 5;

async function extractPdfPagesForClaude(pageNumbers: number[]): Promise<any> {
  if (!globalPdfPath) {
    throw new Error('PDF path not set - cannot extract pages');
  }

  const { maxImageDimension, renderDpi } = getImageSettings();

  // Enforce per-call page limit to stay under API request size limits
  const pagesToExtract = pageNumbers.slice(0, MAX_PAGES_PER_BATCH);
  const remainingPages = pageNumbers.slice(MAX_PAGES_PER_BATCH);

  console.log(`   📄 Extracting ${pagesToExtract.length} pages at ${renderDpi} DPI (max ${maxImageDimension}px)...`);
  if (remainingPages.length > 0) {
    console.log(`   ⚠️  ${remainingPages.length} additional pages deferred (max ${MAX_PAGES_PER_BATCH} per call)`);
  }

  const extractedImages = await extractPdfPages(globalPdfPath, pagesToExtract, renderDpi, maxImageDimension);

  // Compute actual delivered image dimensions for each page
  // Claude needs these to provide accurate crop coordinates
  const pageDimensions: Array<{ pageNumber: number; renderWidth: number; renderHeight: number; imageWidth: number; imageHeight: number }> = [];
  for (const img of extractedImages) {
    const dims = await getPdfPageDimensions(globalPdfPath, img.pageNumber, renderDpi);
    const renderW = dims.pageWidth;
    const renderH = dims.pageHeight;
    // Compute the same downscale that extractPdfPages applies
    let imageW = renderW;
    let imageH = renderH;
    if (renderW > maxImageDimension || renderH > maxImageDimension) {
      const scaleFactor = Math.min(maxImageDimension / renderW, maxImageDimension / renderH);
      imageW = Math.round(renderW * scaleFactor);
      imageH = Math.round(renderH * scaleFactor);
    }
    pageDimensions.push({ pageNumber: img.pageNumber, renderWidth: renderW, renderHeight: renderH, imageWidth: imageW, imageHeight: imageH });
  }

  // Save images to session temp directory so user can view them
  if (globalSessionDir) {
    const imagesDir = path.join(globalSessionDir, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    for (const img of extractedImages) {
      const imgPath = path.join(imagesDir, `page-${img.pageNumber}.jpg`);
      fs.writeFileSync(imgPath, Buffer.from(img.base64Data, 'base64'));
    }
    console.log(`   💾 Saved images to ${imagesDir}`);
  }

  // Build status message with image dimensions
  const notesPath = globalSessionDir ? path.join(globalSessionDir, 'working-notes.md') : null;
  let statusText = `Successfully extracted ${pagesToExtract.length} pages: ${pagesToExtract.join(', ')}`;

  // Include image dimensions so Claude knows the coordinate space
  statusText += '\n\nPage dimensions (use these for crop coordinates):';
  for (const dim of pageDimensions) {
    statusText += `\n  Page ${dim.pageNumber}: ${dim.imageWidth} x ${dim.imageHeight} pixels`;
  }
  statusText += '\n\nWhen using extract_pdf_region with crop coordinates, specify x/y/width/height relative to the image dimensions above.';

  statusText += `\nImages saved to: ${globalSessionDir ? path.join(globalSessionDir, 'images') : 'N/A'}`;

  if (remainingPages.length > 0) {
    statusText += `\n\nNOTE: ${remainingPages.length} additional pages were requested but not included to stay within API size limits. Document your findings from these pages to your working notes file first, then call extract_pdf_pages again with the remaining pages: [${remainingPages.join(', ')}]`;
  }

  statusText += `\n\nREMINDER: After analyzing these images, write your findings to your working notes file at: ${notesPath}`;

  // Return tool result with both text AND images
  const content: any[] = [
    { type: 'text', text: statusText }
  ];

  // Add each image
  for (const img of extractedImages) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mimeType,
        data: img.base64Data
      }
    });
  }

  console.log(`   ✅ Returning ${extractedImages.length} images to Claude`);

  return content;
}

/**
 * Extract a cropped region of a PDF page for detailed reading
 * Returns a single higher-resolution image of the specified area
 */
async function extractPdfRegionForClaude(
  pageNumber: number,
  region?: NamedRegion,
  crop?: CropArea
): Promise<any> {
  if (!globalPdfPath) {
    throw new Error('PDF path not set - cannot extract region');
  }

  if (!region && !crop) {
    throw new Error('Either "region" (named region like "top-left") or "crop" (pixel coordinates {x, y, width, height}) must be provided.');
  }

  const { maxImageDimension, renderDpi } = getImageSettings();

  // Get page dimensions for region resolution
  const { pageWidth, pageHeight } = await getPdfPageDimensions(globalPdfPath, pageNumber, renderDpi);

  // Resolve crop area
  let cropArea: CropArea;
  let regionLabel: string;

  if (region) {
    cropArea = resolveRegionToCrop(region, pageWidth, pageHeight);
    regionLabel = region;
  } else {
    // Scale coordinates from overview image space to render (150 DPI) space.
    // Claude sees a downscaled overview image. Its crop coordinates reference
    // that smaller image, but we need to crop from the full-resolution render.
    let overviewScaleFactor = 1.0;
    if (pageWidth > maxImageDimension || pageHeight > maxImageDimension) {
      overviewScaleFactor = Math.min(maxImageDimension / pageWidth, maxImageDimension / pageHeight);
    }
    const coordScale = 1 / overviewScaleFactor;

    const scaledX = Math.max(0, Math.round(crop!.x * coordScale));
    const scaledY = Math.max(0, Math.round(crop!.y * coordScale));
    const scaledW = Math.round(crop!.width * coordScale);
    const scaledH = Math.round(crop!.height * coordScale);

    if (coordScale > 1.01) {
      console.log(`   📐 Scaling crop coordinates: overview→render factor=${coordScale.toFixed(2)}x (${crop!.x},${crop!.y} ${crop!.width}x${crop!.height} → ${scaledX},${scaledY} ${scaledW}x${scaledH})`);
    }

    cropArea = {
      x: scaledX,
      y: scaledY,
      width: scaledW,
      height: scaledH
    };
    // Clamp to page bounds
    if (cropArea.x + cropArea.width > pageWidth) {
      cropArea.width = pageWidth - cropArea.x;
    }
    if (cropArea.y + cropArea.height > pageHeight) {
      cropArea.height = pageHeight - cropArea.y;
    }
    regionLabel = `crop-${cropArea.x}-${cropArea.y}-${cropArea.width}x${cropArea.height}`;
  }

  console.log(`   🔍 Extracting ${regionLabel} from page ${pageNumber} (${pageWidth}x${pageHeight} at ${renderDpi} DPI, max ${maxImageDimension}px)...`);

  const result = await extractPdfRegion(globalPdfPath, pageNumber, cropArea, renderDpi, maxImageDimension);

  // Save crop image to session directory
  if (globalSessionDir) {
    const imagesDir = path.join(globalSessionDir, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    const imgPath = path.join(imagesDir, `page-${pageNumber}-${regionLabel}.jpg`);
    fs.writeFileSync(imgPath, Buffer.from(result.base64Data, 'base64'));
    console.log(`   💾 Saved crop to ${imgPath}`);
  }

  // Build response with metadata
  // Compute the overview image dimensions for reference
  let overviewWidth = pageWidth;
  let overviewHeight = pageHeight;
  if (pageWidth > maxImageDimension || pageHeight > maxImageDimension) {
    const sf = Math.min(maxImageDimension / pageWidth, maxImageDimension / pageHeight);
    overviewWidth = Math.round(pageWidth * sf);
    overviewHeight = Math.round(pageHeight * sf);
  }

  const notesPath = globalSessionDir ? path.join(globalSessionDir, 'working-notes.md') : null;
  let statusText = `Extracted ${region ? `"${region}" region` : 'custom crop'} of page ${pageNumber}.`;
  statusText += `\nOverview image dimensions: ${overviewWidth}x${overviewHeight} pixels (use these for crop coordinates).`;
  statusText += `\nCrop area (in overview space): x=${crop ? crop.x : cropArea.x}, y=${crop ? crop.y : cropArea.y}, width=${crop ? crop.width : cropArea.width}, height=${crop ? crop.height : cropArea.height}`;
  statusText += `\n\nThis crop has ~${Math.round(pageWidth / cropArea.width)}x higher effective resolution than the full-page overview.`;
  statusText += `\n\nREMINDER: After reading details from this crop, update your working notes at: ${notesPath}`;

  const content: any[] = [
    { type: 'text', text: statusText },
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: result.mimeType,
        data: result.base64Data
      }
    }
  ];

  console.log(`   ✅ Returning crop image to Claude`);

  return content;
}

/**
 * Get extracted text for specific PDF pages
 * Returns zone-grouped text data (no image tokens consumed)
 */
/**
 * Group text items into spatial rows based on Y-coordinate proximity.
 * Items within yTolerance pixels of each other are grouped into the same row.
 * Within each row, items are sorted left-to-right by X coordinate.
 */
function groupIntoRows(items: Array<{ text: string; x: number; y: number; fontSize: number }>, yTolerance: number = 3): Array<{ y: number; items: Array<{ text: string; x: number }> }> {
  if (items.length === 0) return [];

  // Sort by Y (top to bottom), then X (left to right)
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);

  const rows: Array<{ y: number; items: Array<{ text: string; x: number }> }> = [];
  let currentRow: { y: number; items: Array<{ text: string; x: number }> } = {
    y: sorted[0].y,
    items: [{ text: sorted[0].text, x: sorted[0].x }]
  };

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentRow.y) <= yTolerance) {
      // Same row
      currentRow.items.push({ text: item.text, x: item.x });
    } else {
      // New row — sort current row by X before saving
      currentRow.items.sort((a, b) => a.x - b.x);
      rows.push(currentRow);
      currentRow = { y: item.y, items: [{ text: item.text, x: item.x }] };
    }
  }
  // Don't forget last row
  currentRow.items.sort((a, b) => a.x - b.x);
  rows.push(currentRow);

  return rows;
}

async function getPageText(pageNumbers: number[], format: string = 'rows'): Promise<string> {
  if (!globalTextData) {
    throw new Error('No text data available. Text extraction may not have run for this PDF.');
  }

  if (globalTextData.isEmpty) {
    return 'WARNING: This PDF appears to be scanned — text extraction returned very little text. Use image-based workflow (extract_pdf_pages / extract_pdf_region) instead.';
  }

  const results: string[] = [];

  for (const pageNum of pageNumbers) {
    const pageData = globalTextData.pages.find(p => p.pageNumber === pageNum);
    if (!pageData) {
      results.push(`Page ${pageNum}: Not found in text data (PDF has ${globalTextData.pageCount} pages)`);
      continue;
    }

    if (pageData.textItemCount === 0) {
      results.push(`Page ${pageNum}: No text content (may be a graphic-only page or scanned)`);
      continue;
    }

    let pageResult = `=== Page ${pageNum} (${pageData.textItemCount} text items) ===\n`;

    if (format === 'compact') {
      // Compact format: zone summaries only (much smaller, good for discovery)
      for (const zone of pageData.zones) {
        pageResult += `\n[${zone.zone}]\n${zone.text}\n`;
      }
    } else {
      // Rows format: spatial rows with | separators (detailed, good for counting)
      const rows = groupIntoRows(pageData.textItems);
      pageResult += `\n[spatial-rows] (${rows.length} rows, top-to-bottom)\n`;
      for (const row of rows) {
        const rowText = row.items.map(i => i.text).join(' | ');
        pageResult += `  ROW y=${Math.round(row.y)}: ${rowText}\n`;
      }
    }

    // Always include full text for keyword scanning
    pageResult += `\n[full-text]\n${pageData.fullText}\n`;

    results.push(pageResult);
  }

  return results.join('\n\n');
}

/**
 * Search for a term across all PDF pages
 * Returns page numbers and context snippets
 */
async function searchPdfText(query: string, pages?: number[]): Promise<string> {
  if (!globalTextData) {
    throw new Error('No text data available. Text extraction may not have run for this PDF.');
  }

  if (globalTextData.isEmpty) {
    return 'WARNING: This PDF appears to be scanned — text search returned no results. Use image-based workflow instead.';
  }

  const queryLower = query.toLowerCase();
  const matches: Array<{ pageNumber: number; snippets: string[] }> = [];

  // Filter to specific pages if provided, otherwise search all
  const pagesToSearch = pages
    ? globalTextData.pages.filter(p => pages.includes(p.pageNumber))
    : globalTextData.pages;

  for (const page of pagesToSearch) {
    if (page.fullText.toLowerCase().includes(queryLower)) {
      // Extract context snippets around each match
      const snippets: string[] = [];
      const text = page.fullText;
      const textLower = text.toLowerCase();
      let searchStart = 0;

      while (searchStart < textLower.length) {
        const idx = textLower.indexOf(queryLower, searchStart);
        if (idx === -1) break;

        // Get ~60 chars of context on each side
        const snippetStart = Math.max(0, idx - 60);
        const snippetEnd = Math.min(text.length, idx + query.length + 60);
        const prefix = snippetStart > 0 ? '...' : '';
        const suffix = snippetEnd < text.length ? '...' : '';
        snippets.push(`${prefix}${text.slice(snippetStart, snippetEnd)}${suffix}`);

        searchStart = idx + query.length;

        // Limit snippets per page
        if (snippets.length >= 5) break;
      }

      matches.push({ pageNumber: page.pageNumber, snippets });
    }
  }

  const searchScope = pages ? `${pages.length} specified pages` : `all ${globalTextData.pageCount} pages`;
  if (matches.length === 0) {
    return `No matches found for "${query}" across ${searchScope}.`;
  }

  let result = `Found "${query}" on ${matches.length} page(s) (searched ${searchScope}):\n\n`;
  for (const match of matches) {
    result += `Page ${match.pageNumber}:\n`;
    for (const snippet of match.snippets) {
      result += `  • ${snippet}\n`;
    }
    result += '\n';
  }

  return result;
}
