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
import type { Ladder } from "@/types/project";
import type { PanelOpener } from "@/components/sidebar/types";

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
                  <div className="group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-white/72 hover:bg-white/[0.06]">
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
                        className="min-w-0 flex-1 rounded border border-cyan-300/40 bg-slate-950/65 px-1 py-0.5 text-sm text-white outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => panelOpener.openLadder(ladder.id)}
                        onDoubleClick={() => startRename(ladder)}
                        className="min-w-0 flex-1 truncate text-left"
                        title={ladder.name}
                      >
                        {ladder.name}
                      </button>
                    )}
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
          className="mt-2 w-full rounded-lg px-2 py-2 text-left text-sm text-cyan-200/85 transition hover:bg-white/[0.06] hover:text-cyan-100"
        >
          + Add Ladder
        </button>
      </div>
    </div>
  );
}
