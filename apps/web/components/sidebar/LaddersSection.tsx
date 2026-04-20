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
import type { Ladder } from "@/types/project";
import type { PanelOpener } from "@/components/sidebar/types";
import { buttonClass, cx } from "@/components/ui/uiStyles";

export function LaddersSection({
  onAddLadder,
  panelOpener,
}: {
  onAddLadder: () => void;
  panelOpener: PanelOpener;
}) {
  const ladders = useWorkbenchStore((s) => s.project.ladders);
  const renameLadder = useWorkbenchStore((s) => s.renameLadder);
  const duplicateLadder = useWorkbenchStore((s) => s.duplicateLadder);
  const deleteLadder = useWorkbenchStore((s) => s.deleteLadder);

  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return ladders;
    return ladders.filter((l) => l.name.toLowerCase().includes(term));
  }, [ladders, search]);

  function handleDelete(ladder: Ladder) {
    if (!window.confirm(`Delete "${ladder.name}"?`)) return;
    deleteLadder(ladder.id);
  }

  function startRename(ladder: Ladder) {
    setRenamingId(ladder.id);
    setRenameValue(ladder.name);
  }

  function commitRename(id: string) {
    if (renameValue.trim()) renameLadder(id, renameValue.trim());
    setRenamingId(null);
  }

  return (
    <div className="flex h-full flex-col">
      <SectionSearch value={search} onChange={setSearch} placeholder="Search ladders…" />

      <div className="flex-1 space-y-0.5 overflow-y-auto px-4 pb-4">
        {filtered.length === 0 ? (
          <div className="px-2 py-2 text-xs italic text-white/25">
            {search ? "No ladders match." : "No ladders yet."}
          </div>
        ) : (
          filtered.map((ladder) => {
            const isRenaming = renamingId === ladder.id;
            return (
              <ContextMenu key={ladder.id}>
                <ContextMenuTrigger asChild>
                  <div className="group flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm transition hover:border-white/8 hover:bg-white/[0.05]">
                    {isRenaming ? (
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => commitRename(ladder.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(ladder.id);
                          else if (e.key === "Escape") setRenamingId(null);
                        }}
                        autoFocus
                        className="min-w-0 flex-1 rounded-md border border-cyan-300/40 bg-slate-950/70 px-2 py-1 text-sm text-white outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => panelOpener.openLadder(ladder.id)}
                        onDoubleClick={() => startRename(ladder)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.shiftKey) {
                            e.preventDefault();
                            panelOpener.openLadder(ladder.id, "newTab");
                          }
                        }}
                        className="min-w-0 flex-1 truncate text-left text-white/82 transition group-hover:text-white"
                        title={ladder.name}
                      >
                        {ladder.name}
                      </button>
                    )}
                    <ActionMenu label={`${ladder.name} actions`}>
                      <DropdownMenuItem
                        onSelect={() => panelOpener.openLadder(ladder.id)}
                      >
                        Open
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => panelOpener.openLadder(ladder.id, "newTab")}
                      >
                        Open in new tab
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => panelOpener.openLadder(ladder.id, "toSide")}
                      >
                        Open to side
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => duplicateLadder(ladder.id)}
                      >
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => startRename(ladder)}>
                        Rename…
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        destructive
                        onSelect={() => handleDelete(ladder)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </ActionMenu>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    onSelect={() => panelOpener.openLadder(ladder.id)}
                  >
                    Open
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() => panelOpener.openLadder(ladder.id, "newTab")}
                  >
                    Open in new tab
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() => panelOpener.openLadder(ladder.id, "toSide")}
                  >
                    Open to side
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onSelect={() => duplicateLadder(ladder.id)}
                  >
                    Duplicate
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => startRename(ladder)}>
                    Rename…
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    destructive
                    onSelect={() => handleDelete(ladder)}
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
          onClick={onAddLadder}
          className={cx(buttonClass.sidebarAdd, "mt-3")}
        >
          <span className="text-base leading-none">+</span>
          Add Ladder
        </button>
      </div>
    </div>
  );
}
