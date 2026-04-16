# The PA Engine — History and Reference

_Written 2026-04-15. Covers the database exploration that informed the design, the decisions we made along the way, and the final engine's architecture. This is the canonical "how did we get here and how does it work" document for the parametric-assembly engine that lives at `src/shared/engine/`._

Related docs:
- [`parametric-assembly-product-direction.md`](parametric-assembly-product-direction.md) — product-level framing for the whole app, including why the engine exists in the first place
- [`../plans/01-pa-engine.md`](../plans/01-pa-engine.md) — the implementation plan the engine was built against
- [`workflow-ux-explorations.md`](workflow-ux-explorations.md) — the six UI options for Track 2 that will consume this engine

---

## Table of contents

1. [TL;DR](#1-tldr)
2. [Background: what a PowerFab parametric assembly is](#2-background-what-a-powerfab-parametric-assembly-is)
3. [The database exploration phase](#3-the-database-exploration-phase)
4. [What we discovered and why it shaped the design](#4-what-we-discovered-and-why-it-shaped-the-design)
5. [Design decisions](#5-design-decisions)
6. [Engine architecture](#6-engine-architecture)
7. [How an evaluation flows end to end](#7-how-an-evaluation-flows-end-to-end)
8. [Testing strategy](#8-testing-strategy)
9. [What the engine does NOT do](#9-what-the-engine-does-not-do)
10. [Code inventory](#10-code-inventory)
11. [What comes next](#11-what-comes-next)

---

## 1. TL;DR

The PA engine is a pure TypeScript module at `src/shared/engine/` that turns a parametric-assembly template plus a map of variable values into a list of expanded material items ready to be exported as a PowerFab-importable CSV. It is the Track 1 "backend under the hood" of the takeoff-agent-app — the half of the product that estimators never see directly, but that everything else depends on.

- **Input:** a `PATemplate` (a TypeScript object declaring variables and a `calculate()` function) + `Record<string, VariableValue>`
- **Output:** an `EvaluateResult` containing an array of `Item` rows (qty, shape, size, length, grade, labor code, finish, fabrication details)
- **Downstream:** the exporter in `src/shared/exporters/powerfab-csv.ts` turns the items into a CSV the UI can download
- **Shape:** a pure function. Zero I/O, zero side effects, zero globals. Same input always produces the same output.
- **Size:** ~1500 lines of TypeScript across types, runtime, units, 5 starter PAs, and the CSV exporter
- **Tests:** 92 Vitest tests across 5 files, all passing

The engine exists because we needed somewhere to put the "what is a stair actually made of" logic that every fabricator already has, in one form or another, sitting inside PowerFab as a parametric-assembly library. We decided to rebuild that logic in our own codebase rather than try to drive PowerFab's copy of it.

---

## 2. Background: what a PowerFab parametric assembly is

**Tekla PowerFab** is Trimble's desktop software for steel fabrication shops. Estimating, detailing, production tracking, purchasing — it's the back-office system most steel fab companies in the U.S. run on. It's a Windows application backed by a MySQL database.

Inside PowerFab there's a concept called a **parametric assembly** (PA). A PA is a template that says "here's how a Stair Channel is built" or "here's what goes into a roof ladder." It has three parts:

1. **Variables** the user fills in — things like "height between landings," "stair width," "stringer material." Each variable has a type (integer, decimal, length, dimension, enum-by-integer) and a default.
2. **Items** the assembly produces — the physical pieces that roll up to a material list. Stringers, treads, jacks, cap plates, clips. Each item has a shape, a size, a length, a grade, a labor code, a finish, and some fabrication-detail fields (holes, copes, stiffeners, web holes, welded studs, etc.).
3. **Formulas** that connect the two — each item's quantity, length, width, and so on is an expression over the variables. PowerFab's formula dialect supports `IF/THEN/ELSE/ENDIF`, `CEILING`, `SQRT`, variable references like `[Stair Width]`, and unit literals like `6.75"` or `4'`.

An estimator doing a takeoff in PowerFab picks a PA, fills in the variables, and PowerFab expands the formulas into concrete item rows that get added to an estimate. That expansion is exactly what our engine does — except we do it in TypeScript, in a browser, outside of PowerFab.

**Important context:** estimators don't typically author PAs themselves. PAs are built once, per company, by someone who knows how the shop makes its stairs (usually an experienced senior estimator or a fabricator rep). A typical fabricator might have 40–100 PAs in their library covering every assembly type they build. Our primary customer reference (Ricky) has **49 PAs** in his library. Estimators consume PAs; they don't write them.

This last point is the whole reason the takeoff-agent-app exists as a tool for estimators rather than a tool for PA authors: the authoring is a solved problem (you do it in PowerFab once), but the per-takeoff consumption is where estimators spend their time, and that's where we can make their day faster.

---

## 3. The database exploration phase

Before designing the engine, we needed to understand what a PA actually looked like in PowerFab's database. Ricky runs PowerFab locally, so the DB was available — we just had to find a way to read it.

### 3.1 The connection problem

The primary work environment for this project is WSL (Ubuntu under Windows). PowerFab's MySQL server runs on Windows at `localhost:3307`. From inside WSL, `localhost` resolves to WSL's own loopback, not Windows' — so a naive `mysql` client call in WSL can't see PowerFab's server.

Things we tried:
1. **Direct MySQL client from WSL to `localhost:3307`** → `Connection refused`. WSL's localhost is not Windows' localhost.
2. **WSL gateway IP** (`172.26.192.1`, auto-discovered via `ip route`) → timeouts. Windows Defender Firewall was blocking inbound connections from the WSL subnet to the MySQL port.
3. **Opening the firewall rule** → rejected; we didn't want to take permanent Windows-wide action for what was a one-time schema exploration.

The fix that worked: **invoke a Windows Python interpreter from WSL**, targeting the Python that lives at `C:\Users\nickb\AppData\Local\Programs\Python\Python312-arm64\python.exe`. WSL can spawn Windows executables transparently when given an absolute path under `/mnt/c/...`. The Windows Python process runs in the Windows network namespace, so from its perspective `localhost:3307` is the real PowerFab MySQL server and connects instantly.

This means every Python script in `scripts/powerfab-schema-dump/` is written to be invoked from WSL like this:

```bash
/mnt/c/Users/nickb/AppData/Local/Programs/Python/Python312-arm64/python.exe \
  scripts/powerfab-schema-dump/01_list_tables.py
```

Credentials live in `po-finalize-tool/.env` (a sibling project that already had them); `db.py` auto-discovers the file from several candidate locations so nothing had to be copied or duplicated.

### 3.2 The scripts

Five Python scripts were written, each building on the previous one. Each writes its output to `scripts/powerfab-schema-dump/dump/` as JSON or plain text so later steps (and Claude sessions) can read the results without re-hitting the database.

| Script | Purpose | Output |
|---|---|---|
| `01_list_tables.py` | Enumerate every table in the database and bucket them by keyword relevance | `dump/all_tables.txt` (1,285 table names), `dump/matched_tables.json` (relevance-grouped) |
| `02_describe_tables.py` | For each relevance-matched table, dump column names, types, nullability, and keys | `dump/schemas/*.json` (one file per table) |
| `03_sample_data.py` | For each matched table, pull up to 10 sample rows | `dump/samples/*.json` |
| `04_dump_parametric_assemblies.py` | Walk the parametric-assembly table and dump every PA with its variables and items, auto-detecting the root table and its children | `dump/parametric_assemblies/NNN_<slug>.json` (one file per PA, 49 PAs total) |
| `05_lookups_and_resolved_pa.py` | Dump the small reference tables (shapes, sizes, grades, labor codes, categories) and produce a "fully resolved" view of one PA with all foreign-key IDs replaced by human-readable names | `dump/lookups/*.json`, `dump/resolved_pa/29_Stair_Channel.json` |

`db.py` is shared connection code — credential loading plus a `get_connection()` helper.

**All of this output lives locally on disk** in `scripts/powerfab-schema-dump/dump/` but is **intentionally not committed to git** (the `scripts/` and `docs/powerfab/` trees are in `.gitignore`). The exploration materials are local-only reference; this document is the canonical committed summary of what we learned from them.

### 3.3 What the scripts found

Running the scripts against Ricky's PowerFab instance produced:

- **1,285 total tables** in the PowerFab database. Yes — it's a big schema.
- **383 tables** matched our relevance keywords (parametric-assembly / estimating / shapes / grades / labor / finish / imports / jobs / variables / formulas). The remaining ~900 tables cover production tracking, purchasing, detailing, accounting, and so on — not our concern.
- **49 parametric assemblies** in Ricky's library, ranging from a simple `Bollard` (one item, two variables) to a `Ships_Ladder` (24 variables, 18 items, dense conditional logic).
- **The three tables that define a PA**: `parametricassemblies` (the header), `parametricassemblyvariables` (the inputs), `parametricassemblyitems` (the outputs/rows with formulas).
- **Lookup tables** for everything referenced by ID: `shapes` (199 rows), `sizes` (6,743 rows), `grades` (445 rows), `laborcodes` (121 rows), `assemblycategories`, and a handful of smaller tables for finishes, bolt options, and production codes.

---

## 4. What we discovered and why it shaped the design

The exploration surfaced several things about PowerFab's internals that directly shaped what our engine does and doesn't do. Each discovery is paired below with the design consequence.

### 4.1 PowerFab stores formulas as strings AND as pre-parsed RPN

Every formula field in `parametricassemblyitems` exists twice: once as a human-readable expression (e.g. `SQRT(([Hieght Between Landings]*[Hieght Between Landings])+...) + 1"`) and once as a pipe-delimited reverse-polish-notation sequence (e.g. `|[Hieght Between Landings]|[Hieght Between Landings]|*|...`). The RPN version is what PowerFab's runtime actually evaluates; the text version is what its GUI editor shows users.

**Design consequence:** we could in theory parse either form and evaluate it ourselves. We chose to do neither. Writing a parser + evaluator for PowerFab's DSL would be writing a weaker version of TypeScript inside TypeScript. Our PAs are TypeScript modules that call `Math.sqrt` and use real operators. This is the single biggest simplification in the engine. See [§5.1](#51-typescript-not-a-formula-dsl).

### 4.2 Length values are stored as millimeter strings with 15 decimal places

Most of the length-bearing fields in PA tables are actually strings. `parametricassemblyvariables.DefaultValue` is `varchar(255)`. `parametricassemblyitems.Length`, `Width`, `Quantity`, and `Holes` are all `mediumtext` — they have to be strings because they hold formula expressions like `[Height]/6.75"*2`, not raw numbers.

The strings in those fields are **millimeter values with about 15 decimal places of precision**. A real example from Ricky's Stair Channel PA: `"DefaultValue": "3048.00609601219"` — that's 10 feet, 0 inches, expressed as "3048.006… mm" with the precision turned up to eleven so that an imperial value round-trips without drift through PowerFab's metric-canonical storage.

Separately, the dimension-override fields on items (`DimDepth`, `DimWidth`, `DimWeight`, `DimThickness`, `DimGage`, `DimDiameter`) are stored as `decimal(35, 15)` — 35 total digits, 15 after the decimal — for the same reason: they're the only numeric overrides that don't need to hold a formula string, so they can use a proper numeric type.

**Design consequence:** our engine picks **inches** as the canonical internal unit, not mm. Reasons:
- U.S. imperial is Phase 1's market
- AISC shape properties are imperial-native
- Our engine does not write to PowerFab's database, so we don't need to preserve their precision contract
- Imperial math reads more naturally in PA code (`stairWidth * treadCount` is obviously in inches; the same expression in mm reads as "some large number")

The `units.ts` helper file provides `inches(n)`, `feet(n)`, `mm(n)`, `ftIn(f, i)`, and their inverses (`toFeet`, `toMm`), so a PA template author never has to think about the canonical unit — they write `feet(10)` and the engine handles it. The canonical unit is strictly an internal convention; the UI that consumes this engine takes whatever format the estimator types (`4' 6"`, `54`, `1370 mm`, decimal feet, etc.) and converts at the boundary.

### 4.3 No foreign keys, IDs everywhere

PowerFab's schema has effectively **zero foreign-key constraints**. Relationships between `parametricassemblyitems` and `shapes`, `sizes`, `grades`, or `laborcodes` are held together by convention: the `ShapeID` column is an integer, and you're expected to look it up in the `shapes` table yourself. Many fields are nullable ints where `NULL` means "no value" but some also tolerate values like `0` or string placeholders for the IF-enum hack (see below).

This is why script 05 exists — resolving one full PA from the raw data to a human-readable form required joining across 5 tables with a hand-written mapping. No ORM could do this automatically.

**Design consequence:** our engine does not use numeric IDs for shapes, sizes, grades, or labor codes. It uses **strings** — specifically, the AISC `EDI_Std_Nomenclature` designation format (`C12X20.7`, `HSS8X8X1/2`, `W14X68`, `PL3/8`, `L2X2X1/4`). This format happens to match the column called `DimensionSizesImperial_EDI` in PowerFab's `sizes` table, which means a CSV our engine emits can be imported into **any** PowerFab installation regardless of whether their internal `SizeID` matches the one Ricky's DB has for the same physical shape. Strings are portable; integer IDs are not.

### 4.4 Variables come in five types — plus two we decided not to support

PowerFab's `VariableType` column on `parametricassemblyvariables` can hold:
- `Integer Number` — whole numbers for counts and selectors
- `Decimal Number` — floats for ratios, hours, generic numbers
- `Length - Feet, Inches, Fractions - Meters` — length values, the format hint is a display preference, not a storage difference (everything's mm under the hood)
- `Dimension` — a reference to a row in the `sizes` table; stored as an integer but semantically "an AISC designation"
- `Property from EST Line Item` — a reference to a property of a line item in an estimate that uses this PA
- `Property from Assembly Line Item` — a reference to a property of another item inside the same PA (e.g. "the depth of item 10")

Our engine supports **the first four** and explicitly does not support the last two:
- `Property from EST Line Item` depends on an estimating-job context we don't have in Phase 1 (we're a standalone takeoff tool, not an embedded PowerFab add-in)
- `Property from Assembly Line Item` is implementable inside a `calculate` function as plain TypeScript — when a PA needs "the depth of the beam I just emitted," you look up the beam's size in the AISC catalog and pull the depth from there with normal code. No special variable type needed.

We also added an `enum` variable type that PowerFab does not have natively (see §4.6).

### 4.5 Formulas use a small dialect with four operators, three functions, and unit literals

Examining every formula in Ricky's 49 PAs, the dialect in use is:
- **Operators:** `+`, `-`, `*`, `/` (plus parentheses for grouping)
- **Comparisons:** `=`, `>`, `<`, `>=`, `<=` (used inside `IF` guards)
- **Functions:** `CEILING`, `SQRT`, and occasionally `MIN`/`MAX`. No `SIN`/`COS`/`TAN`/`FLOOR`/`ROUND` appear in any PA Ricky has.
- **Control flow:** `IF (...) THEN (...) ELSE (...) ENDIF`, nestable
- **Variable refs:** `[Variable Name]` (spaces and punctuation allowed inside the brackets)
- **Unit literals:** bare numbers followed by `"` for inches or `'` for feet — `6.75"`, `4'`, `11"`

Formulas are typed into a dialog that PowerFab parses into RPN before saving. The dialog is a GUI for writing code.

**Design consequence:** we observed that PowerFab's dialect is effectively "a very small programming language shaped like a calculator, because the authoring surface is a spreadsheet-cell dialog and not a code editor." TypeScript gives us everything that language has and more, with autocomplete, type checking, debugger support, and real function composition. So: our PAs are TypeScript modules, not string formulas. (This is the same point as §4.1 but stated from the other direction.)

### 4.6 PowerFab fakes enums with integers + multiple zeroed item rows

PowerFab variables have no real enum type. When a PA author wants an estimator to pick between "channel stringer, MC channel stringer, or HSS stringer," they have to:
1. Create an integer variable `Column Material` where `1 = channel`, `2 = MC`, `3 = HSS` (by convention — nothing in the database records this mapping; it lives in the variable description field or in the author's head).
2. Create **three separate item rows**, one per shape.
3. Put an IF-guard on each row's `Quantity` formula: `IF ([Column Material]=1) THEN (1) ELSE (0) ENDIF`, `IF ([Column Material]=2) THEN (1) ELSE (0) ENDIF`, etc.
4. At evaluation time, two of the three rows produce `quantity: 0` and the third produces `quantity: 1`. The UI or exporter either drops zero-quantity rows or shows them with a strike-through.

It's a hack. It works, but it's brittle (renaming `Column Material` silently breaks all three IF guards, and nothing in the DB tells you the integer meanings).

**Design consequence:** we inherited **none** of this. Our engine has a real `enum` variable type with `{value, label}` options and stable string values. A PA's `calculate` function receives the enum value as a string and uses a normal `if` or `switch` to branch, producing only the rows that should actually exist. For example, our `landing-channel` PA has a `flooring: "deck" | "floor-plate" | "bent-plate"` enum and emits exactly one flooring row — never three with two of them zeroed. If we ever need to export back to a PowerFab `.txt` PA file, the exporter can re-introduce the IF-enum pattern at the boundary; we keep the clean model internally.

### 4.7 MainPiece + ErectHours + fabrication detail fields

Each `parametricassemblyitems` row has a `MainPiece` flag (boolean) that makes that row act as a header for the assembly. There's usually exactly one main-piece row per PA. It carries the assembly's description (`"Stair"`, `"Landing"`, `"Column"`) and its total erection hours (`ErectHours`), and in PowerFab's consumer-side logic the main piece's quantity multiplier also scales the whole assembly (if you set main-piece qty to 3, the three child rows' quantities also triple).

Each item row also has a dozen fabrication-detail fields: `Holes`, `Copes`, `Stiffeners`, `WebHoles`, `TopFlangeHoles`, `BottomFlangeHoles`, `WeldedStuds`, plus `ManHoursPerPiece` and `ErectHours` overrides.

**Design consequence:** our `Item` type supports all of the above — `mainPiece?: boolean`, all the fabrication fields, and labor overrides — but the **main-piece-quantity multiplier is deliberately not supported in Phase 1**. Each assembly invocation represents exactly one instance of the thing; if the estimator has three identical stairs, they duplicate the assembly three times in their project rather than multiplying one. This has two nice consequences:
- The engine output and the CSV exporter output are functionally identical (the exporter is a thin formatter, not a transformer)
- The UI's live preview shows exactly what will be exported — no "expanded view" mode needed

If we ever add an "N instances" count to the assembly-level record, it'll be an exporter-time multiplier, not an engine change. The engine stays pure.

### 4.8 PA 29: Stair Channel — our reference

Of the 49 PAs, **`Stair Channel` (PA ID 29)** became the reference we designed against. Reasons:
- It's the most common assembly type for steel stairs, so if the engine can't handle it the engine is wrong
- It exercises the Pythagorean pattern (`sqrt(height² + run²)` for the stringer length)
- It has a main-piece row, uses a length variable, a dimension variable, and several numeric variables
- It uses integer tread counts that fall out of a division
- Its formulas are long enough to hurt if you had to parse them, which makes the "just write TypeScript" argument concrete

Script 05 produces a fully human-readable view of this one PA at `scripts/powerfab-schema-dump/dump/resolved_pa/29_Stair_Channel.json`, and the worked example in `src/shared/pa-library/stair-channel.ts` is a clean-room port of the same PA logic into our type system.

---

## 5. Design decisions

The exploration phase left us with enough information to make the big calls. Four of them drove everything else.

### 5.1 TypeScript, not a formula DSL

**The decision:** PA templates are TypeScript modules. There is no parser, no AST, no RPN evaluator, no expression grammar.

**The reasoning:** PowerFab stores formulas as strings because its authoring surface is a dialog box. Their problem, their solution. Our authoring surface is a code editor. TypeScript already has `if`, `Math.ceil`, `Math.sqrt`, `**`, variables, functions, and a powerful type system. Reimplementing PowerFab's formula dialect would be reimplementing a weaker version of TypeScript inside TypeScript. It's the wrong abstraction.

**Consequences:**
- **The engine is trivial.** The "runtime" is essentially `template.calculate(values)`. The actual runtime code is ~100 lines.
- **Type safety.** Variable keys are checked at compile time. Item shapes are validated by TypeScript. PA template authors get autocomplete.
- **No parser bugs, no evaluator edge cases.** All the weirdness of implementing a dynamic expression language just evaporates.
- **Debugging is normal.** Set breakpoints, step through, inspect values.
- **LLMs can generate PA templates directly.** Future AI-assisted PA authoring (Phase 2+) means asking an LLM to produce a TypeScript file, which LLMs are excellent at — far better than producing bespoke DSL strings.
- **The trade-off:** adding a new PA requires a code deploy. This is fine because estimators don't author PAs; only developers do (or, eventually, the AI generates one that we review and check in).

When we eventually support importing `.txt` exports from an existing PowerFab PA library, we translate formulas to TypeScript **once** at import time and check in the generated files, rather than executing them at runtime. Translation is a solvable problem (the grammar is small); runtime execution would force us to build the parser we don't want to build.

### 5.2 Inches as the canonical internal unit

**The decision:** every length value inside the engine — variable values, item lengths, item widths — is a number of inches. Unit helpers handle conversion.

**The reasoning:** Phase 1's market is U.S. steel fab, which is entirely imperial. AISC shape properties are natively imperial. Estimators type feet-and-inches and expect feet-and-inches back. PowerFab stores mm because it's an international product, but we are not PowerFab and we're not writing to their database.

**Consequences:**
- `inches(6)` is a pass-through, `feet(4)` returns `48`, `mm(25.4)` returns `1`, `ftIn(4, 6)` returns `54`
- PA templates read naturally: `const stringerLength = Math.sqrt(height * height + run * run) + inches(1);`
- The UI that consumes this engine takes any format the estimator prefers and converts at the boundary with `parseLength`
- If we ever need to switch to mm-canonical (e.g. international market), we change the helper implementations and no PA template needs touching

**Non-consequence the user never sees:** "inches vs mm" is not a choice anywhere in the UI. The user types `4' 6"`, the engine gets `54`, the preview shows `4' 6"` again. The canonical unit is purely internal.

### 5.3 The engine is a pure function

**The decision:** `evaluatePA(template, values)` has no I/O, no side effects, no network access, no database access, no mutation, no globals. Given the same inputs, it always returns the same output.

**The reasoning:** pure functions compose, test, cache, parallelize, and live-reload trivially. The moment we let the engine hit a database or read a file, we lose all of those properties and we have to start answering questions like "what if the database is unreachable" and "how do we test it without mocking." None of those questions have good answers. None of them have to be asked if the function is pure.

**Consequences:**
- The engine runs anywhere: a Cloudflare Worker, a Vercel function, a browser tab, a Node test runner, an Electron renderer, a React Native app, whatever. No platform dependencies.
- The live preview in the UI can call `evaluatePA` on every keystroke without worrying about rate limits or side effects
- Tests are unit tests on a function, not integration tests with mocked infrastructure
- Porting the engine to another language later would be a mechanical translation of mostly-arithmetic code

### 5.4 No PA authoring UI

**The decision:** estimators never see a PA template editor. There is no "create a new stair type" form, no formula builder, no item-grid spreadsheet. PA templates are checked into the codebase and change through pull requests.

**The reasoning:** the product is a **takeoff tool**, not a **PA authoring tool**. Estimators consume PAs all day long; a typical estimator might never author one. Building an authoring surface would more than double the UI surface area of the app while serving a tiny fraction of the actual workflow. It's a trap we were explicitly warned off.

**Consequences:**
- The Track 2 UI is much smaller: it just has to render a form from variables, call the engine, and display items
- When a new customer onboards, we (or a future AI-assisted authoring mode, or a `.txt` importer) hand them a ported library; they don't start by configuring a hundred forms
- The engine's type system is designed to be hand-authored by a developer or LLM — not to be serialized in and out of a UI

### 5.5 Hidden company defaults

**The decision:** a `VariableDef` can set `hidden: true`, in which case the variable never renders in the form but the engine still uses its `defaultValue` during evaluation. The estimator only sees the subset of variables that correspond to numbers they read off a drawing; everything else is a "company default" that lives in the template but doesn't clutter the UI.

**The reasoning:** the very first version of Stair Channel had five required variables — `heightBetweenLandings`, `stairWidth`, `stringerSize`, `riserHeight`, `treadDepth`. That's too many. Of those five, only two (height and width) come from the drawing; the other three (stringer size, riser height, tread depth) are essentially fixed per shop: "we always use C12x20.7 for stringers," "commercial risers are always 6.75 in," "treads are always 11 in." Making the estimator re-enter them for every stair is friction without benefit, and leaving them as form fields means they sometimes get mis-entered.

The cleaner model: the template knows the company's standards. The estimator enters what varies between takeoffs. Everything else resolves via `defaultValue` automatically.

**Consequences:**
- The Stair Channel form currently shows **three fields** (number of treads, number of risers, stair width), not five. Everything else — stringer size, riser height, tread depth — lives in the template as a hidden default.
- Because hidden variables still have `defaultValue`, they're still tweakable: a shop that uses a different riser height just ships a different template or a future "company overrides" layer patches the defaults at load time. The engine doesn't care.
- The hidden flag is a *UI* concern that lives in the *data model*, which isn't ideal — but it's a small concession to avoid building a parallel "which variables does this PA expose" configuration layer. One flag on the variable definition is enough.
- Tests benefit too: test cases pass only the visible inputs and let the engine resolve the hidden ones, which means the tests document the intended estimator-facing shape of the PA rather than the full variable set.

This was **not in the original plan** — it evolved once the first UI prototypes made it obvious that five fields per stair was painful. See the Stair Channel worked example in [§7](#7-how-an-evaluation-flows-end-to-end) for how a template uses hidden defaults in practice.

---

## 6. Engine architecture

The engine lives at `src/shared/engine/`. It's pure TypeScript with no runtime dependencies — it runs in Workers, in browsers, in Node, in test runners, without any platform-specific code.

### 6.1 File layout

```
src/shared/
├── engine/
│   ├── types.ts          (83 lines)  ← type definitions
│   ├── units.ts          (184 lines) ← unit helpers + parser
│   ├── runtime.ts        (108 lines) ← evaluatePA
│   └── index.ts          (28 lines)  ← barrel re-exports
├── pa-library/
│   ├── stair-channel.ts          (152 lines)
│   ├── stair-channel.test.ts     (105 lines)  ← colocated tests
│   ├── landing-channel.ts        (203 lines)
│   ├── landing-channel.test.ts   (96 lines)   ← colocated tests
│   ├── hss-rail-pickets.ts       (272 lines)
│   ├── roof-ladder.ts            (138 lines)
│   ├── column-hss.ts             (189 lines)
│   └── index.ts                  (31 lines)   ← starterLibrary registry
└── exporters/
    ├── powerfab-csv.ts   (103 lines)
    └── index.ts          (4 lines)
```

Total: **~1,700 lines** of TypeScript (source + colocated tests). See [§10](#10-code-inventory) for the file-by-file breakdown.

### 6.2 The type system (`types.ts`)

Everything downstream of the engine depends on these types being stable.

```ts
// Variable types
export type VariableType = "integer" | "decimal" | "length" | "dimension" | "enum";
export type VariableValue = number | string | null;

export interface VariableDef {
  key: string;                  // machine key, used in values map
  label: string;                // shown in the UI
  description?: string;         // optional helper text
  type: VariableType;
  defaultValue?: VariableValue;
  required?: boolean;
  enumOptions?: { value: string; label: string }[];  // for type=enum
  shapeFilter?: string[];       // for type=dimension, e.g. ["C", "MC"]
  position?: number;            // display order
  hidden?: boolean;             // company default — never renders in the form, engine uses defaultValue
}

// Items (engine output rows)
export type Finish = "PNT" | "UNP" | "GLV";

export interface Item {
  mainPiece?: boolean;
  shape: string;                // "C", "HSS", "PL", "L", "FB", "RD", "CO", "BY"
  size?: string;                // AISC designation: "C12X20.7", "HSS8X8X1/2"
  grade: string;                // "A36", "A500", "A992", "." for comment rows
  quantity: number;
  length?: number;              // canonical inches
  width?: number;               // canonical inches (plates, grating)
  laborCode?: string;           // company-specific, e.g. "M", "H", "JJ"
  finish?: Finish;              // defaults to "PNT"
  comment?: string;             // per-row label ("Stringer", "Tread")
  description?: string;         // main-piece row header ("Stair")

  // Fabrication detail fields (default to 0)
  holes?: number;
  copes?: number;
  stiffeners?: number;
  webHoles?: number;
  topFlangeHoles?: number;
  bottomFlangeHoles?: number;
  weldedStuds?: number;

  // Labor overrides
  manHoursPerPiece?: number;
  erectHours?: number;          // typically on main piece as a flat total
}

// PA templates
export type PACategory =
  | "stair" | "landing" | "rail" | "ladder"
  | "column" | "lintel" | "embed" | "misc";

export interface PATemplate {
  id: string;
  name: string;
  description: string;
  category: PACategory;
  variables: VariableDef[];
  calculate: (values: Record<string, VariableValue>) => Item[];
}
```

**Observations on the type design:**
- `VariableValue` is `number | string | null`. Integer/decimal/length variables are stored as numbers (in canonical inches for lengths). Dimension and enum variables are stored as strings. Null means "no value." This is the minimum surface area that captures every starter PA's needs.
- `Item` is wide (20 optional fields) because PowerFab's item row is wide. Most fields default to undefined or 0 in any given row — the width is there so that a PA that needs, say, `weldedStuds: 12` can set it without the type getting in the way.
- `PATemplate.calculate` is a plain TypeScript function. It is the only piece of the template that is executable code. Everything else (variables, id, name) is data.
- The `calculate` function takes raw `Record<string, VariableValue>`, which means PA authors have to `as`-cast values they know are numbers or strings. This is a deliberate trade-off: the alternative (generics on `PATemplate` carrying a typed shape of the variables) makes the library index much harder to express as a single `PATemplate[]` array. The cast is contained to ~5 lines per PA.
- **`hidden: true` is a late addition.** A hidden variable still exists in the template and still has a `defaultValue` the engine uses during evaluation, but it never renders in the estimator's form. This is how we keep shop-level defaults (stringer channel size, riser height, labor codes, grades) out of the estimator's way — they're still data-driven and still tweakable per-company, but the estimator only sees the numbers they actually read off a drawing. See [§5.5](#55-hidden-company-defaults) for why this was added.

### 6.3 The runtime (`runtime.ts`)

One public function:

```ts
export function evaluatePA(
  template: PATemplate,
  userValues: Record<string, VariableValue>,
): EvaluateResult;

export interface EvaluateResult {
  items: Item[];                              // the expanded items
  resolvedValues: Record<string, VariableValue>;  // after defaults applied
  warnings: string[];                         // e.g. "optional var had no default"
}

export class EvaluationError extends Error {
  readonly templateId: string;
  readonly cause?: unknown;
}
```

The runtime does exactly five things, in order:

1. **Validate required variables.** For each `VariableDef` with `required: true`, check that either `userValues` has a non-null entry or the definition itself has a `defaultValue`. If any required variable is missing, throw `EvaluationError` listing all missing variables (not just the first — better UX).
2. **Apply defaults.** For each variable, if the user provided a value use it; otherwise use the definition's `defaultValue`; otherwise record `null` and emit a warning. The resolved map becomes the argument to `calculate`.
3. **Call `template.calculate(resolvedValues)`.** This is where the PA template's logic runs. Any thrown error is caught and re-thrown as an `EvaluationError` with the original error attached as `cause`, so the caller always sees a typed engine error regardless of what the template did wrong.
4. **Post-process the items.** For each returned item, apply defaults without mutating the input: `finish ?? "PNT"`, `mainPiece ?? false`, fabrication counts default to `0`. The input array is never mutated; a new array is returned.
5. **Return** `{ items, resolvedValues, warnings }`.

It does **not** do:
- Unit conversion. If a length arrives in mm, it'll be treated as inches and produce nonsense. The caller (UI) is responsible for converting at the boundary.
- AISC catalog lookups. If `calculate` returns `size: "C12X20.7"`, the runtime doesn't care whether that designation exists in any catalog. The string is passed through verbatim.
- Rounding. Whatever numbers `calculate` produces come through unchanged. The exporter decides output precision.

### 6.4 Unit helpers (`units.ts`)

All the canonical-inch bookkeeping lives in one file. Three groups of functions:

**Input helpers** — convert from user-facing units to canonical inches:
```ts
inches(6)       // 6         (identity, for readability)
feet(4)         // 48
mm(25.4)        // 1
ftIn(4, 6)      // 54        (feet + inches combined)
```

**Output helpers** — convert from canonical inches to other units:
```ts
toFeet(54)      // 4.5
toMm(1)         // 25.4
```

**Display helpers** — format a canonical-inches number as a human-readable string:
```ts
formatFeetInches(54)     // "4' 6\""
formatFeetInches(54.5)   // "4' 6 1/2\""
formatFeetInches(0.5)    // "1/2\""
formatFeetInches(12)     // "1'"
formatInches(54.5, 2)    // "54.5\""
```

`formatFeetInches` rounds to the nearest 1/16" by default and reduces the fraction (so `5/16` stays `5/16` but `8/16` becomes `1/2`). It handles whole feet (no fraction), whole inches under a foot, and negative values.

**Parser** — the hardest piece, `parseLength(input: string): number`. Accepts:
- bare number = inches: `"54"` → `54`, `"54.5"` → `54.5`
- suffixed inches: `"54\""`, `"54 in"`, `"54 inches"` → `54`
- suffixed feet: `"4 ft"`, `"4.5 ft"`, `"4 feet"` → `48`, `54`, `48`
- suffixed mm: `"1370 mm"` → `53.94...`
- suffixed cm: `"2.54 cm"` → `1`
- feet-inches: `"4' 6\""`, `"4'6\""`, `"4'-6\""`, `"4' 6"` → `54`
- feet-inches with fraction: `"4' 6 1/2\""` → `54.5`
- inches with fraction: `"6 1/2\""`, `"6 1/2"` → `6.5`
- pure fraction: `"1/2"`, `"3/4\""` → `0.5`, `0.75`

Throws `ParseError` on anything it doesn't recognize. Strict parsing is intentional — the parser grows more permissive as real estimator inputs reveal edge cases, not preemptively.

### 6.5 The starter PA library (`pa-library/`)

Five hand-ported templates, each modeled on a corresponding PA from Ricky's library:

| Our ID | Our Name | Modeled on | Category | Visible vars | Hidden defaults | Why this one |
|---|---|---|---|---|---|---|
| `stair-channel` | Stair Channel | Ricky's PA 29 | stair | 3 (numTreads, numRisers, stairWidth) | 3 (riserHeight, treadDepth, stringerSize) | Core product demo, exercises the Pythagorean pattern and the visible-vs-hidden split |
| `landing-channel` | Landing Channel | Ricky's PA 33 | landing | 2 (widthOfLanding, depthOfLanding) | 5 (frame size, front size, cross member size, flooring, connection type) | Pairs with stair, exercises real enum variables for floor type and connection type |
| `hss-rail-pickets` | HSS Rail with Pickets | Ricky's PA 32 | rail | 15 (pre-hidden-defaults era) | 0 | Most complex — section-per-turn pattern using an array inside `calculate` |
| `roof-ladder` | Roof Ladder | Ricky's PA 54 | ladder | 6 (pre-hidden-defaults era) | 0 | Simple two-rail ladder, tests the `FB`/`RD` shape codes |
| `column-hss` | HSS Column | HSS variant of Ricky's PA 43 | column | 10 (pre-hidden-defaults era) | 0 | Conditional rows (stiffener count, shear tab count) |

Each file exports a named `PATemplate` constant. `pa-library/index.ts` collects them into a `starterLibrary: PATemplate[]` array and exposes two helpers:
- `getTemplate(id: string): PATemplate | undefined` — lookup by id
- `getTemplatesByCategory(category: PACategory): PATemplate[]` — filter by top-level type

**Hidden-defaults status.** Only `stair-channel` and `landing-channel` have been rewritten to use the `hidden: true` pattern (see [§5.5](#55-hidden-company-defaults)). The other three — `hss-rail-pickets`, `roof-ladder`, `column-hss` — still expose every variable as a visible form field. They work, but when the UI renders them the estimator sees 6–15 fields instead of 2–3. Porting them to the hidden-defaults pattern is straightforward (flag every non-drawing-readable variable as `hidden: true` and keep its existing default) and is the next refactor in line for the library.

**Modeling accuracy:** these are hand-ported, not automatically extracted. For each starter PA, the process was:
1. Read the dumped JSON at `scripts/powerfab-schema-dump/dump/parametric_assemblies/NNN_<name>.json`
2. Interpret PowerFab's formula strings, unit literals, and ID-based references
3. Rewrite the logic as clean TypeScript using our type system
4. Preserve the item count, ordering, and the quantitative relationships between variables and outputs

We aim for **functional equivalence**, not byte-for-byte matching with PowerFab's output. If Ricky's Stair Channel produces a 17-tread stair with a stringer of 19'6 1/8" and ours produces 19'6" flat, that's acceptable for Phase 1. What matters is that the item count, the shapes, the grades, the labor codes, and the quantitative relationships are correct. Tests pin specific expected values so we catch regressions.

### 6.6 The CSV exporter (`powerfab-csv.ts`)

```ts
export function exportItemsToCsv(
  items: Item[],
  options?: CsvExportOptions,
): string;

export interface CsvExportOptions {
  lengthFormat?: "feet-inches" | "decimal-inches" | "millimeters";
  fractionDenominator?: number;
  includeHeader?: boolean;
  sequenceStart?: number;
  sequenceIncrement?: number;
}
```

Column layout (first pass — the actual PowerFab import format is still being verified):

```
Item, Sequence, Qty, Shape, Size, Length, Width, Grade, LaborCode, Finish, Holes, Copes, Stiffeners, Comment
```

- Sequence numbers start at 10 and increment by 10 by default (`10, 20, 30, ...`), so insertions don't renumber everything
- Lengths are formatted as feet-and-inches by default; `decimal-inches` and `millimeters` modes are available
- Fields containing commas or quotes are CSV-escaped with double-quoting
- Missing lengths/widths produce empty cells, not `undefined`
- Integer quantities emit as `1`, not `1.0`

Detail fields we aren't emitting yet (because we don't know if PowerFab's importer reads them): `WebHoles`, `TopFlangeHoles`, `BottomFlangeHoles`, `WeldedStuds`, `ManHoursPerPiece`, `ErectHours`. Added back when testing against a real PowerFab install reveals they're needed.

---

## 7. How an evaluation flows end to end

Worked example: the UI creates a Stair Channel assembly. The estimator fills in only the visible fields; hidden company defaults are applied by the engine.

**Step 1 — the UI imports the template and the runtime:**
```ts
import { stairChannel } from "@shared/pa-library";
import { evaluatePA } from "@shared/engine";
```

**Step 2 — the estimator fills in the three visible fields:**
```
Number of Treads: 14
Number of Risers: 15
Stair Width:      3' 6"
```

The UI calls the engine with only those three values:
```ts
const result = evaluatePA(stairChannel, {
  numTreads: 14,
  numRisers: 15,
  stairWidth: 42,  // 3'6" in canonical inches
});
```

Note what the UI does **not** pass: `riserHeight`, `treadDepth`, `stringerSize`. Those are flagged `hidden: true` in the template, and the estimator never saw them in the form.

The runtime walks `stairChannel.variables` to build the resolved value map:

- `numTreads` (integer, visible, required, default `14`) → user passed `14`, resolves to `14`
- `numRisers` (integer, visible, required, default `15`) → user passed `15`, resolves to `15`
- `stairWidth` (length, visible, required, default `ftIn(3, 6)` = `42`) → user passed `42`, resolves to `42`
- `riserHeight` (length, **hidden**, default `inches(6.75)` = `6.75`) → no user value, uses default `6.75`
- `treadDepth` (length, **hidden**, default `inches(11)` = `11`) → no user value, uses default `11`
- `stringerSize` (dimension, **hidden**, default `"C12X20.7"`) → no user value, uses default `"C12X20.7"`

No missing required variables. The runtime calls `stairChannel.calculate({ numTreads: 14, numRisers: 15, stairWidth: 42, riserHeight: 6.75, treadDepth: 11, stringerSize: "C12X20.7" })`.

**Step 3 — `calculate` runs:**
```ts
const numTreads = 14;
const numRisers = 15;
const width = 42;
const riser = 6.75;
const run = 11;
const stringerSize = "C12X20.7";

const height = numRisers * riser;                 // 15 * 6.75 = 101.25
const horizontalRun = numTreads * run;            // 14 * 11   = 154
const stringerLength =
  Math.sqrt(height * height + horizontalRun * horizontalRun) + inches(1);
// ≈ sqrt(101.25² + 154²) + 1
// ≈ sqrt(10251.5625 + 23716) + 1
// ≈ sqrt(33967.56) + 1
// ≈ 184.30 + 1
// ≈ 185.30"  ≈ 15' 5 5/16"
```

It then constructs and returns 6 items:
1. `{ mainPiece: true, shape: "CO", grade: ".", quantity: 1, description: "Stair", erectHours: 40 }`
2. `{ shape: "C", size: "C12X20.7", grade: "A36", quantity: 2, length: 185.30, laborCode: "M", comment: "Stringer" }`
3. `{ shape: "L", size: "L3X3X1/4", grade: "A36", quantity: 28, length: 9, laborCode: "Y", comment: "Jacks" }` — two per tread (14 × 2 = 28)
4. `{ shape: "PL", size: "PL14GA", grade: "A36", quantity: 14, length: 42, width: 11, laborCode: "JJ", comment: "Tread Pans" }`
5. `{ shape: "PL", size: "PL3/8", grade: "A36", quantity: 3, length: 12, width: 2, laborCode: "W", comment: "Caps" }`
6. `{ shape: "L", size: "L2X2X1/4", grade: "A36", quantity: 2, length: 12, laborCode: "Y", comment: "Clips" }`

**Step 4 — post-processing:** the runtime walks the 6 items, applies defaults (`finish ?? "PNT"`, `mainPiece ?? false`, fabrication counts default to `0`), and returns:
```ts
{
  items: [/* 6 items, all with finish:"PNT" and fabrication counts = 0 */],
  resolvedValues: {
    numTreads: 14,
    numRisers: 15,
    stairWidth: 42,
    riserHeight: 6.75,
    treadDepth: 11,
    stringerSize: "C12X20.7",
  },
  warnings: [],
}
```

Notice that `resolvedValues` shows **all six variables** — including the three hidden ones. Hidden just means "not in the form"; the engine still resolves and uses them.

**Step 5 — the UI renders:** loops over `result.items`, displays each as a table row in the live material-list preview. When the estimator bumps the tread count from 14 to 17 in the form, the UI calls `evaluatePA` again with the new value and re-renders. Horizontal run becomes `17 × 11 = 187`, jacks become `34`, tread pans become `17`, the stringer length recomputes — the preview updates within a keystroke.

**Step 6 — CSV export:** the user clicks "Download CSV." The UI calls `exportItemsToCsv(result.items)`, gets back a ~7-line CSV string, and triggers a browser download. The CSV is the exact content of the preview table, formatted for PowerFab's importer.

That's the entire loop. Nothing hits a database, nothing hits the network, nothing waits on anything. The engine is a calculator.

**A note on the math shift:** earlier versions of this PA took `heightBetweenLandings` as a direct input (10 feet → 120 inches) and computed `numTreads = Math.floor(height / riser)`. The current version reverses the dependency: `numTreads` and `numRisers` are direct estimator inputs, and `height` is derived (`numRisers × riserHeight`). This is because estimators typically read the tread count off a stair detail more easily than they measure the floor-to-floor distance, and because the floor-to-floor distance computed from an integer tread count matches the fabricated assembly exactly (no "we have 17.78 treads, round down to 17 and now there's a mismatch" problem).

---

## 8. Testing strategy

**Current state:** 8 Vitest tests across 2 files, all passing as of 2026-04-15. Tests are **colocated** next to the source they exercise, at `src/shared/pa-library/<name>.test.ts`, and are picked up by vitest via `include: ["src/**/*.test.ts"]` in `vitest.config.ts`. Run with `bun run test`.

| File | Tests | Covers |
|---|---|---|
| `src/shared/pa-library/stair-channel.test.ts` | 4 | Evaluates with only the three visible inputs (hidden defaults fall back to their `defaultValue`); verifies the 6-item material list (main piece header, stringers, jacks, tread pans, caps, clips) with hand-calculated expected values for a 14-tread / 15-riser / 3'6" flight; exercises the visible-vs-hidden split end to end |
| `src/shared/pa-library/landing-channel.test.ts` | 4 | Evaluates with only the two visible inputs (width + depth); verifies the expected rows for the default deck flooring + clip connection; exercises the flooring and connection hidden defaults |

**Ground truth for expected values:**
1. **Hand calculation** — Pythagorean stair length, tread count, cross-member count, etc. Committed as constants in the test file.
2. **Reading Ricky's dumped JSON** — cross-referencing the dumped PA structure in `scripts/powerfab-schema-dump/dump/parametric_assemblies/` against our TypeScript version for item count, ordering, and quantitative relationships.
3. **Functional equivalence** — quantity mismatches are bugs; length mismatches within 1/16" are acceptable.

### Test layout history

An earlier version of the engine (pre-hidden-defaults refactor) had **92 tests across 5 files** in a separate `test/` directory:

```
test/shared/engine/units.test.ts              (29 tests)
test/shared/engine/runtime.test.ts             (13 tests)
test/shared/engine/pa-library.test.ts          (28 tests)
test/shared/engine/library-index.test.ts       (10 tests)
test/shared/exporters/powerfab-csv.test.ts     (12 tests)
```

Those files **still exist on disk** but are gitignored (the `test/` tree is in `.gitignore`) AND excluded from vitest runs by the updated `include` glob. They're effectively orphaned. The Stair Channel tests in particular no longer match the current PA (which uses `numTreads`/`numRisers` instead of `heightBetweenLandings`), so even if you ran them they'd fail.

### What's missing from the current test coverage

Only `stair-channel` and `landing-channel` have colocated tests so far. Three of the five starter PAs have **no current test coverage**:

- `hss-rail-pickets` — most complex PA, has the multi-section pattern and mid-runners, absolutely needs tests
- `roof-ladder` — simple but tests the FB/RD shape codes and hole counts
- `column-hss` — tests conditional rows for stiffeners and shear tabs

Also orphaned from the old test tree but worth porting back:
- **Unit tests** for `parseLength`, `formatFeetInches`, `feet/mm/ftIn` — these are pure functions and should have fast-running coverage again. The old `test/shared/engine/units.test.ts` had 29 cases; reviving them under `src/shared/engine/units.test.ts` would be ~30 lines of copy-paste.
- **Runtime tests** for `evaluatePA`'s required-variable validation, default application, purity, and error wrapping. Important because the runtime is the contract everything depends on.
- **CSV exporter tests** for column layout, length format switching, CSV escaping. The exporter is small but wrong in subtle ways (unescaped commas, missing header row) would break imports downstream.
- **Library index tests** (every template evaluates with defaults, every required variable has a default, template IDs are unique) — these catch whole classes of PA authoring errors.

**Recommendation for the next test pass:** port the engine/runtime/units/csv/library-index tests from the orphaned `test/` tree to colocated files under `src/shared/` to get back to ~72 tests without writing anything new, then add 3–4 colocated tests per remaining PA (ladder/rail/column) to round out library coverage. The stair-channel and landing-channel colocated tests are the model for what those should look like.

**Not done in Phase 1:** automated diffing against a live PowerFab instance. PowerFab has no API; driving its desktop UI programmatically is fragile; scraping its DB from an unattended script is risky. If a customer complains about a mismatch we'll add targeted fixture tests for that specific PA, but the general case is deferred until there's demand.

---

## 9. What the engine does NOT do

Explicit non-goals. Each is listed because it was considered and rejected (or deferred), not because we forgot about it.

### 9.1 No formula parser, AST, or RPN evaluator
Covered in §5.1. PAs are TypeScript modules.

### 9.2 No database access
Covered in §5.3. Pure function. The UI handles persistence; the engine handles math.

### 9.3 No PA authoring UI
Covered in §5.4. Estimators consume PAs; developers (or eventually an AI) author them as TypeScript files.

### 9.4 No PowerFab `.txt` import
Deferred. When a real `.txt` export is available from Ricky we'll write a small translator that converts formula strings → TypeScript source at import time, producing hand-editable `.ts` files. The grammar is small; the translator is maybe a day of work. Not Phase 1.

### 9.5 No AI-assisted PA authoring
Deferred. Phase 2+. The long-term plan is a mode where a user describes an assembly in English and an LLM produces a `PATemplate` TypeScript module they can review, edit, and save. Shares the engine and data model with the takeoff workflow but lives in a separate admin surface.

### 9.6 No per-company customization
Phase 1 ships a single bundled starter library of 5 PAs. Different customers will want different defaults (size preferences, labor code names, grade spellings). The simplest intermediate step is per-customer deploy builds; the long-term answer is a data-driven PA store keyed by customer. Both are out of scope for Phase 1.

### 9.7 No AISC catalog lookups
Covered in §4.3. Shapes and sizes are opaque strings. When a PA template says `size: "C12X20.7"`, the engine doesn't validate or expand that — it just passes the string through. A later plan will introduce a `resolveSize` helper backed by the AISC v16.0 catalog so the UI can offer searchable dimension pickers, but the engine itself stays dumb about it.

### 9.8 No `SIN`, `COS`, `TAN`, `FLOOR`, `ROUND` handling
None of Ricky's 49 PAs use them. If a future PA needs them, add `Math.sin` / `Math.cos` / `Math.floor` / `Math.round` directly in `calculate` — no spec change needed.

### 9.9 No main-piece-quantity multiplier
Covered in §4.7. Each assembly invocation is one instance. Multiple instances = multiple assemblies in the project.

### 9.10 No rounding, no display formatting in the engine
The engine returns raw numbers with whatever precision the math produced. Rounding to the nearest 1/16", formatting as feet-inches, switching to mm for display — all happen at the exporter or the UI layer. The engine's output is canonical.

### 9.11 No `Property from EST Line Item` or `Property from Assembly Line Item` variable types
Covered in §4.4. The first requires an estimating-job context we don't have; the second can be done inside `calculate` as normal TypeScript.

---

## 10. Code inventory

As of 2026-04-15 (post hidden-defaults refactor):

**Source files:**

| Path | Lines | What it is |
|---|---|---|
| `src/shared/engine/types.ts` | 83 | All type definitions (incl. `hidden` flag on `VariableDef`) |
| `src/shared/engine/units.ts` | 184 | Unit helpers + `parseLength` |
| `src/shared/engine/runtime.ts` | 108 | `evaluatePA`, `EvaluationError`, `EvaluateResult` |
| `src/shared/engine/index.ts` | 28 | Barrel re-exports |
| `src/shared/pa-library/stair-channel.ts` | 152 | Stair Channel starter PA (uses hidden defaults) |
| `src/shared/pa-library/landing-channel.ts` | 203 | Landing Channel starter PA (uses hidden defaults) |
| `src/shared/pa-library/hss-rail-pickets.ts` | 272 | HSS Rail with Pickets — most complex, not yet refactored to hidden defaults |
| `src/shared/pa-library/roof-ladder.ts` | 138 | Roof Ladder — not yet refactored to hidden defaults |
| `src/shared/pa-library/column-hss.ts` | 189 | HSS Column — not yet refactored to hidden defaults |
| `src/shared/pa-library/index.ts` | 31 | Library registry + lookup helpers |
| `src/shared/exporters/powerfab-csv.ts` | 103 | CSV exporter |
| `src/shared/exporters/index.ts` | 4 | Barrel re-export |
| **Source subtotal** | **1,495** | |

**Colocated tests:**

| Path | Lines | What it covers |
|---|---|---|
| `src/shared/pa-library/stair-channel.test.ts` | 105 | 4 tests exercising Stair Channel with hidden defaults |
| `src/shared/pa-library/landing-channel.test.ts` | 96 | 4 tests exercising Landing Channel with hidden defaults |
| **Test subtotal** | **201** | **8 tests, all passing** |

**Grand total: 1,696 lines of TypeScript.**

Three starter PAs (`hss-rail-pickets`, `roof-ladder`, `column-hss`) have no colocated tests yet. Their old tests from the `test/` tree no longer run (see [§8](#8-testing-strategy)).

**Local-only reference material** (not committed, in `.gitignore`):
- `test/` — the old 92-test tree from before the hidden-defaults refactor. Orphaned but still on disk.
- `scripts/powerfab-schema-dump/` — the 5 Python dump scripts plus `dump/` containing schemas for the 383 relevance-matched tables, 49 PA dumps, lookup tables (shapes, sizes, grades, labor codes), and one fully resolved Stair Channel example. This doc is the committed summary of what these materials taught us.
- `docs/powerfab/` — the exploration-phase documentation (`aisc-shapes-catalog.md`, `database-findings.md`, `parametric-assembly-authoring-guide.md`) that captured the raw observations. Also gitignored, also on disk.

---

## 11. What comes next

Track 1 (this engine) is complete. The remaining work splits into three threads:

1. **Track 2 — the estimator workflow UI.** A React SPA that renders forms from `template.variables`, calls `evaluatePA` on every change, shows the live material-list preview, and downloads the CSV. Planning in progress. Two prototype branches (`frontend/workbench-hybrid` and `frontend/wizard-grouped`) explore the two main UX directions. See [`workflow-ux-explorations.md`](workflow-ux-explorations.md).

2. **The AISC catalog ingestion.** A small data layer that ingests AISC v16.0 shapes data into a searchable form the UI can use to render a proper dimension picker (instead of the free-text stub). Not strictly blocking Track 2 — the UI can ship with a text-input stub and swap to the picker later.

3. **Additional starter PAs.** Phase 1 has 5. Real fabricators have 40–100. As we onboard real users we'll hand-port more PAs from Ricky's library, or (eventually) write a `.txt` importer that generates them for us.

All three threads consume the same engine without changing it. That's the point of having built Track 1 first.
