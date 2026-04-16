# UI inspiration research + recommendations

_Last updated: 2026-04-15._

A research memo of 11 external apps whose "enter parameters → see computed output" workflow maps to what we need for the estimator's `+ Add Stair` / `+ Add Landing` / `+ Add Rail` experience, followed by concrete recommendations for what to adopt in the Workbench's center pane.

**Scope of this doc:** the **center-pane form experience** only — the moment an estimator clicks `+ Add Stair`, fills in fields, and sees the material-list update. The Workbench shell (three-panel layout, left tree, right chat panel, status bar) is already locked in; see `workflow-ux-explorations.md` §9.

## Related docs

- [`workflow-ux-explorations.md`](workflow-ux-explorations.md) — where the Workbench layout was chosen (Option 6)
- [`parametric-assembly-product-direction.md`](parametric-assembly-product-direction.md) — the "PA engine, not PA authoring tool" product framing
- [`assembly-form-wireframes.md`](assembly-form-wireframes.md) — ASCII wireframes that apply the recommendations below
- [`../powerfab/parametric-assembly-authoring-guide.md`](../powerfab/parametric-assembly-authoring-guide.md) — how PAs actually work in PowerFab
- [`../powerfab/aisc-shapes-catalog.md`](../powerfab/aisc-shapes-catalog.md) — shape/size catalogs that drive dropdown options

## Table of contents

1. [Research — 11 reference apps](#1-research--11-reference-apps)
   - [Bucket A — direct competitors (steel / estimating)](#bucket-a--direct-competitors-steel--estimating)
   - [Bucket B — adjacent patterns](#bucket-b--adjacent-patterns)
2. [Top 3 picks to study deeply](#2-top-3-picks-to-study-deeply)
3. [Recommendations — what should for sure go into our UI](#3-recommendations--what-should-for-sure-go-into-our-ui)
4. [Summary table — recommendations vs. sources](#4-summary-table--recommendations-vs-sources)

---

## 1. Research — 11 reference apps

### Bucket A — direct competitors (steel / estimating)

#### 1. Tekla Structures — Stairs (S71) component dialog ⭐

- **Link:** https://support.tekla.com/doc/tekla-structures/2025/macro_s71_help
- **Screenshot search:** YouTube — `Tekla Structures S71 stair tutorial`

**What they do:** Double-click "Stairs S71" in the component catalog → a tabbed modal opens with Picture / Stair setup / Steps / Bracket / Welds tabs. The estimator enters values and Tekla rebuilds the 3D stair on commit.

**Worth stealing:**

- Tabs named after intent, not data shape (Picture / Stair setup / Steps / Bracket). Each tab is a "stage of thought," not an arbitrary field grouping.
- **The "Picture" tab is a schematic with numbered callouts (1–18) and input boxes placed next to the dimension they drive.** The single highest-signal pattern in the whole memo.
- Landing-type picker uses pictogram variants (horizontal / notched / vertical lowered) — no dropdown text soup.
- "Get" button pulls values from an existing stair in the model. Mirror as "Load from existing stair."

**Watch out for:** Unapologetically dense (25+ fields per tab). Estimators won't live in this dialog the way Tekla modelers do; don't copy the density.

---

#### 2. Tekla Structures — Custom Component Dialog Editor

- **Link:** https://support.tekla.com/doc/tekla-structures/2025/det_cc_custom_component_dialog_box_editor

**What they do:** Authoring tool where a power user builds the dialog that modelers later fill in: drag tabs, drop parameter boxes, attach `.bmp` images, insert dropdowns and "list with images" controls.

**Worth stealing:**

- **"Lists with images"** as a first-class control — a stringer-profile picker where each option shows a cross-section icon.
- Their ergonomic ceiling of ~25 fields per tab is worth respecting in our PA schema.
- Dedicated Profile / Part controls that expand into the right sub-fields (shape + size + grade in one control, not three loose dropdowns).

**Watch out for:** The authoring tool itself is clunky. Copy the rendered dialog shape, not the authoring UX.

---

#### 3. Tekla PowerFab — Parametric Assembly dialog (the one we're replacing)

- **Link:** https://support.tekla.com/doc/tekla-powerfab/2026/est_example_parametric_assembly

**What they do:** Estimating ribbon → pick an assembly (e.g. "Roof ladder without cage") → Variables modal lists every variable flat → type a value → click "Set Value" per row → click Calculate → a separate Results modal shows expanded line items.

**Worth stealing:**

- The variable → result → commit flow is already our mental model. Keep it, but collapse the three sequential modals into one live pane.
- Native variable types we should support: Integer, Decimal, Length (ft/in/fractions *and* decimal feet *and* millimeters), Dimension.
- "Property from EST Line Item" / "Property from Assembly Line Item" — variables can inherit defaults from the parent estimate. Mirror as "stair's grade defaults to project default unless overridden."

**Watch out for:** Slow, modal, list-only, zero feedback. Mostly a lesson in what NOT to do. The team calls it out for a reason.

---

#### 4. STACK Takeoff — Assembly Inputs side panel

- **Link:** https://help-preconstruction.stackct.com/docs/add-edit-or-remove-an-assembly-on-a-takeoff

**What they do:** Drop an assembly onto a drawing → an "Assembly Inputs" side panel appears with variable fields and item-group dropdowns. A **"Test Inputs"** button validates entered values before commit.

**Worth stealing:**

- **Explicit "Test Inputs" dry-run button** — estimators need a "does this even compute?" beat before trusting the preview.
- Side-panel form pinned beside the drawing, not a modal. Matches our center-pane plan.
- Variables and item-group pickers visually separated (numbers vs. catalog lookups get different treatments).

**Watch out for:** No schematic or picture — STACK's inputs are pure fields. We have an opportunity to out-Tekla STACK here.

---

#### 5. PlanSwift — Tree-expand assemblies + drag to drawing

- **Link:** https://www.planswift.com/blog/use-takeoff-assemblies/

**What they do:** Each assembly is a tree node on the left rail. Click `+` to expand inline into its parts list. Drag the whole assembly onto a drawing region and it recomputes.

**Worth stealing:**

- "Expand an assembly to see its parts" as an always-available inline action on the left tree.
- Drag-to-drawing as the commit action — a better metaphor than "Save."

**Watch out for:** PlanSwift's forms are generic property-grid style; nothing special about the input UX itself. Steal the tree/preview loop, not the form.

---

#### 6. SDS/2 — Parametric Dialog (multi-column, image + fields)

- **Link:** https://techsupport.sds2.com/sds2_2022/Topics/fun_dlg.htm

**What they do:** SDS/2's Python-authored connection dialogs render with multi-column layouts that combine entry fields and images side-by-side. Live preview of the component rebuilds as fields change.

**Worth stealing:**

- **Multi-column dialogs with image column + field column.** The SDS/2 docs literally call this out as canonical — confirms Tekla's picture-beside-fields approach isn't a one-off.
- Live preview of the configured part as the user types.

**Watch out for:** The Python authoring layer is developer-facing. Extract the layout pattern; leave the API.

---

### Bucket B — adjacent patterns

#### 7. Fusion 360 — Change Parameters dialog

- **Link:** https://help.autodesk.com/view/fusion360/ENU/?guid=SLD-MODIFY-CHANGE-PARAMETERS

**What they do:** Modify → Change Parameters opens a grid: Name, Unit, Expression, Value, Comment. Edit an expression and the 3D model rebuilds on commit.

**Worth stealing:**

- **Expression column that accepts formulas referencing other parameters** (`tread_width = total_run / num_treads`). Estimators will eventually want `handrail_length = stringer_length + 6"`.
- Per-row unit column — not a global setting. Mixed-unit forms are fine.
- Comment column as the "why did I set this" audit trail.

**Watch out for:** Pure spreadsheet. No picture, no grouping, no discovery. Good for power users reviewing; bad as a first-touch for a new stair.

---

#### 8. Onshape — Variables / Variable Studio

- **Link:** https://cad.onshape.com/help/Content/variable.htm

**What they do:** A Variable feature is dropped into a Part Studio with Name, Type (Length / Angle / Integer / Real / Text), Default, Min, Max, and Description. Variable Studios centralize all variables for a project in one place.

**Worth stealing:**

- **Min/max as first-class constraints.** Riser height has code-driven bounds (IBC / OSHA). Bake into the schema and show as field hint text (`7.0"–7.75" per IBC`).
- Variable Studio as a project-level "defaults screen" separate from the per-assembly form.

**Watch out for:** No pictures. Type discipline alone isn't enough for non-engineers.

---

#### 9. DriveWorks — Form Designer / Live Configurator ⭐

- **Link:** https://www.driveworkslive.com/

**What they do:** Custom forms for SolidWorks-driven product configurators: 20+ control types, rules that show/hide fields based on other selections, and an embedded live 3D preview of the configured part.

**Worth stealing:**

- **Inline preview pane that updates as fields change.** Even a 2D SVG schematic would destroy PowerFab's zero-feedback dialog.
- **Conditional field visibility ("rules"):** if `has_top_landing = false`, hide every top-landing field. Huge cognitive-load reduction.
- Sliders for continuous numerics with obvious ranges (tread width 36"–48").

**Watch out for:** DriveWorks forms can be over-styled and slow. Copy the rule engine and the preview pane, not the look-and-feel.

---

#### 10. Porsche Car Configurator — three-region layout, wizard stages ⭐

- **Link:** https://configurator.porsche.com/

**What they do:** Three-region layout — big visualization top-left, price/summary top-right, options below. The user moves through tabbed stages (exterior → wheels → interior → options) one at a time.

**Worth stealing:**

- **Three-region layout maps directly onto our center pane:** schematic on top, running material-list preview docked, fields below.
- **Wizard stages prevent "wall of fields" paralysis.** Stair = geometry → stringers → treads/risers → rail. Same idea as S71 tabs but with explicit progression.
- Every field change redraws the big preview immediately. The preview *is* the feedback.

**Watch out for:** Consumer configurators pad everything with marketing imagery and whitespace. Borrow the layout grammar, tighten the spacing for estimators who need density.

---

#### 11. Figma — Component Properties panel

- **Link:** https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties

**What they do:** Select a component instance → the right sidebar shows its properties: variant dropdowns, boolean toggles, text inputs, instance swaps. Change a value and the canvas re-renders instantly.

**Worth stealing:**

- Property types get distinct visual controls, not uniform inputs: booleans = toggles, variants = segmented controls, instance swaps = thumbnail pickers, text = text field. Stair form: "has landing" = toggle, "stringer size" = dropdown with profile icon, "num treads" = number stepper.
- Variant properties pinned at the top as the primary axis of variation — analog: "stair type" (straight / switchback / spiral) at the top drives everything below.
- **No apply button — changes stream live.** Removes an entire class of "did I save?" bugs.

**Watch out for:** Figma's panel is narrow (~240px). Our center pane is wider — use the extra horizontal room to put a schematic next to the fields.

---

## 2. Top 3 picks to study deeply

1. **Tekla Structures S71 dialog** — the single highest-signal reference. The "Picture tab with numbered callouts tied to input fields" is THE pattern to copy. If we steal nothing else, steal this.
2. **Porsche Car Configurator** — for how to organize the center pane: visualization, running summary, staged options. Solves "wall of fields" paralysis the moment an assembly gets non-trivial.
3. **DriveWorks Live configurators** — for live preview + rule-driven conditional visibility. This is the mechanism that turns a static form into the live feedback Nick keeps calling for, and it's battle-tested in a parametric-CAD-adjacent context.

---

## 3. Recommendations — what should for sure go into our UI

What we should build into the `+ Add Stair` / `+ Add Landing` / `+ Add Rail` experience. Every item below traces back to at least one specific source from section 1.

### Must-have patterns (highest confidence)

**1. Schematic with numbered callouts + inline fields.** When the estimator clicks `+ Add Stair`, the center pane shows a stair schematic with numbered callouts (①②③…) and input fields positioned next to (or keyed to) the dimensions they drive. The estimator's mental model **is** the drawing — meet them there instead of handing them a flat field list. _(Source: Tekla S71, SDS/2)_

**2. Live material-list preview docked at the bottom of the center pane.** The bottom third of the pane shows the exact lines that will export to the PowerFab CSV — updating on every field change. This is the product's core value proposition: the estimator sees exactly what will hit PowerFab. _(Source: DriveWorks, Figma no-apply-button)_

**3. Conditional field visibility via assembly rules.** If `has_top_landing = false`, hide every top-landing field. If stair type = "spiral," hide stringer-length fields and show diameter / pitch instead. Table stakes for assemblies with 40+ potential variables. _(Source: DriveWorks)_

**4. Variant picker pinned at the top of the form, with pictograms.** Stair type (straight / switchback / spiral / quarter-turn) rendered as clickable illustrated tiles at the top of the form, driving what fields show below. _(Source: Tekla S71 landing-type picker, Figma variant properties)_

**5. "Load from existing" action in the form header.** Lets an estimator reuse a prior assembly's values as a starting point. Huge for copy-paste-heavy workflows where 80% of stairs on a job are near-duplicates of each other. _(Source: Tekla S71 "Get" button)_

**6. No Save button — autosave + live feedback.** Changes stream live; no "did I save?" question. _(Source: Figma, modern web apps)_

**7. Min/max constraints with helper text under each field.** Each field shows its valid range when applicable (`7.0"–7.75" per IBC`, `36" min width per OSHA`). Code compliance isn't our job, but surfacing the numbers estimators already know is a win. _(Source: Onshape)_

**8. "Test Inputs" / validate button.** An explicit dry-run that confirms every formula resolves and no required variables are missing, before the estimator relies on the preview. _(Source: STACK Takeoff)_

### Strongly recommended

**9. Staged progression for complex assemblies (tabs or wizard).** Geometry → stringers → treads/risers → rail. Prevents the "wall of 40 empty fields" paralysis. Use tabs for simpler assemblies (≤3 stages), wizard for bigger ones. _(Source: Tekla S71 tabs, Porsche wizard)_

**10. Per-row unit selection for length fields.** Accept `7'6"`, `7.5'`, `90"`, `2286mm` interchangeably in the same form. Don't force a global unit. _(Source: Fusion 360)_

**11. Formula expressions allowed in advanced fields.** Power users can enter `handrail_length = stringer_length + 6"` instead of computing manually. Start simple (raw numbers only), add formulas for the estimator who asks. _(Source: Fusion 360)_

**12. Field types beyond text inputs.** Booleans = toggles. Small enums = segmented controls. Catalog items = dropdowns with icons. Continuous numerics = sliders or number steppers. _(Source: Figma component properties)_

**13. Item picker dropdowns show profile icons.** The stringer-size dropdown doesn't just say "C10X25" — it shows the C-channel cross-section icon next to it. Enormous comprehension lift for people who think visually. _(Source: Tekla custom component dialog editor, "lists with images")_

### Nice-to-have

**14. Comments / notes per variable.** Audit trail when an estimator hands a job to a detailer ("set riser height to 7.5 because client spec"). _(Source: Fusion 360)_

**15. Project-level defaults screen ("Defaults Studio").** A single place to see and edit all shared defaults across assemblies in a project. Separate from the per-assembly form. _(Source: Onshape Variable Studio)_

**16. Expand-inline on left tree to preview assembly parts.** Click the `▸` next to an assembly name in the tree to peek at its parts list without opening the full form. _(Source: PlanSwift)_

---

## 4. Summary table — recommendations vs. sources

| #   | Recommendation                                 | Primary source            | Category |
| --- | ---------------------------------------------- | ------------------------- | -------- |
| 1   | Schematic with numbered callouts + fields      | Tekla S71                 | Must     |
| 2   | Live material-list preview docked at bottom    | DriveWorks / Figma        | Must     |
| 3   | Conditional field visibility rules             | DriveWorks                | Must     |
| 4   | Variant picker pictograms at top               | Tekla S71 / Figma         | Must     |
| 5   | "Load from existing" header action             | Tekla S71 "Get"           | Must     |
| 6   | No save button — autosave + live               | Figma                     | Must     |
| 7   | Min/max constraints + helper text              | Onshape                   | Must     |
| 8   | "Test Inputs" dry-run validation               | STACK                     | Must     |
| 9   | Staged progression (tabs / wizard)             | Tekla S71 / Porsche       | Strong   |
| 10  | Per-row unit selection for length              | Fusion 360                | Strong   |
| 11  | Formula expressions in fields                  | Fusion 360                | Strong   |
| 12  | Distinct control types per field type          | Figma                     | Strong   |
| 13  | Profile icons in item-picker dropdowns         | Tekla custom editor       | Strong   |
| 14  | Per-variable comments                          | Fusion 360                | Nice     |
| 15  | Project-level defaults studio                  | Onshape Variable Studio   | Nice     |
| 16  | Left-tree inline expand preview                | PlanSwift                 | Nice     |

See [`assembly-form-wireframes.md`](assembly-form-wireframes.md) for ASCII wireframe examples that apply these recommendations.
