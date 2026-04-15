/**
 * The PA runtime. One public function: evaluatePA.
 *
 * See docs/plans/01-pa-engine.md §4.
 */

import type { Item, PATemplate, VariableValue } from "./types";

export interface EvaluateResult {
  items: Item[];
  resolvedValues: Record<string, VariableValue>;
  warnings: string[];
}

export class EvaluationError extends Error {
  readonly templateId: string;
  readonly cause?: unknown;

  constructor(message: string, templateId: string, cause?: unknown) {
    super(message);
    this.name = "EvaluationError";
    this.templateId = templateId;
    this.cause = cause;
  }
}

export function evaluatePA(
  template: PATemplate,
  userValues: Record<string, VariableValue>,
): EvaluateResult {
  // 1. Validate required variables and build the resolved value map.
  const resolvedValues: Record<string, VariableValue> = {};
  const warnings: string[] = [];
  const missing: string[] = [];

  for (const def of template.variables) {
    const provided = userValues[def.key];
    if (provided !== undefined && provided !== null) {
      resolvedValues[def.key] = provided;
      continue;
    }

    if (def.defaultValue !== undefined && def.defaultValue !== null) {
      resolvedValues[def.key] = def.defaultValue;
      continue;
    }

    if (def.required) {
      missing.push(def.key);
      continue;
    }

    warnings.push(`Variable "${def.key}" has no value and no default.`);
    resolvedValues[def.key] = null;
  }

  if (missing.length > 0) {
    throw new EvaluationError(
      `Missing required variables: ${missing.join(", ")}`,
      template.id,
    );
  }

  // 2. Run the PA's calculate function. Wrap any error.
  let rawItems: Item[];
  try {
    rawItems = template.calculate(resolvedValues);
  } catch (err) {
    throw new EvaluationError(
      `calculate() threw: ${err instanceof Error ? err.message : String(err)}`,
      template.id,
      err,
    );
  }

  if (!Array.isArray(rawItems)) {
    throw new EvaluationError(
      `calculate() returned ${typeof rawItems}, expected an array`,
      template.id,
    );
  }

  // 3. Post-process: apply item defaults without mutating the input.
  const items: Item[] = rawItems.map((raw) => ({
    mainPiece: raw.mainPiece ?? false,
    shape: raw.shape,
    size: raw.size,
    grade: raw.grade,
    quantity: raw.quantity,
    length: raw.length,
    width: raw.width,
    laborCode: raw.laborCode,
    finish: raw.finish ?? "PNT",
    comment: raw.comment,
    description: raw.description,
    holes: raw.holes ?? 0,
    copes: raw.copes ?? 0,
    stiffeners: raw.stiffeners ?? 0,
    webHoles: raw.webHoles ?? 0,
    topFlangeHoles: raw.topFlangeHoles ?? 0,
    bottomFlangeHoles: raw.bottomFlangeHoles ?? 0,
    weldedStuds: raw.weldedStuds ?? 0,
    manHoursPerPiece: raw.manHoursPerPiece,
    erectHours: raw.erectHours,
  }));

  return { items, resolvedValues, warnings };
}
