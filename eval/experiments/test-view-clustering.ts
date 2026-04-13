#!/usr/bin/env bun
/**
 * Test View-Aware Spatial Clustering
 *
 * Tests the preprocessing pipeline that groups PDF text items into
 * drawing views (section views, plan views, detail callouts) and
 * crops a high-resolution image for each view.
 *
 * No LLM involved — pure data pipeline test. Output is a folder of
 * cropped images + text reports for visual inspection.
 *
 * Usage:
 *   bun run eval/test-view-clustering.ts                     # Default: pages 250-270
 *   bun run eval/test-view-clustering.ts --pages 252,253     # Specific pages
 *   bun run eval/test-view-clustering.ts --pages 252         # Single page
 *
 * Output goes to eval/view-clustering-output/
 */

import * as path from 'path';
import * as fs from 'fs';

const ROOT = path.resolve(import.meta.dir, '..');
const DIST = path.join(ROOT, 'dist', 'main');
const OUTPUT_DIR = path.join(ROOT, 'eval', 'view-clustering-output');
const PDF_PATH = "/Users/nicholashorton/Documents/takeoff-ai-poc/files/2024-06-14_Volume 2_CSPermit_Addendum 03_OHWC.pdf";

const DEFAULT_PAGES = Array.from({ length: 21 }, (_, i) => 250 + i);
const RENDER_DPI = 150;
const CROP_MAX_DIMENSION = 2000; // Higher res for cropped views since they're smaller regions

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
  pageWidth: number;   // PDF points
  pageHeight: number;  // PDF points
}

interface ViewCluster {
  id: number;
  label: string;                // Identified title or positional label
  viewType: 'section' | 'plan' | 'detail' | 'unknown';
  level?: string;               // e.g., "Level 03", "Level 06-08"
  items: TextItem[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  // Bounds with padding for image cropping (PDF points)
  cropBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ─── Spatial Clustering ─────────────────────────────────────────────────────

/**
 * Cluster all text items on a page into drawing views.
 *
 * Strategy: Title-anchored grid-cell assignment.
 *
 * 1. Find all view title text items (SECTION, LEVEL XX PLAN, etc.)
 * 2. Detect the grid structure from title X and Y positions
 * 3. Compute grid cell boundaries (midpoints between title positions)
 * 4. Assign every text item to the grid cell it falls within
 *
 * This produces clean rectangular boundaries that don't overlap.
 *
 * Fallback: If no titles found, fall back to gap-based spatial clustering.
 */
function clusterIntoViews(
  items: TextItem[],
  pageWidth: number,
  pageHeight: number
): ViewCluster[] {
  if (items.length === 0) return [];

  // Step 1: Find view titles
  interface TitleInfo {
    x: number;
    y: number;
    label: string;
    viewType: ViewCluster['viewType'];
    level?: string;
  }

  const rawTitles: TitleInfo[] = [];

  for (const item of items) {
    const sectionMatch = item.text.match(/SECTION/i);
    const planMatch = item.text.match(/LEVEL\s*([\dP]+(?:\s*[-–—]\s*[\dP]+)?)\s*(?:(?:IP|MOB|MOD|MECH|AND\s+[\dP]+)\s*)?PLAN/i);

    if (sectionMatch && /STAIR/i.test(items.filter(i => Math.abs(i.y - item.y) < 10 && Math.abs(i.x - item.x) < 200).map(i => i.text).join(' '))) {
      const nearbyRowItems = items.filter(i => Math.abs(i.y - item.y) < 10 && Math.abs(i.x - item.x) < 200);
      const fullTitle = nearbyRowItems.sort((a, b) => a.x - b.x).map(i => i.text).join(' ');
      rawTitles.push({
        x: item.x,
        y: item.y,
        label: fullTitle.trim(),
        viewType: 'section',
      });
    } else if (planMatch) {
      const nearbyRowItems = items.filter(i => Math.abs(i.y - item.y) < 10 && Math.abs(i.x - item.x) < 200);
      const fullTitle = nearbyRowItems.sort((a, b) => a.x - b.x).map(i => i.text).join(' ');
      rawTitles.push({
        x: item.x,
        y: item.y,
        label: fullTitle.trim(),
        viewType: 'plan',
        level: `Level ${planMatch[1].trim()}`,
      });
    }
  }

  // Deduplicate titles that are close together (same view title detected from multiple text items)
  const titles: TitleInfo[] = [];
  for (const title of rawTitles) {
    const isDuplicate = titles.some(t => Math.abs(t.x - title.x) < 100 && Math.abs(t.y - title.y) < 30);
    if (!isDuplicate) {
      titles.push(title);
    }
  }

  console.log(`      Title-anchored grid clustering: found ${titles.length} unique view titles`);

  if (titles.length === 0) {
    console.log(`      No titles found, falling back to gap-based clustering`);
    return gapBasedClustering(items, pageWidth, pageHeight);
  }

  // Step 2: Detect grid structure from title positions
  // Find distinct X columns by clustering title X values
  const titleXs = [...new Set(titles.map(t => t.x))].sort((a, b) => a - b);
  const colPositions: number[] = [titleXs[0]];
  for (let i = 1; i < titleXs.length; i++) {
    if (titleXs[i] - colPositions[colPositions.length - 1] > 100) {
      colPositions.push(titleXs[i]);
    }
  }

  // Find distinct Y rows by clustering title Y values
  const titleYs = [...new Set(titles.map(t => t.y))].sort((a, b) => a - b);
  const rowPositions: number[] = [titleYs[0]];
  for (let i = 1; i < titleYs.length; i++) {
    if (titleYs[i] - rowPositions[rowPositions.length - 1] > 100) {
      rowPositions.push(titleYs[i]);
    }
  }

  console.log(`      Grid: ${colPositions.length} columns × ${rowPositions.length} rows`);
  console.log(`      Column X positions: ${colPositions.map(x => Math.round(x)).join(', ')}`);
  console.log(`      Row Y positions: ${rowPositions.map(y => Math.round(y)).join(', ')}`);

  // Step 3: Compute grid cell boundaries using midpoints
  // Column boundaries: page left edge, midpoints between columns, page right edge
  const colBoundaries: number[] = [0]; // Left edge
  for (let i = 0; i < colPositions.length - 1; i++) {
    colBoundaries.push((colPositions[i] + colPositions[i + 1]) / 2);
  }
  colBoundaries.push(pageWidth); // Right edge

  // Row boundaries: page top edge, biased splits between rows, page bottom edge
  // Titles are at the BOTTOM of each view, so each view's content extends
  // far ABOVE its title. The boundary between two rows should be placed
  // just below the upper row's title — giving the lower row maximum space
  // above for its drawing content.
  //
  // We use a 85/15 bias: boundary = upperTitle + 15% of gap
  // (leave a small margin below the upper title for its scale text etc.)
  const ROW_BIAS = 0.15; // boundary is 15% below the upper title
  const rowBoundaries: number[] = [0]; // Top edge
  for (let i = 0; i < rowPositions.length - 1; i++) {
    const gap = rowPositions[i + 1] - rowPositions[i];
    rowBoundaries.push(rowPositions[i] + gap * ROW_BIAS);
  }
  rowBoundaries.push(pageHeight); // Bottom edge

  console.log(`      Column boundaries: ${colBoundaries.map(x => Math.round(x)).join(', ')}`);
  console.log(`      Row boundaries: ${rowBoundaries.map(y => Math.round(y)).join(', ')}`);

  // Step 4: Build grid occupancy map and detect spanning views
  // A title occupies one cell, but some views (like section views) span
  // multiple rows. Empty cells (no title) get merged into the nearest
  // titled cell in the same column.

  interface GridCell {
    title: TitleInfo | null;
    col: number;
    row: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
  }

  // Build the full grid (every col × row combination)
  const allCells: GridCell[][] = []; // [col][row]
  for (let c = 0; c < colPositions.length; c++) {
    allCells[c] = [];
    for (let r = 0; r < rowPositions.length; r++) {
      // Find the title in this cell (if any)
      const cellTitle = titles.find(t =>
        Math.abs(t.x - colPositions[c]) < 100 &&
        Math.abs(t.y - rowPositions[r]) < 100
      ) || null;

      allCells[c][r] = {
        title: cellTitle,
        col: c,
        row: r,
        left: colBoundaries[c],
        right: colBoundaries[c + 1],
        top: rowBoundaries[r],
        bottom: rowBoundaries[r + 1],
      };
    }
  }

  // Log the grid occupancy
  console.log(`      Grid occupancy:`);
  for (let r = 0; r < rowPositions.length; r++) {
    const rowCells = colPositions.map((_, c) => {
      const cell = allCells[c][r];
      return cell.title ? cell.title.label.substring(0, 20) : '(empty)';
    });
    console.log(`        Row ${r}: ${rowCells.join(' | ')}`);
  }

  // Merge empty cells into titled cells in the same column
  // Strategy: for each column, find cells with titles. Empty cells between/around
  // them get merged into the nearest titled cell (expanding its top/bottom bounds).
  interface MergedCell {
    title: TitleInfo;
    left: number;
    right: number;
    top: number;
    bottom: number;
    items: TextItem[];
  }

  const mergedCells: MergedCell[] = [];

  for (let c = 0; c < colPositions.length; c++) {
    const colCells = allCells[c];
    const titledRows = colCells.filter(cell => cell.title !== null);

    if (titledRows.length === 0) {
      // Entire column has no titles — skip (items will be unassigned)
      continue;
    }

    if (titledRows.length === 1) {
      // One title in this column — it gets the entire column height
      const titled = titledRows[0];
      mergedCells.push({
        title: titled.title!,
        left: colBoundaries[c],
        right: colBoundaries[c + 1],
        top: 0, // Entire column height
        bottom: pageHeight,
        items: [],
      });
    } else {
      // Multiple titles in this column — each gets its own row range
      for (const titled of titledRows) {
        mergedCells.push({
          title: titled.title!,
          left: titled.left,
          right: titled.right,
          top: titled.top,
          bottom: titled.bottom,
          items: [],
        });
      }
    }
  }

  // Assign every text item to the merged cell it falls within
  for (const item of items) {
    for (const cell of mergedCells) {
      if (item.x >= cell.left && item.x < cell.right &&
          item.y >= cell.top && item.y < cell.bottom) {
        cell.items.push(item);
        break;
      }
    }
  }

  // Step 5: Build ViewCluster objects
  const viewClusters: ViewCluster[] = mergedCells
    .filter(cell => cell.items.length > 0)
    .map((cell) => {
      const PAD = 10; // Small padding in normalized coords
      return {
        id: 0,
        label: cell.title.label,
        viewType: cell.title.viewType,
        level: cell.title.level,
        items: cell.items,
        bounds: {
          minX: cell.left,
          maxX: cell.right,
          minY: cell.top,
          maxY: cell.bottom,
        },
        // Use the grid cell boundaries directly for cropping — clean rectangles
        cropBounds: {
          x: Math.max(0, cell.left - PAD),
          y: Math.max(0, cell.top - PAD),
          width: Math.min(pageWidth, cell.right + PAD) - Math.max(0, cell.left - PAD),
          height: Math.min(pageHeight, cell.bottom + PAD) - Math.max(0, cell.top - PAD),
        },
      };
    });

  // Sort: section views first, then plan views by level
  viewClusters.sort((a, b) => {
    const typeOrder = { section: 0, plan: 1, detail: 2, unknown: 3 };
    if (typeOrder[a.viewType] !== typeOrder[b.viewType]) {
      return typeOrder[a.viewType] - typeOrder[b.viewType];
    }
    return (a.bounds.minY - b.bounds.minY) || (a.bounds.minX - b.bounds.minX);
  });

  viewClusters.forEach((v, i) => v.id = i + 1);
  return viewClusters;
}

/**
 * Fallback gap-based clustering when no view titles are found.
 */
function gapBasedClustering(
  items: TextItem[],
  pageWidth: number,
  pageHeight: number
): ViewCluster[] {
  const X_GAP_FRACTION = 0.06;
  const Y_GAP_FRACTION = 0.04;
  const xGapThreshold = pageWidth * X_GAP_FRACTION;
  const yGapThreshold = pageHeight * Y_GAP_FRACTION;

  const sortedByX = [...items].sort((a, b) => a.x - b.x);
  const xBands: TextItem[][] = [[sortedByX[0]]];

  for (let i = 1; i < sortedByX.length; i++) {
    const gap = sortedByX[i].x - sortedByX[i - 1].x;
    if (gap > xGapThreshold) {
      xBands.push([sortedByX[i]]);
    } else {
      xBands[xBands.length - 1].push(sortedByX[i]);
    }
  }

  const clusters: TextItem[][] = [];
  for (const band of xBands) {
    const sortedByY = [...band].sort((a, b) => a.y - b.y);
    const yBands: TextItem[][] = [[sortedByY[0]]];
    for (let i = 1; i < sortedByY.length; i++) {
      const gap = sortedByY[i].y - sortedByY[i - 1].y;
      if (gap > yGapThreshold) {
        yBands.push([sortedByY[i]]);
      } else {
        yBands[yBands.length - 1].push(sortedByY[i]);
      }
    }
    clusters.push(...yBands);
  }

  const viewClusters: ViewCluster[] = clusters.map((clusterItems, idx) => {
    const bounds = {
      minX: Math.min(...clusterItems.map(i => i.x)),
      maxX: Math.max(...clusterItems.map(i => i.x)),
      minY: Math.min(...clusterItems.map(i => i.y)),
      maxY: Math.max(...clusterItems.map(i => i.y)),
    };
    const PAD_X = pageWidth * 0.02;
    const PAD_Y = pageHeight * 0.02;
    const { label, viewType, level } = identifyView(clusterItems);
    return {
      id: idx + 1,
      label,
      viewType,
      level,
      items: clusterItems,
      bounds,
      cropBounds: {
        x: Math.max(0, bounds.minX - PAD_X),
        y: Math.max(0, bounds.minY - PAD_Y),
        width: Math.min(pageWidth, bounds.maxX + PAD_X) - Math.max(0, bounds.minX - PAD_X),
        height: Math.min(pageHeight, bounds.maxY + PAD_Y) - Math.max(0, bounds.minY - PAD_Y),
      },
    };
  });

  viewClusters.sort((a, b) => {
    const typeOrder = { section: 0, plan: 1, detail: 2, unknown: 3 };
    if (typeOrder[a.viewType] !== typeOrder[b.viewType]) {
      return typeOrder[a.viewType] - typeOrder[b.viewType];
    }
    return (a.bounds.minY - b.bounds.minY) || (a.bounds.minX - b.bounds.minX);
  });
  viewClusters.forEach((v, i) => v.id = i + 1);
  return viewClusters;
}

// ─── View Title Identification ──────────────────────────────────────────────

/**
 * View title patterns commonly found in architectural stair drawings.
 */
const VIEW_TITLE_PATTERNS = {
  section: /SECTION\s*[-–—]?\s*STAIR\s*\d+/i,
  plan: /STAIR\s*\d+\s*[-–—]\s*LEVEL\s*([\d]+(?:\s*[-–—]\s*\d+)?)\s*(?:IP\s*)?PLAN/i,
  detail: /DETAIL|ENLARGED|TYP(?:ICAL)?/i,
};

function identifyView(items: TextItem[]): { label: string; viewType: ViewCluster['viewType']; level?: string } {
  // Concatenate all text in the cluster for pattern matching
  const allText = items.map(i => i.text).join(' ');

  // Also look at text near the bottom of the cluster (where titles usually are)
  const maxY = Math.max(...items.map(i => i.y));
  const bottomItems = items.filter(i => i.y > maxY - 30); // Within 30 points of bottom
  const bottomText = bottomItems.map(i => i.text).join(' ');

  // Try to match section view
  const sectionMatch = allText.match(VIEW_TITLE_PATTERNS.section) || bottomText.match(VIEW_TITLE_PATTERNS.section);
  if (sectionMatch) {
    // Look for the full title including direction
    const fullMatch = allText.match(/SECTION\s*[-–—]?\s*STAIR\s*\d+\s*[-–—]?\s*LOOKING\s*\w+/i);
    return {
      label: fullMatch ? fullMatch[0] : sectionMatch[0],
      viewType: 'section',
    };
  }

  // Try to match plan view with level
  const planMatch = allText.match(VIEW_TITLE_PATTERNS.plan) || bottomText.match(VIEW_TITLE_PATTERNS.plan);
  if (planMatch) {
    const level = planMatch[1]?.trim();
    return {
      label: planMatch[0],
      viewType: 'plan',
      level: level ? `Level ${level}` : undefined,
    };
  }

  // Try to match detail view
  const detailMatch = allText.match(VIEW_TITLE_PATTERNS.detail) || bottomText.match(VIEW_TITLE_PATTERNS.detail);
  if (detailMatch) {
    return {
      label: detailMatch[0],
      viewType: 'detail',
    };
  }

  // No title found — use positional label
  return {
    label: 'untitled view',
    viewType: 'unknown',
  };
}

// ─── Row Grouping (within a view) ───────────────────────────────────────────

function groupIntoRows(items: TextItem[], yTolerance: number = 3): Array<{ y: number; items: Array<{ text: string; x: number }> }> {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: Array<{ y: number; items: Array<{ text: string; x: number }> }> = [];
  let currentRow = {
    y: sorted[0].y,
    items: [{ text: sorted[0].text, x: sorted[0].x }]
  };

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentRow.y) <= yTolerance) {
      currentRow.items.push({ text: item.text, x: item.x });
    } else {
      currentRow.items.sort((a, b) => a.x - b.x);
      rows.push(currentRow);
      currentRow = { y: item.y, items: [{ text: item.text, x: item.x }] };
    }
  }
  currentRow.items.sort((a, b) => a.x - b.x);
  rows.push(currentRow);

  return rows;
}

// ─── Image Rendering & Cropping (pdftoppm + node-canvas) ───────────────────

import { execSync } from 'child_process';

/**
 * Render a PDF page to a JPEG buffer using pdftoppm (poppler).
 * Much more reliable than pdfjs-dist in Node for rendering.
 */
async function renderPageToBuffer(pdfPath: string, pageNumber: number, dpi: number): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
}> {
  const tmpFile = `/tmp/takeoff-render-page-${pageNumber}`;

  // pdftoppm renders a specific page range at the given DPI
  // -f/-l: first/last page, -jpeg: output format, -r: DPI
  execSync(
    `pdftoppm -f ${pageNumber} -l ${pageNumber} -jpeg -r ${dpi} "${pdfPath}" "${tmpFile}"`,
    { timeout: 30000 }
  );

  // pdftoppm names output: tmpFile-NNNNNN.jpg (zero-padded page number)
  // Find the actual output file
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
    // Try glob-like approach
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
  fs.unlinkSync(outputPath); // Clean up temp file

  // Get image dimensions from the buffer using node-canvas
  const canvasModule = await import('canvas');
  const img = await canvasModule.loadImage(buffer);

  return {
    buffer,
    width: img.width,
    height: img.height,
  };
}

/**
 * Crop a region from a rendered page buffer using node-canvas.
 * cropArea is in render pixel space (already scaled from PDF points).
 */
async function cropFromBuffer(
  fullPageBuffer: Buffer,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number,
  maxDimension: number
): Promise<Buffer> {
  const canvasModule = await import('canvas');

  // Load the full page image
  const img = await canvasModule.loadImage(fullPageBuffer);

  // Clamp crop to image bounds
  const cx = Math.max(0, Math.round(cropX));
  const cy = Math.max(0, Math.round(cropY));
  const cw = Math.min(Math.round(cropW), img.width - cx);
  const ch = Math.min(Math.round(cropH), img.height - cy);

  // Determine output size (downscale if needed)
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

// ─── Report Generation ─────────────────────────────────────────────────────

function generateClusterReport(
  pageNumber: number,
  pageWidth: number,
  pageHeight: number,
  clusters: ViewCluster[],
  totalItems: number
): string {
  let report = '';
  report += `${'═'.repeat(80)}\n`;
  report += `  PAGE ${pageNumber} — VIEW CLUSTERING REPORT\n`;
  report += `  Page dimensions: ${pageWidth.toFixed(0)} x ${pageHeight.toFixed(0)} pts\n`;
  report += `  Total text items: ${totalItems}\n`;
  report += `  Views detected: ${clusters.length}\n`;
  report += `${'═'.repeat(80)}\n\n`;

  for (const cluster of clusters) {
    report += `${'─'.repeat(60)}\n`;
    report += `  VIEW ${cluster.id}: "${cluster.label}"\n`;
    report += `  Type: ${cluster.viewType}`;
    if (cluster.level) report += ` | ${cluster.level}`;
    report += `\n`;
    report += `  Items: ${cluster.items.length}\n`;
    report += `  Text bounds: x=[${Math.round(cluster.bounds.minX)}-${Math.round(cluster.bounds.maxX)}], y=[${Math.round(cluster.bounds.minY)}-${Math.round(cluster.bounds.maxY)}]\n`;
    report += `  Crop bounds: (${Math.round(cluster.cropBounds.x)}, ${Math.round(cluster.cropBounds.y)}) ${Math.round(cluster.cropBounds.width)}x${Math.round(cluster.cropBounds.height)} pts\n`;
    report += `${'─'.repeat(60)}\n`;

    // Text rows within this view
    const rows = groupIntoRows(cluster.items);
    report += `\n  [spatial-rows] (${rows.length} rows)\n`;
    for (const row of rows) {
      const rowText = row.items.map(i => `[x=${Math.round(i.x)}] ${i.text}`).join('  |  ');
      report += `    ROW y=${Math.round(row.y)}: ${rowText}\n`;
    }
    report += '\n';
  }

  // Summary of unclustered items (if any)
  const clusteredCount = clusters.reduce((sum, c) => sum + c.items.length, 0);
  if (clusteredCount < totalItems) {
    report += `\n⚠️  ${totalItems - clusteredCount} items not assigned to any view\n`;
  }

  return report;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // Parse args
  let pagesToTest: number[];
  if (args.includes('--pages')) {
    const pagesStr = args[args.indexOf('--pages') + 1];
    pagesToTest = pagesStr.split(',').map(Number);
  } else {
    pagesToTest = DEFAULT_PAGES;
  }

  console.log(`\n🔬 View Clustering Test`);
  console.log(`   PDF: ${path.basename(PDF_PATH)}`);
  console.log(`   Pages: ${pagesToTest.join(', ')}`);
  console.log(`   Output: ${OUTPUT_DIR}\n`);

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Step 1: Extract text from PDF
  console.log(`📝 Extracting text from PDF...`);
  const extractorPath = path.join(DIST, 'core', 'pdf-text-extractor.js');
  const { extractAllPagesText } = await import(extractorPath);
  const textData = await extractAllPagesText(PDF_PATH);
  console.log(`   ✅ Extracted ${textData.pageCount} pages\n`);

  // Process each requested page
  for (const pageNum of pagesToTest) {
    const pageData = textData.pages.find((p: PageTextData) => p.pageNumber === pageNum);
    if (!pageData) {
      console.log(`   ⚠️  Page ${pageNum} not found in text data, skipping`);
      continue;
    }

    if (pageData.textItemCount === 0) {
      console.log(`   ⚠️  Page ${pageNum} has no text items, skipping`);
      continue;
    }

    console.log(`📄 Processing page ${pageNum} (${pageData.textItemCount} text items)...`);

    // Normalize coordinates: shift all items so min x,y = 0 (top-left origin)
    // Some PDFs have centered or offset coordinate systems
    const allX = pageData.textItems.map((i: TextItem) => i.x);
    const allY = pageData.textItems.map((i: TextItem) => i.y);
    const minX = Math.min(...allX);
    const minY = Math.min(...allY);
    const maxX = Math.max(...allX);
    const maxY = Math.max(...allY);

    // The effective page dimensions from the text extent
    const textWidth = maxX - minX;
    const textHeight = maxY - minY;

    console.log(`   📐 Raw coords: x=[${minX.toFixed(0)}, ${maxX.toFixed(0)}], y=[${minY.toFixed(0)}, ${maxY.toFixed(0)}]`);
    console.log(`   📐 Page dims: ${pageData.pageWidth.toFixed(0)} x ${pageData.pageHeight.toFixed(0)} pts`);
    console.log(`   📐 Text extent: ${textWidth.toFixed(0)} x ${textHeight.toFixed(0)} pts`);

    // Create normalized text items (shift so min = small padding)
    const normalizedItems: TextItem[] = pageData.textItems.map((i: TextItem) => ({
      text: i.text,
      x: i.x - minX,
      y: i.y - minY,
      fontSize: i.fontSize,
    }));

    // Use text extent as the effective page dimensions for clustering
    const effectiveWidth = textWidth;
    const effectiveHeight = textHeight;

    // Create page output directory
    const pageDir = path.join(OUTPUT_DIR, `page-${pageNum}`);
    fs.mkdirSync(pageDir, { recursive: true });

    // Step 2: Cluster normalized text items into views
    const clusters = clusterIntoViews(
      normalizedItems,
      effectiveWidth,
      effectiveHeight
    );
    console.log(`   🔍 Found ${clusters.length} views`);
    for (const c of clusters) {
      console.log(`      View ${c.id}: "${c.label}" (${c.viewType}, ${c.items.length} items)`);
    }

    // Step 3: Generate text report
    const report = generateClusterReport(
      pageNum,
      effectiveWidth,
      effectiveHeight,
      clusters,
      pageData.textItemCount
    );
    fs.writeFileSync(path.join(pageDir, 'clustering-report.txt'), report);

    // Step 4: Render full page image
    console.log(`   🖼️  Rendering page ${pageNum} at ${RENDER_DPI} DPI...`);
    try {
      const { buffer: fullPageBuffer, width: renderWidth, height: renderHeight } = await renderPageToBuffer(
        PDF_PATH,
        pageNum,
        RENDER_DPI
      );
      const overviewPath = path.join(pageDir, `page-${pageNum}-overview.jpg`);
      fs.writeFileSync(overviewPath, fullPageBuffer);
      console.log(`   ✅ Overview: ${renderWidth}x${renderHeight}px → ${overviewPath}`);

      // Step 5: Crop each view
      //
      // Coordinate mapping strategy:
      // - pdfjs-dist gives text x = transform[4] (raw PDF user space)
      // - pdfjs-dist gives text y = viewport.height - transform[5] (top-down)
      // - pdftoppm renders the full page to pixels
      //
      // For pages with non-zero origin (common in CAD drawings where origin is
      // at center of page), the raw X can be negative.
      //
      // We use a fractional approach:
      // - Text X spans [minX, maxX] across the page
      // - We know the page is pageWidth pts wide
      // - The text extent (maxX - minX) should be roughly pageWidth
      //   (text extends nearly edge to edge on architectural sheets)
      // - Map: fraction = (rawX - pageLeftEdge) / pageWidth
      //        pixelX = fraction * renderWidth
      //
      // For Y: pdfjs already converts to top-down with y = viewport.height - transform[5]
      // viewport.height at scale=1 = page height in points
      // So y ranges from 0 (top) to pageHeight (bottom)... but we see y starting at ~1389
      // This suggests the page has content only in part of the Y range too.
      //
      // Simplest reliable approach: map the text bounding box to the rendered
      // image proportionally. The text on an architectural sheet typically fills
      // the drawable area within the border. We'll add margin to account for
      // drawing elements outside the text extent.

      // Estimate page edges in raw PDF coords
      // X: text spans minX..maxX, page is pageWidth wide
      // The margin on each side = (pageWidth - textWidth) / 2 (roughly)
      const xMargin = (pageData.pageWidth - textWidth) / 2;
      const yMargin = (pageData.pageHeight - textHeight) / 2;
      const estPageLeftRaw = minX - xMargin;
      const estPageTopRaw = minY - yMargin;

      const pixelPerPtX = renderWidth / pageData.pageWidth;
      const pixelPerPtY = renderHeight / pageData.pageHeight;

      console.log(`   📐 Coord mapping: margins=${xMargin.toFixed(0)}x${yMargin.toFixed(0)}pts, scale=${pixelPerPtX.toFixed(2)}px/pt`);

      for (const cluster of clusters) {
        // Convert normalized crop bounds back to raw PDF coords
        const rawCropX = cluster.cropBounds.x + minX;
        const rawCropY = cluster.cropBounds.y + minY;
        const rawCropW = cluster.cropBounds.width;
        const rawCropH = cluster.cropBounds.height;

        // Map to render pixels
        const cropX = (rawCropX - estPageLeftRaw) * pixelPerPtX;
        const cropY = (rawCropY - estPageTopRaw) * pixelPerPtY;
        const cropW = rawCropW * pixelPerPtX;
        const cropH = rawCropH * pixelPerPtY;

        const safeLabel = cluster.label
          .replace(/[^a-zA-Z0-9\-_ ]/g, '')
          .replace(/\s+/g, '-')
          .toLowerCase()
          .substring(0, 50);
        const cropFilename = `page-${pageNum}-view-${cluster.id}-${safeLabel}.jpg`;

        try {
          const cropBuffer = await cropFromBuffer(
            fullPageBuffer,
            cropX, cropY, cropW, cropH,
            CROP_MAX_DIMENSION
          );
          const cropPath = path.join(pageDir, cropFilename);
          fs.writeFileSync(cropPath, cropBuffer);
          console.log(`   ✅ View ${cluster.id}: ${Math.round(cropW)}x${Math.round(cropH)}px → ${cropFilename}`);
        } catch (err) {
          console.log(`   ❌ View ${cluster.id} crop failed: ${err}`);
        }
      }
    } catch (err) {
      console.log(`   ❌ Page rendering failed: ${err}`);
      console.log(`      (Text clustering report was still saved)`);
    }

    console.log('');
  }

  console.log(`\n✅ Done! Output in: ${OUTPUT_DIR}`);
  console.log(`   Open the output folder to inspect clustering results.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
