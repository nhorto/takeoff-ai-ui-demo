#!/usr/bin/env bun
/**
 * Test LLM-Based View Detection on Construction Drawing Sheets
 *
 * Sends a rendered page image to Claude and asks it to identify all drawing
 * views with bounding boxes. Then crops each view and filters text items.
 *
 * This tests whether LLM vision can replace algorithmic view detection
 * (which failed in our experiments with contour detection, projection
 * profiles, and DocLayout-YOLO).
 *
 * Usage:
 *   bun run eval/test-llm-view-detection.ts --pages 252,256
 *   bun run eval/test-llm-view-detection.ts --pages 252
 *
 * Output goes to eval/llm-view-detection-output/
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 */

import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';

// Load .env file
const envPath = path.resolve(import.meta.dir, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+?)\s*=\s*(.+)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      // Map "CLAUDE API KEY" to ANTHROPIC_API_KEY
      if (key === 'CLAUDE API KEY' || key === 'ANTHROPIC_API_KEY') {
        process.env.ANTHROPIC_API_KEY = value;
      }
    }
  }
}

// ─── Configuration ──────────────────────────────────────────────────────────

const ROOT = path.resolve(import.meta.dir, '..');
const DIST = path.join(ROOT, 'dist', 'main');
const OUTPUT_DIR = path.join(ROOT, 'eval', 'llm-view-detection-output');
const PDF_PATH = "/Users/nicholashorton/Documents/takeoff-ai-poc/files/2024-06-14_Volume 2_CSPermit_Addendum 03_OHWC.pdf";

const DEFAULT_PAGES = [252, 256]; // Known stair pages for testing
const RENDER_DPI = 150;
const CROP_MAX_DIMENSION = 2000;
const LLM_MAX_DIMENSION = 1568; // Match existing tools.ts default
const MODEL = 'claude-sonnet-4-5-20250929';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TextItem {
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

interface PageTextData {
  pageNumber: number;
  fullText: string;
  textItemCount: number;
  textItems: TextItem[];
  pageWidth: number;
  pageHeight: number;
}

interface Detection {
  label: string;
  type: 'section' | 'plan' | 'detail' | 'axonometric' | 'elevation' | 'other';
  level: string | null;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2] fractions 0-1
}

interface DetectionResult {
  detections: Detection[];
  rawResponse: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

// ─── LLM Prompt ─────────────────────────────────────────────────────────────

const BBOX_PADDING = 0.025; // 2.5% padding on all sides

const DETECTION_PROMPT = `You are analyzing a construction/architectural drawing sheet. This sheet contains multiple independent "views" arranged on the page — each view is a self-contained drawing with its own title and annotations.

Common view types:
- Section view: Cross-section cut, labeled like "SECTION - STAIR 2 - LOOKING EAST"
- Plan view: Top-down floor plan, labeled like "STAIR 2 - LEVEL 05 IP PLAN"
- Detail view: Enlarged detail of a component
- Axonometric/3D view: 3D projection view
- Elevation view: Side view

Each view typically has a title below it (sometimes above) and may have a rectangular border or just whitespace separating it from adjacent views.

Identify every distinct drawing view on this sheet. Do NOT include:
- The sheet title block (usually bottom-right area with project info, sheet number, firm name)
- Revision blocks or general notes areas
- The border/frame around the entire sheet

Rules:
- Each view should appear EXACTLY ONCE — do not duplicate views
- Bounding boxes should NOT overlap. If views are in a grid, the boxes should tile cleanly.
- Include the view's title/label text and all dimension annotations within the bounding box
- Err on the side of slightly larger bounding boxes — it is better to include a small amount of an adjacent view's content than to cut off important annotations from this view

Return a JSON array where each element has:
- "label": The view's title text exactly as written on the drawing
- "type": One of "section", "plan", "detail", "axonometric", "elevation", "other"
- "level": The floor level if this is a plan view (e.g., "03", "P2", "06-08"), or null
- "bbox": [x1, y1, x2, y2] as fractions from 0.0 to 1.0 where (0,0) is top-left and (1,1) is bottom-right. The bbox should enclose the complete view including its title text and all annotations.

Return ONLY the JSON array, no other text or markdown.`;

const CORRECTION_PROMPT_TEMPLATE = `I previously asked you to identify drawing views on this construction sheet. The colored rectangles on this image show the bounding boxes from your first attempt, which found VIEWS_COUNT views.

Your job is to REFINE the bounding box positions — NOT to add new views. The view count of VIEWS_COUNT is most likely correct.

Review each bounding box:
1. Is any box TOO SMALL — cutting off dimension annotations, title text, or parts of the drawing? If so, expand it.
2. Is any box TOO LARGE — encompassing two separate views? If so, split it or shrink it.
3. Are any boxes significantly overlapping? Adjust boundaries so views tile cleanly without major overlap.
4. Are there any DUPLICATE detections (same view detected twice)? If so, remove the duplicate.
5. Is there a view that was clearly missed? Only add it if you can see a titled drawing with NO box around it.

CRITICAL RULES:
- Do NOT add views that weren't in the first pass unless a titled drawing is clearly uncovered
- Do NOT split a single view into multiple detections
- Do NOT duplicate any view — each view appears EXACTLY ONCE
- The final count should be close to VIEWS_COUNT (within ±2)
- Focus on adjusting POSITIONS of existing boxes, not adding/removing

Return ONLY the corrected JSON array. Same format:
- "label": The view's title text
- "type": One of "section", "plan", "detail", "axonometric", "elevation", "other"
- "level": The floor level if plan view, or null
- "bbox": [x1, y1, x2, y2] as fractions 0.0-1.0`;

// ─── PDF Rendering (reused from test-view-clustering.ts) ────────────────────

async function renderPageToBuffer(pdfPath: string, pageNumber: number, dpi: number): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
}> {
  const tmpFile = `/tmp/takeoff-llm-detect-page-${pageNumber}`;

  execSync(
    `pdftoppm -f ${pageNumber} -l ${pageNumber} -jpeg -r ${dpi} "${pdfPath}" "${tmpFile}"`,
    { timeout: 30000 }
  );

  // Find the output file (pdftoppm names vary)
  const possibleNames = [
    `${tmpFile}-${String(pageNumber).padStart(6, '0')}.jpg`,
    `${tmpFile}-${String(pageNumber).padStart(3, '0')}.jpg`,
    `${tmpFile}-${pageNumber}.jpg`,
  ];

  let outputPath = '';
  for (const name of possibleNames) {
    if (fs.existsSync(name)) {
      outputPath = name;
      break;
    }
  }

  if (!outputPath) {
    const dir = path.dirname(tmpFile);
    const prefix = path.basename(tmpFile);
    const files = fs.readdirSync(dir).filter((f: string) => f.startsWith(prefix) && f.endsWith('.jpg'));
    if (files.length > 0) {
      outputPath = path.join(dir, files[0]);
    }
  }

  if (!outputPath) {
    throw new Error(`pdftoppm output not found for page ${pageNumber}`);
  }

  const buffer = fs.readFileSync(outputPath);
  fs.unlinkSync(outputPath);

  const canvasModule = await import('canvas');
  const img = await canvasModule.loadImage(buffer);

  return { buffer, width: img.width, height: img.height };
}

// ─── Image Processing ───────────────────────────────────────────────────────

async function downscaleBuffer(
  buffer: Buffer,
  srcWidth: number,
  srcHeight: number,
  maxDim: number
): Promise<Buffer> {
  const canvasModule = await import('canvas');
  const img = await canvasModule.loadImage(buffer);

  const scale = Math.min(maxDim / srcWidth, maxDim / srcHeight, 1.0);
  const w = Math.round(srcWidth * scale);
  const h = Math.round(srcHeight * scale);

  const canvas = canvasModule.createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  return canvas.toBuffer('image/jpeg', { quality: 0.85 });
}

async function cropFromBuffer(
  fullPageBuffer: Buffer,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number,
  maxDimension: number
): Promise<Buffer> {
  const canvasModule = await import('canvas');
  const img = await canvasModule.loadImage(fullPageBuffer);

  const cx = Math.max(0, Math.round(cropX));
  const cy = Math.max(0, Math.round(cropY));
  const cw = Math.min(Math.round(cropW), img.width - cx);
  const ch = Math.min(Math.round(cropH), img.height - cy);

  let outW = cw;
  let outH = ch;
  if (cw > maxDimension || ch > maxDimension) {
    const scaleFactor = Math.min(maxDimension / cw, maxDimension / ch);
    outW = Math.round(cw * scaleFactor);
    outH = Math.round(ch * scaleFactor);
  }

  const canvas = canvasModule.createCanvas(outW, outH);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, cx, cy, cw, ch, 0, 0, outW, outH);

  return canvas.toBuffer('image/jpeg', { quality: 0.90 });
}

async function drawAnnotations(
  overviewBuffer: Buffer,
  detections: Detection[],
  imgWidth: number,
  imgHeight: number
): Promise<Buffer> {
  const canvasModule = await import('canvas');
  const img = await canvasModule.loadImage(overviewBuffer);

  const canvas = canvasModule.createCanvas(imgWidth, imgHeight);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const colorMap: Record<string, string> = {
    section: '#FF0000',
    plan: '#00CC00',
    detail: '#0066FF',
    axonometric: '#FF9900',
    elevation: '#CC00CC',
    other: '#00CCCC',
  };

  for (let i = 0; i < detections.length; i++) {
    const det = detections[i];
    const [x1, y1, x2, y2] = det.bbox;
    const px1 = Math.round(x1 * imgWidth);
    const py1 = Math.round(y1 * imgHeight);
    const px2 = Math.round(x2 * imgWidth);
    const py2 = Math.round(y2 * imgHeight);

    const color = colorMap[det.type] || '#FFFFFF';

    // Draw bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(px1, py1, px2 - px1, py2 - py1);

    // Draw label background
    const label = `${i + 1}. ${det.label} (${det.type})`;
    ctx.font = 'bold 24px sans-serif';
    const metrics = ctx.measureText(label);
    const labelH = 30;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(px1, py1 - labelH - 4, metrics.width + 12, labelH + 4);

    // Draw label text
    ctx.fillStyle = color;
    ctx.fillText(label, px1 + 6, py1 - 10);
  }

  return canvas.toBuffer('image/jpeg', { quality: 0.90 });
}

// ─── LLM Detection ─────────────────────────────────────────────────────────

async function detectViewsClaude(imageBuffer: Buffer): Promise<DetectionResult> {
  const anthropic = new Anthropic();
  const base64 = imageBuffer.toString('base64');

  const startTime = Date.now();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: base64,
          },
        },
        {
          type: 'text',
          text: DETECTION_PROMPT,
        },
      ],
    }],
  });

  const durationMs = Date.now() - startTime;

  const rawText = response.content
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('');

  // Parse JSON — strip markdown code fences if present
  let jsonStr = rawText.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let detections: Detection[];
  try {
    detections = JSON.parse(jsonStr);
  } catch (e) {
    console.error(`   Failed to parse LLM response as JSON:`);
    console.error(`   Raw response: ${rawText.substring(0, 500)}`);
    detections = [];
  }

  // Validate and clamp bboxes
  detections = detections.map(d => ({
    ...d,
    bbox: [
      Math.max(0, Math.min(1, d.bbox[0])),
      Math.max(0, Math.min(1, d.bbox[1])),
      Math.max(0, Math.min(1, d.bbox[2])),
      Math.max(0, Math.min(1, d.bbox[3])),
    ] as [number, number, number, number],
  }));

  return {
    detections,
    rawResponse: rawText,
    model: MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    durationMs,
  };
}

// ─── Post-Processing ────────────────────────────────────────────────────────

function applyPadding(detections: Detection[], padding: number): Detection[] {
  return detections.map(d => ({
    ...d,
    bbox: [
      Math.max(0, d.bbox[0] - padding),
      Math.max(0, d.bbox[1] - padding),
      Math.min(1, d.bbox[2] + padding),
      Math.min(1, d.bbox[3] + padding),
    ] as [number, number, number, number],
  }));
}

// ─── Self-Correction Pass ───────────────────────────────────────────────────

async function correctDetections(
  annotatedBuffer: Buffer,
  firstPassResult: DetectionResult,
): Promise<DetectionResult> {
  const anthropic = new Anthropic();
  const base64 = annotatedBuffer.toString('base64');

  const correctionPrompt = CORRECTION_PROMPT_TEMPLATE.replace(
    /VIEWS_COUNT/g,
    String(firstPassResult.detections.length)
  );

  const startTime = Date.now();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: base64,
          },
        },
        {
          type: 'text',
          text: correctionPrompt,
        },
      ],
    }],
  });

  const durationMs = Date.now() - startTime;

  const rawText = response.content
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('');

  let jsonStr = rawText.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let detections: Detection[];
  try {
    detections = JSON.parse(jsonStr);
  } catch (e) {
    console.error(`   Failed to parse correction response, keeping original detections`);
    console.error(`   Raw: ${rawText.substring(0, 300)}`);
    return firstPassResult;
  }

  // Validate and clamp bboxes
  detections = detections.map(d => ({
    ...d,
    bbox: [
      Math.max(0, Math.min(1, d.bbox[0])),
      Math.max(0, Math.min(1, d.bbox[1])),
      Math.max(0, Math.min(1, d.bbox[2])),
      Math.max(0, Math.min(1, d.bbox[3])),
    ] as [number, number, number, number],
  }));

  return {
    detections,
    rawResponse: rawText,
    model: MODEL,
    inputTokens: firstPassResult.inputTokens + response.usage.input_tokens,
    outputTokens: firstPassResult.outputTokens + response.usage.output_tokens,
    durationMs: firstPassResult.durationMs + durationMs,
  };
}

// ─── Text Filtering ─────────────────────────────────────────────────────────

function filterTextToView(
  textItems: TextItem[],
  bbox: [number, number, number, number],
  pageWidth: number,
  pageHeight: number,
  minX: number,
  minY: number,
  textWidth: number,
  textHeight: number,
): TextItem[] {
  // Convert text coordinates to fractional page space
  // Same margin estimation as test-view-clustering.ts (lines 798-807)
  const xMargin = (pageWidth - textWidth) / 2;
  const yMargin = (pageHeight - textHeight) / 2;
  const estPageLeftRaw = minX - xMargin;
  const estPageTopRaw = minY - yMargin;

  const [bx1, by1, bx2, by2] = bbox;

  return textItems.filter(item => {
    const fracX = (item.x - estPageLeftRaw) / pageWidth;
    const fracY = (item.y - estPageTopRaw) / pageHeight;
    return fracX >= bx1 && fracX <= bx2 && fracY >= by1 && fracY <= by2;
  });
}

// ─── Output Formatting ──────────────────────────────────────────────────────

function toYoloFormat(detections: Detection[]): string {
  const classMap: Record<string, number> = {
    section: 0, plan: 1, detail: 2, elevation: 3, axonometric: 4, other: 5,
  };

  return detections.map(d => {
    const [x1, y1, x2, y2] = d.bbox;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const w = x2 - x1;
    const h = y2 - y1;
    const classId = classMap[d.type] ?? 5;
    return `${classId} ${cx.toFixed(6)} ${cy.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`;
  }).join('\n');
}

function formatTextItems(items: TextItem[]): string {
  // Group by Y (3px tolerance), sorted top-to-bottom, left-to-right within row
  const rows: { y: number; items: TextItem[] }[] = [];

  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const item of sorted) {
    const existing = rows.find(r => Math.abs(r.y - item.y) < 3);
    if (existing) {
      existing.items.push(item);
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  // Sort items within each row left-to-right
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
  }

  return rows.map(row => {
    const texts = row.items.map(i => i.text).join('  |  ');
    return `ROW y=${Math.round(row.y)}: ${texts}`;
  }).join('\n');
}

function generateReport(
  pageNumber: number,
  result: DetectionResult,
  textItemsPerView: Map<number, TextItem[]>,
): string {
  const lines: string[] = [];

  lines.push('═'.repeat(70));
  lines.push(`  PAGE ${pageNumber} — LLM VIEW DETECTION REPORT`);
  lines.push(`  Model: ${result.model}`);
  lines.push(`  Input tokens: ${result.inputTokens}`);
  lines.push(`  Output tokens: ${result.outputTokens}`);
  lines.push(`  Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
  lines.push(`  Est. cost: $${((result.inputTokens * 3 + result.outputTokens * 15) / 1_000_000).toFixed(4)}`);
  lines.push(`  Views detected: ${result.detections.length}`);
  lines.push('═'.repeat(70));
  lines.push('');

  for (let i = 0; i < result.detections.length; i++) {
    const det = result.detections[i];
    const textItems = textItemsPerView.get(i) || [];
    const [x1, y1, x2, y2] = det.bbox;

    lines.push('─'.repeat(60));
    lines.push(`  VIEW ${i + 1}: "${det.label}"`);
    lines.push(`  Type: ${det.type}${det.level ? ` | Level ${det.level}` : ''}`);
    lines.push(`  Bbox: [${x1.toFixed(3)}, ${y1.toFixed(3)}, ${x2.toFixed(3)}, ${y2.toFixed(3)}]`);
    lines.push(`  Text items: ${textItems.length}`);
    lines.push('─'.repeat(60));
    lines.push('');

    if (textItems.length > 0) {
      lines.push(formatTextItems(textItems));
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  // Parse args
  const args = process.argv.slice(2);
  let pagesToTest: number[];
  if (args.includes('--pages')) {
    const pagesStr = args[args.indexOf('--pages') + 1];
    pagesToTest = pagesStr.split(',').map(Number);
  } else {
    pagesToTest = DEFAULT_PAGES;
  }

  console.log(`\n🔬 LLM View Detection Test`);
  console.log(`   Model: ${MODEL}`);
  console.log(`   PDF: ${path.basename(PDF_PATH)}`);
  console.log(`   Pages: ${pagesToTest.join(', ')}`);
  console.log(`   Output: ${OUTPUT_DIR}\n`);

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Extract text from PDF
  console.log(`📝 Extracting text from PDF...`);
  const extractorPath = path.join(DIST, 'core', 'pdf-text-extractor.js');
  const { extractAllPagesText } = await import(extractorPath);
  const textData = await extractAllPagesText(PDF_PATH);
  console.log(`   ✅ Extracted ${textData.pageCount} pages\n`);

  let totalCost = 0;

  for (const pageNum of pagesToTest) {
    const pageData = textData.pages.find((p: PageTextData) => p.pageNumber === pageNum);
    if (!pageData) {
      console.log(`   ⚠️  Page ${pageNum} not found in text data, skipping`);
      continue;
    }

    console.log(`📄 Processing page ${pageNum} (${pageData.textItemCount} text items)...`);

    // Create page output directory
    const pageDir = path.join(OUTPUT_DIR, `page-${pageNum}`);
    fs.mkdirSync(pageDir, { recursive: true });

    // Step 1: Render full page
    console.log(`   🖼️  Rendering at ${RENDER_DPI} DPI...`);
    const { buffer: fullPageBuffer, width: renderWidth, height: renderHeight } =
      await renderPageToBuffer(PDF_PATH, pageNum, RENDER_DPI);
    console.log(`   ✅ Full page: ${renderWidth}x${renderHeight}px`);

    // Save overview
    fs.writeFileSync(path.join(pageDir, `page-${pageNum}-overview.jpg`), fullPageBuffer);

    // Step 2: Downscale for LLM
    console.log(`   📐 Downscaling to ${LLM_MAX_DIMENSION}px max dim...`);
    const llmBuffer = await downscaleBuffer(fullPageBuffer, renderWidth, renderHeight, LLM_MAX_DIMENSION);
    const llmScale = Math.min(LLM_MAX_DIMENSION / renderWidth, LLM_MAX_DIMENSION / renderHeight, 1.0);
    const llmW = Math.round(renderWidth * llmScale);
    const llmH = Math.round(renderHeight * llmScale);
    console.log(`   ✅ LLM image: ${llmW}x${llmH}px (${(llmBuffer.length / 1024).toFixed(0)}KB)`);

    // Step 3: Send to Claude
    console.log(`   🤖 Sending to Claude ${MODEL}...`);
    let result: DetectionResult;
    try {
      result = await detectViewsClaude(llmBuffer);
    } catch (err: any) {
      console.error(`   ❌ API call failed: ${err.message}`);
      // Retry once
      console.log(`   🔄 Retrying in 2 seconds...`);
      await new Promise(r => setTimeout(r, 2000));
      try {
        result = await detectViewsClaude(llmBuffer);
      } catch (err2: any) {
        console.error(`   ❌ Retry failed: ${err2.message}, skipping page`);
        continue;
      }
    }

    console.log(`   ✅ Pass 1: ${result.detections.length} views in ${(result.durationMs / 1000).toFixed(1)}s`);
    for (const det of result.detections) {
      console.log(`      • ${det.type}: "${det.label}"${det.level ? ` [Level ${det.level}]` : ''}`);
    }

    // Save pass 1 artifacts
    fs.writeFileSync(
      path.join(pageDir, `page-${pageNum}-pass1-response.json`),
      JSON.stringify({ model: result.model, rawResponse: result.rawResponse, tokens: { input: result.inputTokens, output: result.outputTokens }, durationMs: result.durationMs }, null, 2)
    );
    fs.writeFileSync(
      path.join(pageDir, `page-${pageNum}-pass1-detections.json`),
      JSON.stringify(result.detections, null, 2)
    );

    // Draw pass 1 annotations for self-correction
    console.log(`   🎨 Drawing pass 1 annotations...`);
    const pass1AnnotatedBuffer = await drawAnnotations(fullPageBuffer, result.detections, renderWidth, renderHeight);
    fs.writeFileSync(path.join(pageDir, `page-${pageNum}-pass1-annotated.jpg`), pass1AnnotatedBuffer);

    // Step 4: Self-correction pass — show it the annotated image and let it fix
    console.log(`   🔍 Pass 2: Self-correction — sending annotated image back to Claude...`);
    const pass1AnnotatedLlm = await downscaleBuffer(pass1AnnotatedBuffer, renderWidth, renderHeight, LLM_MAX_DIMENSION);

    const pass1Count = result.detections.length;
    try {
      const corrected = await correctDetections(pass1AnnotatedLlm, result);
      const pass2Count = corrected.detections.length;

      // Guard: if correction inflated view count by more than 2, it's hallucinating — keep pass 1
      if (pass2Count > pass1Count + 2) {
        console.log(`   ⚠️  Pass 2 inflated from ${pass1Count} to ${pass2Count} views — keeping pass 1 results`);
        // Still accumulate the token costs
        result.inputTokens = corrected.inputTokens;
        result.outputTokens = corrected.outputTokens;
        result.durationMs = corrected.durationMs;
      } else {
        result = corrected;
        console.log(`   ✅ Pass 2: ${result.detections.length} views (corrected) in ${(result.durationMs / 1000).toFixed(1)}s total`);
        for (const det of result.detections) {
          console.log(`      • ${det.type}: "${det.label}"${det.level ? ` [Level ${det.level}]` : ''}`);
        }
      }
    } catch (err: any) {
      console.log(`   ⚠️  Correction pass failed: ${err.message}, using pass 1 results`);
    }

    // Step 5: Apply padding to final detections
    result.detections = applyPadding(result.detections, BBOX_PADDING);

    const pageCost = (result.inputTokens * 3 + result.outputTokens * 15) / 1_000_000;
    totalCost += pageCost;
    console.log(`      Total tokens: ${result.inputTokens} in / ${result.outputTokens} out ($${pageCost.toFixed(4)})`);

    // Save final results
    fs.writeFileSync(
      path.join(pageDir, `page-${pageNum}-llm-response.json`),
      JSON.stringify({ model: result.model, rawResponse: result.rawResponse, tokens: { input: result.inputTokens, output: result.outputTokens }, durationMs: result.durationMs }, null, 2)
    );
    fs.writeFileSync(
      path.join(pageDir, `page-${pageNum}-detections.json`),
      JSON.stringify(result.detections, null, 2)
    );
    fs.writeFileSync(
      path.join(pageDir, `page-${pageNum}-detections.yolo.txt`),
      toYoloFormat(result.detections)
    );

    // Draw final annotations (with padding applied)
    console.log(`   🎨 Drawing final annotations (with ${BBOX_PADDING * 100}% padding)...`);
    const annotatedBuffer = await drawAnnotations(fullPageBuffer, result.detections, renderWidth, renderHeight);
    fs.writeFileSync(path.join(pageDir, `page-${pageNum}-annotated.jpg`), annotatedBuffer);

    // Step 5: Compute text coordinate mapping
    const allX = pageData.textItems.map((i: TextItem) => i.x);
    const allY = pageData.textItems.map((i: TextItem) => i.y);
    const minX = Math.min(...allX);
    const minY = Math.min(...allY);
    const maxX = Math.max(...allX);
    const maxY = Math.max(...allY);
    const textWidth = maxX - minX;
    const textHeight = maxY - minY;

    // Step 6: Crop views and filter text
    console.log(`   ✂️  Cropping ${result.detections.length} views...`);
    const textItemsPerView = new Map<number, TextItem[]>();

    for (let i = 0; i < result.detections.length; i++) {
      const det = result.detections[i];
      const [bx1, by1, bx2, by2] = det.bbox;

      // Scale fractional bbox to full-res pixels
      const cropX = bx1 * renderWidth;
      const cropY = by1 * renderHeight;
      const cropW = (bx2 - bx1) * renderWidth;
      const cropH = (by2 - by1) * renderHeight;

      const safeLabel = det.label
        .replace(/[^a-zA-Z0-9\-_ ]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase()
        .substring(0, 50);
      const viewPrefix = `page-${pageNum}-view-${i + 1}-${safeLabel}`;

      // Crop image
      try {
        const cropBuffer = await cropFromBuffer(fullPageBuffer, cropX, cropY, cropW, cropH, CROP_MAX_DIMENSION);
        fs.writeFileSync(path.join(pageDir, `${viewPrefix}.jpg`), cropBuffer);
        console.log(`   ✅ View ${i + 1}: ${Math.round(cropW)}x${Math.round(cropH)}px → ${viewPrefix}.jpg`);
      } catch (err) {
        console.log(`   ❌ View ${i + 1} crop failed: ${err}`);
      }

      // Filter text items
      const viewTextItems = filterTextToView(
        pageData.textItems,
        det.bbox,
        pageData.pageWidth,
        pageData.pageHeight,
        minX, minY, textWidth, textHeight,
      );
      textItemsPerView.set(i, viewTextItems);

      // Save text
      const textContent = formatTextItems(viewTextItems);
      fs.writeFileSync(
        path.join(pageDir, `${viewPrefix}.txt`),
        `VIEW: ${det.label}\nTYPE: ${det.type}\nLEVEL: ${det.level || 'N/A'}\nTEXT ITEMS: ${viewTextItems.length}\n\n${textContent}`
      );
    }

    // Step 7: Generate report
    const report = generateReport(pageNum, result, textItemsPerView);
    fs.writeFileSync(path.join(pageDir, 'detection-report.txt'), report);

    console.log('');
  }

  console.log(`\n✅ Done!`);
  console.log(`   Output: ${OUTPUT_DIR}`);
  console.log(`   Total API cost: $${totalCost.toFixed(4)}`);
  console.log(`\n   Open the annotated images to visually verify bounding boxes.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
