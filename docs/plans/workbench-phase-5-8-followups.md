# Workbench Phases 5–8 — Code Review Follow-ups

Findings from the post-implementation code review of the workbench UX
overhaul (commits `84aa47c`, `e82c67d`, `a92d64f`, `1699f54` on
`frontend/workbench-hybrid`). None are blocking — no critical runtime
bugs — but they're worth addressing before this branch ships.

## Medium

### Peek-ref lifecycle edge case
`apps/web/components/dockview/DockviewWorkbench.tsx` (`openEntityPanel`)

Rapid interactions could briefly leave two peek tabs or leave the ref
pointing at a removed panel:
- close-then-reopen the same entity as peek → ref is cleared by
  `onDidRemovePanel`, then reinstalled on the next click, which is fine
  in isolation but fragile
- a double-click on "Open in new tab" while a peek already exists could
  race the removal of the old peek

Worth a manual smoke test plus a tighter invariant: before setting
`peekPanelIdRef.current`, assert the referenced panel actually exists
in `api.panels`.

### Shift+Enter is undiscoverable
`apps/web/components/sidebar/{Stairs,Rails,Ladders,Landings}Section.tsx`

The row buttons accept Shift+Enter to open in a new tab, but nothing
tells the user. Add a `title="Shift+Enter opens in new tab"` to each
row button (or a one-liner hint at the top of each section).

### Panel params are untyped
`apps/web/components/dockview/DockviewWorkbench.tsx` (`openEntityPanel`)

`params: Record<string, unknown>` means a wrong-shape params object
(e.g., `{ templateId }` passed to a flight panel) won't fail at compile
time. Refactor to a discriminated union of `{ component, params }`
pairs keyed by panel component name.

### No focus restoration on peek → persistent promotion
`apps/web/components/dockview/DockviewWorkbench.tsx` (`onDidMovePanel`)

Dragging a peek panel into another group clears the ref but does not
restore focus explicitly. If the user was tab-navigating inside the
peek panel, focus may land in an unexpected place.

## Low

### FlightPanel vs. Rail/Ladder/Landing editor pattern drift
`apps/web/components/dockview/FlightPanel.tsx` computes `items`/`errors`
outside the editor and passes them in, while
`RailTemplateEditor`/`LadderEditor`/`LandingTemplateEditor` compute
internally. Pick one shape and unify.

### `panelOpener` uses `getState()` in closures
`apps/web/App.tsx` (~L115–149)

The memoized `panelOpener` reads store state via `getState()` inside
callbacks. It works because `useMemo` deps include the right actions,
but it's inconsistent with the `subscribe` pattern used in the
title-sync effect. Worth converting to `useCallback`s that close over
real selectors, or using a ref that always points at fresh state.

### Orphaned rail assignment renders silently
`apps/web/components/FlightTabs/RailTab.tsx` (~L156)

When a referenced rail template has been deleted, `RailAssignmentCard`
falls back to `(template deleted)`. No banner/warning to prompt the
user to reassign or remove the orphan.

### `openEntityPanel` mode switch not exhaustive
`apps/web/components/dockview/DockviewWorkbench.tsx`

The mode branches handle `"peek"` and `"toSide"` explicitly, then fall
through to `"newTab"`. If `OpenMode` gets a new variant later, that
variant would silently behave as `newTab`. Add an explicit `switch`
with a `never` default, or a `satisfies` check.

### `RailTemplateEditor` name input affordance
`apps/web/components/RailTemplateEditor.tsx` (~L77–82)

The inline name field has no focus/hover indicator, unlike the
double-click-to-rename flow in the sidebar. Add a `focus:border` or
`focus:ring` so users know it's editable in place.
