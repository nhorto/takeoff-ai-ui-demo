#!/usr/bin/env bun
/**
 * Dump extracted text for specific PDF pages — shows exactly what the agent sees.
 *
 * Usage:
 *   bun run eval/dump-text.ts                     # Dump all stair pages (250-270)
 *   bun run eval/dump-text.ts --pages 252,253     # Dump specific pages
 *   bun run eval/dump-text.ts --stair 3           # Dump pages for Stair 3
 *   bun run eval/dump-text.ts --all               # Dump all 298 pages (big file)
 *
 * Output goes to eval/text-dumps/
 */

import * as path from 'path';
import * as fs from 'fs';

const ROOT = path.resolve(import.meta.dir, '..');
const DIST = path.join(ROOT, 'dist', 'main');
const DUMP_DIR = path.join(ROOT, 'eval', 'text-dumps');
const PDF_PATH = "/Users/nicholashorton/Documents/takeoff-ai-poc/files/2024-06-14_Volume 2_CSPermit_Addendum 03_OHWC.pdf";

// Stair page assignments (from discovery data across multiple runs)
const STAIR_PAGES: Record<string, number[]> = {
  'Stair 1': [250, 251],
  'Stair 2': [252],
  'Stair 3': [253],
  'Stair 4': [254, 255],
  'Stair 5': [256, 257],
  'Stair 6': [258],
  'Stair 7': [259],
  'Elevator 15': [260],
  'Details': [261, 262, 263],
};

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

/**
 * Group text items into spatial rows (same logic as tools.ts getPageText)
 */
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

/**
 * Format a page's text in both row and full-text format (matches get_page_text output)
 */
function formatPage(pageData: PageTextData): string {
  let output = `${'═'.repeat(80)}\n`;
  output += `  PAGE ${pageData.pageNumber} (${pageData.textItemCount} text items, ${pageData.pageWidth.toFixed(0)}x${pageData.pageHeight.toFixed(0)} pts)\n`;
  output += `${'═'.repeat(80)}\n\n`;

  if (pageData.textItemCount === 0) {
    output += '  (no text content — graphic-only or scanned page)\n\n';
    return output;
  }

  // Spatial rows format (what counting agents see)
  const rows = groupIntoRows(pageData.textItems);
  output += `[spatial-rows] (${rows.length} rows, top-to-bottom)\n`;
  for (const row of rows) {
    const rowText = row.items.map(i => i.text).join(' | ');
    output += `  ROW y=${Math.round(row.y)}: ${rowText}\n`;
  }

  // Highlight riser/tread annotations
  output += `\n[annotations found]\n`;
  const annotations: string[] = [];
  for (const row of rows) {
    const rowText = row.items.map(i => i.text).join(' ');
    // Match common annotation patterns
    if (/\d+\s*(EQ\s*)?R(S?RS|ISERS)/i.test(rowText) || /\d+\s*TREADS/i.test(rowText)) {
      annotations.push(`  y=${Math.round(row.y)}: ${rowText.trim()}`);
    }
  }
  if (annotations.length > 0) {
    output += annotations.join('\n') + '\n';
  } else {
    output += '  (no riser/tread annotations found on this page)\n';
  }

  // Full text (what keyword search sees)
  output += `\n[full-text]\n${pageData.fullText}\n`;

  return output;
}

async function main() {
  const args = process.argv.slice(2);

  // Parse args
  let pagesToDump: number[] = [];
  let outputLabel = 'stairs-250-270';

  if (args.includes('--all')) {
    pagesToDump = []; // Will dump all pages
    outputLabel = 'all-pages';
  } else if (args.includes('--pages')) {
    const pagesStr = args[args.indexOf('--pages') + 1];
    pagesToDump = pagesStr.split(',').map(Number);
    outputLabel = `pages-${pagesStr.replace(/,/g, '-')}`;
  } else if (args.includes('--stair')) {
    const stairNum = args[args.indexOf('--stair') + 1];
    const stairKey = `Stair ${stairNum}`;
    if (!STAIR_PAGES[stairKey]) {
      console.error(`Unknown stair: ${stairKey}. Available: ${Object.keys(STAIR_PAGES).join(', ')}`);
      process.exit(1);
    }
    pagesToDump = STAIR_PAGES[stairKey];
    outputLabel = `stair-${stairNum}`;
  } else {
    // Default: all stair pages 250-270
    pagesToDump = Array.from({ length: 21 }, (_, i) => 250 + i);
    outputLabel = 'stairs-250-270';
  }

  // Extract text from PDF
  console.log(`📝 Extracting text from PDF...`);
  const extractorPath = path.join(DIST, 'core', 'pdf-text-extractor.js');
  const { extractAllPagesText } = await import(extractorPath);
  const textData = await extractAllPagesText(PDF_PATH);

  // Filter to requested pages
  const pages = pagesToDump.length > 0
    ? textData.pages.filter((p: PageTextData) => pagesToDump.includes(p.pageNumber))
    : textData.pages;

  // Build output
  let output = `TEXT DUMP: ${outputLabel}\n`;
  output += `PDF: ${path.basename(PDF_PATH)}\n`;
  output += `Pages: ${pages.length} of ${textData.pageCount}\n`;
  output += `Generated: ${new Date().toISOString()}\n`;
  output += `\nThis is EXACTLY what the agent sees when it calls get_page_text().\n`;
  output += `Look for riser/tread annotations like "14 EQ RSRS 7'-6\\"" or "13 TREADS @ 11\\""\n\n`;

  // Per-stair grouping header
  if (!args.includes('--all') && !args.includes('--pages')) {
    output += `${'─'.repeat(80)}\n`;
    output += `STAIR → PAGE MAPPING\n`;
    output += `${'─'.repeat(80)}\n`;
    for (const [stair, stairPages] of Object.entries(STAIR_PAGES)) {
      output += `  ${stair.padEnd(16)} → pages ${stairPages.join(', ')}\n`;
    }
    output += `${'─'.repeat(80)}\n\n`;
  }

  for (const page of pages) {
    // Add stair label if this page belongs to a known stair
    for (const [stair, stairPages] of Object.entries(STAIR_PAGES)) {
      if (stairPages.includes(page.pageNumber)) {
        output += `\n▼▼▼ ${stair} ▼▼▼\n`;
        break;
      }
    }
    output += formatPage(page);
    output += '\n';
  }

  // Write to file
  fs.mkdirSync(DUMP_DIR, { recursive: true });
  const outputPath = path.join(DUMP_DIR, `${outputLabel}.txt`);
  fs.writeFileSync(outputPath, output);

  console.log(`\n✅ Text dump saved to: ${outputPath}`);
  console.log(`   ${pages.length} pages, ${output.length.toLocaleString()} chars`);

  // Also print annotation summary to console
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ANNOTATION SUMMARY`);
  console.log(`${'═'.repeat(60)}`);

  for (const page of pages) {
    const rows = groupIntoRows(page.textItems);
    const annotations: string[] = [];
    for (const row of rows) {
      const rowText = row.items.map((i: { text: string }) => i.text).join(' ');
      if (/\d+\s*(EQ\s*)?R(S?RS|ISERS)/i.test(rowText) || /\d+\s*TREADS/i.test(rowText)) {
        annotations.push(rowText.trim());
      }
    }

    const stairLabel = Object.entries(STAIR_PAGES).find(([, p]) => p.includes(page.pageNumber))?.[0] || '';
    if (annotations.length > 0) {
      console.log(`\n  Page ${page.pageNumber} (${stairLabel}):`);
      for (const a of annotations) {
        console.log(`    • ${a}`);
      }
    } else {
      console.log(`\n  Page ${page.pageNumber} (${stairLabel}): no annotations found`);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
