import { useMemo, useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/ContextMenu";
import { SectionSearch } from "@/components/sidebar/SectionSearch";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";
import type { RailTemplate, RailType } from "@/types/project";
import type { PanelOpener } from "@/components/sidebar/types";

const TYPE_LABEL: Record<RailType, string> = {
  picket: "Picket",
  "multi-line": "Multi-line",
  cable: "Cable",
  wall: "Wall",
  assist: "Assist",
};

export function RailsSection({
  onAddRail,
  panelOpener,
}: {
  onAddRail: () => void;
  panelOpener: PanelOpener;
}) {
  const railTemplates = useWorkbenchStore((s) => s.project.railTemplates);
  const renameRailTemplate = useWorkbenchStore((s) => s.renameRailTemplate);
  const duplicateRailTemplate = useWorkbenchStore(
    (s) => s.duplicateRailTemplate,
  );
  const deleteRailTemplate = useWorkbenchStore((s) => s.deleteRailTemplate);

  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = !term
      ? railTemplates
      : railTemplates.filter(
          (t) =>
            t.name.toLowerCase().includes(term) ||
            TYPE_LABEL[t.type].toLowerCase().includes(term),
        );

    const out = new Map<RailType, RailTemplate[]>();
    for (const type of Object.keys(TYPE_LABEL) as RailType[]) {
      out.set(type, []);
    }
    for (const t of filtered) out.get(t.type)!.push(t);
    return out;
  }, [railTemplates, search]);

  function handleDelete(template: RailTemplate) {
    if (!window.confirm(`Delete "${template.name}"? Assignments to flights will be removed.`)) return;
    deleteRailTemplate(template.id);
  }

  function startRename(template: RailTemplate) {
    setRenamingId(template.id);
    setRenameValue(template.name);
  }

  function commitRename(id: string) {
    if (renameValue.trim()) renameRailTemplate(id, renameValue.trim());
    setRenamingId(null);
  }

  return (
    <div className="flex h-full flex-col">
      <SectionSearch value={search} onChange={setSearch} placeholder="Search rails…" />

      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {(Object.keys(TYPE_LABEL) as RailType[]).map((type) => {
          const items = grouped.get(type) ?? [];
          if (items.length === 0 && search.trim()) return null;
          return (
            <div key={type}>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
                {TYPE_LABEL[type]}
              </div>
              {items.length === 0 ? (
                <div className="px-2 py-1 text-xs italic text-white/25">
                  none
                </div>
              ) : (
                <div className="space-y-0.5">
                  {items.map((template) => {
                    const isRenaming = renamingId === template.id;
                    return (
                      <ContextMenu key={template.id}>
                        <ContextMenuTrigger asChild>
                          <div className="group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-white/72 hover:bg-white/[0.06]">
                            {isRenaming ? (
                              <input
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={() => commitRename(template.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") commitRename(template.id);
                                  else if (e.key === "Escape") setRenamingId(null);
                                }}
                                autoFocus
                                className="min-w-0 flex-1 rounded border border-cyan-300/40 bg-slate-950/65 px-1 py-0.5 text-sm text-white outline-none"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  panelOpener.openRailTemplate(template.id)
                                }
                                onDoubleClick={() => startRename(template)}
                                className="min-w-0 flex-1 truncate text-left"
                                title={template.name}
                              >
                                {template.name}
                              </button>
                            )}
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            onSelect={() =>
                              panelOpener.openRailTemplate(template.id)
                            }
                          >
                            Open
                          </ContextMenuItem>
                          <ContextMenuItem
                            onSelect={() => duplicateRailTemplate(template.id)}
                          >
                            Duplicate
                          </ContextMenuItem>
                          <ContextMenuItem onSelect={() => startRename(template)}>
                            Rename…
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            destructive
                            onSelect={() => handleDelete(template)}
                          >
                            Delete
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={onAddRail}
          className="mt-2 w-full rounded-lg px-2 py-2 text-left text-sm text-cyan-200/85 transition hover:bg-white/[0.06] hover:text-cyan-100"
        >
          + Add Rail Template
        </button>
      </div>
    </div>
  );
}
