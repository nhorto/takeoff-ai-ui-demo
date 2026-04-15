# Plan 01 — The PA Engine (Track 1)

_Status: **Complete.** Plan drafted 2026-04-15, implemented 2026-04-15. Engine, 5 starter PAs, CSV exporter, and 92 passing tests. See [§14 implementation report](#14-implementation-report) at the end of this doc._

This is the first build plan for the takeoff-agent-app. It specifies the **PA engine** — the "backend under the hood" (Track 1 of the two-track model in [`../architecture/parametric-assembly-product-direction.md`](../architecture/parametric-assembly-product-direction.md)) — which turns estimator-provided variable values into expanded material lists that can be exported to PowerFab.

This doc is meant to be complete enough that a future engineer (including a future Claude session) can implement the engine from just this plan, without needing to re-read any other docs in the repo.

Related reference material:

- [`../architecture/parametric-assembly-product-direction.md`](../architecture/parametric-assembly-product-direction.md) — why this engine exists and how it fits the overall product
- [`../powerfab/parametric-assembly-authoring-guide.md`](../powerfab/parametric-assembly-authoring-guide.md) — how PowerFab PAs work conceptually (the thing we're modeling)
- [`../powerfab/database-findings.md`](../powerfab/database-findings.md) — the PowerFab data model we're drawing from
- [`../powerfab/aisc-shapes-catalog.md`](../powerfab/aisc-shapes-catalog.md) — the canonical shape/size catalog (AISC v16.0)
- [`../../scripts/powerfab-schema-dump/dump/parametric_assemblies/`](../../scripts/powerfab-schema-dump/dump/parametric_assemblies/) — 49 real PAs from Ricky's library, used as ground truth for building our starter library

---

## Table of contents

1. [Purpose and non-goals](#1-purpose-and-non-goals)
2. [Core design decision: TypeScript, not a formula DSL](#2-core-design-decision-typescript-not-a-formula-dsl)
3. [TypeScript data model](#3-typescript-data-model)
4. [Runtime contract](#4-runtime-contract)
5. [Unit helper library](#5-unit-helper-library)
6. [Worked example: the Stair Channel PA](#6-worked-example-the-stair-channel-pa)
7. [Starter PA library](#7-starter-pa-library)
8. [CSV exporter](#8-csv-exporter)
9. [File structure](#9-file-structure)
10. [Test strategy](#10-test-strategy)
11. [Implementation order](#11-implementation-order)
12. [Future work and deferred decisions](#12-future-work-and-deferred-decisions)
13. [Open questions](#13-open-questions)

---

## 1. Purpose and non-goals

### What the engine does

The PA engine is the calculation core of the takeoff-agent-app. Given:

- A **PA template** (a TypeScript module describing an assembly type — its variables and how to compute its items)
- A set of **variable values** provided by the estimator (stair width, number of treads, etc.)

the engine produces:

- A list of **expanded items** — concrete material rows with shape, size, length, grade, labor code, finish, etc. — ready to be rendered in the UI or serialized to a CSV for PowerFab import.

It's a pure function. No database access, no network calls, no side effects. Takes data in, gives data out.

### In scope for Phase 1

- A TypeScript data model for PA templates, variables, and computed items
- A runtime function `evaluatePA(template, values) → Item[]`
- A unit helper library for working with lengths in a consistent canonical unit
- A starter library of 4–6 hand-written PA templates modeled on Ricky's real PAs
- A CSV exporter that takes `Item[]` and produces a PowerFab-importable file
- A test suite that validates each PA's output against hand-computed expected results for several input combinations

### Explicitly NOT in scope

- **No formula parser, AST, or formula-string evaluator.** We do not rebuild PowerFab's formula dialect. See [§2](#2-core-design-decision-typescript-not-a-formula-dsl).
- **No PA authoring UI.** Authoring a PA means writing a TypeScript module in the repo. End users never see this.
- **No UI of any kind.** This plan covers Track 1 only. The UI is Track 2 ([`../architecture/workflow-ux-explorations.md`](../architecture/workflow-ux-explorations.md)).
- **No PowerFab `.txt` import.** Deferred to future work ([§12.1](#121-powerfab-txt-import)).
- **No per-company data-driven PA customization.** Deferred ([§12.3](#123-per-company-pa-customization)).
- **No AI-assisted PA authoring.** Deferred ([§12.2](#122-ai-assisted-pa-authoring)).
- **No runtime verification against PowerFab output.** Deferred — we aim for functional equivalence only and flag discrepancies to fix later ([§12.4](#124-powerfab-compatibility-verification)).
- **No `SIN`, `COS`, `HYP`, `FLOOR`, `ROUND` special handling.** None of Ricky's 49 PAs use them. If a future PA needs them, add standard `Math.sin/cos/floor/round` at that point — no spec change needed.

---

## 2. Core design decision: TypeScript, not a formula DSL

**The single most important decision in this plan**: PA templates are TypeScript modules, not formula strings. There is no parser, no AST, no RPN, no expression grammar.

### Why this matters

PowerFab stores formulas as strings like:

```
SQRT(([Hieght Between Landings]*[Hieght Between Landings])+...)+1"
```

...because PowerFab is a GUI tool and needed a way to let users enter calculations through a dialog. They built a stringly-typed mini-language for it. Their problem; their solution.

**We're building in TypeScript.** TypeScript already has `if`, `Math.ceil`, `Math.sqrt`, `**`, variables, functions, and a powerful type system. Reimplementing PowerFab's formula dialect would be reimplementing a weaker version of TypeScript inside TypeScript. It's the wrong abstraction.

Instead, a PA template in our system is a TypeScript object with a `calculate(values)` method that returns items directly:

```ts
// Instead of this (PowerFab-style formula string):
Length: "SQRT(([Height]*[Height])+((([Height]/6.75\")*11\")^2))+1\""

// We write this (real TypeScript):
const stringerLength = Math.sqrt(
  values.heightBetweenLandings ** 2 +
  ((values.heightBetweenLandings / inches(6.75)) * inches(11)) ** 2
) + inches(1);
```

### Consequences — good

- **The engine is trivial.** The "runtime" is essentially `template.calculate(values)`.
- **No parser bugs.** No formula edge cases. No unit coercion surprises from a handwritten evaluator.
- **Type safety.** Variable keys are checked at compile time. Item shapes are validated by TypeScript.
- **IDE affordances work.** Autocomplete, go-to-definition, refactoring, and type errors all apply to PA templates.
- **Testing is normal.** Unit tests on PA templates are unit tests on functions.
- **Easy debugging.** Set breakpoints, step through, inspect values — normal JavaScript debugging.
- **LLMs can generate PA templates directly.** For the future AI-assisted authoring feature, the AI generates TypeScript code, which LLMs are excellent at — far better than generating bespoke DSL strings.

### Consequences — trade-offs to flag

- **Authoring a PA requires writing code.** This is fine because **estimators never author PAs**. Only developers (or the future AI-assisted authoring feature, which generates code for us) write PAs.
- **Adding a new PA requires a code deploy.** The PA library is part of the app bundle, not a database table. Adding a new PA for a specific customer means a PR and a deploy. If that becomes a bottleneck, we revisit with a data-driven path (see [§12.3](#123-per-company-pa-customization)).
- **Importing existing PowerFab PAs requires translation, not execution.** When we eventually support PowerFab `.txt` import, we translate the formula strings into TypeScript modules once at import time, rather than executing them at runtime. Translation is a solvable problem (the grammar is small, the patterns are few); runtime execution would force us to build the parser we don't want to build. See [§12.1](#121-powerfab-txt-import).

These are all acceptable for Phase 1. The simplification is worth it.

---

## 3. TypeScript data model

All types live in `src/shared/engine/types.ts`.

### Variable types

```ts
export type VariableType =
  | "integer"     // whole number: counts, selectors
  | "decimal"     // floating-point: ratios, hours, generic numbers
  | "length"      // a length in canonical units (inches — see §5)
  | "dimension"   // an AISC designation string: "C12X20.7", "HSS8X8X1/2"
  | "enum";       // a one-of-several selection (our clean replacement for PowerFab's integer-as-enum hack)

export type VariableValue = number | string | null;
```

We deliberately **do not** include PowerFab's `Property from EST Line Item` or `Property from Assembly Line Item` variable types in Phase 1:

- `Property from EST Line Item` depends on an estimating-job context we don't have yet
- `Property from Assembly Line Item` (used in the Lintel PA for beam-depth-drives-stiffener-length) can be implemented in the `calculate` function directly — when you need "the beam depth", you just look up the beam's size in the AISC catalog and pull the depth from there, in normal TypeScript. No special variable type needed.

### Variable definition

```ts
export interface VariableDef {
  /** Machine-readable identifier used as the key in the values object. */
  key: string;

  /** Human-readable label shown to the estimator in the form. */
  label: string;

  /** Optional longer explanation, shown as helper text. */
  description?: string;

  /** What kind of value this variable holds. */
  type: VariableType;

  /** Value used if the estimator doesn't enter one. */
  defaultValue?: VariableValue;

  /** If true, the form cannot be submitted without a value. */
  required?: boolean;

  /**
   * For `enum` type: the legal choices.
   * Each choice has a stable machine value and a display label.
   */
  enumOptions?: { value: string; label: string }[];

  /**
   * For `dimension` type: restrict the picker to certain shape types.
   * e.g. ["C", "MC"] limits to channel and misc channel.
   * If omitted, all shapes are allowed.
   */
  shapeFilter?: string[];

  /** Display order in the form. Lower = earlier. */
  position?: number;
}
```

### Item (output)

```ts
export type Finish = "PNT" | "UNP" | "GLV";

export interface Item {
  /** True for the header row that labels the assembly. Default false. */
  mainPiece?: boolean;

  /** AISC-style shape code: "W", "C", "HSS", "PL", "L", "PIPE", "CO", "BY", etc. */
  shape: string;

  /**
   * AISC-style designation for rolled shapes, or supplementary designation
   * for plate/bar/sheet. Example: "C12X20.7", "PL1/4", "HSS8X8X1/2".
   * Optional for CO (comment) and BY (buy-out) rows.
   */
  size?: string;

  /** Material grade: "A36", "A500", "A992", "A53", "." (comment), "-" (buy-out). */
  grade: string;

  /** Number of pieces. Required. */
  quantity: number;

  /** Length in canonical units (inches). Optional for comment and buy-out rows. */
  length?: number;

  /** Width in canonical units, for rectangular shapes (plate, sheet, grating). */
  width?: number;

  /** Company-specific labor code (e.g. "H", "M", "JJ"). Optional. */
  laborCode?: string;

  /** Painted / unpainted / galvanized. Defaults to PNT. */
  finish?: Finish;

  /** Short label for this row ("Stringer", "Tread", "Cap Plate"). */
  comment?: string;

  /**
   * Label that appears in the assembly header row.
   * Only meaningful when mainPiece is true.
   */
  description?: string;

  // --- Fabrication detail fields (all default to 0, all optional) ---
  holes?: number;
  copes?: number;
  stiffeners?: number;
  webHoles?: number;
  topFlangeHoles?: number;
  bottomFlangeHoles?: number;
  weldedStuds?: number;

  // --- Labor overrides (all optional) ---
  /** Manual per-piece hours override, bypassing the labor code's calc. */
  manHoursPerPiece?: number;
  /** Erection hours, typically set on the main piece row as a flat total. */
  erectHours?: number;
}
```

### PA template

```ts
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
  /** Stable identifier for this template. Used as a URL slug, DB key, etc. */
  id: string;

  /** Display name ("Stair Channel", "Roof Ladder"). */
  name: string;

  /** Longer description shown in the type-picker UI. */
  description: string;

  /** Top-level category — determines which "Add X" button creates this. */
  category: PACategory;

  /** Variable definitions the estimator sees as form fields. */
  variables: VariableDef[];

  /**
   * The calculation function. Takes filled-in variable values and returns
   * the list of items. Should be a pure function — no side effects.
   */
  calculate: (values: Record<string, VariableValue>) => Item[];
}
```

---

## 4. Runtime contract

The engine has one public function:

```ts
// src/shared/engine/runtime.ts

import type { PATemplate, VariableValue, Item } from "./types";

export interface EvaluateResult {
  /** The computed items, in the order returned by calculate(). */
  items: Item[];

  /** Values actually used during evaluation (defaults applied). */
  resolvedValues: Record<string, VariableValue>;

  /** Any warnings the runtime surfaces (e.g. missing optional values). */
  warnings: string[];
}

export class EvaluationError extends Error {
  constructor(
    message: string,
    public readonly templateId: string,
    public readonly cause?: unknown,
  ) {
    super(message);
  }
}

export function evaluatePA(
  template: PATemplate,
  userValues: Record<string, VariableValue>,
): EvaluateResult;
```

### Contract behavior

1. **Validate required variables.** For each variable in `template.variables` with `required: true`, confirm `userValues` has a non-null entry. If not, throw an `EvaluationError` with a clear message listing missing required variables. (Don't crash — throw.)

2. **Apply defaults.** For each variable missing from `userValues`, use `defaultValue` if present. If neither a value nor a default exists and the variable is not required, leave it as `undefined` and emit a warning.

3. **Call `template.calculate(resolvedValues)`.** This is where the PA template's TypeScript function runs. It returns `Item[]`.

4. **Post-process the items.** Apply defaults to each item: `finish` defaults to `"PNT"`, `mainPiece` defaults to `false`, and any missing numeric detail fields default to `0`. Don't mutate the returned items — produce a new array.

5. **Return** the processed items, the resolved values (so the UI can show what defaults were applied), and any warnings.

### What the runtime does NOT do

- **No unit conversion.** If the user enters `4' 6"` in the form, the UI converts it to canonical inches BEFORE calling `evaluatePA`. The engine works in canonical units only.
- **No size-to-dimensions resolution.** If a PA item returns `size: "C12X20.7"`, the engine doesn't look up the actual channel depth or flange width. That's a concern for the CSV exporter (which just passes the designation string through) or the UI (which may want to show the designation's depth for display).
- **No rounding.** Items with fractional quantities or lengths pass through unchanged. The exporter decides the output precision.
- **No I/O.** Pure function. Given the same inputs, always returns the same outputs.

---

## 5. Unit helper library

Location: `src/shared/engine/units.ts`.

### This is strictly an internal convention, not a user-facing choice

Before anything else: **the user never sees "inches vs mm" anywhere in the UI.** The UI accepts and displays whatever format the estimator prefers (feet-inches like `4' 6"`, decimal feet like `4.5`, mm, etc.). The canonical unit is strictly about "what does the bare number mean when it's sitting inside the engine" so that arithmetic is consistent across PA templates.

The reason we need a canonical unit at all: once any PA template does math on lengths — Pythagorean for stringer length, dividing height by riser to get tread count, adding a 1" slack — the values have to be plain numbers. `Math.sqrt("10 ft"² + "11 ft"²)` is not a thing. Plain numbers need a unit convention or `stringerLength + 1` is ambiguous (add 1 inch? 1 foot? 1 mm?). We pick one convention and stick to it; every PA template author knows it; the UI converts at the boundary.

### Canonical internal unit

**Lengths are stored as numbers in inches.** This is an arbitrary choice but a consistent one. Everywhere inside the engine and the PA templates, a `length` variable value or an `Item.length` field is a number of inches.

Why inches (not mm):

- U.S. imperial is the target market for Phase 1
- AISC dimensional properties are natively imperial
- Estimators type feet + inches, which converts cleanly
- Math reads naturally: `v.stairWidth * v.treadCount` is in inches × count, which is still inches

We could change this to mm later by updating only the helper implementations below — no PA template changes would be needed because they always go through the helpers.

### Helper functions

```ts
// Input helpers — convert from user-facing units to canonical inches

/** A literal inches value. Pass-through for readability: inches(6) === 6. */
export const inches = (n: number): number => n;

/** Feet to inches: feet(4) === 48. */
export const feet = (n: number): number => n * 12;

/** Millimeters to inches: mm(25.4) === 1. */
export const mm = (n: number): number => n / 25.4;

/** Feet + inches combined: ftIn(4, 6) === 54. */
export const ftIn = (f: number, i: number = 0): number => f * 12 + i;

// Conversion helpers — canonical inches to other units

export const toFeet = (inches: number): number => inches / 12;
export const toMm = (inches: number): number => inches * 25.4;

// Display helpers

/**
 * Format an inches value as feet-and-inches for display.
 * formatFeetInches(54) === "4' 6\""
 * formatFeetInches(54.5) === "4' 6 1/2\""
 */
export function formatFeetInches(
  inches: number,
  fractionDenominator: number = 16,
): string;

/**
 * Format as decimal inches: formatInches(54.5) === "54.5\""
 */
export function formatInches(
  inches: number,
  decimals: number = 2,
): string;
```

### Parsing helper (for UI → engine conversion)

```ts
/**
 * Parse a human-entered length into canonical inches.
 *
 * Accepts:
 *   "4' 6"          → 54
 *   "4'-6\""         → 54
 *   "4' 6 1/2"      → 54.5
 *   "54"            → 54 (assumed inches)
 *   "54 in"         → 54
 *   "4.5 ft"        → 54
 *   "1370 mm"       → 53.937...
 *
 * Throws ParseError on unrecognized input.
 */
export function parseLength(input: string): number;

export class ParseError extends Error {}
```

Parsing is best-effort and will grow more permissive over time. Keep the initial implementation strict and expand as real estimator inputs reveal edge cases.

---

## 6. Worked example: the Stair Channel PA

This is what a PA template file actually looks like. Based on Ricky's Stair Channel PA (PA ID 29 in the dumped library), simplified for readability.

```ts
// src/shared/pa-library/stair-channel.ts

import type { PATemplate } from "../engine/types";
import { inches, feet, ftIn } from "../engine/units";

export const stairChannel: PATemplate = {
  id: "stair-channel",
  name: "Stair Channel",
  description: "Channel-stringer stair with pan treads. Two stringers, jacks, and tread pans.",
  category: "stair",

  variables: [
    {
      key: "heightBetweenLandings",
      label: "Height Between Landings",
      description: "Vertical distance from the lower landing surface to the upper landing surface.",
      type: "length",
      defaultValue: feet(10),
      required: true,
      position: 1,
    },
    {
      key: "stairWidth",
      label: "Stair Width",
      description: "Width of the treads (also the overall stair width).",
      type: "length",
      defaultValue: ftIn(3, 6),
      required: true,
      position: 2,
    },
    {
      key: "stringerSize",
      label: "Stringer Size",
      description: "Channel size for the two stringers.",
      type: "dimension",
      shapeFilter: ["C", "MC"],
      defaultValue: "C12X20.7",
      required: true,
      position: 3,
    },
    {
      key: "riserHeight",
      label: "Riser Height",
      description: "Vertical distance between treads. Commercial default 6.75 in.",
      type: "length",
      defaultValue: inches(6.75),
      required: true,
      position: 4,
    },
    {
      key: "treadDepth",
      label: "Tread Depth",
      description: "Horizontal run of each tread. Commercial default 11 in.",
      type: "length",
      defaultValue: inches(11),
      required: true,
      position: 5,
    },
  ],

  calculate: (v) => {
    const height = v.heightBetweenLandings as number;
    const width = v.stairWidth as number;
    const stringerSize = v.stringerSize as string;
    const riser = v.riserHeight as number;
    const run = v.treadDepth as number;

    const numTreads = Math.floor(height / riser);
    const horizontalRun = numTreads * run;
    const stringerLength =
      Math.sqrt(height * height + horizontalRun * horizontalRun) + inches(1);

    return [
      {
        mainPiece: true,
        shape: "CO",
        grade: ".",
        quantity: 1,
        description: "Stair",
        erectHours: 40,
        finish: "PNT",
      },
      {
        shape: "C",
        size: stringerSize,
        grade: "A36",
        quantity: 2,
        length: stringerLength,
        laborCode: "M",
        finish: "PNT",
        comment: "Stringer",
      },
      {
        shape: "L",
        size: "L3X3X1/4",
        grade: "A36",
        quantity: numTreads * 2,
        length: inches(9),
        laborCode: "Y",
        finish: "PNT",
        comment: "Jacks",
      },
      {
        shape: "PL",
        size: "PL14GA",
        grade: "A36",
        quantity: numTreads,
        length: width,
        width: run,
        laborCode: "JJ",
        finish: "PNT",
        comment: "Tread Pans",
      },
      {
        shape: "PL",
        size: "PL3/8",
        grade: "A36",
        quantity: 3,
        length: inches(12),
        width: inches(2),
        laborCode: "W",
        finish: "PNT",
        comment: "Caps",
      },
      {
        shape: "L",
        size: "L2X2X1/4",
        grade: "A36",
        quantity: 2,
        length: inches(12),
        laborCode: "Y",
        finish: "PNT",
        comment: "Clips",
      },
    ];
  },
};
```

Compare this to the real PowerFab Stair Channel PA (in `dump/parametric_assemblies/008_Stair_Channel.json`):

- The PowerFab PA uses `Hieght Between Landings` (typo and all), stored in mm; we use `heightBetweenLandings`, stored canonically in inches.
- PowerFab's stringer length formula is a 200-character string with embedded unit literals; ours is three lines of TypeScript that any developer can read.
- PowerFab's `6.75"` is hardcoded in the formula; ours is a proper variable with a default, so the estimator can override it for residential or industrial applications.
- Every shape, size, grade, and labor code in our version corresponds to the same concept PowerFab uses, but expressed as strings directly (AISC designations) rather than numeric IDs that point into a lookup table.

---

## 7. Starter PA library

Phase 1 ships with **5 starter PAs**, each modeled on a corresponding PA from Ricky's library:

| Our ID | Our Name | Modeled on (Ricky's PA) | Category | Why this one |
|---|---|---|---|---|
| `stair-channel` | Stair Channel | PA 29 — Stair Channel | stair | Core product demo. Covers the Pythagorean pattern. |
| `landing-channel` | Landing Channel | PA 33 — Landing Channel | landing | Pairs with Stair Channel. Exercises conditional rows (flooring type, connection type). |
| `hss-rail-pickets` | HSS Rail with Pickets | PA 32 — HSS Rail w/Pickets | rail | Covers the "sections with turns" pattern. Our cleaner version uses a variable-length sections array instead of fixed Side 1 / Side 2. |
| `roof-ladder` | Roof Ladder | PA 54 — Ladder | ladder | Simple, shows the buy-out (BY) pattern for brackets. |
| `column-hss` | HSS Column | PA 43 — Columns Pipe / Channel (HSS variant only) | column | Demonstrates dimension variables driving an item's SizeID via the Property-from-Assembly-Line-Item pattern, expressed as normal TS. |

These cover the four most common assembly categories plus one column for demonstration. They're enough to exercise the engine, the unit helpers, the CSV exporter, and the UI (once Track 2 begins), and they match what an estimator doing a typical stair-tower takeoff would reach for first.

Each starter PA lives in its own file under `src/shared/pa-library/`, exports the `PATemplate` as a named export, and is registered in the library index:

```ts
// src/shared/pa-library/index.ts
import { stairChannel } from "./stair-channel";
import { landingChannel } from "./landing-channel";
import { hssRailPickets } from "./hss-rail-pickets";
import { roofLadder } from "./roof-ladder";
import { columnHss } from "./column-hss";

export const starterLibrary: PATemplate[] = [
  stairChannel,
  landingChannel,
  hssRailPickets,
  roofLadder,
  columnHss,
];

export function getTemplate(id: string): PATemplate | undefined {
  return starterLibrary.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: PACategory): PATemplate[] {
  return starterLibrary.filter((t) => t.category === category);
}
```

### Modeling accuracy note

These are **hand-ported** from Ricky's real PAs, not automatically extracted. Each one:

1. Reads the corresponding dumped JSON (`dump/parametric_assemblies/NNN_Name.json`)
2. Interprets the PowerFab formula strings, unit literals, and shape/grade/labor IDs
3. Expresses the same logic as clean TypeScript
4. Preserves the item count, ordering, and the quantitative relationships between variables and outputs

Because compatibility is B ([§3 of the product direction doc's decisions](../architecture/parametric-assembly-product-direction.md)), we aim for **functional equivalence** rather than byte-for-byte output match. If our Stair Channel produces a 12-tread stair with stringer length 19'6" and Ricky's PowerFab version produces 19'6 1/8", that's an acceptable discrepancy to start. The test suite ([§10](#10-test-strategy)) pins down specific expected values so we catch regressions, and future work ([§12.4](#124-powerfab-compatibility-verification)) adds a verification pass against PowerFab's actual output.

---

## 8. CSV exporter

Location: `src/shared/exporters/powerfab-csv.ts`.

### Output format (starting guess)

Until we have a verified PowerFab import format spec, we'll produce a CSV with this column layout:

```
Item, Sequence, Qty, Shape, Size, Length, Width, Grade, LaborCode, Finish, Holes, Copes, Stiffeners, Comment
```

- **Item / Sequence** — row numbering (10, 20, 30, ...) with sparse increments so insertions don't renumber everything
- **Qty** — integer or decimal as-is from the item's `quantity`
- **Shape** — AISC-style shape code ("C", "HSS", "PL", "CO", etc.)
- **Size** — AISC designation ("C12X20.7", "PL1/4") or empty for CO/BY rows
- **Length** — formatted as feet-and-inches by default (configurable per user)
- **Width** — same formatting as length
- **Grade** — the `grade` field passthrough
- **LaborCode** — the `laborCode` field passthrough, or empty if not set
- **Finish** — PNT / UNP / GLV
- **Holes / Copes / Stiffeners** — integer counts
- **Comment** — the `comment` field

Detail fields we're *not* emitting in the first version (because we don't know if PowerFab's importer reads them): WebHoles, TopFlangeHoles, BottomFlangeHoles, WeldedStuds, ManHoursPerPiece, ErectHours. Add them later if testing reveals they're needed.

### Function signature

```ts
// src/shared/exporters/powerfab-csv.ts

import type { Item } from "../engine/types";

export interface CsvExportOptions {
  /** Length formatting — "feet-inches" (default) or "decimal-inches" or "millimeters". */
  lengthFormat?: "feet-inches" | "decimal-inches" | "millimeters";
  /** How to format fractional inches in feet-inches mode. Default 16. */
  fractionDenominator?: number;
  /** Include a header row? Default true. */
  includeHeader?: boolean;
}

export function exportItemsToCsv(
  items: Item[],
  options?: CsvExportOptions,
): string;
```

Returns a CSV string. UI layer downloads it as a file.

### Future output format verification

The actual PowerFab import CSV format is not yet verified. See [§12.4](#124-powerfab-compatibility-verification).

---

## 9. File structure

```
takeoff-agent-app/
├── docs/
│   └── plans/
│       └── 01-pa-engine.md           ← this document
├── src/
│   └── shared/                       ← pure TypeScript, runs in Workers and browsers
│       ├── engine/
│       │   ├── types.ts              ← VariableDef, Item, PATemplate, etc.
│       │   ├── units.ts              ← inches, feet, mm, ftIn, formatFeetInches, parseLength
│       │   ├── runtime.ts            ← evaluatePA
│       │   └── index.ts              ← public exports
│       ├── pa-library/
│       │   ├── stair-channel.ts
│       │   ├── landing-channel.ts
│       │   ├── hss-rail-pickets.ts
│       │   ├── roof-ladder.ts
│       │   ├── column-hss.ts
│       │   └── index.ts              ← starterLibrary, getTemplate, getTemplatesByCategory
│       └── exporters/
│           ├── powerfab-csv.ts       ← exportItemsToCsv
│           └── index.ts
└── test/
    └── shared/
        ├── engine/
        │   ├── runtime.test.ts
        │   ├── units.test.ts
        │   └── pa-library.test.ts    ← golden-file tests for each starter PA
        └── exporters/
            └── powerfab-csv.test.ts
```

Everything in `src/shared/` is **pure TypeScript with no runtime dependencies on the browser or on Node/Workers**. This means the same engine code can run in:

- A Cloudflare Worker (server-side evaluation, export generation)
- The React frontend (client-side live preview as the estimator types)
- Tests (via Vitest, without needing a browser or Worker environment)

No DOM APIs. No `fetch`. No Node-specific modules. Just TypeScript, the standard library, and `Math`.

---

## 10. Test strategy

### Test framework

**Vitest.** It's the de facto standard for modern TypeScript projects, it's fast, it has first-class ESM support, and its API is compatible with Jest so any existing familiarity carries over.

Config lives at `vitest.config.ts` at the takeoff-agent-app root.

### Test categories

1. **Unit tests for the runtime** (`test/shared/engine/runtime.test.ts`)
   - `evaluatePA` applies defaults correctly
   - `evaluatePA` throws on missing required variables
   - `evaluatePA` applies item defaults (finish=PNT, numeric zeros)
   - `evaluatePA` is a pure function (same input → same output)

2. **Unit tests for units** (`test/shared/engine/units.test.ts`)
   - `feet(4) === 48`, `mm(25.4) === 1`, `ftIn(4, 6) === 54`
   - Round-trip: `toFeet(feet(n)) === n` for sample values
   - `formatFeetInches(54) === "4' 6\""`, `formatFeetInches(54.5) === "4' 6 1/2\""`
   - `parseLength("4' 6\"") === 54`, parses common formats
   - `parseLength` throws on malformed input

3. **Golden-file tests for each starter PA** (`test/shared/engine/pa-library.test.ts`)

   For each starter PA, we define a table of `(inputValues, expectedItems)` pairs and assert that `evaluatePA(template, inputValues)` produces exactly the expected items. Example for Stair Channel:

   ```ts
   describe("stair-channel PA", () => {
     test("default 10' × 4' stair produces 13 items, no, wait, 6 items", () => {
       const values = {
         heightBetweenLandings: feet(10),
         stairWidth: feet(4),
         stringerSize: "C12X20.7",
         riserHeight: inches(6.75),
         treadDepth: inches(11),
       };
       const result = evaluatePA(stairChannel, values);
       expect(result.items).toHaveLength(6);

       // Main piece
       expect(result.items[0]).toMatchObject({
         mainPiece: true,
         shape: "CO",
         description: "Stair",
       });

       // Stringers — 2 channels, pythagorean length
       const numTreads = Math.floor(120 / 6.75);  // 17
       const expectedLength = Math.sqrt(120 ** 2 + (numTreads * 11) ** 2) + 1;
       expect(result.items[1]).toMatchObject({
         shape: "C",
         size: "C12X20.7",
         quantity: 2,
       });
       expect(result.items[1].length).toBeCloseTo(expectedLength, 3);

       // Treads — one per step
       expect(result.items[3].quantity).toBe(numTreads);
       expect(result.items[3].length).toBe(48); // 4' in inches
     });

     test("different heights produce different tread counts", () => {
       // 12' height, 6.75" risers → 21 treads
       const result = evaluatePA(stairChannel, {
         heightBetweenLandings: feet(12),
         stairWidth: feet(4),
         stringerSize: "C12X20.7",
         riserHeight: inches(6.75),
         treadDepth: inches(11),
       });
       expect(result.items[3].quantity).toBe(21);
     });

     test("custom riser height works", () => { /* ... */ });
     test("residential riser produces fewer treads", () => { /* ... */ });
   });
   ```

   Every starter PA gets at least 3 test cases:
   - Default values produce the canonical expected output
   - One non-default variation to prove variables actually flow through
   - One edge case (very small, very large, or boundary value)

4. **CSV exporter tests** (`test/shared/exporters/powerfab-csv.test.ts`)
   - Given a small item list, produce a CSV with the expected columns and rows
   - Header row is optional via `includeHeader: false`
   - Length formatting works in all three modes (feet-inches, decimal-inches, millimeters)
   - Empty values (no size on CO rows) produce empty cells, not `undefined`

### Ground-truth sources for expected values

For the starter PAs, expected values are derived by:

1. **Hand calculation.** Pythagorean stair length, tread count from riser height, etc. Verified with a calculator and committed as constants in the test file.
2. **Reading Ricky's dumped JSON** (`dump/parametric_assemblies/008_Stair_Channel.json`) and cross-referencing quantities, item counts, and structure with our implementation.
3. **Functional equivalence check.** If PowerFab's default 10' × 4' stair produces 17 treads with the 6.75" riser, our engine must also produce 17 treads. Quantity mismatches are bugs. Length mismatches within 1/16" are acceptable under Option B compatibility.

### No automated verification against PowerFab in Phase 1

We do **not** run Ricky's actual PAs through a live PowerFab instance and diff the outputs. That would require either a PowerFab API (which doesn't exist) or a manual process. Flagged as future work — see [§12.4](#124-powerfab-compatibility-verification).

---

## 11. Implementation order

Work through this in strict order. Each step produces something testable before moving to the next.

### Step 1 — Scaffolding and types (½ day)

- Create `src/shared/engine/` directory
- Write `types.ts` with all the type definitions from [§3](#3-typescript-data-model)
- Verify: `tsc --noEmit` passes; the types import cleanly

### Step 2 — Unit helpers (½ day)

- Write `units.ts` with input, conversion, display, and parsing helpers
- Write `test/shared/engine/units.test.ts` with table-driven tests
- Verify: all tests pass; `parseLength` handles common formats

### Step 3 — Runtime (½ day)

- Write `runtime.ts` implementing `evaluatePA`
- Write `test/shared/engine/runtime.test.ts` with a small inline fake PA template
- Verify: defaults apply, required-variable validation throws, items get their default finish etc.

### Step 4 — First PA template: Stair Channel (1 day)

- Write `src/shared/pa-library/stair-channel.ts` modeled on the worked example in [§6](#6-worked-example-the-stair-channel-pa)
- Write `test/shared/engine/pa-library.test.ts` with 3+ test cases for Stair Channel
- Verify: `evaluatePA(stairChannel, defaults)` produces exactly the expected items
- **Milestone: the engine can evaluate a real stair PA end-to-end.** This is the "does the idea work" moment.

### Step 5 — CSV exporter (½ day)

- Write `src/shared/exporters/powerfab-csv.ts` implementing `exportItemsToCsv`
- Write `test/shared/exporters/powerfab-csv.test.ts`
- Verify: calling `exportItemsToCsv(evaluatePA(stairChannel, defaults).items)` produces a CSV string with the expected shape

### Step 6 — Remaining starter PAs (1–2 days)

One at a time, in this order:
- `roof-ladder` (simple — good for a sanity check)
- `landing-channel` (introduces conditional items via `if` in TypeScript)
- `column-hss` (introduces the "dimension variable drives sizes" pattern)
- `hss-rail-pickets` (most complex — sections, posts, pickets)

For each: write the template, write the tests, verify.

### Step 7 — Library index and integration (½ day)

- Write `src/shared/pa-library/index.ts` exporting `starterLibrary`, `getTemplate`, `getTemplatesByCategory`
- Add integration tests that enumerate the library and verify every template evaluates without errors using its default values
- Verify: `starterLibrary.length === 5`, every template evaluates cleanly

### Step 8 — Doc update (½ day)

- Update this plan doc's status from "not started" to "complete"
- Write a short implementation-report section noting what changed from this plan during implementation (there will be things — always are)
- Cross-reference the engine code from `parametric-assembly-product-direction.md`

### Total estimate

**~5–6 working days** for a single engineer working through this sequentially.

---

## 12. Future work and deferred decisions

Things noted in this plan but explicitly not part of Phase 1. Each one has a short spec of what we'd need to do to tackle it when the time comes.

### 12.1 PowerFab `.txt` import

**What:** A feature that lets a customer upload a PowerFab PA `.txt` export and have our app convert it into a TypeScript module our engine can use.

**Why deferred:** We don't have a sample `.txt` file yet. PowerFab's export format isn't publicly documented and we haven't reverse-engineered it. Getting a real file from Ricky is the first step. Until then, Phase 1 uses the hand-crafted starter library.

**What we'd need to do:**
1. Obtain a sample `.txt` export from Ricky (priority: ask next time we talk)
2. Document the `.txt` format in a new doc under `docs/powerfab/`
3. Write a parser that reads `.txt` and produces an intermediate JSON representation (PA name, variables with types, items with formula strings)
4. Write a **formula translator** that converts PowerFab formula strings into TypeScript source code. The target shape is the same `calculate(v) → Item[]` function signature our hand-written PAs use. The formula translator is a medium-complexity task:
   - Parse PowerFab formulas using a small recursive-descent parser (the grammar is small)
   - Map tokens to TypeScript equivalents: `CEILING` → `Math.ceil`, `SQRT` → `Math.sqrt`, `IF/THEN/ELSE/ENDIF` → ternary, `[Name]` → `v.name`, `6.75"` → `inches(6.75)`, etc.
   - Generate a `.ts` file the user can review, edit, and commit
5. Wire it up as an admin-only import flow
6. Validate with Ricky's existing PAs — run them through the translator and verify the output matches what we'd write by hand

This is **the second-most-important future feature after the engine itself**, because it's what lets us onboard a new customer with their existing PA library in minutes rather than re-authoring everything.

### 12.2 AI-assisted PA authoring

**What:** A feature where a user describes an assembly in natural language ("a roof ladder with a cage, 15' tall, 3/4" rungs spaced 12" apart") and an agent writes a new TypeScript PA template they can save and use.

**Why deferred:** Needs an AI integration, Phase 2 AI work, a UI for the authoring mode, and validation that the generated templates actually run cleanly. None of that exists in Phase 1.

**What we'd need to do when the time comes:**
1. Define a small training corpus of natural-language descriptions paired with their corresponding PA templates (we can bootstrap from the starter library plus a dozen human-written examples)
2. Prompt an LLM to generate `PATemplate`-shaped TypeScript code from a description
3. Validate the generated code: it compiles, it exports a `PATemplate`, it evaluates cleanly with default values, all items pass basic sanity checks (qty > 0, length > 0 or reasonable, shape exists in the catalog)
4. Present the generated PA to the user in a review UI — they can edit the TypeScript source or the computed item preview before saving
5. Save to a per-company library (probably a D1 table that maps to a loadable module at runtime)

The AI-generated PAs are still code, not data — they're TypeScript modules written by the LLM instead of by a human. The engine doesn't care who wrote them.

### 12.3 Per-company PA customization

**What:** Some customers will want to modify the starter PAs (different stringer size defaults, different labor codes, a custom tread size) or add entirely new PAs specific to their shop.

**Why deferred:** Phase 1 uses a bundled starter library. Any customization requires a code deploy, which is fine for a handful of customers but doesn't scale to many.

**What we'd need to do:**
1. Decide on a data-driven path: either store PA templates as JSON in D1 (requires a small DSL for the `calculate` function) or store them as TypeScript source code that we compile at runtime (requires a sandboxed JS runtime in the Worker)
2. Build a UI for the customization mode (overlaps with 12.2 above)
3. Namespace per-company PAs so Company A's PAs don't leak into Company B's app
4. Cache strategies so we don't recompile every PA on every request

The simplest intermediate step is: **per-company PAs continue to be TypeScript modules, but they're bundled in a per-customer build**. A customer's takeoff-agent-app deployment includes only their library. This is fine for 5 customers, gets ugly past 50.

### 12.4 PowerFab compatibility verification

**What:** An automated pipeline that runs a given PA through both PowerFab and our engine with the same inputs, and diffs the outputs to catch discrepancies.

**Why deferred:** PowerFab doesn't have an API. Running it programmatically would require either a scripted interaction with the desktop UI (fragile) or a custom driver against the MySQL database (risky). Neither is trivial.

**What we'd need to do if it becomes worth the effort:**
1. Identify a minimum set of representative PAs and variable combinations to verify
2. Either manually run each through PowerFab's Test dialog and record outputs as fixtures, OR write a read-only database scraper that pulls the expanded items PowerFab computed
3. Write a diff tool that compares our engine's output against the fixtures and reports mismatches
4. Iterate on our starter PAs until the diffs are acceptable (within functional-equivalence tolerance)

**When we'd do it:** if a customer complains about a mismatch, or as a release-gate before the first paying customer uses the app. Not before then.

### 12.5 Additional starter PAs

The initial library is 5 PAs. Real fabricators have 40–100 PA types. Over time we'll want to add more to the starter library as we identify common patterns. Priorities after Phase 1 (in rough order):

1. Additional stair variants (HSS stringer, wide-flange stringer, angle stringer)
2. Landing variants (HSS frame, angle frame)
3. Pipe rail with and without pickets
4. Ships ladder (ambitious — 24 variables)
5. Handrail (wall-mounted)
6. Simple column types (wide-flange, pipe)
7. Lintel
8. Bollards
9. Embeds (angle, plate, dock leveler)
10. Decking

Each addition follows the same pattern as the initial 5: hand-port from Ricky's dumped JSON, write tests, commit.

### 12.6 Metric unit support

**What:** Allow the engine to store canonical lengths in mm instead of inches, for international customers.

**Why deferred:** Phase 1 target market is U.S. steel fab, which is entirely imperial. Adding mm support now is overhead with no near-term benefit.

**What we'd need to do:** Change the `inches(n)` helper to return `n * 25.4` (or create a parallel canonical unit and add a per-project preference). Because all PA template code goes through the helpers, no template file needs to change.

---

## 13. Open questions — all resolved 2026-04-15

All eight open questions from the initial plan draft were resolved before implementation began. Resolutions recorded here for posterity.

1. **Canonical unit: inches or mm?** ✅ **Inches.** This is strictly an internal convention — the UI accepts and displays any format (feet-inches, decimal feet, mm) and converts to canonical inches at the boundary. See [§5](#5-unit-helper-library) for the reasoning. The user never sees "inches vs mm" as a choice.

2. **CSV export format specifics.** ⏸ **Deferred.** We're guessing at the column layout PowerFab's importer accepts based on the `parametricassemblyitems` schema. Revisit after we can run our output through a live PowerFab import. Not a Phase 1 blocker.

3. **MainPiece quantity multiplier.** ✅ **Not supported in Phase 1.** Each assembly invocation in a project represents one instance of the thing (one stair, one landing). If the estimator has three identical stairs, they create three Stair assemblies (or duplicate one). Main piece quantity is always 1 by convention in PA templates. This has two nice consequences:
   - The engine output and the CSV exporter output are functionally identical — the exporter is a thin formatter, not a transformer.
   - The **live preview in the UI shows exactly what the export will contain.** No "view expanded version" mode needed, no mismatch between preview and export. This is a first-class testable feature of the Workbench UI.
   - If we add a "multiply this assembly by N" feature later (Phase 2+), we add it as an assembly-level count field, not as a main-piece-qty hack. The exporter applies it at export time. Engine stays pure.

4. **Plan 02 (AISC catalog) ordering.** ✅ **Build plan 01 first, then plan 02, then Track 2.** Plan 01 doesn't need the catalog; Track 2's UI will. Clean sequential order.

5. **Validation error handling.** ✅ **Throw.** If a PA's `calculate` function fails, the runtime wraps the error in `EvaluationError` and rethrows. Partial results are a nicer UX but require the engine to distinguish item-level failures from template-level failures — too much complexity for Phase 1. Revisit when the UI needs it.

6. **Item ordering and identity.** ✅ **No stable IDs in Phase 1.** Items are returned in the order `calculate` produces them; their identity is their array index. Fine because Phase 1 doesn't support inline editing of individual items — the estimator edits variables, the engine re-runs, items are regenerated fresh.

7. **Engine knowledge of non-AISC shapes (PL, FB, RD, BY, etc.)?** ✅ **No — engine is dumb.** The engine never inspects a shape designation. It just writes whatever string the PA template produced into the item. The UI's shape picker and the CSV exporter are the things that care about the catalog.

8. **`resolveSize` helper.** ✅ **Deferred to plan 02** alongside the catalog conversion itself. The 5 starter PAs in Phase 1 are chosen specifically so none of them need it (Stair Channel, Landing Channel, HSS Rail Pickets, Roof Ladder, HSS Column). PAs like Lintel that need dependent-dimension lookups join the starter library later, once plan 02 is done.

---

## Appendix: How this plan maps to the three scope decisions

On 2026-04-15 we made three scope calls that shape this plan:

- **Q1 (PA source):** Starter library of hand-crafted TypeScript modules. Future work for PowerFab `.txt` import noted in [§12.1](#121-powerfab-txt-import).
- **Q2 (formula dialect):** No formula dialect at all. PAs are TypeScript. The "engine" is a runtime that calls `template.calculate()`. This is the biggest simplification in the plan — see [§2](#2-core-design-decision-typescript-not-a-formula-dsl).
- **Q3 (compatibility bar):** Functional equivalence, not exact match. Future work for PowerFab verification noted in [§12.4](#124-powerfab-compatibility-verification).

All three are captured inline in the relevant sections, and the status bar at the top of this doc links out to the architecture doc where the original rationale lives.

---

## 14. Implementation report

_Implemented 2026-04-15._ What actually landed vs. what the plan called for:

### Files created

- `src/shared/engine/types.ts` — all type definitions from §3
- `src/shared/engine/units.ts` — unit helpers + `parseLength` per §5
- `src/shared/engine/runtime.ts` — `evaluatePA`, `EvaluationError` per §4
- `src/shared/engine/index.ts` — barrel re-exports
- `src/shared/pa-library/stair-channel.ts` — the worked example from §6
- `src/shared/pa-library/roof-ladder.ts`
- `src/shared/pa-library/landing-channel.ts`
- `src/shared/pa-library/column-hss.ts`
- `src/shared/pa-library/hss-rail-pickets.ts`
- `src/shared/pa-library/index.ts` — `starterLibrary`, `getTemplate`, `getTemplatesByCategory`
- `src/shared/exporters/powerfab-csv.ts` — `exportItemsToCsv`
- `src/shared/exporters/index.ts`
- `test/shared/engine/units.test.ts` (23 tests)
- `test/shared/engine/runtime.test.ts` (11 tests)
- `test/shared/engine/pa-library.test.ts` (28 tests — Stair Channel + 4 new PAs)
- `test/shared/engine/library-index.test.ts` (9 tests)
- `test/shared/exporters/powerfab-csv.test.ts` (12 tests)
- `vitest.config.ts` — vitest config at repo root
- `tsconfig.test.json` — typecheck config that also covers the `test/` tree

### Package changes

- Added `vitest` as a dev dependency
- Added `test`, `test:watch`, and `typecheck` scripts to `package.json`

### Deltas from the plan

1. **No `src/shared/engine/runtime.ts` re-export of `evaluatePA` from `src/shared/engine/index.ts` originally planned as a separate concern — instead, `src/shared/engine/index.ts` is a small barrel that re-exports everything from types, runtime, and units.** Nothing in the plan said *not* to do this; just capturing it because §9's file tree didn't explicitly call out the barrel file.

2. **`hss-rail-pickets` models sections without needing a variable-length array type.** The plan's §7 said "our cleaner version uses a variable-length sections array instead of fixed Side 1 / Side 2." Since `VariableType` has no list type, the final implementation uses `numberOfTurns: integer` + three individual length variables (`section1Length`, `section2Length`, `section3Length`), and the `calculate` function builds a real `number[]` from whichever sections the turn count activates. The result is a single loop over sections inside `calculate`, which is the "clean" outcome the plan wanted, just with the list materialized inside the function instead of being a user-entered list variable.

3. **`column-hss` is HSS-only, not a combined HSS-or-W-beam PA.** Ricky's original PowerFab PA 43 is "Columns Pipe / Channel" and uses the integer-enum hack to pick between variants. Per the plan's explicit guidance about not inheriting that hack, the starter library has a pure `column-hss` PA. A future W-beam column is a separate PA and a separate entry in the library.

4. **`landing-channel` uses real `enum` variables for `flooring` and `connectionType`**, again to avoid the PowerFab integer-enum hack. This meant the calculate function reads `if (flooring === "deck")` instead of `if (flooring === 1)`.

5. **No `"deck"` / `"floor-plate"` / `"bent-plate"` shape codes beyond `DK` and `PL`** — the exporter currently passes shape strings through unchanged, and decking is emitted as shape `DK`. When the AISC catalog (plan 02) lands we may reconcile this, but for Phase 1 the engine is intentionally dumb about shape strings.

6. **`roof-ladder` does not use the BY (buy-out) pattern** that §7 mentioned. Ricky's real Ladder PA 54 doesn't use BY either — I was working from a misremembered note in the plan. If brackets end up being buy-outs in a future revision, a `BY` row can be added to the calculate function in one place.

7. **Vitest version is 4.1.4**, installed as a dev dep. The existing repo uses Bun, so `bun x vitest` and `bun run test` both work. No changes to the Electron build pipeline.

8. **Tests run cleanly from the repo root** with `bun run test` (all 92 pass) and `bun run typecheck` also passes clean with no errors.

### What did NOT land that the plan implied

- The plan's §11 implementation order suggested writing `types.ts` first then `units.ts`, then `runtime.ts`, then the first PA. That order was followed, but between steps 4 and 5 vitest was installed and `vitest.config.ts` created (implied but not called out as its own step in §11).
- No ErectHours / ManHoursPerPiece columns in the CSV exporter — the plan's §8 excluded these from the first version, so they aren't emitted. The fields ARE preserved on `Item` and flow through `evaluatePA`, they're just not in the CSV yet.
- No AISC catalog-aware `resolveSize` helper (per resolved open question 8 in §13) — deferred to plan 02.

### Test coverage snapshot

```
 Test Files  5 passed (5)
      Tests  92 passed (92)
```

Breakdown:
- `units.test.ts` — 23 tests (input helpers, conversion helpers, formatters, `parseLength`)
- `runtime.test.ts` — 11 tests (required-variable validation, defaults, item post-processing, purity, error wrapping)
- `pa-library.test.ts` — 28 tests (5–6 cases per starter PA)
- `library-index.test.ts` — 9 tests (integration, uniqueness, every template evaluates with defaults)
- `powerfab-csv.test.ts` — 12 tests (structure, length formats, escaping, CSV ↔ engine round-trip)

### Next steps

Track 1 is complete. The engine is ready for Track 2 (the Workbench UI) to consume. Plan 02 (AISC catalog ingestion + `resolveSize` helper) should happen next so that the UI's dimension-picker dropdowns have real data to render. Plan 02 is the last blocker before starting Track 2.
