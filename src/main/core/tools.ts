// Tool implementations for TakeoffAI Electron
import { app, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { ToolDefinition, ToolExecutionResult, CropArea, NamedRegion } from './types.js';
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
            x: { type: 'number', description: 'X coordinate of crop origin (pixels at 150 DPI, from top-left)' },
            y: { type: 'number', description: 'Y coordinate of crop origin (pixels at 150 DPI, from top-left)' },
            width: { type: 'number', description: 'Width of crop area in pixels at 150 DPI' },
            height: { type: 'number', description: 'Height of crop area in pixels at 150 DPI' }
          },
          required: ['x', 'y', 'width', 'height'],
          description: 'Exact pixel coordinates for the crop area. **USE THIS for counting tasks** — target exactly the stair flight, detail, or text you need. Coordinates are relative to the page rendered at 150 DPI. Page dimensions are returned in extract_pdf_pages and extract_pdf_region responses. Example: To zoom into a single stair flight, estimate its position from the overview and request a tight crop like {x: 200, y: 400, width: 400, height: 600}.'
        }
      },
      required: ['page_number']
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

      case 'extract_pdf_pages':
        // This returns an array of content blocks (text + images)
        result = await extractPdfPagesForClaude(toolInput.page_numbers as number[]);
        break;

      case 'extract_pdf_region':
        result = await extractPdfRegionForClaude(
          toolInput.page_number as number,
          toolInput.region as NamedRegion | undefined,
          toolInput.crop as CropArea | undefined
        );
        break;

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
 * Read documentation from the knowledge base
 */
async function readDocumentation(docPath: string): Promise<string> {
  const knowledgeBase = getKnowledgeBasePath();
  const fullPath = path.join(knowledgeBase, docPath);

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

  if (path.isAbsolute(filePath)) {
    // For absolute paths, validate they're within allowed directories
    const outputsDir = getOutputsDir();
    const sessionDir = globalSessionDir;

    // Allow writes to outputs directory or session temp directory
    if (!filePath.startsWith(outputsDir) && !filePath.startsWith(sessionDir)) {
      throw new Error(`Cannot write to path outside of outputs or session directory: ${filePath}`);
    }
    resolvedPath = filePath;
  } else {
    // For relative paths, use session-specific output directory
    const sessionOutputDir = getSessionOutputDir();

    // Strip "outputs/" prefix if present (Claude sometimes includes it)
    const cleanPath = filePath.replace(/^outputs[/\\]/, '');
    resolvedPath = path.join(sessionOutputDir, cleanPath);
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
 * Read a file from the filesystem
 */
async function readFile(filePath: string): Promise<string> {
  let resolvedPath = filePath;

  if (!path.isAbsolute(filePath)) {
    // For relative paths starting with outputs/, use session output directory
    if (filePath.startsWith('outputs/') || filePath.startsWith('outputs\\')) {
      const cleanPath = filePath.replace(/^outputs[/\\]/, '');
      resolvedPath = path.join(getSessionOutputDir(), cleanPath);
    }
    // Otherwise, path is relative to session temp dir (for working-notes.md etc.)
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  return content;
}

/**
 * List directory contents
 */
async function listDirectory(directoryPath: string): Promise<string> {
  let resolvedPath = directoryPath;

  // Resolve "outputs" to session-specific output directory
  if (directoryPath === 'outputs' || directoryPath === 'outputs/') {
    resolvedPath = getSessionOutputDir();
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Directory not found: ${directoryPath}`);
  }

  const files = fs.readdirSync(resolvedPath);
  const fullPath = resolvedPath;
  return `Contents of ${fullPath}:\n${files.join('\n')}`;
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

  const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];

  if (!mainWindow) {
    throw new Error('No active window to show dialog');
  }

  // Send question to renderer via IPC
  mainWindow.webContents.send('agent-question', {
    question,
    context: context || ''
  });

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

  // Build status message
  const notesPath = globalSessionDir ? path.join(globalSessionDir, 'working-notes.md') : null;
  let statusText = `Successfully extracted ${pagesToExtract.length} pages: ${pagesToExtract.join(', ')}`;
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
    // Clamp user-provided coordinates to page bounds
    cropArea = {
      x: Math.max(0, Math.round(crop!.x)),
      y: Math.max(0, Math.round(crop!.y)),
      width: Math.round(crop!.width),
      height: Math.round(crop!.height)
    };
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
  const notesPath = globalSessionDir ? path.join(globalSessionDir, 'working-notes.md') : null;
  let statusText = `Extracted ${region ? `"${region}" region` : 'custom crop'} of page ${pageNumber}.`;
  statusText += `\nFull page dimensions: ${pageWidth}x${pageHeight} pixels (${renderDpi} DPI).`;
  statusText += `\nCrop area: x=${cropArea.x}, y=${cropArea.y}, width=${cropArea.width}, height=${cropArea.height}`;
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
