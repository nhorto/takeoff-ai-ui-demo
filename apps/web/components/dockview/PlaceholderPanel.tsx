import type { IDockviewPanelProps } from "dockview-react";

/**
 * Temporary panel for entity editors that aren't wired up yet.
 * Replaced by RailTemplatePanel / LadderPanel / LandingTemplatePanel in Phase 6.
 */
export function PlaceholderPanel(
  props: IDockviewPanelProps<{ kind: string; id: string; name?: string }>,
) {
  const { kind, id, name } = props.params ?? { kind: "?", id: "?" };
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-slate-950/40 px-6 text-center">
      <div className="text-xs uppercase tracking-[0.18em] text-white/45">
        {kind} editor
      </div>
      <div className="text-base text-white/80">{name ?? id}</div>
      <div className="max-w-sm text-sm text-white/45">
        Editor coming in Phase 6. The data is already stored — use the sidebar's
        right-click menu to rename, duplicate, or delete.
      </div>
    </div>
  );
}
