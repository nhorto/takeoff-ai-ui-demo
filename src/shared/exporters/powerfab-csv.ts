/**
 * CSV exporter for PowerFab import.
 *
 * Takes expanded Item[] (output of evaluatePA) and produces a CSV string
 * in the starting-guess column layout. The actual PowerFab importer format
 * is not yet verified — see docs/plans/01-pa-engine.md §8.
 */

import type { Item } from "../engine/types";
import { formatFeetInches, formatInches, toMm } from "../engine/units";

export interface CsvExportOptions {
  lengthFormat?: "feet-inches" | "decimal-inches" | "millimeters";
  fractionDenominator?: number;
  includeHeader?: boolean;
  sequenceStart?: number;
  sequenceIncrement?: number;
}

const COLUMNS = [
  "Item",
  "Sequence",
  "Qty",
  "Shape",
  "Size",
  "Length",
  "Width",
  "Grade",
  "LaborCode",
  "Finish",
  "Holes",
  "Copes",
  "Stiffeners",
  "Comment",
] as const;

export function exportItemsToCsv(
  items: Item[],
  options: CsvExportOptions = {},
): string {
  const {
    lengthFormat = "feet-inches",
    fractionDenominator = 16,
    includeHeader = true,
    sequenceStart = 10,
    sequenceIncrement = 10,
  } = options;

  const rows: string[] = [];
  if (includeHeader) rows.push(COLUMNS.join(","));

  items.forEach((item, index) => {
    const seq = sequenceStart + index * sequenceIncrement;
    const row: Record<(typeof COLUMNS)[number], string> = {
      Item: String(index + 1),
      Sequence: String(seq),
      Qty: formatNumber(item.quantity),
      Shape: item.shape,
      Size: item.size ?? "",
      Length: formatLength(item.length, lengthFormat, fractionDenominator),
      Width: formatLength(item.width, lengthFormat, fractionDenominator),
      Grade: item.grade,
      LaborCode: item.laborCode ?? "",
      Finish: item.finish ?? "PNT",
      Holes: String(item.holes ?? 0),
      Copes: String(item.copes ?? 0),
      Stiffeners: String(item.stiffeners ?? 0),
      Comment: item.comment ?? item.description ?? "",
    };

    rows.push(COLUMNS.map((col) => csvEscape(row[col])).join(","));
  });

  return rows.join("\n");
}

function formatLength(
  value: number | undefined,
  mode: "feet-inches" | "decimal-inches" | "millimeters",
  denominator: number,
): string {
  if (value === undefined) return "";
  switch (mode) {
    case "feet-inches":
      return formatFeetInches(value, denominator);
    case "decimal-inches":
      return formatInches(value);
    case "millimeters":
      return `${Number(toMm(value).toFixed(3))}`;
  }
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(4)));
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
