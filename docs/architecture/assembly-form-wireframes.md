# Assembly form wireframes

_Last updated: 2026-04-15._

ASCII wireframes for the **center-pane form experience** — the moment an estimator clicks `+ Add Stair` (or Landing, Rail, Ladder, Column) and starts entering data. These wireframes apply the recommendations in [`ui-inspiration-research.md`](ui-inspiration-research.md) §3 to concrete layouts so we can react, compare, and pick.

**Scope reminder:** the outer three-panel Workbench shell (left tree, center pane, right chat panel, status bar) is already locked in — see [`workflow-ux-explorations.md`](workflow-ux-explorations.md) §9. These wireframes only zoom into the **center pane**, which is where almost all the form-design decisions live.

## Related docs

- [`ui-inspiration-research.md`](ui-inspiration-research.md) — the 11 reference apps and 16 recommendations these wireframes apply
- [`workflow-ux-explorations.md`](workflow-ux-explorations.md) §9 — the Workbench (outer shell) definition
- [`parametric-assembly-product-direction.md`](parametric-assembly-product-direction.md) — product framing

## Table of contents

1. [How to read these wireframes](#1-how-to-read-these-wireframes)
2. [The Workbench shell in context](#2-the-workbench-shell-in-context)
3. [Stair form — five layout variations](#3-stair-form--five-layout-variations)
   - [3.1 Hybrid — schematic beside fields (recommended default)](#31-hybrid--schematic-beside-fields-recommended-default)
   - [3.2 Schematic-first with inline numbered callouts (Tekla S71-style)](#32-schematic-first-with-inline-numbered-callouts-tekla-s71-style)
   - [3.3 Tabbed — S71 style](#33-tabbed--s71-style)
   - [3.4 Wizard — staged progression (Porsche-style)](#34-wizard--staged-progression-porsche-style)
   - [3.5 Fields-only minimal (fallback)](#35-fields-only-minimal-fallback)
4. [UI component detail wireframes](#4-ui-component-detail-wireframes)
   - [4.1 Variant picker with pictograms](#41-variant-picker-with-pictograms)
   - [4.2 Conditional field visibility](#42-conditional-field-visibility)
   - [4.3 Item-picker dropdown with profile icons](#43-item-picker-dropdown-with-profile-icons)
   - [4.4 Material-list preview — expanded](#44-material-list-preview--expanded)
   - [4.5 "Load from existing" picker](#45-load-from-existing-picker)
   - [4.6 Field with min/max + unit selector + formula](#46-field-with-minmax--unit-selector--formula)
5. [Other assembly types](#5-other-assembly-types)
   - [5.1 Landing form](#51-landing-form)
   - [5.2 Rail form](#52-rail-form)
   - [5.3 Ladder form](#53-ladder-form)
6. [Comparison matrix — which layout for which assembly](#6-comparison-matrix--which-layout-for-which-assembly)

---

## 1. How to read these wireframes

- `│ ─ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼` — frame borders (a box-drawing character != a real pixel)
- `[ Button ]` — a clickable button
- `[▾]` — a dropdown
- `[ ]` / `[x]` — an unchecked / checked checkbox or toggle
- `( )` / `(•)` — radio buttons
- `①②③` — numbered callouts matching schematic labels to fields
- `▦ ▧` — a selected / unselected pictogram tile
- `◆` — a required field marker
- `⚠` — a validation warning
- `…` — "more content below, truncated for the wireframe"
- `[SCHEMATIC]` — a placeholder region where a real SVG/PNG schematic would render

Every wireframe assumes the outer Workbench shell is already on screen (left tree, right AI chat, top breadcrumbs, bottom status bar). The box you see in the wireframe is the **center pane** only, unless explicitly labeled otherwise.

---

## 2. The Workbench shell in context

One wireframe showing where everything else hangs — so the rest of the doc can zoom into the center pane without re-drawing the outer shell every time.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  2026-Northside-Tower  ▸  Stair A-101                                     [Export CSV] [? ]  │
├──────────────────┬────────────────────────────────────────────────────┬──────────────────────┤
│ ASSEMBLIES       │                                                    │ AI CHAT              │
│                  │                                                    │                      │
│ 🏠 Welcome       │                                                    │  > add a stair       │
│                  │                                                    │    like A-100 but    │
│ ▾ Stairs     (3) │                                                    │    with 10 treads    │
│   ● A-101        │                                                    │                      │
│   ○ A-102        │            ═══ CENTER PANE ═══                     │  Done. Created       │
│   ○ A-103        │         (all other wireframes in                   │  Stair A-104 with    │
│   + Add Stair    │          this doc zoom in here)                    │  10 treads, W8X31    │
│                  │                                                    │  stringers, A36.     │
│ ▸ Landings   (2) │                                                    │                      │
│ ▸ Rails      (5) │                                                    │                      │
│ ▸ Ladders    (1) │                                                    │  > _                 │
│ ▸ Columns    (0) │                                                    │                      │
│                  │                                                    │                      │
│                  │                                                    │                      │
│                  │                                                    │                      │
├──────────────────┴────────────────────────────────────────────────────┴──────────────────────┤
│ 11 assemblies · 7 complete · All valid · Autosaved 2s ago · ⌘K commands              🌙 dark │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

The rest of this doc zooms into the center pane only.

---

## 3. Stair form — five layout variations

Five ways to organize the "add a stair and enter its data" experience. The hybrid (§3.1) is the recommended default; the others are tradeoffs worth trying side-by-side.

---

### 3.1 Hybrid — schematic beside fields (recommended default)

Schematic on the left 45%, fields on the right 55%, material-list preview docked at the bottom. Variant picker pinned at the top. This is the layout that applies the most recommendations at once and should be our default.

```
┌─ CENTER PANE ───────────────────────────────────────────────────────────────────────┐
│  Stair A-101                        [ Load existing ▾ ] [ Test inputs ] [ … ]       │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│                                                                                     │
│  TYPE                                                                               │
│  [▦ Straight]  [▧ Switchback]  [▧ Spiral]  [▧ Quarter-turn]                         │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│                                                                                     │
│  ┌─── Schematic ──────────────────┐  ┌─── Fields ──────────────────────────────┐    │
│  │                                │  │                                          │    │
│  │             ① top              │  │  GEOMETRY                                │    │
│  │           ┌────────┐           │  │  ① Number of treads  ◆   [    8  ] ⓘ    │    │
│  │           │        │           │  │  ② Tread width       ◆   [  36" ] ⓘ     │    │
│  │           │  ①     │           │  │  ③ Riser height      ◆   [ 7.5" ] ⓘ     │    │
│  │           │        │           │  │      7.0"–7.75" per IBC                  │    │
│  │         ╱─┘                    │  │  ④ Overall rise           [    ]  auto  │    │
│  │       ╱─┘                      │  │                                          │    │
│  │     ╱─┘   ③ riser              │  │  STRINGERS                               │    │
│  │   ╱─┘                          │  │  ⑤ Stringer shape    ◆   [ C-Chan ▾ ]   │    │
│  │ ╱─┘                            │  │  ⑥ Stringer size     ◆   [ C10X25 ▾ ]   │    │
│  │ │                              │  │  ⑦ Grade                 [ A36    ▾ ]   │    │
│  │ │ ④ bottom                     │  │                                          │    │
│  │ └──┐                           │  │  RAIL                                    │    │
│  │    │                           │  │  ⑧ Has rail?             [x] Yes         │    │
│  │    │ ② tread                   │  │  ⑨ Rail type             [ Pipe   ▾ ]   │    │
│  │    │                           │  │  ⑩ Handrail length       [ auto  ]      │    │
│  │    └──                         │  │                                          │    │
│  │                                │  │  LANDING (top)                           │    │
│  │   ⑤ stringer along here        │  │  ⑪ Top landing?          [x] Yes         │    │
│  │                                │  │  ⑫ Top landing width     [ 48" ]         │    │
│  └────────────────────────────────┘  └──────────────────────────────────────────┘    │
│                                                                                     │
│  ═════════════════════════════════════════════════════════════════════════════════  │
│  MATERIAL LIST PREVIEW                                     12 lines · All valid ✓   │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│   Qty  Shape    Size      Length    Grade   Labor      Notes                        │
│     2  Channel  C10X25    8'-6"     A36     STR-01     Stringer L/R                 │
│     8  Plate    PL1/4X10  3'-0"     A36     TRD-02     Treads                       │
│     8  Angle    L3X3X1/4  3'-0"     A36     CLP-01     Tread clips                  │
│     1  Plate    PL1/4X48  4'-0"     A36     LND-01     Top landing                  │
│     + 8 more lines…                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Applies recommendations:** 1 (schematic + numbered callouts), 2 (docked preview), 3 (conditional visibility — notice landing fields only appear because `Top landing?` is checked), 4 (variant picker at top), 5 (Load existing), 6 (no save button), 7 (min/max helper `7.0"–7.75"`), 8 (Test inputs), 12 (mixed field types), 13 (stringer dropdown will have profile icons — see §4.3).

**When to use:** default for Stairs, Landings, Rails, Ladders. Good for any assembly where a picture helps.

---

### 3.2 Schematic-first with inline numbered callouts (Tekla S71-style)

Same callout-to-field linkage as §3.1, but the schematic is BIG (takes 60% of the pane) and the fields are arranged in a column along the right, with each field positioned vertically near its callout. This is the closest to what Tekla Structures actually does with S71 — high-signal for people who grew up on Tekla.

```
┌─ CENTER PANE ───────────────────────────────────────────────────────────────────────┐
│  Stair A-101                        [ Load existing ▾ ] [ Test inputs ] [ … ]       │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│                                                                                     │
│  TYPE   [▦ Straight]  [▧ Switchback]  [▧ Spiral]  [▧ Quarter-turn]                  │
│                                                                                     │
│  ┌────────────────────────────────────────────────┐                                 │
│  │                                                │   ① Treads    [   8 ]           │
│  │                   ┌──────┐                     │                                 │
│  │                   │      │① top                │   ② Tread W   [ 36" ]           │
│  │                   │      │                     │                                 │
│  │                 ──┘      │                     │   ③ Riser     [7.5"]            │
│  │               ──┘                               │                                │
│  │             ──┘                                 │   ④ Overall   auto              │
│  │           ──┘                                  │                                 │
│  │         ──┘  ③ riser                           │   ─── stringers ───             │
│  │       ──┘                                      │                                 │
│  │     ──┘  ⑤ stringer                            │   ⑤ Shape    [ C-Chan ▾]        │
│  │   ──┘                                          │                                 │
│  │  │                                             │   ⑥ Size     [ C10X25 ▾]        │
│  │  │  ④ bottom                                   │                                 │
│  │  └──┐                                          │   ⑦ Grade    [ A36    ▾]        │
│  │     │  ② tread                                 │                                 │
│  │     └──                                        │   ─── rail ───                  │
│  └────────────────────────────────────────────────┘                                 │
│                                                       ⑧ Has rail? [x]               │
│                                                                                     │
│  ═════════════════════════════════════════════════════════════════════════════════  │
│  MATERIAL LIST PREVIEW                                     12 lines · All valid ✓   │
│     …                                                                               │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Applies recommendations:** 1 (strongest application), 2, 3, 4, 5, 6, 7, 8, 13.

**When to use:** when we've got a really good schematic asset and the assembly has ≤15 fields. Clicking a numbered badge in the schematic scrolls/highlights the matching field on the right (and vice versa).

**Watch out for:** only works if the schematic lib can render numbered callouts dynamically. Harder to implement than §3.1.

---

### 3.3 Tabbed — S71 style

Variant picker at the top, then tabs for each stage of thought. Each tab shows a picture and the fields relevant to that tab. Material-list preview stays docked at the bottom across all tabs.

```
┌─ CENTER PANE ───────────────────────────────────────────────────────────────────────┐
│  Stair A-101                        [ Load existing ▾ ] [ Test inputs ] [ … ]       │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│                                                                                     │
│  TYPE   [▦ Straight]  [▧ Switchback]  [▧ Spiral]  [▧ Quarter-turn]                  │
│                                                                                     │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐                           │
│  │ Geometry │ Stringers│  Treads  │   Rail   │  Landing │                           │
│  └──────────┴══════════┴──────────┴──────────┴──────────┘                           │
│             (active tab: Stringers)                                                 │
│                                                                                     │
│  ┌─── Schematic (stringer detail) ──┐  ┌─── Fields ───────────────────────────┐    │
│  │        │                          │  │                                       │    │
│  │        │  ① shape                 │  │  ① Stringer shape   ◆  [ C-Chan ▾]   │    │
│  │    ───┬┘                          │  │  ② Stringer size    ◆  [ C10X25 ▾]   │    │
│  │       │                           │  │  ③ Grade                [ A36    ▾]  │    │
│  │       │                           │  │  ④ Finish               [ Paint  ▾]  │    │
│  │   ② size                          │  │  ⑤ Count                [   2    ]   │    │
│  │                                   │  │  ⑥ Labor code           [STR-01 ▾]   │    │
│  │                                   │  │                                       │    │
│  └───────────────────────────────────┘  └───────────────────────────────────────┘    │
│                                                                                     │
│  ═════════════════════════════════════════════════════════════════════════════════  │
│  MATERIAL LIST PREVIEW                                     12 lines · All valid ✓   │
│     …                                                                               │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Applies recommendations:** 1, 2, 4, 5, 6, 7, 8, 9 (tabs), 13.

**When to use:** for complex assemblies with ≥4 clearly-separable sections. The tab bar is a table of contents; the estimator jumps directly to the section they care about. Tab names must be intent-based (Geometry / Stringers / Rail), not data-type-based (Numbers / Dropdowns / Booleans).

**Watch out for:** tabs hide state. Use badge indicators (`Stringers ⚠`) when a tab has validation errors so the estimator doesn't miss them.

---

### 3.4 Wizard — staged progression (Porsche-style)

Force the estimator through stages in order. Each stage shows one big question with its schematic and a small set of fields. A progress rail at the top tracks position. Material list grows below as more stages are completed.

```
┌─ CENTER PANE ───────────────────────────────────────────────────────────────────────┐
│  Stair A-101                        [ Load existing ▾ ] [ ← Back ] [ Next → ]       │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│                                                                                     │
│  ● Type ──── ● Geometry ──── ○ Stringers ──── ○ Treads ──── ○ Rail ──── ○ Review    │
│                           (current)                                                 │
│                                                                                     │
│                                                                                     │
│                        STAGE 2  ·  Geometry                                         │
│                                                                                     │
│  ┌─── Schematic ──────────────────┐  ┌─── Fields ─────────────────────────────┐    │
│  │                                │  │                                         │    │
│  │           ┌────────┐           │  │  How many treads?          ◆           │    │
│  │           │  top   │           │  │                                         │    │
│  │         ╱─┘                    │  │      [    8    ]  ⓘ max 16 per run     │    │
│  │       ╱─┘                      │  │                                         │    │
│  │     ╱─┘                        │  │  Tread width?              ◆           │    │
│  │   ╱─┘                          │  │                                         │    │
│  │ ╱─┘                            │  │      [   36"   ]  ⓘ OSHA min 22"       │    │
│  │ │                              │  │                                         │    │
│  │ │bottom                        │  │  Riser height?             ◆           │    │
│  │ └──┐                           │  │                                         │    │
│  │    │                           │  │      [  7.5"   ]  ⓘ 7.0"–7.75" IBC     │    │
│  │    │                           │  │                                         │    │
│  │    └──                         │  │                                         │    │
│  └────────────────────────────────┘  └─────────────────────────────────────────┘    │
│                                                                                     │
│                                 [ ← Back ]  [ Next → ]                              │
│                                                                                     │
│  ═════════════════════════════════════════════════════════════════════════════════  │
│  MATERIAL LIST PREVIEW (partial — 4 of expected ~12 lines)                          │
│     Qty  Shape    Size     Length    Grade                                          │
│       8  Plate    PL1/4X10 3'-0"     (pending: riser)                               │
│     …                                                                               │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Applies recommendations:** 1, 2, 3, 4, 5, 6, 7, 8, 9 (wizard variant).

**When to use:** for brand-new users who don't know the domain. Too slow for expert estimators — they'll want to jump around. Consider offering `[ Skip to expert view → §3.1 ]` toggle.

**Watch out for:** wizards feel patronizing to power users. Good as an onboarding mode; bad as a default.

---

### 3.5 Fields-only minimal (fallback)

No schematic. Just a vertical form with every field visible, grouped by section headers. Material list docked at bottom. The lowest-implementation-cost option — what we ship if the schematic library isn't ready.

```
┌─ CENTER PANE ───────────────────────────────────────────────────────────────────────┐
│  Stair A-101                        [ Load existing ▾ ] [ Test inputs ] [ … ]       │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│                                                                                     │
│  TYPE   [▦ Straight]  [▧ Switchback]  [▧ Spiral]  [▧ Quarter-turn]                  │
│                                                                                     │
│  GEOMETRY                                                                           │
│  ──────────                                                                         │
│  Number of treads   ◆    [    8     ]                                               │
│  Tread width        ◆    [  36"     ]    ⓘ OSHA min 22"                             │
│  Riser height       ◆    [ 7.5"     ]    ⓘ 7.0"–7.75" per IBC                       │
│  Overall rise            [  auto    ]    computed                                   │
│                                                                                     │
│  STRINGERS                                                                          │
│  ──────────                                                                         │
│  Shape              ◆    [ C-Channel ▾ ]                                            │
│  Size               ◆    [ C10X25    ▾ ]                                            │
│  Grade                   [ A36       ▾ ]                                            │
│  Finish                  [ Paint     ▾ ]                                            │
│                                                                                     │
│  RAIL                                                                               │
│  ──────────                                                                         │
│  Has rail?               [x] Yes                                                    │
│  Rail type               [ Pipe rail ▾ ]                                            │
│  Handrail length         [    auto   ]                                              │
│                                                                                     │
│  LANDING                                                                            │
│  ──────────                                                                         │
│  Top landing?            [x] Yes                                                    │
│  Top landing width       [   48"     ]                                              │
│  Bottom landing?         [ ] No                                                     │
│                                                                                     │
│  ═════════════════════════════════════════════════════════════════════════════════  │
│  MATERIAL LIST PREVIEW                                     12 lines · All valid ✓   │
│     …                                                                               │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Applies recommendations:** 2, 3, 4, 5, 6, 7, 8, 12.

**When to use:** MVP, or for assemblies where a schematic doesn't add value (e.g. a generic "misc steel" assembly). Probably our day-1 implementation target — we can add the schematic later and upgrade to §3.1 without breaking anyone's workflow.

**Watch out for:** feels identical to PowerFab's existing Parametric Assembly dialog if we're not careful — the live preview and conditional visibility are what differentiates it. Don't ship without those.

---

## 4. UI component detail wireframes

Zoomed-in sketches of individual controls that appear inside the form layouts above.

---

### 4.1 Variant picker with pictograms

Pinned at the top of every assembly form. Segmented control of pictogram tiles; clicking one reconfigures the whole form below.

```
┌─────────────────────────────────────────────────────────────────┐
│  STAIR TYPE                                                     │
│                                                                 │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│   │    ╱     │  │    ╱╲    │  │    ⌒     │  │    ╱─    │        │
│   │   ╱      │  │   ╱  ╲   │  │   (  )   │  │   ╱      │        │
│   │  ╱       │  │  ╱    ╲  │  │    ⌒     │  │  ─       │        │
│   │─┘        │  │─┘    └─  │  │          │  │          │        │
│   │ Straight │  │Switchback│  │  Spiral  │  │ Qtr-turn │        │
│   └━━━━━━━━━━┘  └──────────┘  └──────────┘  └──────────┘        │
│     ▲ selected                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Notes:** selection is visually dominant (thick border or accent fill). Hovering a tile shows a tooltip with the full name and a one-line description. Switching variants prompts: `Changing stair type will reset 4 fields. Continue?` if data would be lost.

---

### 4.2 Conditional field visibility

Before and after toggling `Top landing?`.

**Before (off):**

```
┌─────────────────────────────────────────────────────────────────┐
│  LANDING                                                        │
│  ──────────                                                     │
│  Top landing?          [ ] No                                   │
│  Bottom landing?       [x] Yes                                  │
│    Bottom landing width      [  48"  ]                          │
│    Bottom landing depth      [  36"  ]                          │
└─────────────────────────────────────────────────────────────────┘
```

**After (toggled on):**

```
┌─────────────────────────────────────────────────────────────────┐
│  LANDING                                                        │
│  ──────────                                                     │
│  Top landing?          [x] Yes                                  │
│    Top landing width         [  48"  ]   ← newly revealed        │
│    Top landing depth         [  36"  ]   ← newly revealed        │
│  Bottom landing?       [x] Yes                                  │
│    Bottom landing width      [  48"  ]                          │
│    Bottom landing depth      [  36"  ]                          │
└─────────────────────────────────────────────────────────────────┘
```

**Notes:** rules are defined in the PA schema (`show_when: has_top_landing == true`). Revealed fields animate in with a subtle slide so the estimator notices the layout changed. Hidden fields retain their values until the assembly is committed — toggling back shows the old values.

---

### 4.3 Item-picker dropdown with profile icons

Stringer-size dropdown expanded. Each option shows the AISC cross-section icon next to the designation.

```
┌──────────────────────────────────────────┐
│  Stringer size    ◆   [ C10X25     ▾ ]   │
│                        ─────────────     │
│  ┌───────────────────────────────────┐   │
│  │ ⌐─┐  C8X11.5   ·  11.5 lb/ft      │   │
│  │ ⌐─┐  C10X15.3  ·  15.3 lb/ft      │   │
│  │ ⌐─┐  C10X25    ·  25.0 lb/ft    ✓ │   │ ← selected
│  │ ⌐─┐  C10X30    ·  30.0 lb/ft      │   │
│  │ ⌐─┐  C12X20.7  ·  20.7 lb/ft      │   │
│  │ ⌐─┐  C12X25    ·  25.0 lb/ft      │   │
│  │                                   │   │
│  │  [ Search…                    🔍]│   │
│  └───────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

**Notes:** `⌐─┐` is a placeholder for the real AISC cross-section glyph (C-channel, W-shape, L-angle, etc.). The search field at the bottom lets the estimator type `C12` and filter. Recently-used items show at the top. When `Shape` changes above this dropdown, this list repopulates.

---

### 4.4 Material-list preview — expanded

Full material list when the section is expanded (clicking the collapse handle expands it to show all lines). Always visible at the bottom of the center pane.

```
┌─ MATERIAL LIST PREVIEW ─────────────────────────── 12 lines · All valid ✓  [⇱]  ┐
│                                                                                  │
│   #   Qty  Shape     Size       Length    Grade   Labor      Notes               │
│  ─── ──── ─────────  ─────────  ────────  ──────  ─────────  ─────────────       │
│   1     2  Channel   C10X25     8'-6"     A36     STR-01     Stringer L          │
│   2     2  Channel   C10X25     8'-6"     A36     STR-01     Stringer R          │
│   3     8  Plate     PL1/4X10   3'-0"     A36     TRD-02     Treads              │
│   4    16  Angle     L3X3X1/4   0'-4"     A36     CLP-01     Tread clips         │
│   5     1  Plate     PL1/4X48   4'-0"     A36     LND-01     Top landing         │
│   6     4  Angle     L3X3X1/4   4'-0"     A36     LND-02     Top landing frame   │
│   7     1  Pipe      P1-1/2     8'-0"     A53     RAIL-01    Handrail            │
│   8     3  Pipe      P1-1/2     3'-6"     A53     RAIL-02    Handrail posts      │
│   9    16  Plate     PL1/4X2    0'-2"     A36     MISC       Post base plates    │
│  10    32  Misc      5/8" bolt  —         A325    BOLT       Connection bolts    │
│  11     1  Plate     PL1/4X48   4'-0"     A36     LND-01     Bottom landing      │
│  12     4  Angle     L3X3X1/4   4'-0"     A36     LND-02     Bottom landing fr.  │
│                                                                                  │
│                             [ Export to CSV ]                                    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Notes:** the `#` column is a stable sort key that matches the PA's item order. Hovering a row highlights which field(s) in the form drove it. Any row with a validation issue shows a `⚠` in the leftmost column. `[⇱]` collapses the section back to a summary line (`12 lines · All valid ✓`).

---

### 4.5 "Load from existing" picker

Triggered from the header `[ Load existing ▾ ]` button. Modal (or dropdown panel) showing prior assemblies of the same type in the current project, plus an option to load from another project.

```
┌─ Load from existing stair ──────────────────────────────────────┐
│                                                                 │
│  [ Search stairs…                                           🔍] │
│                                                                 │
│  FROM THIS PROJECT                                              │
│  ─────────────────                                              │
│   ○ A-100  ·  Straight  ·  8 treads  ·  C10X25       2h ago     │
│   ● A-102  ·  Straight  ·  12 treads ·  C12X20.7     yesterday  │ ← highlighted
│   ○ A-103  ·  Switchback · 16 treads ·  W8X31        3d ago     │
│                                                                 │
│  FROM OTHER PROJECTS                                            │
│  ───────────────────                                            │
│   ○ 2025-Westside ▸ B-201  ·  Straight  ·  10 treads            │
│   ○ 2025-Downtown ▸ S-5    ·  Spiral    ·  14 risers            │
│                                                                 │
│  What to copy:                                                  │
│    [x] Geometry    [x] Stringers    [x] Rail    [ ] Landings    │
│                                                                 │
│                              [ Cancel ]  [ Load A-102 ]         │
└─────────────────────────────────────────────────────────────────┘
```

**Notes:** the `What to copy` section lets the estimator clone just the parts they want — a stair that reuses geometry but swaps the rail is a common pattern. After loading, the form fields animate to their new values so the estimator can see what changed.

---

### 4.6 Field with min/max + unit selector + formula

Single field with every affordance turned on. Not every field needs all of these — this is the "power user" state.

```
┌─ Stringer length ──────────────────────────────────────────────┐
│                                                                │
│  Stringer length  ◆   [ =treads*tread_w+6"    ] [ ft-in  ▾ ]   │
│                         ─────────────────────    ─────────    │
│                         expression (prefix `=`)    unit        │
│                                                                │
│  Computed: 8'-6"   ·   Min: 4'-0"   ·   Max: 24'-0"            │
│  ⓘ Derived from `treads` × `tread_width` + 6" nose                │
│                                                                │
│  [ 📝 Note ] set because client spec ABC-4 requires 6" nose   │
└────────────────────────────────────────────────────────────────┘
```

**Notes:** typing `=` at the start of a field switches it from a raw value to a formula expression. Autocomplete suggests other field names in the same assembly. Hovering the computed value shows which fields contribute. The note field (rec #14) is collapsed by default and only expands when clicked.

---

## 5. Other assembly types

The same patterns apply to every assembly type — here are shorter wireframes for the most common non-stair assemblies to show how the system generalizes.

---

### 5.1 Landing form

Landings are simpler than stairs — fewer fields, so the form is shorter. Schematic is a top-down view.

```
┌─ CENTER PANE ───────────────────────────────────────────────────────────────────────┐
│  Landing L-05                          [ Load existing ▾ ] [ Test inputs ] [ … ]    │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│                                                                                     │
│  TYPE   [▦ Rectangular]  [▧ Triangular]  [▧ Notched]  [▧ L-shaped]                  │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│                                                                                     │
│  ┌─── Schematic (top view) ───────┐  ┌─── Fields ──────────────────────────────┐    │
│  │                                │  │                                          │    │
│  │   ┌──────────────┐             │  │  ① Width           ◆   [  48"  ]         │    │
│  │   │              │ ① width     │  │  ② Depth           ◆   [  36"  ]         │    │
│  │   │              │             │  │  ③ Plate thickness ◆   [ 1/4"  ▾]        │    │
│  │   │       ③      │             │  │  ④ Grade               [ A36    ▾]       │    │
│  │   │              │             │  │  ⑤ Nosing?             [x] Yes           │    │
│  │   │              │             │  │  ⑥ Support under?      [x] 4 sides       │    │
│  │   └──────────────┘             │  │  ⑦ Support shape       [ L3X3X1/4 ▾]     │    │
│  │         ② depth                │  │                                          │    │
│  │                                │  │                                          │    │
│  └────────────────────────────────┘  └──────────────────────────────────────────┘    │
│                                                                                     │
│  ═════════════════════════════════════════════════════════════════════════════════  │
│  MATERIAL LIST PREVIEW                                      5 lines · All valid ✓   │
│   1   1  Plate  PL1/4X48   4'-0"   A36   LND-01   Landing plate                     │
│   2   4  Angle  L3X3X1/4   4'-0"   A36   LND-02   Supports                          │
│   …                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 5.2 Rail form

Rails use a side-elevation schematic. The variant picker at the top shows rail styles.

```
┌─ CENTER PANE ───────────────────────────────────────────────────────────────────────┐
│  Rail R-12                             [ Load existing ▾ ] [ Test inputs ] [ … ]    │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│                                                                                     │
│  TYPE   [▦ Pipe rail]  [▧ Tube rail]  [▧ Picket]  [▧ Cable]                         │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│                                                                                     │
│  ┌─── Schematic (elevation) ──────┐  ┌─── Fields ──────────────────────────────┐    │
│  │                                │  │                                          │    │
│  │  ① ════════════════════        │  │  ① Top rail size   ◆  [ P1-1/2   ▾]      │    │
│  │                                │  │  ② Mid rail?           [x] Yes           │    │
│  │  ② ──────────────────          │  │  ③ Mid rail size       [ P1-1/4  ▾]      │    │
│  │                                │  │  ④ Post spacing    ◆  [   48"  ]         │    │
│  │  ③ │      │      │             │  │                            ⓘ max 60"      │    │
│  │    │      │      │             │  │  ⑤ Post size           [ P1-1/2  ▾]      │    │
│  │    │  ④   │      │             │  │  ⑥ Total length    ◆  [ 120"  ]          │    │
│  │  ──┴──────┴──────┴──           │  │  ⑦ Height          ◆  [   42"  ]         │    │
│  │                                │  │      42" per OSHA 1910.29                │    │
│  │         ⑥ total                │  │  ⑧ Base plates?        [x] Yes           │    │
│  │                                │  │  ⑨ Finish              [ Galv.   ▾]      │    │
│  │                                │  │                                          │    │
│  └────────────────────────────────┘  └──────────────────────────────────────────┘    │
│                                                                                     │
│  ═════════════════════════════════════════════════════════════════════════════════  │
│  MATERIAL LIST PREVIEW                                      7 lines · All valid ✓   │
│     …                                                                               │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 5.3 Ladder form

Ladders have an obvious side elevation and a small set of fields. Good fit for the Hybrid layout.

```
┌─ CENTER PANE ───────────────────────────────────────────────────────────────────────┐
│  Ladder LD-03                          [ Load existing ▾ ] [ Test inputs ] [ … ]    │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│                                                                                     │
│  TYPE   [▦ Fixed]  [▧ Cage]  [▧ Ship]  [▧ Roof access]                              │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│                                                                                     │
│  ┌─── Schematic ──────────────────┐  ┌─── Fields ──────────────────────────────┐    │
│  │                                │  │                                          │    │
│  │   │       │  ① side rail       │  │  ① Side rail shape ◆  [ L2X2X1/4 ▾]      │    │
│  │   │       │                    │  │  ② Rung size       ◆  [ Ø3/4"    ▾]      │    │
│  │   ├───────┤  ② rung            │  │  ③ Rung spacing         [  12"  ]         │    │
│  │   │       │                    │  │       OSHA max 12"                       │    │
│  │   ├───────┤                    │  │  ④ Rung count      ◆  [    12  ]          │    │
│  │   │       │                    │  │  ⑤ Width           ◆  [  18"  ]           │    │
│  │   ├───────┤  ③ spacing         │  │       OSHA min 16"                       │    │
│  │   │       │                    │  │  ⑥ Overall height      auto (computed)    │    │
│  │   ├───────┤                    │  │  ⑦ Mounting            [ Wall   ▾]       │    │
│  │   │       │                    │  │  ⑧ Grade                [ A36    ▾]       │    │
│  │   ⑤ width                      │  │                                          │    │
│  │                                │  │                                          │    │
│  └────────────────────────────────┘  └──────────────────────────────────────────┘    │
│                                                                                     │
│  ═════════════════════════════════════════════════════════════════════════════════  │
│  MATERIAL LIST PREVIEW                                      4 lines · All valid ✓   │
│     …                                                                               │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Comparison matrix — which layout for which assembly

A cheat sheet for picking which of the §3 layouts to use for a given assembly.

| Assembly      | Typical field count | Recommended layout               | Why                                                 |
| ------------- | ------------------- | -------------------------------- | --------------------------------------------------- |
| Stair         | 15–25               | §3.1 Hybrid (default)            | Enough fields to benefit from schematic; not so many that tabs are needed |
| Landing       | 5–10                | §3.1 Hybrid                      | Simple enough for one view; schematic helps        |
| Rail          | 8–12                | §3.1 Hybrid                      | Elevation schematic adds a lot                     |
| Ladder        | 6–10                | §3.1 Hybrid                      | Classic picture-with-callouts                      |
| Column        | 4–6                 | §3.5 Fields-only minimal          | Not worth a schematic                              |
| Complex stair with cage + platforms | 40+ | §3.3 Tabbed | Too many fields for one pane; tabs split cleanly |
| Onboarding / first-time user | any | §3.4 Wizard (opt-in) | Slower but more approachable                       |
| Generic misc-steel bucket | 2–5  | §3.5 Fields-only minimal          | No picture possible                                |

**The important idea:** layout is a property of the PA definition, not a global setting. Each PA in the library can declare its preferred layout (hybrid / tabbed / wizard / minimal) and the Workbench renders accordingly. This means we can ship §3.5 as the MVP and upgrade individual high-value PAs (Stair, Rail, Ladder) to §3.1 one at a time.
