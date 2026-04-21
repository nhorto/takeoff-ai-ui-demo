import { useMemo, useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/ContextMenu";
import { ActionMenu } from "@/components/ui/ActionMenu";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/DropdownMenu";
import { SectionSearch } from "@/components/sidebar/SectionSearch";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";
import type { RailTemplate, RailType } from "@/types/project";
import type { PanelOpener } from "@/components/sidebar/types";
import { buttonClass, cx } from "@/components/ui/uiStyles";

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
              <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                {TYPE_LABEL[type]}
              </div>
              {items.length === 0 ? (
                <div className="rounded-md border border-white/8 bg-white/[0.03] px-3 py-3 text-sm text-white/50">
                  No {TYPE_LABEL[type].toLowerCase()} templates yet.
                </div>
              ) : (
                <div className="space-y-0.5">
                  {items.map((template) => {
                    const isRenaming = renamingId === template.id;
                    return (
                      <ContextMenu key={template.id}>
                        <ContextMenuTrigger asChild>
                          <div className="group flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm transition hover:border-white/8 hover:bg-white/[0.05]">
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
                                className="min-w-0 flex-1 rounded-md border border-cyan-300/40 bg-slate-950/70 px-2 py-1 text-sm text-white outline-none"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  panelOpener.openRailTemplate(template.id)
                                }
                                onDoubleClick={() => startRename(template)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && e.shiftKey) {
                                    e.preventDefault();
                                    panelOpener.openRailTemplate(
                                      template.id,
                                      "newTab",
                                    );
                                  }
                                }}
                                className="min-w-0 flex-1 truncate text-left text-white/82 transition group-hover:text-white"
                                title={template.name}
                              >
                                {template.name}
                              </button>
                            )}
                            <ActionMenu label={`${template.name} actions`}>
                              <DropdownMenuItem
                                onSelect={() =>
                                  panelOpener.openRailTemplate(template.id)
                                }
                              >
                                Open
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() =>
                                  panelOpener.openRailTemplate(
                                    template.id,
                                    "newTab",
                                  )
                                }
                              >
                                Open in new tab
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() =>
                                  panelOpener.openRailTemplate(
                                    template.id,
                                    "toSide",
                                  )
                                }
                              >
                                Open to side
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => duplicateRailTemplate(template.id)}
                              >
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => startRename(template)}
                              >
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                destructive
                                onSelect={() => handleDelete(template)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </ActionMenu>
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
                            onSelect={() =>
                              panelOpener.openRailTemplate(template.id, "newTab")
                            }
                          >
                            Open in new tab
                          </ContextMenuItem>
                          <ContextMenuItem
                            onSelect={() =>
                              panelOpener.openRailTemplate(template.id, "toSide")
                            }
                          >
                            Open to side
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            onSelect={() => duplicateRailTemplate(template.id)}
                          >
                            Duplicate
                          </ContextMenuItem>
                          <ContextMenuItem onSelect={() => startRename(template)}>
                            Rename
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
          className={cx(buttonClass.sidebarAdd, "mt-3")}
        >
          <span className="text-base leading-none">+</span>
          Add Rail Template
        </button>
      </div>
    </div>
  );
}
