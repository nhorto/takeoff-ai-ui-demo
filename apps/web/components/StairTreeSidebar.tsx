import { useMemo, useState } from "react";
import { formatFeetInches, type VariableValue } from "@shared/engine";
import { stairChannel, landingChannel } from "@shared/pa-library";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";
import type { FlightRecord, StairRecord } from "@/types/project";

export function StairTreeSidebar({
  onEnsureFlightTab,
  onAddStair,
}: {
  onEnsureFlightTab: (stair: StairRecord, flight: FlightRecord) => void;
  onAddStair: () => void;
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

  const [search, setSearch] = useState("");
  const [renamingStairId, setRenamingStairId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const filteredStairs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return project.stairs;

    return project.stairs
      .map((stair) => {
        if (stair.name.toLowerCase().includes(term)) return stair;
        const matchingFlights = stair.flights.filter((flight) =>
          buildFlightSearchString(stair, flight).includes(term),
        );
        if (matchingFlights.length === 0) return null;
        return { ...stair, flights: matchingFlights };
      })
      .filter((s): s is StairRecord => s !== null);
  }, [project.stairs, search]);

  const searchActive = search.trim().length > 0;

  function handleAddFlight(stairId: string) {
    const result = addFlight(stairId);
    if (result) {
      onEnsureFlightTab(result.stair, result.flight);
    }
  }

  function handleDeleteStair(stairId: string) {
    const target = project.stairs.find((s) => s.id === stairId);
    if (!target) return;
    if (
      !window.confirm(
        `Delete "${target.name}" and all its flights? This cannot be undone.`,
      )
    )
      return;
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

  function handleRenameCommit(stairId: string, name: string) {
    renameStair(stairId, name);
    setRenamingStairId(null);
  }

  return (
    <aside className="border-b border-white/10 bg-white/[0.02] xl:border-b-0 xl:border-r">
      <div className="px-4 py-4">
        <div className="text-xs uppercase tracking-[0.22em] text-white/45">
          Stairs
        </div>
        <div className="mt-4">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search..."
            className="w-full rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/15"
          />
        </div>
      </div>

      <div className="space-y-1 px-4 pb-4">
        {filteredStairs.map((stair) => {
          const expanded = ui.expandedStairIds.includes(stair.id);
          const isRenaming = renamingStairId === stair.id;

          return (
            <div key={stair.id}>
              {/* Stair header row */}
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
                    onBlur={() => {
                      if (renameValue.trim())
                        handleRenameCommit(stair.id, renameValue.trim());
                      setRenamingStairId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && renameValue.trim()) {
                        handleRenameCommit(stair.id, renameValue.trim());
                      } else if (e.key === "Escape") {
                        setRenamingStairId(null);
                      }
                    }}
                    autoFocus
                    className="min-w-0 flex-1 rounded border border-cyan-300/40 bg-slate-950/65 px-1 py-0.5 text-sm text-white outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleExpandedStair(stair.id)}
                    onDoubleClick={() => {
                      setRenamingStairId(stair.id);
                      setRenameValue(stair.name);
                    }}
                    className="min-w-0 flex-1 truncate text-left font-medium"
                    title={`${stair.name} (${stair.flights.length} flights) — double-click to rename`}
                  >
                    {stair.name}
                  </button>
                )}

                <span className="shrink-0 text-xs text-white/35">
                  {stair.flights.length}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddFlight(stair.id);
                  }}
                  title="Add flight"
                  className="shrink-0 text-white/35 opacity-0 transition group-hover:opacity-100 hover:text-cyan-300"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteStair(stair.id);
                  }}
                  title="Delete stair"
                  className="shrink-0 text-white/35 opacity-0 transition group-hover:opacity-100 hover:text-red-300"
                >
                  ×
                </button>
              </div>

              {/* Nested flights */}
              {expanded && (
                <div className="ml-4 space-y-0.5">
                  {stair.flights.map((flight) => {
                    const active = ui.selectedFlightId === flight.id;
                    const flightExp = isFlightExpanded(flight.id, searchActive);

                    return (
                      <div key={flight.id}>
                        {/* Flight row */}
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
                            className={`shrink-0 text-xs ${active ? "text-slate-400" : "text-white/40 hover:text-white/65"}`}
                          >
                            {flightExp ? "▾" : "▸"}
                          </button>
                          <button
                            type="button"
                            onClick={() => onEnsureFlightTab(stair, flight)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <span className="truncate font-medium">
                              Flight {flight.order}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFlight(stair.id, flight.id);
                            }}
                            title="Delete flight"
                            className={`shrink-0 opacity-0 transition group-hover:opacity-100 ${
                              active
                                ? "text-slate-500 hover:text-red-500"
                                : "text-white/40 hover:text-red-300"
                            }`}
                          >
                            ×
                          </button>
                        </div>

                        {/* Flight children */}
                        {flightExp && (
                          <div className="ml-5 space-y-0.5 py-0.5">
                            <button
                              type="button"
                              onClick={() => onEnsureFlightTab(stair, flight)}
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
                                onClick={() => onEnsureFlightTab(stair, flight)}
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
                              <div className={`flex items-center gap-2 px-2 py-1 text-xs ${active ? "text-slate-400" : "text-white/25"}`}>
                                <span>↳</span>
                                <span className="italic">No landing</span>
                              </div>
                            )}

                            <div className={`flex items-center gap-2 px-2 py-1 text-xs ${active ? "text-slate-400" : "text-white/25"}`}>
                              <span>↳</span>
                              <span className="italic">Rails (coming soon)</span>
                            </div>
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
    </aside>
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

function buildFlightSearchString(stair: StairRecord, flight: FlightRecord): string {
  const parts: string[] = [stair.name, `flight ${flight.order}`, "stair"];

  for (const v of stairChannel.variables) {
    if (v.hidden) continue;
    parts.push(v.label);
    parts.push(v.key);
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
      parts.push(v.label);
      parts.push(v.key);
      const val = flight.landing.values[v.key];
      if (val != null) {
        parts.push(String(val));
        if (typeof val === "number" && v.type === "length") {
          try { parts.push(formatFeetInches(val)); } catch { /* skip */ }
        }
      }
    }
  }

  return parts.join(" ").toLowerCase();
}
