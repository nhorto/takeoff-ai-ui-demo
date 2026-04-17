/**
 * Type definitions for the PA engine.
 *
 * See docs/plans/01-pa-engine.md §3 for the rationale and design decisions
 * behind each shape in this file.
 */

// ─── Variables ──────────────────────────────────────────────────────────────

export type VariableType =
  | "integer"
  | "decimal"
  | "length"
  | "dimension"
  | "enum";

export type VariableValue = number | string | null;

export interface VariableDef {
  key: string;
  label: string;
  description?: string;
  type: VariableType;
  defaultValue?: VariableValue;
  required?: boolean;
  enumOptions?: { value: string; label: string }[];
  shapeFilter?: string[];
  position?: number;
  // Hidden variables never render in the form. The engine uses defaultValue
  // as a company default — this is how shop-level choices (stringer size,
  // riser height, labor codes, etc.) stay out of the estimator's way.
  hidden?: boolean;
  // Optional tab/section grouping used by form UIs to partition related
  // variables (e.g. "geometry" | "stringers" | "treads").
  group?: string;
}

// ─── Items (engine output) ──────────────────────────────────────────────────

export type Finish = "PNT" | "UNP" | "GLV";

export interface Item {
  mainPiece?: boolean;
  shape: string;
  size?: string;
  grade: string;
  quantity: number;
  length?: number;
  width?: number;
  laborCode?: string;
  finish?: Finish;
  comment?: string;
  description?: string;

  holes?: number;
  copes?: number;
  stiffeners?: number;
  webHoles?: number;
  topFlangeHoles?: number;
  bottomFlangeHoles?: number;
  weldedStuds?: number;

  manHoursPerPiece?: number;
  erectHours?: number;
}

// ─── PA templates ───────────────────────────────────────────────────────────

export type PACategory =
  | "stair"
  | "landing"
  | "rail"
  | "ladder"
  | "column"
  | "lintel"
  | "embed"
  | "misc";

export interface PATemplate {
  id: string;
  name: string;
  description: string;
  category: PACategory;
  variables: VariableDef[];
  calculate: (values: Record<string, VariableValue>) => Item[];
}
