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
import type { LandingTemplate } from "@/types/project";
import type { PanelOpener } from "@/components/sidebar/types";
import { buttonClass, cx } from "@/components/ui/uiStyles";

export function LandingsSection({
  onAddLanding,
  panelOpener,
}: {
  onAddLanding: () => void;
  panelOpener: PanelOpener;
}) {
  const landingTemplates = useWorkbenchStore((s) => s.project.landingTemplates);
  const renameLandingTemplate = useWorkbenchStore(
    (s) => s.renameLandingTemplate,
  );
  const duplicateLandingTemplate = useWorkbenchStore(
    (s) => s.duplicateLandingTemplate,
  );
  const deleteLandingTemplate = useWorkbenchStore(
    (s) => s.deleteLandingTemplate,
  );

  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return landingTemplates;
    return landingTemplates.filter((t) =>
      t.name.toLowerCase().includes(term),
    );
  }, [landingTemplates, search]);

  function handleDelete(template: LandingTemplate) {
    if (
      !window.confirm(
        `Delete "${template.name}"? Flights using this landing will lose their landing assignment.`,
      )
    )
      return;
    deleteLandingTemplate(template.id);
  }

  function startRename(template: LandingTemplate) {
    setRenamingId(template.id);
    setRenameValue(template.name);
  }

  function commitRename(id: string) {
    if (renameValue.trim()) renameLandingTemplate(id, renameValue.trim());
    setRenamingId(null);
  }

  return (
    <div className="flex h-full flex-col">
      <SectionSearch value={search} onChange={setSearch} placeholder="Search landings…" />

      <div className="flex-1 space-y-0.5 overflow-y-auto px-4 pb-4">
        {filtered.length === 0 ? (
          <div className="px-2 py-2 text-xs italic text-white/25">
            {search ? "No landings match." : "No landing templates yet."}
          </div>
        ) : (
          filtered.map((template) => {
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
                          panelOpener.openLandingTemplate(template.id)
                        }
                        onDoubleClick={() => startRename(template)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.shiftKey) {
                            e.preventDefault();
                            panelOpener.openLandingTemplate(
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
                          panelOpener.openLandingTemplate(template.id)
                        }
                      >
                        Open
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          panelOpener.openLandingTemplate(template.id, "newTab")
                        }
                      >
                        Open in new tab
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          panelOpener.openLandingTemplate(template.id, "toSide")
                        }
                      >
                        Open to side
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => duplicateLandingTemplate(template.id)}
                      >
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => startRename(template)}>
                        Rename…
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
                      panelOpener.openLandingTemplate(template.id)
                    }
                  >
                    Open
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() =>
                      panelOpener.openLandingTemplate(template.id, "newTab")
                    }
                  >
                    Open in new tab
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() =>
                      panelOpener.openLandingTemplate(template.id, "toSide")
                    }
                  >
                    Open to side
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onSelect={() => duplicateLandingTemplate(template.id)}
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
          })
        )}

        <button
          type="button"
          onClick={onAddLanding}
          className={cx(buttonClass.sidebarAdd, "mt-3")}
        >
          <span className="text-base leading-none">+</span>
          Add Landing Template
        </button>
      </div>
    </div>
  );
}
