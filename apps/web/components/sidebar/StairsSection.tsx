import { useMemo, useState } from "react";
import { formatFeetInches, type VariableValue } from "@shared/engine";
import { stairChannel, landingChannel } from "@shared/pa-library";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/ContextMenu";
import { SectionSearch } from "@/components/sidebar/SectionSearch";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";
import type { FlightRecord, StairRecord } from "@/types/project";
import type { PanelOpener } from "@/components/sidebar/types";

export function StairsSection({
  onAddStair,
  panelOpener,
}: {
  onAddStair: () => void;
  panelOpener: PanelOpener;
}) {
  const project = useWorkbenchStore((s) => s.project);
  const ui = useWorkbenchStore((s) => s.ui);
  const toggleExpandedStair = useWorkbenchStore((s) => s.toggleExpandedStair);
  const toggleExpandedFlight = useWorkbenchStore((s) => s.toggleExpandedFlight);
  const isFlightExpanded = useWorkbenchStore((s) => s.isFlightExpanded);
  const addFlight = useWorkbenchStore((s) => s.addFlight);
  const deleteStair = useWorkbenchStore((s) => s.deleteStair);
  const deleteFlight = useWorkbenchStore((s) => s.deleteFlight);
  const renameStair = useWorkbenchStore((s) => s.renameStair);
  const duplicateStair = useWorkbenchStore((s) => s.duplicateStair);
  const duplicateFlight = useWorkbenchStore((s) => s.duplicateFlight);

  const [search, setSearch] = useState("");
  const [renamingStairId, setRenamingStairId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const filteredStairs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return project.stairs;
    return project.stairs
      .map((stair) => {
        if (stair.name.toLowerCase().includes(term)) return stair;
        const matching = stair.flights.filter((flight) =>
          buildFlightSearchString(stair, flight).includes(term),
        );
        if (matching.length === 0) return null;
        return { ...stair, flights: matching };
      })
      .filter((s): s is StairRecord => s !== null);
  }, [project.stairs, search]);

  const searchActive = search.trim().length > 0;

  function handleAddFlight(stairId: string) {
    const result = addFlight(stairId);
    if (result) panelOpener.openFlight(result.stair, result.flight);
  }

  function handleDeleteStair(stairId: string) {
    const target = project.stairs.find((s) => s.id === stairId);
    if (!target) return;
    if (!window.confirm(`Delete "${target.name}" and all its flights?`)) return;
    deleteStair(stairId);
  }

  function handleDeleteFlight(stairId: string, flightId: string) {
    const stair = project.stairs.find((s) => s.id === stairId);
    if (!stair) return;
    if (stair.flights.length <= 1) {
      window.alert("A stair must have at least one flight.");
      return;
    }
    const flight = stair.flights.find((f) => f.id === flightId);
    if (!flight) return;
    if (!window.confirm(`Delete Flight ${flight.order} from "${stair.name}"?`)) return;
    deleteFlight(stairId, flightId);
  }

  function startRename(stair: StairRecord) {
    setRenamingStairId(stair.id);
    setRenameValue(stair.name);
  }

  function commitRename(stairId: string) {
    if (renameValue.trim()) renameStair(stairId, renameValue.trim());
    setRenamingStairId(null);
  }

  return (
    <div className="flex h-full flex-col">
      <SectionSearch value={search} onChange={setSearch} placeholder="Search stairs…" />

      <div className="flex-1 space-y-1 overflow-y-auto px-4 pb-4">
        {filteredStairs.map((stair) => {
          const expanded = ui.expandedStairIds.includes(stair.id);
          const isRenaming = renamingStairId === stair.id;

          return (
            <div key={stair.id}>
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div className="group flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-white/72 hover:bg-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => toggleExpandedStair(stair.id)}
                      className="shrink-0 text-white/45 hover:text-white/70"
                    >
                      {expanded ? "▾" : "▸"}
                    </button>

                    {isRenaming ? (
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => commitRename(stair.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(stair.id);
                          else if (e.key === "Escape") setRenamingStairId(null);
                        }}
                        autoFocus
                        className="min-w-0 flex-1 rounded border border-cyan-300/40 bg-slate-950/65 px-1 py-0.5 text-sm text-white outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleExpandedStair(stair.id)}
                        onDoubleClick={() => startRename(stair)}
                        className="min-w-0 flex-1 truncate text-left font-medium"
                        title={`${stair.name} (${stair.flights.length} flights)`}
                      >
                        {stair.name}
                      </button>
                    )}

                    <span className="shrink-0 text-xs text-white/35">
                      {stair.flights.length}
                    </span>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onSelect={() => handleAddFlight(stair.id)}>
                    Add flight
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => duplicateStair(stair.id)}>
                    Duplicate stair
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => startRename(stair)}>
                    Rename…
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() => toggleExpandedStair(stair.id)}
                  >
                    {expanded ? "Collapse" : "Expand"}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    destructive
                    onSelect={() => handleDeleteStair(stair.id)}
                  >
                    Delete stair
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>

              {expanded && (
                <div className="ml-4 space-y-0.5">
                  {stair.flights.map((flight) => {
                    const active = ui.selectedFlightId === flight.id;
                    const flightExp = isFlightExpanded(flight.id, searchActive);

                    return (
                      <div key={flight.id}>
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition ${
                                active
                                  ? "bg-white text-slate-950"
                                  : "text-white/65 hover:bg-white/[0.06] hover:text-white"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => toggleExpandedFlight(flight.id)}
                                className={`shrink-0 text-xs ${
                                  active ? "text-slate-400" : "text-white/40 hover:text-white/65"
                                }`}
                              >
                                {flightExp ? "▾" : "▸"}
                              </button>
                              <button
                                type="button"
                                onClick={() => panelOpener.openFlight(stair, flight)}
                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                              >
                                <span className="truncate font-medium">
                                  Flight {flight.order}
                                </span>
                              </button>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem
                              onSelect={() => panelOpener.openFlight(stair, flight)}
                            >
                              Open
                            </ContextMenuItem>
                            <ContextMenuItem
                              onSelect={() =>
                                panelOpener.openFlight(stair, flight, "newTab")
                              }
                            >
                              Open in new tab
                            </ContextMenuItem>
                            <ContextMenuItem
                              onSelect={() =>
                                panelOpener.openFlight(stair, flight, "toSide")
                              }
                            >
                              Open to side
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onSelect={() => duplicateFlight(stair.id, flight.id)}
                            >
                              Duplicate flight
                            </ContextMenuItem>
                            <ContextMenuItem
                              onSelect={() => toggleExpandedFlight(flight.id)}
                            >
                              {flightExp ? "Collapse" : "Expand"}
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              destructive
                              onSelect={() =>
                                handleDeleteFlight(stair.id, flight.id)
                              }
                            >
                              Delete flight
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {flightExp && (
                          <div className="ml-5 space-y-0.5 py-0.5">
                            <button
                              type="button"
                              onClick={() => panelOpener.openFlight(stair, flight)}
                              className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition ${
                                active
                                  ? "text-slate-600 hover:bg-slate-100"
                                  : "text-white/50 hover:bg-white/[0.05] hover:text-white/70"
                              }`}
                            >
                              <span className={active ? "text-slate-400" : "text-cyan-300/50"}>↳</span>
                              <span className="font-medium">Stair</span>
                              <span className={`truncate ${active ? "text-slate-400" : "text-white/30"}`}>
                                {stairSummary(flight.stairValues)}
                              </span>
                            </button>

                            {flight.landing ? (
                              <button
                                type="button"
                                onClick={() =>
                                  panelOpener.openLandingTemplate(flight.landing!.templateId)
                                }
                                className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition ${
                                  active
                                    ? "text-slate-600 hover:bg-slate-100"
                                    : "text-white/50 hover:bg-white/[0.05] hover:text-white/70"
                                }`}
                              >
                                <span className={active ? "text-slate-400" : "text-cyan-300/50"}>↳</span>
                                <span className="font-medium">Landing</span>
                                <span className={`truncate ${active ? "text-slate-400" : "text-white/30"}`}>
                                  {landingSummary(flight.landing.values)}
                                </span>
                              </button>
                            ) : (
                              <div className={`flex items-center gap-2 px-2 py-1 text-xs ${
                                active ? "text-slate-400" : "text-white/25"
                              }`}>
                                <span>↳</span>
                                <span className="italic">No landing</span>
                              </div>
                            )}

                            {flight.rails.length > 0 ? (
                              flight.rails.map((rail, idx) => (
                                <button
                                  key={rail.id}
                                  type="button"
                                  onClick={() =>
                                    panelOpener.openRailTemplate(rail.templateId)
                                  }
                                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition ${
                                    active
                                      ? "text-slate-600 hover:bg-slate-100"
                                      : "text-white/50 hover:bg-white/[0.05] hover:text-white/70"
                                  }`}
                                >
                                  <span className={active ? "text-slate-400" : "text-cyan-300/50"}>↳</span>
                                  <span className="font-medium">Rail {idx + 1}</span>
                                  <span className={`truncate ${active ? "text-slate-400" : "text-white/30"}`}>
                                    {rail.sourceType}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <div className={`flex items-center gap-2 px-2 py-1 text-xs ${
                                active ? "text-slate-400" : "text-white/25"
                              }`}>
                                <span>↳</span>
                                <span className="italic">No rails</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={onAddStair}
          className="mt-2 w-full rounded-lg px-2 py-2 text-left text-sm text-cyan-200/85 transition hover:bg-white/[0.06] hover:text-cyan-100"
        >
          + Add Stair
        </button>
      </div>
    </div>
  );
}

function stairSummary(values: Record<string, VariableValue>): string {
  const parts: string[] = [];
  if (values.numTreads != null) parts.push(`${values.numTreads}T`);
  if (values.numRisers != null) parts.push(`${values.numRisers}R`);
  if (typeof values.stairWidth === "number")
    parts.push(formatFeetInches(values.stairWidth));
  return parts.length > 0 ? parts.join(" / ") : "no data";
}

function landingSummary(values: Record<string, VariableValue>): string {
  const w =
    typeof values.widthOfLanding === "number"
      ? formatFeetInches(values.widthOfLanding)
      : "?";
  const d =
    typeof values.depthOfLanding === "number"
      ? formatFeetInches(values.depthOfLanding)
      : "?";
  return `${w} × ${d}`;
}

function buildFlightSearchString(
  stair: StairRecord,
  flight: FlightRecord,
): string {
  const parts: string[] = [stair.name, `flight ${flight.order}`, "stair"];

  for (const v of stairChannel.variables) {
    if (v.hidden) continue;
    parts.push(v.label, v.key);
    const val = flight.stairValues[v.key];
    if (val != null) {
      parts.push(String(val));
      if (typeof val === "number" && v.type === "length") {
        try { parts.push(formatFeetInches(val)); } catch { /* skip */ }
      }
    }
  }

  if (flight.landing) {
    parts.push("landing");
    for (const v of landingChannel.variables) {
      if (v.hidden) continue;
      parts.push(v.label, v.key);
      const val = flight.landing.values[v.key];
      if (val != null) {
        parts.push(String(val));
        if (typeof val === "number" && v.type === "length") {
          try { parts.push(formatFeetInches(val)); } catch { /* skip */ }
        }
      }
    }
  }

  for (const rail of flight.rails) parts.push("rail", rail.sourceType);

  return parts.join(" ").toLowerCase();
}
