# Parametric Assembly Product Direction

_Source: product discussion 2026-04-13._

> **Related docs:**
> - [`docs/powerfab/database-findings.md`](../powerfab/database-findings.md) — what's actually in PowerFab's database, field-by-field
> - [`docs/powerfab/parametric-assembly-authoring-guide.md`](../powerfab/parametric-assembly-authoring-guide.md) — how PAs are authored, formula syntax, patterns

## Vision

The end goal of this app is to **replace the PowerFab parametric-assembly authoring experience with something dramatically simpler**, and to layer AI on top so estimators don't have to type out repetitive takeoff data by hand.

An estimator should be able to:

1. Open a project, pick an assembly type (Stair, Landing, Rail, Ladder, …)
2. Fill in a small form of variables (number of treads, stair width, stringer material, …)
3. Get back a clean material list — quantities, shapes, sizes, lengths, labor codes, grades, finishes — ready to import into a PowerFab estimate
4. Eventually, have an AI agent pre-fill that form from a drawing or a plain-English description, with the estimator reviewing and editing before save

The app is essentially **the PowerFab parametric assembly, rebuilt as a web tool, with AI-assisted input**. It is not a thin OCR layer over drawings — it is a takeoff workflow tool with an opinionated data model.

## Phasing

Sequencing was the central decision of the meeting.

### Phase 1 — Front-end and workflow first, no AI

Build the authoring/usage UI end-to-end with manual entry only:

- Project list and project create flow
- Assembly-type picker inside a project (Stair / Landing / Rail / Ladder / …)
- Per-assembly form with the variables an estimator needs to fill in
- A summary view of all assemblies entered for a project
- Output: a material list file the estimator can import into PowerFab

No AI in Phase 1. The motivation is that users want the authoring experience regardless of AI quality, and a stable UI/data model gives the AI a concrete target to fill later.

### Phase 2 — AI fills the variables

Once the front-end is solid, layer the agent on top. Two complementary input modes:

- **Drawing-driven**: agent reads uploaded drawings and pre-populates as much of the form as it can
- **Conversation-driven**: estimator describes the assembly in plain English or speech — _"I have a stair with 12 treads, 5' wide, pan treads"_ — and the agent fills the form, asking clarifying questions when needed

In both modes, AI-filled fields should be visually distinct (e.g. highlighted yellow) so the estimator can see what to verify. Nothing is auto-committed; the human always reviews before save.

### Side angle — PA generator agent (separate revenue stream, same data model)

Some domain experts already use ChatGPT to generate PowerFab parametric-assembly `.txt` files for fabricator clients, and get ~75% of the way there before manual cleanup. There is a parallel product opportunity: an in-app **"personal parametric assembly agent"** that builds PowerFab PA `.txt` files from natural-language descriptions, for fabricators who use PowerFab directly and don't want to author PAs by hand.

This is a different audience and a different output format from the takeoff workflow above, but it shares the same parametric-assembly data model, so building one helps the other.

## Output target

Decided in the meeting:

- **Output is a material-list file (Excel/CSV/text), not a PowerFab parametric-assembly `.txt` file.** The output contains the _expanded_ line items from running the formulas — qty, shape, size, length, labor code, grade, finish — in the format PowerFab's estimate import accepts.
- The **parametric-assembly logic itself (variables, formulas, conditionals, calculations) lives inside this app**, not in a downstream `.txt` file. PowerFab is a destination for results, not a partner that runs our logic.
- **Writing directly to PowerFab's SQL database was considered and rejected.** Reasons: data corruption risk if AI ever touches the DB, and the user would need to be authenticated to their own DB from our site (engineering nightmare).
- Excel is the reluctant medium. Team rule: _"no .KISS files — we'd look like hypocrites if our tool generates one."_ If a better target appears later, swap out the exporter; the data model shouldn't care.

### Output schema (current baseline)

The existing schema in `resources/knowledge-base/CLAUDE.md` is the starting point:

```
Item, Sequence, Stair, Category, Component, Qty, Shape, Size, Length, Grade, Notes
```

A PowerFab walkthrough surfaced fields the current schema does not yet capture and that we will likely need to add:

- **Labor code / "type"** — a recipe identifier that tells PowerFab which labor template to apply (e.g. `H` = fillet weld both ends). User/company-defined.
- **Finish** — painted / unpainted / galvanized.
- **Width** — needed for plate (plate has both width and length).
- **Main-piece flag** — a boolean on a header row that makes it act as a parent. In PowerFab, multiplying the qty on a "main piece" header row multiplies all child rows. We should preserve this behavior in the exporter even if the in-app UX hides it.

## Data model

The central object is a **parametric assembly invocation** — not a flat row of takeoff data. Conceptually, every assembly the estimator authors has the shape:

```
Assembly
├── type           (Stair | Landing | Rail | Ladder | …)
├── label          ("Stair 1", "North Tower Flight 2", etc.)
├── variables      ← user-filled or AI-filled inputs
│     ├── { name, type, value }
│     └── …
└── items          ← derived from formulas at calculate time
      ├── { qty, shape, size, length, width?, labor, grade, finish, isMainPiece? }
      └── …
```

The `variables` are what the estimator (or the AI) fills in. The `items` are computed by running this app's formulas/logic against those variables, and they are what gets exported to PowerFab.

Three places in the codebase need to converge on this object:

1. **The UI** — reads/writes it as the estimator works through forms
2. **The agent (Phase 2)** — produces it from drawings or conversation
3. **The exporter** — converts it into the PowerFab-importable file (CSV today, possibly something better later)

Locking this shape in early is the leverage point — it lets UI, agent, and exporter be built independently against a shared contract.

### Important: do not inherit PowerFab's quirks

PowerFab's parametric-assembly authoring has a hack pattern that has to be used because PowerFab variables don't have native enums: create an integer variable (`1=C, 2=MC, 3=HSS`), then define _three separate item rows_ — one per shape — with `IF [stringer material]=1 THEN 2 ELSE 0 ENDIF` on quantity to zero-out the unused rows. **Our app should not inherit this awfulness.** Use a real dropdown, store the choice as an enum, and resolve to the correct shape in our exporter. The whole point of building this is to be simpler than PowerFab.

## UX direction

### Decided

- **Project list / landing page** uses the Steel Genie pattern: dark theme, grid of project tiles with thumbnails, status badges (e.g. "In Progress"), an "Add new project" tile in the top-left.
- **Inside a project**, a left-side menu lists assembly types (Stair, Rail, Landing, Ladder). Clicking one opens the variable form for that assembly type in the main pane.
- **After saving an assembly**, it appears as a row in a summary list, with a renamable label (default `Stair 1`, `Stair 2`, …).
- **Component decomposition**: a "stair tower" is _not_ one assembly. It is three components — Stairs (stringers + treads), Landings, Rails — each authored as its own assembly. This matches how estimators already think about steel.
- **Phase 1 form UX = plain text boxes, dropdowns, and number fields.** No graphical configurator yet.

### Long-term direction

The eventual form UX is a **graphical configurator** in the style of Tekla Structures' rebar staircase dialog: a drawing of the assembly with dimension input fields placed directly on the picture, plus parameter dropdowns on the side. (See the Tekla rebar staircase reference image from the meeting.) The team advocated strongly for this direction, with the caveat that it's outside current browser-graphics experience. Treat it as a Phase 1.5 / Phase 2 upgrade — the form fields are the same data, just rendered against a background image instead of in a plain grid.

### Estimator-driven input (Phase 2)

In addition to the form, Phase 2 should support estimators describing assemblies in natural language while looking at a drawing on the other monitor. The agent listens/reads, fills the form, asks clarifying questions, and the human reviews. The team liked this — it matches how people are already using AI tools.

### Open: how to organize work inside a project

This is the biggest unresolved UX question. Options on the table:

- **Flat list of assemblies** ("Stair 1", "Stair 2", "Landing 1", …) with a `flights` count field inside each so estimators who average can do it once
- **Tree structure** by stair, with levels/flights nested underneath
- **Grouped by component type** (all stringers, all landings, all rails)

The current lean is toward the flat list with a `flights` field, pending input from an experienced estimator before committing. This decision shapes routing and navigation across most of the UI, so it should be settled early.

## Hard constraints

These were surfaced repeatedly in the discussion and any design that ignores them will need to be reworked.

- **Estimators measure stairs three different ways**: number of treads, stringer length, or rise/run. Initial implementation should force one method to ship; eventually accept any of the three and back-compute the others. A reference PA supporting all three methods is being built in parallel.
- **Length input formats** vary: feet/inches/fractions vs. decimal feet vs. millimeters. Force one for now.
- **Company-default fallbacks are essential.** Many drawings show only "stair" with no material spec. The tool _must_ have per-company defaults: default sizes for each shape category ("we use C12x20.7 for stringers"), default grades per shape (channel ≠ beam ≠ angle), default labor codes, and default shape codenames (some firms call tube "HSS", others "TS"). These should be company-scoped settings, not user-scoped.
- **AISC shape database is the source of truth** for shapes and sizes. It is public data and is being sourced for the project. The set of valid shapes/sizes/dimensions in our dropdowns should come from there.
- **Grades are messy.** The same grade gets 14 spellings ("A500-GR.B", "A500-GR B", "A500-B", …). The app needs a company-defined canonical grade list with the ability to map dirty inputs onto it.
- **Finishes** (painted/unpainted/galvanized) need to be capturable per item or per assembly.
- **Estimators all do this differently.** Whatever we ship, somebody will say it's wrong. Default to one opinionated workflow and add knobs as users actually ask for them, not preemptively.

## Action items

| Owner        | Item                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| Domain lead  | Provide the AISC shapes Excel database                                                                        |
| Domain lead  | Provide a sketch list of variables + dropdown values for at least Stairs and Landings (target: day after meeting) |
| Domain lead  | Optionally build a reference parametric assembly accepting all three stair-measurement methods                |
| Eng lead     | Scaffold the UI shell: project list → project view → assembly forms (plain text boxes, no AI, no graphic)     |
| Team         | Pull an experienced estimator in to validate the within-project workflow (flat vs. tree)                      |

No external deadline. Nothing is needed for "the show next week."
