# Workflow & UX Explorations: Six Design Directions

_Last updated: 2026-04-14._

This document sketches six different ways the takeoff-agent-app's authoring workflow could be designed. None of them are committed yet. The point is to have concrete options to react to, pick from, combine, or prototype side-by-side.

Each option is written so a future version of this project (or a future Claude session) could build a working prototype from just the section below, without needing any other conversation context.

Related docs:

- [`parametric-assembly-product-direction.md`](parametric-assembly-product-direction.md) — the overall product direction and phasing decision (UI first, AI second, output is a CSV to PowerFab)
- [`../powerfab/database-findings.md`](../powerfab/database-findings.md) — the PowerFab data model we're targeting
- [`../powerfab/parametric-assembly-authoring-guide.md`](../powerfab/parametric-assembly-authoring-guide.md) — the mechanics of PAs (variables, items, formulas)
- [`../powerfab/aisc-shapes-catalog.md`](../powerfab/aisc-shapes-catalog.md) — where shape catalogs come from

---

## Table of contents

1. [Purpose and how to read this](#1-purpose-and-how-to-read-this)
2. [Shared concepts across all six options](#2-shared-concepts-across-all-six-options)
3. [Cross-cutting design dimensions](#3-cross-cutting-design-dimensions)
4. [Option 1 — The Form Grid](#4-option-1--the-form-grid)
5. [Option 2 — The Wizard](#5-option-2--the-wizard)
6. [Option 3 — The Visual Configurator](#6-option-3--the-visual-configurator)
7. [Option 4 — The Conversational AI-First](#7-option-4--the-conversational-ai-first)
8. [Option 5 — The Drawing Split](#8-option-5--the-drawing-split)
9. [Option 6 — The Workbench (VS Code-inspired)](#9-option-6--the-workbench-vs-code-inspired)
10. [Hybrid and combined approaches](#10-hybrid-and-combined-approaches)
11. [Suggested prototype order](#11-suggested-prototype-order)
12. [Open questions](#12-open-questions)

---

## 1. Purpose and how to read this

This is a **menu**, not a plan. Read each option as "what would it feel like to use the app if we built it this way?". Compare them. Mix-and-match — the variants in section 3 let you swap pieces independently. When we're ready to prototype, we'll pick one or two to build first and see how they feel.

Each option follows the same structure:

- **The idea** — one-paragraph elevator pitch
- **Layout wireframe** — ASCII sketch of what the screen looks like
- **User journey** — step-by-step walkthrough of an estimator using it to add their first stair
- **Key interactions** — the non-obvious details that make the experience work
- **Variants** — meaningful variations on the same core idea
- **Pros / cons**
- **Implementation cost** — rough feel for effort (low / medium / high / very high)
- **Best for** — which user type and which situation this option optimizes for

Where an option has sub-options that significantly change the feel, they're called out explicitly.

---

## 2. Shared concepts across all six options

Regardless of which direction we pick, a few things stay the same. Treating them as shared dramatically shortens the rest of this doc.

### 2.1 The three-level navigation spine

Every option lives inside the same outer navigation:

```
Level 1: Project list (Steel Genie-style landing page)
             │
             ▼
Level 2: Project workspace (this is where the options differ)
             │
             ▼
Level 3: Individual assembly editor (may be a panel, a page, a modal, or a chat — depending on option)
```

Level 1 is the project list. It's a grid of project cards with thumbnails, status, and an "Add Project" tile. We agreed on this shape earlier and it's not affected by the option choice.

Level 2 is the project workspace — the place you land after clicking into a project. **This is what varies across the six options.** Everything below in sections 4–9 is about level 2 (and how it routes into level 3).

### 2.2 The data model is the same

Every option produces the same underlying data: a `Project` with a list of `Assembly` invocations. Each assembly has a type (Stair, Landing, Rail, Ladder, …), a user-visible label, variable values, and (derived at export time) a list of computed line items. See `parametric-assembly-product-direction.md` for the full shape.

This means options can be **hot-swapped** later. If we ship option 1 and users prefer a different model, the data moves cleanly — we're only rewriting the UI, not migrating anything.

### 2.3 The output is the same

Every option eventually generates a CSV file ready for PowerFab import. What differs is how the estimator gets there. The exporter is decoupled from the authoring UI and will work identically regardless of which option wraps it.

### 2.4 Phase 1 has no AI

Every option below is described as a Phase 1 (no-AI) experience first. AI assist is a Phase 2 overlay that can plug into any of them — some options (4, 6) expose AI as a first-class feature; others (1, 2, 3) treat it as a future add-on.

### 2.5 Project summary is always available

Every option has some way to see "everything I've added to this project so far". In some it's a persistent sidebar; in others it's a dedicated summary view. Either way, the estimator can always answer "what's in this project right now?" without more than one click.

---

## 3. Cross-cutting design dimensions

These are independent knobs that can be turned on any of the six options. When reading each option below, assume the defaults listed here unless the option specifically calls out a different choice.

### 3.1 Navigation inside a project: flat, grouped, or tree

How is the list of assemblies in a project organized?

- **Flat list** — one row per assembly in creation order. `Stair 1, Stair 2, Landing 1, Rail 1, Landing 2, …`. Simple, no hierarchy. Current team preference per the 2026-04-13 meeting.
- **Grouped by free-text group field** — every assembly has an optional `group` string. Assemblies with no group appear at the top; grouped ones appear under their group header. `"North Tower" → Stair 1, Stair 2; "South Tower" → Stair 3`. Gives hierarchy without hardcoding one.
- **Tree structured** — explicit parent/child relationships. Stairs are children of a "Stair Tower A" node. Rails are children of the stair they belong to. More powerful but adds a concept ("what's the parent?") to every creation action.

**Recommendation**: default to grouped-by-free-text (gives flat-list users a flat experience, gives tree users a tree experience, requires no schema change between them). Trees are a later upgrade if users ask for them.

Every option below assumes this by default unless it says otherwise.

### 3.2 Live preview vs. on-demand Calculate

When the estimator types a value into an assembly form, does the generated item list update instantly, or only after they click a Calculate button?

- **Live preview** — items recompute on every keystroke (debounced ~200ms). User sees immediate feedback. Matches modern form UX.
- **On-demand** — user fills in variables, clicks "Calculate Parametric Assembly" (like PowerFab's Test dialog), then sees the result. Less visually noisy, matches what estimators know.

**Recommendation**: live preview, with a visual affordance (a soft highlight or "updated" pulse on changed rows) so the user isn't surprised. PowerFab does on-demand for performance reasons we don't share — our formulas are light and web browsers handle them instantly.

### 3.3 AI chat panel: persistent, toggleable, absent

- **Persistent** — always visible as a side panel. Good for options where the AI is part of the core experience.
- **Toggleable** — hidden by default, opened with a keyboard shortcut or button. Good for options where AI is a help/assist rather than the main flow.
- **Absent** — no AI chat in the UI. AI integration happens via a different mechanism (e.g., a "Fill from drawing" button that kicks off a background agent).

Every option can accommodate any of these. The default for Phase 2 will depend on which option we pick.

### 3.4 Per-PA-type custom graphics

Does each assembly type get its own illustration (a stair diagram for Stair, a ladder silhouette for Ladder, etc.)?

- **Full custom graphics** — hand-illustrated SVG per type, possibly animated to reflect the current inputs. Expensive but high wow-factor.
- **Thumbnail only** — a small icon in the type picker, nothing in the editor. Cheap.
- **None** — pure text/form. Cheapest. Least visually engaging.

This is a variant that interacts strongly with option 3 (Visual Configurator), where graphics are mandatory. Other options can optionally add graphics as decoration.

### 3.5 Drawing upload: required, optional, absent

Does the workflow depend on the user uploading a drawing PDF?

- **Required** — the workflow starts with "upload your drawing" and the whole interface is built around the drawing.
- **Optional** — you can upload to get AI/drawing-integrated features, but you can also type values manually without ever uploading.
- **Absent** — no drawing upload at all in Phase 1. Pure manual entry.

Option 5 (Drawing Split) makes drawings the center of the experience. Every other option works fine without a drawing.

### 3.6 Tabs vs. single-document center

When the user opens an assembly for editing, does the main area show one at a time, or can multiple assemblies be open as tabs?

- **Single document** — clicking another assembly replaces the current one. Simpler state management; less flexible for side-by-side comparison.
- **Tabbed** — each assembly opens in a tab; user can have many open at once. Better for comparing similar assemblies, editing a group in parallel. More familiar to anyone who uses an IDE or browser tabs.

Option 6 (Workbench) assumes tabs as a default — it's part of the VS Code mental model. Other options default to single-document but could add tabs as a variant.

### 3.7 Save behavior

- **Explicit save** — user clicks "Save" to commit changes. Changes can be discarded by closing without saving. Familiar.
- **Autosave** — every edit is written to local state (and eventually the backend) immediately. No save button. Modern feel but users who are used to "ctrl+Z / close without saving to undo" are initially uncomfortable.

**Recommendation**: autosave with a visible "last saved" indicator, plus a session-level undo stack so users can roll back recent changes. This is the modern default and matches Figma, Notion, Linear, etc.

### 3.8 Progress indicator / completeness

Does the user see a sense of "how complete is this assembly / project" somewhere?

- **Per-assembly** — a progress bar or checklist showing which required variables are filled
- **Per-project** — an overall completeness meter ("12 of 18 assemblies finished")
- **None** — the user judges completeness themselves

A subtle per-assembly indicator is cheap and helpful, especially for long PAs like Ships Ladder with 24 variables. Worth including in any option as a default.

---

## 4. Option 1 — The Form Grid

### The idea

A two-pane layout with a sidebar of assemblies on the left and a big form editor on the right. Closest to "what PowerFab has, but cleaner". The estimator picks a type, fills in a form, sees the generated item list below, and saves. Familiar, fast, predictable, boring in the good way.

### Layout wireframe

```
┌──────────────────────────────────────────────────────────────┐
│ TakeoffAI   ▸ North Lakes Warehouse                     [⚙]  │
├─────────────────┬────────────────────────────────────────────┤
│ + Add Assembly  │   Stair 1 — Main Stair Tower              │
│                 │  ─────────────────────────────────────     │
│  STAIR          │   Variables                                │
│  + New          │   ┌───────────────────────────────────┐    │
│                 │   │ Stair Width        [  4' 0"    ]  │    │
│  ─ Stair 1      │   │ Height Between Ldg [  10' 0"   ]  │    │
│  ─ Stair 2      │   │ Number of Treads   [    12    ]   │    │
│                 │   │ Stringer Material  [   C     ▾]   │    │
│  LANDING        │   │ Stringer Size      [ C12X20.7 ▾]  │    │
│  + New          │   │ Tread Material     [ Pan     ▾]   │    │
│  ─ Landing 1    │   └───────────────────────────────────┘    │
│                 │                                            │
│  RAIL           │   Generated items  (live preview)          │
│  + New          │   ┌───────────────────────────────────┐    │
│                 │   │ Qty  Shape  Size    Length  Labor │    │
│                 │   │ 1    CO     —       —       —     │    │
│                 │   │ 2    C      C12X... 19'6"   H     │    │
│                 │   │ 12   PL     1/4x24  4'0"    JJ    │    │
│                 │   │ 2    PL     3/8x3   4'0"    A     │    │
│                 │   └───────────────────────────────────┘    │
│                 │                                            │
│                 │   [  Save  ]  [ Duplicate ] [ Delete ]     │
│                 │                                            │
│                 │                      [  Export to CSV  ]   │
└─────────────────┴────────────────────────────────────────────┘
```

### User journey

1. Estimator creates a new project from the Steel Genie-style landing page
2. Lands on the empty project workspace — left sidebar shows "Add Assembly" with a disabled list below it, main pane shows a placeholder "Select or add an assembly to begin"
3. Clicks "Stair + New" in the sidebar
4. A new "Stair 1" row appears in the sidebar and the main pane opens a fresh Stair form with default values prefilled (e.g. 4' × 10' × 12 treads × C12X20.7)
5. Estimator tweaks `Stair Width` to match the drawing. The item preview updates live — length of each tread changes to 4' 0".
6. Estimator scans the item preview, sees it looks right, clicks Save (or relies on autosave). The sidebar entry now shows a ✓ or a summary line ("12-tread C-stringer stair, 4' wide").
7. Adds a Landing next: clicks "Landing + New", same pattern
8. When done with all assemblies, clicks "Export to CSV" in the top-right

### Key interactions

- **Keyboard-first**. Tab advances through form fields. `Enter` saves the current assembly and opens a new one of the same type. `Ctrl+D` duplicates the current assembly (common operation for estimators doing 4 nearly-identical stairs).
- **Live preview** is the default. Item list updates on every keystroke, debounced ~150ms.
- **Inline editing of item comments**. Clicking a row in the preview lets the user override a comment or labor code for that specific row — useful when one specific stair needs a different finish without re-authoring the PA.
- **Sidebar is grouped by assembly type** by default. Within each type, assemblies are a flat list in creation order. A small collapse/expand arrow per group.
- **Status badge** on each sidebar entry: green dot for complete, yellow dot for incomplete (missing required variables), grey dot for draft.

### Variants

- **V1a — Sidebar grouped by type** (the default shown above). Clean, matches PowerFab mental model.
- **V1b — Sidebar grouped by free-text group field**. User can type "North Tower" into a group field on each assembly; sidebar groups by that instead of by type. Lets estimators organize by physical location in the building instead of component type.
- **V1c — Sidebar as a tree**. Strict parent/child. Stair Tower A → Stair 1, Stair 2 → Landing 1 → Rail 1. More structure, more setup work. Probably a later addition, not a Phase 1 default.
- **V1d — Horizontal split instead of vertical**. Variables on the left, item preview on the right, instead of top/bottom. Better use of wide monitors. Worse on small screens.
- **V1e — On-demand calculate**. No live preview. User clicks "Calculate" to see the item list. Matches PowerFab exactly. I don't recommend this; it costs feedback and responsiveness for no real gain.
- **V1f — With chat sidebar on the far right**. Adds an AI chat panel that can assist ("change the stringer size to HSS", "duplicate this 3 times"). Phase 2 feature — cheap to layer on later.

### Pros

- **Fastest for power users.** Experienced estimators can enter a whole stair in ~30 seconds by tabbing through fields.
- **Most predictable.** Nothing surprising happens; the form is always the form.
- **Easiest to build.** Standard HTML forms with a preview pane. No custom rendering, no complex state, no graphics.
- **Works at any screen size.** Degrades to mobile reasonably (form on top, preview below).
- **Bug surface is tiny.** When the estimator reports a bug, the state is right there in the form.
- **Closest to what PowerFab users already know.** Migration costs near-zero for existing PowerFab users.

### Cons

- **Visually boring.** Looks like an internal admin panel. Won't generate "wow, this is cool" moments.
- **No visual reinforcement** of what the assembly looks like. The user has to imagine it from the numbers.
- **Same as a spreadsheet** in feel. That's fine for accountants, less fine for people who think visually about structural steel.
- **Doesn't leverage anything our tool is unique for.** A hypothetical competitor could build this in a week.

### Implementation cost

**Low.** All standard web form components. Estimate: 2–3 weeks for a polished Phase 1 that covers Stair, Landing, Rail, Ladder templates end-to-end with CSV export.

### Best for

- Experienced PowerFab estimators who just want a cleaner version of what they have
- Companies where the primary users are fast typists and speed matters more than visual appeal
- The conservative baseline that's guaranteed to be usable from day one

---

## 5. Option 2 — The Wizard

### The idea

Adding an assembly launches a multi-step flow that asks one question (or small group) per screen. "What type?" → "Dimensions" → "Materials" → "Finish & labor" → "Review". Progress bar at the top, Back/Next buttons at the bottom. Like TurboTax, like a software installer, like an onboarding flow. Impossible to miss a required field.

### Layout wireframe

```
┌──────────────────────────────────────────────────────────────┐
│ TakeoffAI   ▸ North Lakes Warehouse                     [⚙]  │
├──────────────────────────────────────────────────────────────┤
│   Step 2 of 5 — Dimensions                                   │
│   ●──●──○──○──○                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                                                              │
│        How tall is the stair?                                │
│                                                              │
│        Height between landings                               │
│                                                              │
│            ┌──────────────────┐                              │
│            │  10' 0"          │                              │
│            └──────────────────┘                              │
│                                                              │
│        How wide is the stair?                                │
│                                                              │
│            ┌──────────────────┐                              │
│            │  4' 0"           │                              │
│            └──────────────────┘                              │
│                                                              │
│        How many treads?                                      │
│                                                              │
│            ┌──────────────────┐                              │
│            │  12              │                              │
│            └──────────────────┘                              │
│                                                              │
│                                                              │
│        [  ← Back  ]                      [  Next →  ]        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### User journey

1. Estimator creates the project and clicks "Add Assembly" somewhere prominent (floating button in the center or top-right)
2. A modal/full-screen wizard launches. **Step 1: What type of assembly?** — a grid of big cards with icons for Stair, Landing, Rail, Ladder, Column, etc. Picks "Stair".
3. **Step 2: Dimensions** — three large labeled inputs for height, width, number of treads. Below each is a small hint ("typical: 10'", "typical: 4'", "typical: 12").
4. **Step 3: Materials** — "What are the stringers made of?" with radio-button cards: C-channel, HSS, W-beam. Picks C. Then "What size?" with a searchable dropdown of channel sizes.
5. **Step 4: Finish & labor** — "Painted, unpainted, or galvanized?" Defaults painted.
6. **Step 5: Review** — shows a summary card ("Stair 1: 12 treads, 4' wide, 10' rise, C12X20.7 channel stringers, painted") and a preview of the generated item list.
7. User clicks "Save assembly" and the wizard closes, returning them to the project workspace with the new stair visible in the project summary.
8. Big "+ Add Assembly" button to repeat the flow.

### Key interactions

- **Every step has validation** — Next is disabled until all required fields are filled. Optional fields are clearly marked.
- **Back button never loses state** — going backward keeps what you've entered on later steps, so you can adjust something and come forward again without retyping.
- **A "Skip to end"** option on step 2 or later lets power users collapse to a single-page form view if they find the wizard too slow.
- **Editing an existing assembly** reopens the wizard pre-filled, starting at whichever step the user clicks (step jumping from the review page).
- **Contextual help** next to each field: a tiny "?" button that expands a one-sentence explanation ("Height between landings is the vertical distance from one landing surface to the next").

### Variants

- **V2a — Pure linear wizard**. The default above. No shortcuts, no jumping around.
- **V2b — Wizard with step jumping**. User can click any completed step in the progress bar to jump there. Reduces click count for experienced users.
- **V2c — Grouped wizard**. Instead of one question per screen, each step has 3–5 related inputs (like Step 2 above). Faster. Still keeps the linear structure.
- **V2d — Branching wizard**. Later steps adapt to earlier answers. If the user picks "HSS stringers" in the material step, the "HSS size" step appears; otherwise it's skipped. More sophisticated, harder to design.
- **V2e — Inline-in-page wizard** instead of a modal. The wizard lives in the main pane of the project workspace, with the project summary still visible around it. Less "page takeover", more contextual.

### Pros

- **Lowest cognitive load.** You're never staring at a 25-field form wondering what matters.
- **Excellent for novices.** A first-time user can add an assembly without ever reading a tooltip, as long as the labels are clear.
- **Hard to leave fields blank.** The linear structure enforces completeness.
- **Natural place for contextual help.** One question per screen means there's always room for a sentence of explanation.
- **Great for onboarding** and customer demos — the linear flow is easy to narrate.

### Cons

- **Slow for power users.** A wizard adds clicks and loses keyboard momentum. Experienced estimators will get frustrated by Step 4 of their eighth stair.
- **Editing is cumbersome.** "I just want to change the stringer size on Stair 1" shouldn't require walking through a wizard; a form-based approach (option 1) handles this in two clicks.
- **Scales badly to complex PAs.** Ships Ladder has 24 variables. A 24-step wizard is torture. Grouping helps but still ends up with 6–8 screens per assembly.
- **Doesn't scale to 50+ assembly types.** Each new type needs a wizard definition (which steps, which questions, which order). High authoring overhead on our side.

### Implementation cost

**Low to medium.** The wizard shell is straightforward but the step definitions are data that has to be maintained per assembly type. Estimate: 3 weeks for Phase 1 covering the main assembly types, plus an ongoing maintenance cost as new types are added.

### Best for

- First-time users, novice estimators, users demoing the tool to decision-makers
- Companies where onboarding new estimators is a recurring cost
- As a sub-mode within another option — e.g. a "guide me through this" button in Option 1's form view that temporarily switches to a wizard

**I don't recommend this as the primary UI** for Phase 1. The power-user experience is too slow, and estimators are power users. A wizard is a good fallback for complex or unfamiliar assemblies, not a primary workflow.

---

## 6. Option 3 — The Visual Configurator

### The idea

A preferred direction from the meeting. Main pane shows an illustration of the assembly — a stair tower drawing, a rail with posts and pickets, a ladder silhouette — with input fields positioned directly on the graphic. Click a dimension callout, type a number, watch the drawing update. Like the Tekla Structures rebar staircase configurator image we looked at. Visual, immediate, impressive.

### Layout wireframe

```
┌──────────────────────────────────────────────────────────────┐
│ TakeoffAI   ▸ Stair 1                                   [⚙]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Width:  [ 4' 0" ]                                          │
│                                                              │
│                                           ╱│                 │
│                                          ╱ │ Height:         │
│                                         ╱  │ [ 10' 0" ]      │
│                           ──────────── ╱   │                 │
│                          │        │   ╱    │                 │
│                          │  ████  │  ╱     │                 │
│                          │  ████  │ ╱      │                 │
│                          │  ████  │╱       │                 │
│                          │  ████  │        │                 │
│                          │────────│        │                 │
│                                                              │
│   Treads: [ 12 ]                                             │
│                                                              │
│   Stringer material  [ C12x20.7 ▾ ]                          │
│   Tread material     [ Pan     ▾ ]                          │
│                                                              │
│                                                              │
│                    [  Save  ]  [  Item list ▸  ]             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

(Imagine the middle area being a proper SVG stair diagram with the input boxes overlaid near the relevant dimensions.)

### User journey

1. From the project workspace, user clicks "Add Stair"
2. A new page opens with the stair illustration centered. A "Width" input box sits at the top edge near a horizontal arrow showing the stair width; a "Height" box sits at the right edge near the vertical arrow; a "Treads" box sits near the top of the stringer; material dropdowns live in a small panel below the illustration.
3. User types 4' 0" for width. The illustration redraws — the stair gets visibly wider. Feels like manipulating the real object.
4. User types 10' 0" for height. The illustration redraws — stringer angle shifts, tread count visually increases.
5. User picks C12x20.7 from the stringer dropdown. The stringer in the illustration switches color or thickness to reflect the chosen shape.
6. Clicks "Item list" to expand a panel showing the generated rows, or clicks Save to finish.

### Key interactions

- **The illustration is not decoration — it's the primary editing surface.** Clicking a part of the drawing opens its detail form. Hovering shows a tooltip naming the component.
- **Inputs are positioned near their meaning.** Width input near the width arrow. Height input near the height arrow. Stringer material near the stringer in the drawing. This is what makes it feel different from a regular form — the spatial relationship does half the labeling work.
- **Live redraw on change.** When the estimator changes a dimension, the illustration visually updates. Not to exact scale necessarily — proportions are good enough. This provides strong feedback.
- **Component highlighting.** Hover "C12x20.7 stringer" in the item list and the corresponding part of the drawing highlights. Lets the user sanity-check what goes where.
- **A "show dimensions" / "hide dimensions" toggle** cleans up the drawing for review vs. edit mode.

### Variants

- **V3a — Full hand-drawn SVG per assembly type.** Each of the 10+ common assembly types (Stair, Landing, Rail, Ladder, Column, Lintel, …) gets its own custom illustration. Looks beautiful, expensive to produce.
- **V3b — Shared generic diagram** with dimension annotations. One template ("here's a box; you label its dimensions") that's reused across assembly types. Ugly but cheap.
- **V3c — Illustration + compact form side-by-side**. Drawing on the left (big), a small vertical form on the right with every field. User can interact with either; the form is the fallback when the drawing is unclear.
- **V3d — Dynamic illustration that redraws proportionally.** Not just shape/color changes — actual dimensional redraw. Expensive to implement accurately; cheap to fake (render a small set of keyframes and interpolate).
- **V3e — Static illustration** that never changes. Inputs are positioned over it but the drawing itself is fixed. Much cheaper but less satisfying.

### Pros

- **Highest wow-factor.** Screenshots look amazing. Demo conversions improve dramatically.
- **Most intuitive for visual learners.** Estimators who think spatially about steel will feel at home.
- **Natural check against mistakes.** "The stringer should slope down and to the right; the illustration shows it sloping the wrong way — I must have swapped height and run." Catches input errors the form approach doesn't.
- **Great for customer demos and marketing.** Far more compelling than a form in a sales deck.
- **Engages users who'd bounce off a spreadsheet-feeling tool.**

### Cons

- **Very expensive to build.** Custom illustrations per assembly type, per variant. Assuming a starter set of 8 types, that's 8 sets of SVGs + layout + dynamic-redraw logic. Easily 2–3 months of work just for the visual side.
- **Doesn't scale to 50+ assembly types** without massive ongoing illustration cost. A reference library has 49 PAs; even subset the typical ones to 15, that's still 15 illustrations.
- **Hard to iterate.** Changing an illustration takes more effort than changing a form field. Every user-requested tweak is a design ticket.
- **Poor for unusual or custom assemblies.** What if a user wants a stair with an intermediate landing? The static illustration won't accommodate it. We'd fall back to a form anyway.
- **Small-screen problem.** Doesn't work on mobile or narrow windows. The illustration needs space.
- **Doesn't actually speed up data entry.** The fields are still fields; they just live on a drawing instead of in a grid. A skilled typist is slower in this mode than in option 1.

### Implementation cost

**Very high.** Custom SVGs per assembly type, layout engine for positioning inputs, redraw logic, hover/highlight linking between illustration and item list. Estimate: 6–10 weeks for a high-quality Phase 1 covering ~6 assembly types. Heavy ongoing maintenance.

### Best for

- Customer demos and marketing screenshots
- First-time users who are visual thinkers
- A premium mode layered on top of a simpler base — "upgrade to Visual Edit" button

**Don't build this first.** The cost is too high relative to the feedback we'd get from prototypes. Build option 1 (fast, cheap) first to validate the data model and workflow, then layer option 3 on top if it still looks worth it.

---

## 7. Option 4 — The Conversational AI-First

### The idea

Main pane is a chat. The estimator types or speaks a description of the assembly in natural language: "I have a 3-flight stair, 10 treads each, 4 foot wide, C12x20.7 channel stringers, pan treads". An agent parses the description and fills a structured form on the right side. Missing fields trigger follow-up questions: "Which finish?" "How tall is each flight?". The user reviews the filled form and commits. Matches how people already use ChatGPT and Gemini.

### Layout wireframe

```
┌──────────────────────────────────────────────────────────────┐
│ TakeoffAI   ▸ North Lakes Warehouse — Stair 1           [⚙]  │
├──────────────────────────────────┬───────────────────────────┤
│  AI Assistant                    │  Generated assembly       │
│                                  │                           │
│  You: I have a 3-flight stair,   │  Type: Stair              │
│  10 treads each, 4 foot wide,    │  Label: Stair 1           │
│  C12x20.7 channel stringers,     │                           │
│  pan treads                      │  Height Between Landings: │
│                                  │    10' 0"   (inferred)   │
│  AI: Got it. I've filled in      │                           │
│  the first flight. A few         │  Stair Width:             │
│  questions:                      │    4' 0"    (from chat)  │
│                                  │                           │
│   1. Is the 10' height between   │  Number of Treads:        │
│      landings total, or per      │    10       (from chat)  │
│      flight?                     │                           │
│                                  │  Stringer Material:       │
│   2. Painted or galvanized?      │    C        (from chat)  │
│                                  │                           │
│  You: per flight, painted        │  Stringer Size:           │
│                                  │    C12X20.7 (from chat)  │
│  AI: Done. I've created 3        │                           │
│  separate stair assemblies,      │  Tread Material:          │
│  one per flight. Review on       │    Pan      (from chat)  │
│  the right and let me know if    │                           │
│  anything is wrong.              │  Finish: Painted          │
│                                  │                           │
│                                  │   [ Edit ] [ Commit ]     │
│  [ Type a message... ]           │                           │
│                                  │                           │
└──────────────────────────────────┴───────────────────────────┘
```

### User journey

1. User clicks "Add Assembly" in the project workspace. An assistant chat opens in the main area.
2. User types or speaks: "I have a 3-flight stair, 10 treads each, 4 foot wide, C12x20.7 channel stringers, pan treads"
3. AI parses the description. The right panel starts filling in fields, with each field marked with a provenance tag ("from chat", "inferred", "default").
4. AI identifies missing required fields and asks about them in a conversational way: "Is that 10' total or per flight? Painted or galvanized?"
5. User replies in natural language. AI updates the form.
6. When the AI has enough info, it generates the assembly(ies) and shows them on the right for review. Each field is editable inline — the user can click and change any value without going back through the chat.
7. User clicks Commit, and the assembly (or multiple assemblies, in the 3-flight example) are saved to the project.

### Key interactions

- **Provenance tags on every field** — ("from chat", "inferred", "default", "manual edit") so the user knows where each value came from and can trust or distrust it accordingly.
- **Voice input** is a first-class feature, not an afterthought. A microphone button in the chat input. Transcription happens locally or via an API.
- **The chat remembers context** — user can say "same as Stair 1 but 12 treads" and the AI fills in from the previous stair's values.
- **Fallback to form edit** — every AI-filled field can be manually overridden by clicking. The user is never forced to use chat to make a correction.
- **Multi-assembly creation in one turn** — "3 stairs" becomes 3 assemblies, each reviewable independently. The AI decides when one prompt means multiple assemblies vs. one parameterized assembly.
- **Undo last AI action** — a single "revert" button in case the AI does something surprising.

### Variants

- **V4a — Chat is the only way to add assemblies.** Pure conversational, no alternative entry path. Highest AI dependency. Fails badly if the AI is down or gives bad answers.
- **V4b — Chat is the default but a "manual entry" button is always visible.** User can switch to a form-based flow at any time. Recommended — gives users a safety net.
- **V4c — Chat assists a form instead of filling it.** The main pane is still a form (like option 1), but a chat panel on the side lets the user say things like "change the stringer size to HSS". The AI edits the form on the user's behalf. Less ambitious, more reliable.
- **V4d — Voice-first.** Mic button is the primary input; typing is the fallback. Good for hands-busy users looking at drawings.
- **V4e — Chat with suggested prompts.** Below the input, the AI shows 3–4 suggested things the user might want to say next ("Change the finish to galvanized", "Duplicate for the south tower", "Add a landing"). Reduces blank-canvas paralysis.

### Pros

- **Matches how people already use AI tools.** Familiar from ChatGPT, Gemini, Copilot.
- **Scales to any assembly type** without custom UI — no wizard definitions, no custom illustrations. The same chat works for stairs, rails, ladders, columns, lintels, anything.
- **Natural Phase 2 integration.** The AI is the interface, so improving the AI directly improves the product.
- **Low friction for "I'm looking at a drawing and describing what I see".** Exactly the workflow estimators want.
- **Speaks to users who dislike forms.** Some estimators will feel faster typing descriptions than filling grids.
- **Natural support for bulk operations.** "Add 3 stairs, all identical except flight count" is one sentence instead of three copy-paste operations.

### Cons

- **Quality is bottlenecked by the AI.** A bad prompt parse frustrates the user. Early versions will be frustrating.
- **Slow for known-exact inputs.** "I know I want a C12x20.7 stringer" — typing it into a form is faster than typing it into a chat. Power users will hate this for their thousandth stair.
- **Hard to handle precise edits.** "Change the third tread's length to 3' 11"" is awkward in natural language. Forms handle this trivially.
- **Voice transcription quality** is not perfect, and steel fab terminology (C12X20.7, HSS, MC) is especially error-prone.
- **Fragile on vague inputs.** "A stair like the last one but bigger" — what does "bigger" mean? The AI has to ask, and the ask is another round-trip.
- **Privacy / data concerns.** Every user input goes to an AI provider. Some customers will need on-prem AI or strict no-data-retention guarantees.
- **Cost per assembly.** AI inference is not free. At scale, this is a per-assembly cost that a form-based option doesn't have.

### Implementation cost

**Medium to high.** The chat UI itself is straightforward. The hard parts are the prompt engineering, the provenance tracking, the multi-turn context management, and the fallback-to-form integration. Estimate: 4–6 weeks for a Phase 1 that feels like a proper assistant (as opposed to a gimmicky chatbot).

### Best for

- The original product vision — AI as the primary interface
- Users who dislike forms
- Voice-first and accessibility scenarios
- The long-game differentiator. As AI quality improves, this option gets better automatically. A form does not.

**I'd prototype this as a Phase 2 add-on to option 1 or option 6** — not as the primary authoring mode in Phase 1. The AI quality isn't high enough yet to carry the whole experience on its own, and the form fallback has to exist regardless. Build the form first, layer the chat on top, evolve.

---

## 8. Option 5 — The Drawing Split

### The idea

Upload a drawing PDF. It renders on the left half of the screen. The right half is the assembly form. As the estimator looks at the drawing, they fill in the form; they can click a dimension callout on the drawing to capture it directly into the currently focused field. An annotation layer lets them mark components as "counted" so they don't lose their place. The estimator never looks away from the drawing. Matches the real-world workflow: drawing on one screen, tool on the other — except both are in the same window.

### Layout wireframe

```
┌──────────────────────────────────────────────────────────────┐
│ TakeoffAI  ▸ North Lakes Warehouse — Stair 1            [⚙]  │
├──────────────────────────────┬───────────────────────────────┤
│  A-301 Stair Tower Sheet     │  Stair 1                      │
│  ┌────────────────────────┐  │  ─────────────                │
│  │    ↕ 10'0"             │  │                               │
│  │    │                   │  │  Height Between Landings      │
│  │    │   ╱│              │  │  ┌─────────────┐              │
│  │    │  ╱ │              │  │  │  10' 0"   ✓ │              │
│  │    │ ╱  │              │  │  └─────────────┘              │
│  │    │╱──────── 4' 0"    │  │                               │
│  │                        │  │  Stair Width                  │
│  └────────────────────────┘  │  ┌─────────────┐              │
│                              │  │  4' 0"    ✓ │              │
│  ◈ Mark as counted           │  └─────────────┘              │
│  ◯ Annotation tool           │                               │
│  ◉ Zoom                      │  Number of Treads             │
│                              │  ┌─────────────┐              │
│  Page 1 of 248   ◀ ▶         │  │  12         │              │
│                              │  └─────────────┘              │
│                              │                               │
│                              │  Stringer Material            │
│                              │  [ C  ▾ ]                     │
│                              │                               │
│                              │                               │
│                              │  [  Save & Next  ]            │
└──────────────────────────────┴───────────────────────────────┘
```

### User journey

1. User creates the project, then immediately uploads a drawing PDF. This is required, not optional, for this option.
2. PDF opens on the left. Right side shows a placeholder "Pick an assembly type to start filling in".
3. User clicks "Add Stair". An empty stair form appears on the right; the left shows the drawing at page 1.
4. User pages to the stair sheet (A-301 or wherever). Zooms in on a stair callout.
5. User sees "10'0"" annotated on the drawing. Clicks into the "Height" field on the right. Clicks the "10'0"" text in the drawing. **The field captures the dimension automatically.** (Implementation: we parse text from the PDF and match against the click location.)
6. Does the same for width. Types the tread count manually (no callout on the drawing for that — they counted it visually).
7. Clicks "Save & Next". The stair is saved; a fresh form appears; the drawing view resets or stays on the current page.
8. User clicks the "Mark as counted" tool and clicks on the stair in the drawing to leave a checkmark. Now they know they've handled that stair.
9. Repeat for the next stair on the next sheet.

### Key interactions

- **Click-to-capture** is the key differentiator. Clicking a dimension text on the drawing inserts it into the currently focused form field. No retyping.
- **Annotation layer** over the drawing. User can leave colored checkmarks, circles, or notes. Persists as an overlay on the PDF so next session they pick up where they left off.
- **Page navigation** via thumbnails, page number input, or text-search ("jump to A-301").
- **PDF text extraction at load time** so the click-to-capture can work without OCR. (Most construction drawings have vector text; if they're raster scans we'd need an OCR fallback.)
- **Sync scrolling** is not the right model — drawings don't scroll with forms. Instead, the drawing pane is independent and the user moves it manually.
- **Mini-map** for navigating large drawings. Shows the full sheet with a viewport indicator.

### Variants

- **V5a — Required drawing upload.** User can't even start adding assemblies without a drawing. Enforces the workflow.
- **V5b — Optional drawing upload.** If no drawing, the right pane fills the whole window and it degrades gracefully to option 1. Best of both worlds.
- **V5c — Without click-to-capture.** The drawing is purely visual reference; all form inputs are manual. Much cheaper to build but loses the main differentiator.
- **V5d — With the AI chat from option 4 as a third panel.** Drawing left, form middle, chat right. Three-column. Requires a wide monitor but combines the three strongest differentiators.
- **V5e — Drawing on top, form on bottom** (horizontal split instead of vertical). Better for portrait monitors; worse for wide.
- **V5f — Multiple drawing views** — tabs for different sheets, user can keep A-301 and A-302 open and switch between them.

### Pros

- **Matches the estimator's real workflow.** Drawing + tool in one view. No more alt-tabbing between two applications.
- **Click-to-capture is genuinely faster** than retyping dimensions — and eliminates a common source of transcription errors.
- **Annotation layer adds tangible value** even outside the assembly form. "Did I count this one?" is the biggest source of errors in takeoff, and marked checkmarks solve it.
- **Naturally sets up Phase 2 AI.** The drawing is already loaded; a vision agent can read it directly. No additional user step needed.
- **The drawing is always there as a reference** so the user never has to context-switch to double-check something.
- **Great user story.** "Upload your drawings and we'll work from them" is a compelling pitch.

### Cons

- **High implementation cost.** PDF rendering, text extraction, click-to-capture parsing, annotation persistence, page navigation, zoom, search — each is a medium task, together they're a major investment.
- **Hard on small screens.** Two panels need real estate. Mobile is out of the question. Laptops under 14" start to feel cramped.
- **Fails if the drawing is a raster scan** (older projects, some contractors). Needs OCR fallback, which is a rabbit hole.
- **Useless without a drawing.** For a rough-estimating-before-drawings-exist scenario, this option forces a workflow that doesn't apply.
- **Doesn't help users who already have the drawing on a second monitor** — which is reportedly most of them.
- **Per-drawing vs. per-assembly scope confusion.** Does the drawing upload belong to the project or to a specific assembly? Either answer has tradeoffs.

### Implementation cost

**High.** PDF rendering (pdf.js is fine but tuning it is real work), click-to-capture against text positions, annotation persistence, page management, search. Estimate: 6–8 weeks for a polished Phase 1.

### Best for

- The "upload drawings and work from them" use case (most existing estimating tools work this way — Steel Genie, Bluebeam, ClearEstimates)
- Users who don't have a second monitor
- Users who'd benefit from the AI taking over the drawing interpretation later
- Companies that get paid takeoffs from drawings as their primary workflow (vs. rough estimates from a verbal brief)

**I like this option a lot for Phase 2.** As a Phase 1 starter it's expensive; but if we're committing to AI drawing interpretation as the killer feature long-term, this is the shell that integration lives inside. Think of it as "Phase 1 = option 1 or 6, Phase 2 = add the drawing split, Phase 3 = make the AI read the drawing".

---

## 9. Option 6 — The Workbench (VS Code-inspired)

### Resolved design decisions (as of 2026-04-14)

The following choices have been locked in through discussion. The variants section below still lists alternatives for reference, but these are the intended defaults:

- **Layout: V6a — tree on the LEFT, chat on the RIGHT, center in the middle.** Standard VS Code layout.
- **Center pane: V6e — single-document, not tabs.** Clicking a new assembly in the tree replaces the current view in the center. Multiple-open is not part of the real estimator workflow so we skip the complexity.
- **AI chat panel: V6c-equivalent — present from Phase 1 as a command-dispatching panel.** Phase 1 typing in the chat panel runs the same commands available in the command palette (e.g. "add stair", "duplicate Stair 1", "export csv"). Phase 2 upgrades it to actual AI understanding. No layout change between phases.
- **Return to welcome screen:** two affordances — clicking the project name in the top breadcrumb deselects the current assembly and shows the welcome view, AND a pinned "Welcome" entry at the very top of the left tree provides an always-visible fallback.
- **Status bar at the bottom.** Left to right: project summary (`🗂 5 assemblies · 2 complete · 3 in progress`) · validation state (`⚠ 1 validation error` when present) · save state (`✓ saved · 10s ago` / `Saving…` / `⚠ save failed`) · command-palette hint (`⌨ Ctrl+K for commands`).
- **Breadcrumbs at the top** showing "Project Name ▸ Assembly Name". Clicking any breadcrumb jumps up.
- **Global command palette** opens with **Ctrl+K** (not VS Code's Ctrl+Shift+P — Ctrl+K matches Linear/Figma/Raycast/Notion conventions and is more ergonomic). Same command surface as the welcome screen's embedded command input. Available from any screen.
- **Themes:** dark and light both supported. **Default is dark** (matches Steel Genie aesthetic and is easier in shop lighting). User-togglable — a dedicated toggle button in the status bar plus a "Toggle theme" command in the palette.
- **Center pane layout when an assembly is open:** vertical split. Top: a title bar with the inline-editable assembly name and a `⋯` actions menu (Duplicate / Delete / Move to group / Export just this assembly). Middle: Variables section, one variable per row, label left / input right. Bottom: live Items preview, always visible, updates on every keystroke (no manual Calculate button). No explicit save button — autosave, with status shown in the bottom status bar. Vertical (not horizontal) split because the tree and chat panels make the center narrower than in a single-pane layout.
- **Left tree organization:** all common assembly type groups are always visible even when empty (Stairs, Landings, Rails, Ladders, Columns, Lintels, …) so users discover what's available. Each group is collapsible, shows its count `(N)` in the header, and has its own `+ Add X` button at the bottom for one-click creation. A pinned "Welcome / Home" group at the very top is always visible as the return-to-welcome affordance. Each assembly entry shows a status dot (● complete · ◦ in progress · ⚠ validation error). A search field at the top of the tree filters by assembly name. Default grouping is by type; a settings toggle could later offer a flat list for users who prefer that (not Phase 1 critical).
- **Command palette (Ctrl+K) command set** — Phase 1 starter list of ~15 commands covering Navigation (Go to Welcome, Go to [assembly name], Go to project settings), Creation (Add Stair / Landing / Rail / Ladder / Column / Lintel — immediately creates with auto-name `Stair N` and opens the form, no name prompt), Modification (Rename / Duplicate / Delete / Move to group), Actions (Export CSV, Toggle theme, Show keyboard shortcuts, Import from PowerFab [future]). Raw text input is treated as fuzzy search across assembly names so typing "stair 3" jumps directly. Undo / Redo / Save are keyboard shortcuts, not palette commands. The command set is expected to grow as features are added.

### The idea

A proposed direction. An IDE-style three-panel shell: a blank welcome surface in the center (with a command palette and quick-action links, à la VS Code's welcome tab), a tree or menu of assemblies on the side, and an AI chat panel also accessible as a panel. When you click an assembly in the tree, it opens in the center — possibly as a tab. Adding a new assembly can be done via the command palette ("Add Stair"), via a tree-level "+" button, or via the chat. The chrome stays stable; the center changes based on what you have open.

This option **combines** the navigational clarity of option 1 (tree), the AI affordance of option 4 (chat panel), and the "type what you want" flavor of option 2 (command palette is wizard-like in how it guides you) — inside a mental model every developer already knows.

### Layout wireframe

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TakeoffAI  ▸ North Lakes Warehouse                                 [⚙]   │
├───────────────────┬──────────────────────────────────────┬───────────────┤
│ ASSEMBLIES        │                                      │ AI Assistant  │
│                   │                                      │               │
│ ⌕ Search...       │                                      │ Hi. Tell me   │
│                   │     Type a command or click below    │ what you want │
│ ▾ STAIRS          │     ┌──────────────────────────┐     │ to add.       │
│   ─ Stair 1       │     │ > Add stair              │     │               │
│   ─ Stair 2       │     └──────────────────────────┘     │ You can       │
│   + Add stair     │                                      │ describe it   │
│                   │                                      │ in plain      │
│ ▾ LANDINGS        │                                      │ English.      │
│   ─ Landing 1     │     Quick actions                    │               │
│   + Add landing   │                                      │ ─────────     │
│                   │      ⊞ New stair                     │               │
│ ▾ RAILS           │      ⊞ New landing                   │ [Type here…]  │
│   + Add rail      │      ⊞ New rail                      │               │
│                   │      ⊞ New ladder                    │               │
│ ▾ LADDERS         │      ⊞ Import from PowerFab          │               │
│   + Add ladder    │      ⊞ Export CSV                    │               │
│                   │                                      │               │
│                   │                                      │               │
│                   │     Recent                           │               │
│                   │      ◦ Stair 1 (edited 2 min ago)    │               │
│                   │      ◦ Landing 1 (edited 5 min ago)  │               │
│                   │                                      │               │
│                   │                                      │               │
├───────────────────┴──────────────────────────────────────┴───────────────┤
│ Project: 5 assemblies · 2 complete · 3 in progress              saved ✓  │
└──────────────────────────────────────────────────────────────────────────┘
```

When the user clicks `Stair 1` in the tree, the center changes:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TakeoffAI  ▸ North Lakes Warehouse                                 [⚙]   │
├───────────────────┬──────────────────────────────────────┬───────────────┤
│ ASSEMBLIES        │  Stair 1 ×   Stair 2 ×   Landing 1 × │ AI Assistant  │
│                   │  ─────────────────────────────────   │               │
│ ⌕ Search...       │                                      │ You: change   │
│                   │  Stair 1                             │ the stringer  │
│ ▾ STAIRS          │  ─ Label: Stair 1                    │ to HSS        │
│   ● Stair 1       │                                      │               │
│   ─ Stair 2       │  Variables                           │ AI: Done.     │
│   + Add stair     │  ┌─────────────────────────────┐     │ I've updated  │
│                   │  │ Stair Width   [ 4' 0"   ]   │     │ the shape to  │
│ ▾ LANDINGS        │  │ Height        [ 10' 0"  ]   │     │ HSS and set   │
│   ─ Landing 1     │  │ Treads        [   12    ]   │     │ the size to   │
│   + Add landing   │  │ Stringer      [ C12X.. ▾]   │     │ HSS8X8X1/2.   │
│                   │  │ Tread type    [ Pan    ▾]   │     │               │
│ ▾ RAILS           │  └─────────────────────────────┘     │ [Type here…]  │
│   + Add rail      │                                      │               │
│                   │  Items (live preview)                │               │
│ ▾ LADDERS         │  Qty  Shape  Size       Length       │               │
│   + Add ladder    │  1    CO     —          —            │               │
│                   │  2    C      C12X20.7   19' 6"       │               │
│                   │  12   PL     1/4x24     4' 0"        │               │
│                   │  2    PL     3/8x3      4' 0"        │               │
│                   │                                      │               │
│                   │        [  Duplicate  ] [  Delete  ]  │               │
├───────────────────┴──────────────────────────────────────┴───────────────┤
│ Project: 5 assemblies · 2 complete · 3 in progress      editing · saved ✓│
└──────────────────────────────────────────────────────────────────────────┘
```

### User journey

1. User creates the project and lands on the workbench with the center showing the welcome surface — clean, minimal, with a command prompt ("Type a command or click below") and quick-action tiles ("New stair", "New landing", "Import from PowerFab", etc.). The left sidebar shows an empty assembly tree with just "+ Add" buttons under each type. The right panel shows an idle AI assistant offering to help.
2. User clicks "⊞ New stair" (or types "Add stair" in the command prompt, or types "I need a stair" in the AI chat). All three paths end up in the same place: a new Stair opens as a tab in the center.
3. User fills in the form (same form as option 1). Live preview updates as they type. The sidebar tree now shows "Stair 1" with a dot indicator showing it's being edited.
4. User saves (or relies on autosave). The dot becomes a checkmark.
5. User types "add landing" in the command palette (or clicks "+ Add landing" in the sidebar). A new Landing tab opens next to the Stair tab. Both assemblies are now editable — the user can switch between them by clicking tabs.
6. User opens the AI chat and says "duplicate Stair 1 three times for the south tower". The AI creates Stair 2, Stair 3, Stair 4, each a clone. The tree updates; new tabs don't open automatically (that would be noisy), but a subtle notification lets the user know three assemblies were added.
7. User clicks Stair 2 in the tree to review the clone. The tab opens. User makes tweaks.
8. User presses Ctrl+Shift+P (or clicks the command prompt in the empty welcome tab, which is always accessible via a keyboard shortcut). Types "export csv". The command runs and a CSV downloads.

### Key interactions

- **Command palette is a first-class citizen.** Accessible via Ctrl+Shift+P from anywhere. Type "add stair", "export csv", "rename Stair 1", "duplicate Stair 1", "delete Landing 1", etc. The command list is extensible — anything the UI can do can also be a command.
- **Welcome tab as the blank state.** When no assembly is open, the center shows the welcome surface with quick actions and the command prompt. This is the VS Code reference — when you open an empty VS Code window, you see the welcome tab.
- **Tabs in the center.** Multiple assemblies can be open simultaneously. User can drag a tab to split the center pane for side-by-side editing. Closes with the × on the tab, or with Ctrl+W.
- **Tree in the sidebar** is the canonical navigation. Grouped by assembly type by default (with an option to group by free-text `group` field or switch to flat list). Each entry has a status dot.
- **AI chat is always available** as the right panel. User can show/hide it with a keyboard shortcut or panel toggle. When shown, it's contextual — the chat knows which assembly is focused and can answer questions about it.
- **Status bar at the bottom** shows project-level info: total assembly count, complete/in-progress, save status, validation errors. Clicking the status bar focus-jumps to relevant places.
- **Keyboard-driven.** Every action has a shortcut. Power users rarely touch the mouse.
- **Breadcrumb navigation** at the top: "TakeoffAI ▸ North Lakes Warehouse ▸ Stair 1". Clicking any breadcrumb jumps up.

### Variants

- **V6a — Tree on the LEFT, chat on the RIGHT** (VS Code standard layout). The wireframe above. Familiar to any developer, and to anyone who's used VS Code even once.
- **V6b — Tree on the RIGHT, chat on the RIGHT** (as originally described — the user said "right" twice). Both panels share the right side, either as a vertical split or as tabs between them. This is less conventional but the user may have had a specific reason. Worth including as an explicit variant.
- **V6c — Without the AI chat panel.** Just the tree + welcome + tabs, no AI. Cleanest and most focused. Good for Phase 1 before AI integration is ready.
- **V6d — Without the command palette.** Just tree + tabs, no palette. Simpler but loses the "type what you want" flavor that makes the VS Code model feel powerful. Not recommended.
- **V6e — Single-pane center** instead of tabs. Clicking a new assembly replaces the current one. Simpler state management; loses the multi-edit capability.
- **V6f — Welcome tab stays always available as a special tab**. Even after opening Stair 1, the welcome tab is still there as a separate tab you can return to. Mirrors VS Code behavior.
- **V6g — With the drawing split from option 5 bolted on.** A "Drawings" panel in the left sidebar shows uploaded PDFs. Double-clicking one opens it as a tab alongside the assembly tabs. Lets drawings live in the same workbench as the forms, without making drawings mandatory.
- **V6h — Grouped vs. tree-structured sidebar.** The default is grouped by type (Stairs, Landings, Rails). A tree-structured variant adds explicit hierarchy ("Stair Tower A" nodes with children). Can be toggled per user preference.

### Pros

- **Familiar to anyone who's used VS Code, JetBrains, Xcode, Atom, or similar.** Huge for developer-adjacent estimators; still manageable for non-developers because the core interactions (click a thing in the sidebar, see it in the middle) are intuitive.
- **Combines the best of several options.** Tree navigation (option 1) + AI chat (option 4) + command palette (wizard-like guided entry without the rigidity). Nothing is forced; everything is available.
- **Multi-edit via tabs.** Open Stair 1 and Stair 2 side-by-side for comparison. Opening multiple assemblies is a natural affordance instead of a special mode.
- **Scales well with project complexity.** Ten-assembly project: no problem. 100-assembly project: tree organizes it, search finds things fast, multiple tabs handle parallel edits.
- **Command palette makes everything discoverable.** Users don't have to remember where a command lives; they can type what they want and find it.
- **The AI chat is always there** without being in the way. Phase 2 AI integration doesn't require a UI redesign — the panel already exists, we just make it more useful.
- **The welcome tab is a natural home for onboarding**, templates, recently-opened projects, and quick-start guides — all the things a first-time user needs without cluttering the main workspace.
- **Familiar blank-canvas feeling for new users.** Opening VS Code for the first time and seeing a clean welcome tab isn't intimidating — it's inviting. We get the same effect.
- **Power-user shortcuts are a natural part of the model.** Keyboard-driven users can live entirely in the command palette + keyboard shortcuts.

### Cons

- **Higher implementation cost than option 1.** Three panels, tabs, command palette, tree, state management across multiple open documents. Not huge, but more than a single form pane.
- **More concepts to learn.** A new estimator has to grok "this is the tree, this is the command palette, these are tabs, this is chat" before they can be effective. Option 1 (pure form) has fewer concepts.
- **Risks over-engineering Phase 1.** If we ship the workbench with only two assembly types, users will wonder why the shell is so elaborate for so little content.
- **Command palette only shines** with a meaningful set of commands. Early in development, the palette's usefulness is limited.
- **Developer-aesthetic might feel wrong** to some estimator audiences. Not everyone wants their estimating tool to look like an IDE.

### Implementation cost

**Medium.** The workbench shell is real work (tabs, tree, command palette, keyboard shortcuts, panel resize) but nothing exotic. Lots of good open-source prior art (`react-arborist` for trees, `cmdk` for command palette, `react-mosaic` or `react-resizable-panels` for splits, `@tanstack/react-router` for tab state). Estimate: 4–6 weeks for a Phase 1 that feels polished and covers the main flows. The assembly form itself is lifted from option 1 — we're building the shell around option 1's core, not replacing it.

### Best for

- **This is probably the strongest Phase 1 candidate if we're willing to invest a little more than option 1 costs.** It gives us a product that feels modern and powerful from day one, leaves room for Phase 2 AI integration without a redesign, and matches a mental model (IDE shell) that's increasingly mainstream across productivity tools (Notion, Linear, Figma all use variations of this pattern).
- **Anyone who's used VS Code, Figma, Linear, or Notion** will feel immediately at home.
- **Long-term product vision.** This shell grows gracefully — we can add panels (drawing viewer, PA library, admin tools, reports), commands, and chat features without rearchitecting.

---

## 10. Hybrid and combined approaches

Several of the six options are not mutually exclusive. Here are the natural combinations.

### 10.1 Workbench (6) + Form Grid (1) as the editor

The workbench is the outer shell; option 1's two-panel form is what lives inside each tab. This is actually what the option 6 wireframe shows — the "Stair 1" tab in the workbench shows an option-1-style variables-and-preview form.

**Verdict:** this is basically the default combination. Option 6 **contains** option 1. Treat them as one integrated design if you pick option 6.

### 10.2 Workbench (6) + Conversational AI (4) as a panel

The AI chat lives as the right-side panel in the workbench. Users can ignore it for form-only workflows or use it for "fill this form from my description" and "change the stringer to HSS" type commands.

**Verdict:** natural fit. The workbench's three-panel layout expects a right panel; AI chat is an obvious candidate.

### 10.3 Workbench (6) + Drawing Split (5) as an additional panel

A second sidebar panel (or a dedicated panel next to the center) shows an uploaded drawing. Drawing and form are visible simultaneously. Click-to-capture on the drawing inserts into the focused form field, as in option 5.

**Verdict:** possible but adds significant implementation cost. Probably a Phase 2 overlay rather than a Phase 1 inclusion.

### 10.4 Form Grid (1) + Wizard (2) as a mode toggle

The default is option 1's form. A "Guide me through this" button on the form switches to a temporary wizard mode for users who want the guided experience. After completing the wizard, the form view is shown with the collected values prefilled.

**Verdict:** good defensive option. Gives power users the fast path and novices the safety net, with minimal extra cost.

### 10.5 Visual Configurator (3) + Form Grid (1) side-by-side

The visual configurator is shown alongside a compact form. Both are synchronized. User interacts with whichever feels right for the current task.

**Verdict:** only worth it if we commit to option 3 anyway. Otherwise just build option 1.

### 10.6 Conversational AI (4) + Drawing Split (5) as "AI reads the drawing"

Upload a drawing, the AI reads it directly, fills in all assemblies automatically, user reviews. This is the long-term Phase 2 vision from the meeting.

**Verdict:** the dream. Not a Phase 1 option, but something every Phase 1 choice should leave room for.

---

## 11. Suggested prototype order

If we decide to prototype more than one, here's the order I'd suggest for maximum learning per hour of work:

1. **Option 1 — The Form Grid** first. It's the cheapest to build, validates the data model end-to-end, and gives us a working product we can put in front of real estimators within 2–3 weeks. Everything else can be evaluated against this baseline.

2. **Option 6 — The Workbench** second, if option 1 reveals that users want more navigation power or if we want the command palette and multi-tab editing. Option 6 contains option 1 as its inner form, so the work isn't thrown away — it's wrapped. Add 2–3 weeks on top of option 1.

3. **Option 5 — The Drawing Split** third, as a Phase 2 overlay on top of whichever we picked in step 1 or 2. This is where the Phase 2 AI vision really lives, so we want it ready when the AI is.

4. **Option 4 — The Conversational AI** fourth, layered on top of option 6 as the right-panel chat. Phase 2.

5. **Option 2 — The Wizard** only if user testing reveals first-time users struggling with option 1 or 6. It's a remedial pattern, not a primary one. Likely never needed if onboarding is good.

6. **Option 3 — The Visual Configurator** last, if ever. The cost/benefit is bad unless the visual is critical to the sales story. Revisit when we're thinking about a premium tier or a marketing-driven rebuild.

**Single-sentence recommendation:** build option 1 as the starter prototype, then extend it into option 6 once the data model is validated. That gives us the workbench experience that was proposed while keeping the Phase 1 build small and the Phase 2 expansion path natural.

But again — nothing is committed. Pick whatever you want to prototype first.

---

## 12. Open questions

Things that aren't yet resolved and will need decisions before building any of these:

1. **Does the project workspace have a drawing upload in Phase 1?** If yes, option 5 is viable as Phase 1; if no, options 1 and 6 are more natural starters.

2. **Is the AI chat planned for Phase 1 or Phase 2?** If Phase 1, options 4 and 6 get the nod. If Phase 2, option 1 is a fine start.

3. **Tree vs. flat vs. grouped** as the default sidebar organization. Current lean is flat (meeting). An experienced estimator should weigh in.

4. **Single-document or tabbed center pane?** Tabs are a fixed part of option 6's mental model; for option 1, it's a variant.

5. **Keyboard-first or mouse-first power user?** Shapes whether we invest heavily in shortcuts and a command palette.

6. **Autosave or explicit save?** Recommendation is autosave but this affects the UI in several places.

7. **How does a user go from the project summary to editing a specific assembly?** Each option handles this slightly differently and we should make sure the flow is clear.

8. **Mobile / tablet support.** Options 1 and 2 degrade gracefully. Options 3, 5, 6 don't work well on small screens. If mobile matters, it constrains our choices.

9. **Where do shared company settings live** (default labor codes, company-specific grades, default finish)? Not directly a workflow question but affects several of the option layouts.

10. **Onboarding flow for a brand-new user.** First-run experience is usually worth prototyping separately from the main authoring flow. Nothing in the options above specifies it explicitly.
