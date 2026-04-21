# Responsive Overhaul Plan — Workbench Web App

**Branch:** `frontend/workbench-hybrid`
**Scope:** `apps/web/` (React + TypeScript + Vite + Tailwind + Radix + dockview-react)
**Date:** 2026-04-20
**Status:** Planning — no code changes yet.

---

## Why

The workbench ships to customers. Today it is built with a desktop-only mindset:

- Only 10 of 52 components (~19%) use any responsive Tailwind prefixes.
- The only breakpoint in active use is `md:` (768px). There is no `sm:`, almost no `lg:`, and `xl:` is used once.
- Main layout widths are hardcoded (sidebar 304px, AI panel 260px, dialogs `max-w-md`, tables `min-w-full` with 8 columns).
- Dockview assumes a desktop canvas — split panels never stack.
- The auto-collapse threshold (900px) is an arbitrary number, not tied to Tailwind breakpoints.

We want a site that works on a phone (375px), tablet (768–1024px), laptop (1280px), and large desktop (≥1440px) without ad-hoc fixes. This doc is the plan — implementation happens in a separate pass.

---

## Target breakpoints

Keep Tailwind defaults. Commit to four tiers and design against all four:

| Tier        | Min width | Representative device      | Layout intent                                 |
| ----------- | --------- | -------------------------- | --------------------------------------------- |
| **(base)**  | 0         | iPhone SE (375px)          | Single column. Sidebar drawer. Dockview stacks. |
| **sm:**     | 640px     | Large phone / small tablet | Dialogs tighten. Form padding reduces.        |
| **md:**     | 768px     | iPad Mini                  | Sidebar persistent ribbon. Dockview splits allowed. |
| **lg:**     | 1024px    | Laptop                     | Sidebar expanded. Two-column forms.           |
| **xl:**     | 1280px    | Desktop                    | Current desktop experience.                   |

**Rule:** replace the hardcoded `window.innerWidth < 900` check in `App.tsx` with a `matchMedia("(min-width: 768px)")` — align with `md:`.

---

## Phases

Do this in order. Each phase is a shippable unit; do not start the next until the previous is verified in the browser at all four breakpoints.

### Phase 1 — Foundation (tokens + breakpoint alignment)

**Files:** `apps/web/components/ui/uiStyles.ts`, `apps/web/App.tsx`, `apps/web/index.html` (audit only), `tailwind.config.*`.

1. Add a small set of responsive spacing/typography tokens in `uiStyles.ts`:
   - `responsivePadding` → `"px-4 sm:px-5 md:px-6"`
   - `responsiveSectionPadding` → `"px-4 py-4 sm:px-6 sm:py-5"`
   - `responsiveEyebrow` → `"text-[10px] sm:text-[11px]"`
   - Keep existing exports; add new ones alongside so current callsites keep working.
2. Replace the `900px` auto-collapse breakpoint in `App.tsx:20, 43–53` with `768px` via `matchMedia`.
3. Audit `tailwind.config` for any overridden `screens`. If defaults were overridden, document it here before proceeding.
4. Viewport meta tag (`apps/web/index.html:5–8`) is already correct — leave alone.

**Exit criteria:** New tokens exist. Sidebar auto-collapses at 768px. No visual regression on desktop.

### Phase 2 — Shell layout (App.tsx + sidebar + AI panel)

**Files:** `apps/web/App.tsx`, `apps/web/components/sidebar/WorkbenchSidebar.tsx`.

1. **App.tsx shell grid (line 333–340).** Replace the single `md:grid-cols-[…]` with a responsive cascade:
   - base: single column, sidebar as a slide-over drawer, AI panel hidden behind a toggle.
   - `md:`: sidebar as 48px ribbon, AI panel still toggleable.
   - `lg:`: sidebar expanded (256–304px), AI panel 260px fixed right.
   - `xl:`: current desktop layout.
2. **Sidebar.** Replace `w-64` hardcoded (`WorkbenchSidebar.tsx:86`) with `w-[88vw] max-w-[320px] md:w-14 lg:w-64`. On base, open = slide-over backdrop; md+ = ribbon; lg+ = expanded column.
3. **AI panel.** Add a collapse button for `md:` that preserves the slot but removes the 260px footprint at narrow widths. Current hardcoded 260px → use `lg:w-[260px] xl:w-[280px]`, `md:w-0` (drawer) below that.
4. Consider a top-bar hamburger in base/sm to open the sidebar drawer.

**Exit criteria:** iPhone SE viewport shows a working single-column layout with drawer sidebar. iPad Mini shows sidebar ribbon. Laptop shows the current desktop layout minus the 260px AI panel (which hides/toggles below `lg:`).

### Phase 3 — Dockview behavior at narrow widths

**Files:** `apps/web/components/dockview/DockviewWorkbench.tsx`, `apps/web/styles/dockview-theme.css`.

Dockview itself has no built-in mobile mode. Options, ranked by effort:

1. **(Preferred for v1)** Disable splits below `md:`. When `window.matchMedia("(max-width: 767px)").matches`, intercept panel-open calls so every new panel replaces the current panel (tabs only, no `toSide` splits). Keep the tab bar; make it horizontally scrollable.
2. **(v2, larger)** Build a non-dockview stacked view for base/sm that renders whichever panel is active full-width, with a back button to return to a panel list. This is a larger refactor — out of scope for the first pass but flagged for follow-up if customers report it.

Dockview theme CSS (`dockview-theme.css:6, 42`) has fixed tab heights and padding. Add a `@media (max-width: 640px)` override that reduces `--dv-tabs-and-actions-container-height` and tab `padding` ~20%.

**Exit criteria:** Opening a second panel at <768px replaces the first instead of splitting. Tab bar scrolls horizontally when full.

### Phase 4 — Dialogs

**File:** `apps/web/components/ui/Dialog.tsx`.

1. Line 37 — change `max-w-md` to `w-[calc(100vw-32px)] max-w-md sm:max-w-lg`. Cap height at `max-h-[calc(100vh-32px)] sm:max-h-[min(85vh,760px)]`.
2. Line 33 — keep `p-4 sm:p-6`.
3. Verify each consumer (`AddStairDialog`, `AddRailDialog`, `AddLadderDialog`, `AddLandingDialog`) at 375px width. No changes expected to the consumers — the Dialog primitive handles it.

**Exit criteria:** Every dialog fits on a 375×667 viewport with 16px of breathing room on all sides.

### Phase 5 — Forms (WizardForm, FlightEditor, groupings)

**Files:** `apps/web/components/WizardForm.tsx`, `apps/web/components/FlightEditor.tsx`, `apps/web/components/FlightTabs/*`, `apps/web/components/GroupedFields.tsx`.

1. **`WizardForm.tsx:21`** — change `grid gap-4 xl:grid-cols-2` to `grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-2`. Two columns starting at `md:` is the right density; preserve `xl:` as the upper bound (don't go to 3 or 4 — fields stay readable).
2. **`FlightEditor.tsx:35–36`** — swap `px-6 py-5` for `px-4 py-4 sm:px-6 sm:py-5`.
3. **Tab bar (`ui/Tabs.tsx:15, 31`).** Add `overflow-x-auto` to `TabsList` and `whitespace-nowrap shrink-0` to triggers so 5 tabs scroll rather than wrap. Consider a `sm:text-xs text-[10px]` downgrade on base.
4. **Inputs (`uiStyles.ts`).** `fieldInputSurfaceClass` (`px-4 py-3 text-sm`) stays on desktop but consider `px-3 py-2.5 sm:px-4 sm:py-3` — do this only if touch targets feel cramped after Phase 1 tokens.

**Exit criteria:** At 1024px width the flight editor shows two-column forms. At 640px it collapses to single column with tight but legible padding. Tabs scroll horizontally on phones instead of wrapping.

### Phase 6 — Tables (ItemsTable)

**File:** `apps/web/components/ItemsTable.tsx`.

ItemsTable has 8 columns (Shape, Size, Qty, Length, Width, Grade, Labor, Comment). On narrow viewports the options are:

1. **(Recommended)** Wrap the existing table in `overflow-x-auto` with a min-width so it scrolls horizontally, plus a subtle right-edge fade to signal scroll affordance. Keep the desktop layout unchanged.
2. **(Future)** Hide non-essential columns below `sm:` (Grade, Labor, Width) via `hidden sm:table-cell`. Leaves Shape / Size / Qty / Length / Comment in the mobile view.
3. **(Ambitious)** Convert to card view on base: each row renders as a titled card with a key-value grid inside. Significant rework — defer to a later pass.

Do #1 now. Leave #2 and #3 flagged as follow-ups.

**Exit criteria:** Items table horizontally scrolls on phones without overflowing its parent. Desktop unchanged.

### Phase 7 — Sidebar sections + touch targets

**Files:** `apps/web/components/sidebar/StairsSection.tsx`, `RailsSection.tsx`, `LaddersSection.tsx`, `LandingsSection.tsx`.

1. Sidebar list items: bump `py-1.5` → `py-2 md:py-1.5`. Mobile users want 40px touch targets; desktop keeps the denser feel.
2. Add `overflow-y-auto` to each section's scroll region so long lists don't push the tab bar off-screen.
3. Tab triggers in sections — same `py-2 md:py-1.5` pattern.

**Exit criteria:** Every sidebar item hits a 40×40 minimum touch target on mobile. Long lists scroll within the sidebar.

### Phase 8 — Polish + verification

1. Walk every surface in Chrome DevTools at the four breakpoints: 375, 640, 768, 1024, 1280, 1440.
2. Check type-check (`tsc --noEmit`) and tests (`vitest run`) after every phase.
3. Take screenshots of each surface × each breakpoint and store them under `docs/reference/responsive-screenshots-2026-04-20/` (or the completion date) for before/after comparison.
4. Manual test pass: create a stair, a rail template, a ladder, a landing template, assign them to a flight, open the materials panel, upload a PDF — on each of the four viewport tiers.

---

## Per-file change list

This is a distilled version of the Phases above — cross-reference when implementing.

### Critical

- `apps/web/App.tsx` — replace single-`md:` grid with base/md/lg/xl cascade; replace 900px auto-collapse with 768px.
- `apps/web/components/dockview/DockviewWorkbench.tsx` — intercept splits below `md:`, stack panels.
- `apps/web/components/WizardForm.tsx:21` — `md:grid-cols-2` instead of `xl:grid-cols-2`.
- `apps/web/components/ItemsTable.tsx` — overflow-x wrapper.
- `apps/web/components/ui/Dialog.tsx:37` — responsive `max-w-*` and height.
- `apps/web/components/sidebar/WorkbenchSidebar.tsx:86` — replace `w-64` with drawer/ribbon/expanded cascade.

### Moderate

- `apps/web/components/ui/uiStyles.ts` — add responsive tokens.
- `apps/web/components/FlightEditor.tsx:35–36` — `px-4 py-4 sm:px-6 sm:py-5`.
- `apps/web/components/ui/Tabs.tsx` — horizontal-scroll tab list.
- `apps/web/styles/dockview-theme.css` — mobile media query for tab heights/padding.

### Nice-to-have

- Sidebar sections — bump `py-1.5` → `py-2 md:py-1.5`.
- All form inputs — audit padding on mobile.
- Typography scale (`text-[11px]`) — add `sm:` variants where small text appears.

---

## Out of scope

Flagged as follow-up passes, not part of this overhaul:

- Card-view layout for ItemsTable on phones (Phase 6, option 3).
- Fully custom stacked panel shell to replace dockview below `md:` (Phase 3, option 2).
- Responsive PDF viewer (PdfPanel) — likely needs its own pass with pinch-zoom handling.
- Touch gesture handling for dockview splits (pinch to close, swipe between tabs).
- Print stylesheets.
- Dark/light theme responsiveness — current theme is dark-only, no change planned.

---

## Verification checklist

Before declaring the overhaul done:

- [ ] `tsc --noEmit` passes.
- [ ] `vitest run` passes.
- [ ] Chrome DevTools responsive mode walkthrough at 375 / 640 / 768 / 1024 / 1280 / 1440.
- [ ] No horizontal scroll on body at any breakpoint (only ItemsTable and tab lists scroll, by design).
- [ ] All touch targets ≥40px on base/sm.
- [ ] Dialogs fit on 375×667 with 16px margin.
- [ ] Sidebar drawer / ribbon / expanded states work on base / md / lg respectively.
- [ ] Flight editor usable on a 375px phone: tab selection, field edits, materials panel expand.
- [ ] Dockview does not show split panels below `md:`.
- [ ] Screenshots archived under `docs/reference/`.

---

## Open decisions

Flag these before implementation — user may push back:

1. **Drawer vs bottom-sheet sidebar on base.** Plan assumes a left-slide drawer; a bottom-sheet could be friendlier on tall phones. Small UX call — resolve when implementing Phase 2.
2. **AI panel mobile behavior.** Plan hides it below `lg:` with a toggle. Alternative: show it as a full-screen overlay triggered from the top bar. Pick when starting Phase 2.
3. **ItemsTable hidden columns.** Phase 6 option #2 hides Grade/Labor/Width below `sm:`. User may want all columns always visible — confirm before shipping.
4. **Tab overflow on flight editor.** Horizontal-scroll tabs vs a dropdown fallback. Plan picks scrolling; revisit if estimators find it unintuitive.
