import { useEffect, useMemo, useState } from "react";
import {
  evaluatePA,
  ftIn,
  type EvaluateResult,
  type VariableValue,
} from "@shared/engine";
import { exportItemsToCsv } from "@shared/exporters";
import { stairChannel, landingChannel } from "@shared/pa-library";
import { ItemsTable } from "@/components/ItemsTable";
import { WizardForm } from "@/components/WizardForm";
import { downloadTextFile } from "@/lib/download";
import { loadState, makeId, resetState, saveState } from "@/lib/storage";
import type {
  FlightRecord,
  OpenTab,
  PersistedState,
  ProjectState,
  StairInputMode,
  StairRecord,
  WorkspaceMode,
} from "@/types/project";

export default function App() {
  const [state, setState] = useState<PersistedState>(() => loadState());
  const [search, setSearch] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [addStairOpen, setAddStairOpen] = useState(false);
  const [renamingStairId, setRenamingStairId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    saveState(state);
  }, [state]);

  const project = state.project;
  const activeTab =
    state.ui.openTabs.find((tab) => tab.id === state.ui.activeTabId) ??
    state.ui.openTabs[0];

  const activeStair = activeTab?.stairId
    ? (project.stairs.find((s) => s.id === activeTab.stairId) ?? null)
    : null;
  const activeFlight =
    activeStair && activeTab?.flightId
      ? (activeStair.flights.find((f) => f.id === activeTab.flightId) ?? null)
      : null;

  const stairEvaluation = useMemo(() => {
    if (!activeFlight) return null;
    try {
      const result = evaluatePA(stairChannel, activeFlight.stairValues);
      return { result, error: null };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : "Evaluation error",
      };
    }
  }, [activeFlight]);

  const landingEvaluation = useMemo(() => {
    if (!activeFlight?.landingValues) return null;
    try {
      const result = evaluatePA(landingChannel, activeFlight.landingValues);
      return { result, error: null };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : "Evaluation error",
      };
    }
  }, [activeFlight]);

  const allItems = useMemo(() => {
    const items = [];
    if (stairEvaluation?.result) items.push(...stairEvaluation.result.items);
    if (landingEvaluation?.result)
      items.push(...landingEvaluation.result.items);
    return items;
  }, [stairEvaluation, landingEvaluation]);

  const totalFlights = project.stairs.reduce(
    (sum, s) => sum + s.flights.length,
    0,
  );
  const completedFlights = project.stairs.reduce((sum, stair) => {
    return (
      sum +
      stair.flights.filter((f) => {
        const required = stairChannel.variables.filter(
          (v) => v.required && !v.hidden,
        );
        return required.every(
          (v) => f.stairValues[v.key] != null && f.stairValues[v.key] !== "",
        );
      }).length
    );
  }, 0);

  const filteredStairs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return project.stairs;
    return project.stairs.filter(
      (stair) =>
        stair.name.toLowerCase().includes(term) ||
        stair.flights.some((_, i) => `flight ${i + 1}`.includes(term)),
    );
  }, [project.stairs, search]);

  // ── State helpers ──

  function updateProject(nextProject: ProjectState): void {
    setState((current) => ({
      ...current,
      project: {
        ...nextProject,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function setWorkspaceMode(mode: WorkspaceMode): void {
    setState((current) => ({
      ...current,
      ui: { ...current.ui, workspaceMode: mode },
    }));
  }

  function setActiveTab(tabId: string): void {
    setState((current) => {
      const tab = current.ui.openTabs.find((entry) => entry.id === tabId);
      return {
        ...current,
        ui: {
          ...current.ui,
          activeTabId: tabId,
          selectedStairId: tab?.stairId ?? current.ui.selectedStairId,
          selectedFlightId: tab?.flightId ?? current.ui.selectedFlightId,
        },
      };
    });
  }

  function ensureFlightTab(stair: StairRecord, flight: FlightRecord): void {
    const tabId = `flight-${flight.id}`;
    const title = `${stair.name} / Flight ${flight.order}`;
    setState((current) => {
      const exists = current.ui.openTabs.some((tab) => tab.id === tabId);
      const nextTabs = exists
        ? current.ui.openTabs.map((tab) =>
            tab.id === tabId ? { ...tab, title } : tab,
          )
        : [
            ...current.ui.openTabs,
            {
              id: tabId,
              type: "flight",
              title,
              stairId: stair.id,
              flightId: flight.id,
            } satisfies OpenTab,
          ];

      return {
        ...current,
        ui: {
          ...current.ui,
          openTabs: nextTabs,
          activeTabId: tabId,
          selectedStairId: stair.id,
          selectedFlightId: flight.id,
          expandedStairIds: current.ui.expandedStairIds.includes(stair.id)
            ? current.ui.expandedStairIds
            : [...current.ui.expandedStairIds, stair.id],
        },
      };
    });
  }

  function closeTab(tabId: string): void {
    if (tabId === "welcome") return;
    setState((current) => {
      const nextTabs = current.ui.openTabs.filter((tab) => tab.id !== tabId);
      return {
        ...current,
        ui: {
          ...current.ui,
          openTabs: nextTabs.length > 0 ? nextTabs : current.ui.openTabs,
          activeTabId:
            current.ui.activeTabId === tabId
              ? "welcome"
              : current.ui.activeTabId,
        },
      };
    });
  }

  function toggleExpanded(stairId: string): void {
    setState((current) => ({
      ...current,
      ui: {
        ...current.ui,
        expandedStairIds: current.ui.expandedStairIds.includes(stairId)
          ? current.ui.expandedStairIds.filter((id) => id !== stairId)
          : [...current.ui.expandedStairIds, stairId],
      },
    }));
  }

  // ── CRUD ──

  function addStair(config: {
    name: string;
    numFlights: number;
    mode: StairInputMode;
    totalRisers?: number;
    stairWidth: number;
  }): void {
    const now = new Date().toISOString();
    const stairId = makeId("stair");

    let risersPerFlight: number[] | null = null;
    if (config.mode === "averaged" && config.totalRisers) {
      risersPerFlight = distributeRisers(
        config.totalRisers,
        config.numFlights,
      );
    }

    const flights: FlightRecord[] = Array.from(
      { length: config.numFlights },
      (_, i): FlightRecord => {
        const stairValues: Record<string, VariableValue> = {
          stairWidth: config.stairWidth,
        };
        if (risersPerFlight) {
          stairValues.numRisers = risersPerFlight[i];
          stairValues.numTreads = risersPerFlight[i] - 1;
        }
        return {
          id: makeId("flight"),
          order: i + 1,
          stairValues,
          landingValues: null,
          createdAt: now,
          updatedAt: now,
        };
      },
    );

    const newStair: StairRecord = {
      id: stairId,
      name: config.name,
      inputMode: config.mode,
      totalRisers: config.totalRisers,
      defaultStairWidth: config.stairWidth,
      flights,
      createdAt: now,
      updatedAt: now,
    };

    updateProject({
      ...project,
      stairs: [...project.stairs, newStair],
    });

    ensureFlightTab(newStair, flights[0]);
    setAddStairOpen(false);
  }

  function deleteStair(stairId: string): void {
    const target = project.stairs.find((s) => s.id === stairId);
    if (!target) return;
    if (
      !window.confirm(
        `Delete "${target.name}" and all its flights? This cannot be undone.`,
      )
    )
      return;

    const flightIds = new Set(target.flights.map((f) => f.id));
    setState((current) => {
      const nextTabs = current.ui.openTabs.filter(
        (tab) =>
          tab.type !== "flight" || !flightIds.has(tab.flightId ?? ""),
      );
      const nextDrafts = { ...current.drafts };
      for (const fId of flightIds) {
        delete nextDrafts[`${fId}-stair`];
        delete nextDrafts[`${fId}-landing`];
      }

      const activeFlightId =
        current.ui.openTabs.find(
          (t) => t.id === current.ui.activeTabId,
        )?.flightId ?? "";

      return {
        ...current,
        project: {
          ...current.project,
          stairs: current.project.stairs.filter((s) => s.id !== stairId),
          updatedAt: new Date().toISOString(),
        },
        ui: {
          ...current.ui,
          openTabs:
            nextTabs.length > 0
              ? nextTabs
              : [{ id: "welcome", type: "welcome" as const, title: "Welcome" }],
          activeTabId: flightIds.has(activeFlightId)
            ? "welcome"
            : current.ui.activeTabId,
          selectedStairId:
            current.ui.selectedStairId === stairId
              ? null
              : current.ui.selectedStairId,
          selectedFlightId: flightIds.has(
            current.ui.selectedFlightId ?? "",
          )
            ? null
            : current.ui.selectedFlightId,
          expandedStairIds: current.ui.expandedStairIds.filter(
            (id) => id !== stairId,
          ),
        },
        drafts: nextDrafts,
      };
    });
  }

  function renameStair(stairId: string, name: string): void {
    const now = new Date().toISOString();
    setState((current) => ({
      ...current,
      project: {
        ...current.project,
        stairs: current.project.stairs.map((s) =>
          s.id === stairId ? { ...s, name, updatedAt: now } : s,
        ),
        updatedAt: now,
      },
      ui: {
        ...current.ui,
        openTabs: current.ui.openTabs.map((tab) => {
          if (tab.stairId === stairId && tab.type === "flight") {
            const flight = current.project.stairs
              .find((s) => s.id === stairId)
              ?.flights.find((f) => f.id === tab.flightId);
            return {
              ...tab,
              title: `${name} / Flight ${flight?.order ?? "?"}`,
            };
          }
          return tab;
        }),
      },
    }));
    setRenamingStairId(null);
  }

  function addFlight(stairId: string): void {
    const stair = project.stairs.find((s) => s.id === stairId);
    if (!stair) return;

    const now = new Date().toISOString();
    const newFlight: FlightRecord = {
      id: makeId("flight"),
      order: stair.flights.length + 1,
      stairValues: stair.defaultStairWidth
        ? { stairWidth: stair.defaultStairWidth }
        : {},
      landingValues: null,
      createdAt: now,
      updatedAt: now,
    };

    updateProject({
      ...project,
      stairs: project.stairs.map((s) =>
        s.id === stairId
          ? { ...s, flights: [...s.flights, newFlight], updatedAt: now }
          : s,
      ),
    });

    const updatedStair = {
      ...stair,
      flights: [...stair.flights, newFlight],
    };
    ensureFlightTab(updatedStair, newFlight);
  }

  function deleteFlight(stairId: string, flightId: string): void {
    const stair = project.stairs.find((s) => s.id === stairId);
    if (!stair) return;
    if (stair.flights.length <= 1) {
      window.alert("A stair must have at least one flight.");
      return;
    }

    const flight = stair.flights.find((f) => f.id === flightId);
    if (!flight) return;
    if (
      !window.confirm(
        `Delete Flight ${flight.order} from "${stair.name}"?`,
      )
    )
      return;

    const now = new Date().toISOString();
    const nextFlights = stair.flights
      .filter((f) => f.id !== flightId)
      .map((f, i) => ({ ...f, order: i + 1 }));

    const tabId = `flight-${flightId}`;
    setState((current) => {
      const nextTabs = current.ui.openTabs.filter(
        (tab) => tab.id !== tabId,
      );
      const nextDrafts = { ...current.drafts };
      delete nextDrafts[`${flightId}-stair`];
      delete nextDrafts[`${flightId}-landing`];

      const updatedTabs = nextTabs.map((tab) => {
        if (tab.stairId === stairId && tab.type === "flight") {
          const updated = nextFlights.find((f) => f.id === tab.flightId);
          if (updated) {
            return {
              ...tab,
              title: `${stair.name} / Flight ${updated.order}`,
            };
          }
        }
        return tab;
      });

      return {
        ...current,
        project: {
          ...current.project,
          stairs: current.project.stairs.map((s) =>
            s.id === stairId
              ? { ...s, flights: nextFlights, updatedAt: now }
              : s,
          ),
          updatedAt: now,
        },
        ui: {
          ...current.ui,
          openTabs:
            updatedTabs.length > 0
              ? updatedTabs
              : [{ id: "welcome", type: "welcome" as const, title: "Welcome" }],
          activeTabId:
            current.ui.activeTabId === tabId
              ? (updatedTabs[0]?.id ?? "welcome")
              : current.ui.activeTabId,
          selectedFlightId:
            current.ui.selectedFlightId === flightId
              ? null
              : current.ui.selectedFlightId,
        },
        drafts: nextDrafts,
      };
    });
  }

  function updateFlightStairValue(
    key: string,
    value: VariableValue,
    draft?: string,
  ): void {
    if (!activeStair || !activeFlight) return;
    const now = new Date().toISOString();

    updateProject({
      ...project,
      stairs: project.stairs.map((s) =>
        s.id === activeStair.id
          ? {
              ...s,
              flights: s.flights.map((f) =>
                f.id === activeFlight.id
                  ? {
                      ...f,
                      stairValues: { ...f.stairValues, [key]: value },
                      updatedAt: now,
                    }
                  : f,
              ),
              updatedAt: now,
            }
          : s,
      ),
    });

    if (draft !== undefined) {
      setState((current) => ({
        ...current,
        drafts: {
          ...current.drafts,
          [`${activeFlight.id}-stair`]: {
            ...(current.drafts[`${activeFlight.id}-stair`] ?? {}),
            [key]: draft,
          },
        },
      }));
    }
  }

  function updateFlightLandingValue(
    key: string,
    value: VariableValue,
    draft?: string,
  ): void {
    if (!activeStair || !activeFlight || !activeFlight.landingValues) return;
    const now = new Date().toISOString();

    updateProject({
      ...project,
      stairs: project.stairs.map((s) =>
        s.id === activeStair.id
          ? {
              ...s,
              flights: s.flights.map((f) =>
                f.id === activeFlight.id
                  ? {
                      ...f,
                      landingValues: {
                        ...f.landingValues!,
                        [key]: value,
                      },
                      updatedAt: now,
                    }
                  : f,
              ),
              updatedAt: now,
            }
          : s,
      ),
    });

    if (draft !== undefined) {
      setState((current) => ({
        ...current,
        drafts: {
          ...current.drafts,
          [`${activeFlight.id}-landing`]: {
            ...(current.drafts[`${activeFlight.id}-landing`] ?? {}),
            [key]: draft,
          },
        },
      }));
    }
  }

  function toggleLanding(): void {
    if (!activeStair || !activeFlight) return;
    const now = new Date().toISOString();
    const hasLanding = activeFlight.landingValues !== null;

    updateProject({
      ...project,
      stairs: project.stairs.map((s) =>
        s.id === activeStair.id
          ? {
              ...s,
              flights: s.flights.map((f) =>
                f.id === activeFlight.id
                  ? {
                      ...f,
                      landingValues: hasLanding ? null : {},
                      updatedAt: now,
                    }
                  : f,
              ),
              updatedAt: now,
            }
          : s,
      ),
    });
  }

  function handleExport(): void {
    if (!activeFlight || allItems.length === 0) return;
    const csv = exportItemsToCsv(allItems);
    const safeName = (activeStair?.name ?? "flight")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    downloadTextFile(
      `${safeName}-flight-${activeFlight.order}.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
  }

  function toggleAiPanel(): void {
    setState((current) => ({
      ...current,
      ui: { ...current.ui, aiPanelOpen: !current.ui.aiPanelOpen },
    }));
  }

  function handleReset(): void {
    if (
      !window.confirm(
        "Reset the workbench demo back to its starting state?",
      )
    )
      return;
    setState(resetState());
    setSearch("");
    setAiInput("");
  }

  // ── JSX ──

  return (
    <div className="flex min-h-screen flex-col px-4 py-4 text-white md:px-6">
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col">
        <div className="flex flex-1 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,30,0.98),rgba(8,13,24,0.98))] shadow-glow">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="font-semibold tracking-[0.16em] text-white">
                TakeoffAI
              </div>
              <div className="text-white/35">▸</div>
              <div className="text-white/72">{project.name}</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleAiPanel}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white/68 transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                {state.ui.aiPanelOpen ? "Hide AI" : "Show AI"}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white/68 transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                Reset
              </button>
              <button
                type="button"
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white/68 transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                ⚙
              </button>
            </div>
          </header>

          {/* Main grid */}
          <div
            className={`grid min-h-0 flex-1 ${
              state.ui.aiPanelOpen
                ? "xl:grid-cols-[260px_minmax(0,1fr)_260px]"
                : "xl:grid-cols-[260px_minmax(0,1fr)]"
            }`}
          >
            {/* ── Left panel: Stair tree ── */}
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
                  const expanded = state.ui.expandedStairIds.includes(
                    stair.id,
                  );
                  const isRenaming = renamingStairId === stair.id;

                  return (
                    <div key={stair.id}>
                      {/* Stair header row */}
                      <div className="group flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-white/72 hover:bg-white/[0.06]">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(stair.id)}
                          className="shrink-0 text-white/45 hover:text-white/70"
                        >
                          {expanded ? "▾" : "▸"}
                        </button>

                        {isRenaming ? (
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) =>
                              setRenameValue(e.target.value)
                            }
                            onBlur={() => {
                              if (renameValue.trim())
                                renameStair(
                                  stair.id,
                                  renameValue.trim(),
                                );
                              setRenamingStairId(null);
                            }}
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                renameValue.trim()
                              ) {
                                renameStair(
                                  stair.id,
                                  renameValue.trim(),
                                );
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
                            onClick={() => toggleExpanded(stair.id)}
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
                            addFlight(stair.id);
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
                            deleteStair(stair.id);
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
                            const active =
                              activeFlight?.id === flight.id;
                            const risers =
                              flight.stairValues.numRisers;
                            const treads =
                              flight.stairValues.numTreads;
                            const hasData =
                              risers != null || treads != null;

                            return (
                              <div
                                key={flight.id}
                                className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                                  active
                                    ? "bg-white text-slate-950"
                                    : "text-white/65 hover:bg-white/[0.06] hover:text-white"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    ensureFlightTab(stair, flight)
                                  }
                                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                >
                                  <span
                                    className={`h-2 w-2 rounded-full ${
                                      active
                                        ? "bg-slate-950"
                                        : hasData
                                          ? "bg-emerald-400"
                                          : "bg-white/22"
                                    }`}
                                  />
                                  <span className="truncate">
                                    Flight {flight.order}
                                  </span>
                                  {hasData && (
                                    <span
                                      className={`text-xs ${active ? "text-slate-500" : "text-white/35"}`}
                                    >
                                      {treads != null
                                        ? `${treads}T`
                                        : ""}
                                      {treads != null &&
                                      risers != null
                                        ? " / "
                                        : ""}
                                      {risers != null
                                        ? `${risers}R`
                                        : ""}
                                    </span>
                                  )}
                                </button>
                                {flight.landingValues && (
                                  <span
                                    className={`text-[10px] ${active ? "text-slate-400" : "text-white/30"}`}
                                    title="Has landing"
                                  >
                                    L
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteFlight(
                                      stair.id,
                                      flight.id,
                                    );
                                  }}
                                  title="Delete flight"
                                  className={`opacity-0 transition group-hover:opacity-100 ${
                                    active
                                      ? "text-slate-500 hover:text-red-500"
                                      : "text-white/40 hover:text-red-300"
                                  }`}
                                >
                                  ×
                                </button>
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
                  onClick={() => setAddStairOpen(true)}
                  className="mt-2 w-full rounded-lg px-2 py-2 text-left text-sm text-cyan-200/85 transition hover:bg-white/[0.06] hover:text-cyan-100"
                >
                  + Add Stair
                </button>
              </div>
            </aside>

            {/* ── Center pane ── */}
            <section className="flex min-w-0 flex-col">
              {activeTab?.type === "welcome" ? (
                <WelcomeView
                  stairs={project.stairs}
                  onAddStair={() => setAddStairOpen(true)}
                  onSelectFlight={(stair, flight) =>
                    ensureFlightTab(stair, flight)
                  }
                />
              ) : (
                <>
                  {/* Tabs */}
                  <div className="border-b border-white/10 px-4 py-3">
                    <div className="flex gap-2 overflow-x-auto">
                      {state.ui.openTabs
                        .filter((tab) => tab.type === "flight")
                        .map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`inline-flex shrink-0 items-center gap-2 rounded-t-xl border border-b-0 px-3 py-2 text-sm transition ${
                              state.ui.activeTabId === tab.id
                                ? "border-white/20 bg-white/[0.06] text-white"
                                : "border-transparent bg-transparent text-white/52 hover:text-white/78"
                            }`}
                          >
                            <span>{tab.title}</span>
                            <span
                              onClick={(event) => {
                                event.stopPropagation();
                                closeTab(tab.id);
                              }}
                              className="text-white/40 hover:text-white/78"
                            >
                              ×
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>

                  {/* Flight editor */}
                  <div className="flex-1 overflow-auto px-6 py-5">
                    {activeStair && activeFlight ? (
                      <FlightEditor
                        stair={activeStair}
                        flight={activeFlight}
                        stairEvaluation={stairEvaluation}
                        landingEvaluation={landingEvaluation}
                        stairDrafts={
                          state.drafts[
                            `${activeFlight.id}-stair`
                          ] ?? {}
                        }
                        landingDrafts={
                          state.drafts[
                            `${activeFlight.id}-landing`
                          ] ?? {}
                        }
                        workspaceMode={state.ui.workspaceMode}
                        onSetWorkspaceMode={setWorkspaceMode}
                        onStairValueChange={updateFlightStairValue}
                        onLandingValueChange={
                          updateFlightLandingValue
                        }
                        onToggleLanding={toggleLanding}
                        onExport={handleExport}
                        onDeleteFlight={() =>
                          deleteFlight(
                            activeStair.id,
                            activeFlight.id,
                          )
                        }
                      />
                    ) : (
                      <div className="py-16 text-center text-sm text-white/42">
                        Select a flight to begin editing.
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Footer */}
              <footer className="border-t border-white/10 bg-slate-950/55 px-5 py-2.5 text-xs text-white/48">
                {project.stairs.length} stairs · {totalFlights} flights ·{" "}
                {completedFlights} complete
                <span className="float-right">
                  {activeFlight ? "editing · " : ""}
                  saved ✓
                </span>
              </footer>
            </section>

            {/* ── AI panel ── */}
            {state.ui.aiPanelOpen && (
              <aside className="border-t border-white/10 bg-white/[0.02] xl:border-l xl:border-t-0">
                <div className="px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                    AI Assistant
                  </div>
                </div>
                <div className="flex h-full flex-col px-4 pb-4">
                  <div className="space-y-4 text-sm leading-6 text-white/66">
                    <p>Hi. Tell me what you want to add or change.</p>
                    <p>You can describe it in plain English.</p>
                  </div>

                  <div className="mt-6 border-t border-white/10 pt-4 text-xs text-white/40">
                    Future: edit flights in plain English, explain
                    missing inputs, and assist without leaving the
                    workbench.
                  </div>

                  <div className="mt-auto pt-6">
                    <div className="rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2.5 text-sm text-white/70">
                      <input
                        type="text"
                        value={aiInput}
                        onChange={(event) =>
                          setAiInput(event.target.value)
                        }
                        placeholder="Type here…"
                        className="w-full bg-transparent outline-none placeholder:text-white/28"
                      />
                    </div>
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>

      {/* Add Stair dialog */}
      {addStairOpen && (
        <AddStairDialog
          nextStairNumber={project.stairs.length + 1}
          onConfirm={addStair}
          onCancel={() => setAddStairOpen(false)}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function WelcomeView({
  stairs,
  onAddStair,
  onSelectFlight,
}: {
  stairs: StairRecord[];
  onAddStair: () => void;
  onSelectFlight: (stair: StairRecord, flight: FlightRecord) => void;
}) {
  const recentFlights = stairs
    .flatMap((stair) => stair.flights.map((flight) => ({ stair, flight })))
    .sort(
      (a, b) =>
        Date.parse(b.flight.updatedAt) - Date.parse(a.flight.updatedAt),
    )
    .slice(0, 5);

  return (
    <div className="flex-1 px-6 py-6">
      <div className="mx-auto max-w-2xl pt-10">
        <div className="text-center text-sm text-white/58">
          Your stair assemblies
        </div>

        <div className="mt-10">
          <div className="text-sm text-white/52">Quick actions</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <QuickAction label="New stair" onClick={onAddStair} />
            <QuickAction label="Import from PowerFab" muted />
          </div>
        </div>

        {recentFlights.length > 0 && (
          <div className="mt-10">
            <div className="text-sm text-white/52">Recent flights</div>
            <div className="mt-4 space-y-2">
              {recentFlights.map(({ stair, flight }) => (
                <button
                  key={flight.id}
                  type="button"
                  onClick={() => onSelectFlight(stair, flight)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-white/72 transition hover:bg-white/[0.05] hover:text-white"
                >
                  <span className="text-white/35">◦</span>
                  <span>
                    {stair.name} / Flight {flight.order}
                    <span className="ml-2 text-white/38">
                      (edited{" "}
                      {relativeEditedLabel(flight.updatedAt)})
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FlightEditor({
  stair,
  flight,
  stairEvaluation,
  landingEvaluation,
  stairDrafts,
  landingDrafts,
  workspaceMode,
  onSetWorkspaceMode,
  onStairValueChange,
  onLandingValueChange,
  onToggleLanding,
  onExport,
  onDeleteFlight,
}: {
  stair: StairRecord;
  flight: FlightRecord;
  stairEvaluation: {
    result: EvaluateResult | null;
    error: string | null;
  } | null;
  landingEvaluation: {
    result: EvaluateResult | null;
    error: string | null;
  } | null;
  stairDrafts: Record<string, string>;
  landingDrafts: Record<string, string>;
  workspaceMode: WorkspaceMode;
  onSetWorkspaceMode: (mode: WorkspaceMode) => void;
  onStairValueChange: (
    key: string,
    value: VariableValue,
    draft?: string,
  ) => void;
  onLandingValueChange: (
    key: string,
    value: VariableValue,
    draft?: string,
  ) => void;
  onToggleLanding: () => void;
  onExport: () => void;
  onDeleteFlight: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xl font-semibold text-white">
            {stair.name}
            <span className="ml-2 text-base font-normal text-white/55">
              / Flight {flight.order}
            </span>
          </div>
          <div className="mt-2 text-sm text-white/55">
            {stair.inputMode === "averaged"
              ? "Averaged mode"
              : "Per-flight mode"}
            {stair.totalRisers
              ? ` · ${stair.totalRisers} total risers`
              : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModeButton
            active={workspaceMode === "workbench"}
            onClick={() => onSetWorkspaceMode("workbench")}
          >
            Workbench
          </ModeButton>
          <ModeButton
            active={workspaceMode === "drawing"}
            onClick={() => onSetWorkspaceMode("drawing")}
          >
            Drawing
          </ModeButton>
          <ModeButton
            active={workspaceMode === "split"}
            onClick={() => onSetWorkspaceMode("split")}
          >
            Split
          </ModeButton>
        </div>
      </div>

      {workspaceMode === "drawing" ? (
        <SimpleDrawingView />
      ) : workspaceMode === "split" ? (
        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
          <FlightForms
            flight={flight}
            stairEvaluation={stairEvaluation}
            landingEvaluation={landingEvaluation}
            stairDrafts={stairDrafts}
            landingDrafts={landingDrafts}
            onStairValueChange={onStairValueChange}
            onLandingValueChange={onLandingValueChange}
            onToggleLanding={onToggleLanding}
            onExport={onExport}
            onDeleteFlight={onDeleteFlight}
          />
          <SimpleDrawingView compact />
        </div>
      ) : (
        <FlightForms
          flight={flight}
          stairEvaluation={stairEvaluation}
          landingEvaluation={landingEvaluation}
          stairDrafts={stairDrafts}
          landingDrafts={landingDrafts}
          onStairValueChange={onStairValueChange}
          onLandingValueChange={onLandingValueChange}
          onToggleLanding={onToggleLanding}
          onExport={onExport}
          onDeleteFlight={onDeleteFlight}
        />
      )}
    </div>
  );
}

function FlightForms({
  flight,
  stairEvaluation,
  landingEvaluation,
  stairDrafts,
  landingDrafts,
  onStairValueChange,
  onLandingValueChange,
  onToggleLanding,
  onExport,
  onDeleteFlight,
}: {
  flight: FlightRecord;
  stairEvaluation: {
    result: EvaluateResult | null;
    error: string | null;
  } | null;
  landingEvaluation: {
    result: EvaluateResult | null;
    error: string | null;
  } | null;
  stairDrafts: Record<string, string>;
  landingDrafts: Record<string, string>;
  onStairValueChange: (
    key: string,
    value: VariableValue,
    draft?: string,
  ) => void;
  onLandingValueChange: (
    key: string,
    value: VariableValue,
    draft?: string,
  ) => void;
  onToggleLanding: () => void;
  onExport: () => void;
  onDeleteFlight: () => void;
}) {
  const hasLanding = flight.landingValues !== null;
  const allStairItems = stairEvaluation?.result?.items ?? [];
  const allLandingItems = landingEvaluation?.result?.items ?? [];
  const allItems = [...allStairItems, ...allLandingItems];

  return (
    <div className="space-y-6">
      {/* Stair section */}
      <div>
        <div className="text-sm font-medium text-white/72">Stair</div>
        <div className="mt-3">
          <WizardForm
            variables={stairChannel.variables}
            values={flight.stairValues}
            drafts={stairDrafts}
            onValueChange={onStairValueChange}
          />
        </div>
      </div>

      {/* Landing section */}
      <div>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-white/72">
            Landing
          </div>
          <button
            type="button"
            onClick={onToggleLanding}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              hasLanding
                ? "border-red-400/25 text-red-200/70 hover:border-red-400/50 hover:bg-red-500/10"
                : "border-cyan-300/25 text-cyan-200/70 hover:border-cyan-300/50 hover:bg-cyan-300/10"
            }`}
          >
            {hasLanding ? "Remove landing" : "+ Add landing"}
          </button>
        </div>
        {hasLanding && (
          <div className="mt-3">
            <WizardForm
              variables={landingChannel.variables}
              values={flight.landingValues!}
              drafts={landingDrafts}
              onValueChange={onLandingValueChange}
            />
          </div>
        )}
      </div>

      {/* Items preview */}
      <div>
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-white/58">
            Items (live preview)
          </div>
          <button
            type="button"
            onClick={onExport}
            disabled={allItems.length === 0}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white/68 transition hover:border-white/20 hover:bg-white/[0.05] disabled:opacity-40"
          >
            Export CSV
          </button>
        </div>

        {stairEvaluation?.error && (
          <div className="mt-4 rounded-xl border border-red-400/18 bg-red-400/10 p-4 text-sm text-red-100">
            Stair: {stairEvaluation.error}
          </div>
        )}
        {landingEvaluation?.error && (
          <div className="mt-4 rounded-xl border border-red-400/18 bg-red-400/10 p-4 text-sm text-red-100">
            Landing: {landingEvaluation.error}
          </div>
        )}

        {allItems.length > 0 && (
          <div className="mt-4">
            <ItemsTable items={allItems} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onDeleteFlight}
          className="rounded-full border border-red-400/25 px-4 py-2.5 text-sm text-red-200/80 transition hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-100"
        >
          Delete Flight
        </button>
      </div>
    </div>
  );
}

function AddStairDialog({
  nextStairNumber,
  onConfirm,
  onCancel,
}: {
  nextStairNumber: number;
  onConfirm: (config: {
    name: string;
    numFlights: number;
    mode: StairInputMode;
    totalRisers?: number;
    stairWidth: number;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(`Stair ${nextStairNumber}`);
  const [numFlights, setNumFlights] = useState(3);
  const [mode, setMode] = useState<StairInputMode>("per-flight");
  const [totalRisers, setTotalRisers] = useState(45);

  const defaultWidth = ftIn(3, 6);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[rgb(12,18,32)] p-6 shadow-2xl">
        <div className="text-lg font-semibold text-white">Add Stair</div>
        <div className="mt-1 text-sm text-white/50">
          Configure the stair and its flights
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm text-white/65">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/15"
            />
          </div>

          <div>
            <label className="block text-sm text-white/65">
              Number of flights
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={numFlights}
              onChange={(e) =>
                setNumFlights(Math.max(1, Number(e.target.value)))
              }
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/15"
            />
          </div>

          <div>
            <label className="block text-sm text-white/65">
              Input mode
            </label>
            <div className="mt-2 flex gap-4">
              <label className="flex items-center gap-2 text-sm text-white/72">
                <input
                  type="radio"
                  checked={mode === "per-flight"}
                  onChange={() => setMode("per-flight")}
                  className="accent-cyan-300"
                />
                Per-flight
              </label>
              <label className="flex items-center gap-2 text-sm text-white/72">
                <input
                  type="radio"
                  checked={mode === "averaged"}
                  onChange={() => setMode("averaged")}
                  className="accent-cyan-300"
                />
                Averaged
              </label>
            </div>
            <div className="mt-1 text-xs text-white/40">
              {mode === "averaged"
                ? "Enter total risers — they'll be distributed evenly across flights."
                : "Fill in each flight's treads and risers individually."}
            </div>
          </div>

          {mode === "averaged" && (
            <div>
              <label className="block text-sm text-white/65">
                Total risers (all flights)
              </label>
              <input
                type="number"
                min={1}
                value={totalRisers}
                onChange={(e) =>
                  setTotalRisers(Math.max(1, Number(e.target.value)))
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/15"
              />
              <div className="mt-1 text-xs text-white/40">
                ≈ {Math.floor(totalRisers / numFlights)} risers per
                flight
                {totalRisers % numFlights > 0 &&
                  ` (${totalRisers % numFlights} flights get +1)`}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-white/68 transition hover:border-white/20 hover:bg-white/[0.05]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm({
                name: name.trim() || `Stair ${nextStairNumber}`,
                numFlights,
                mode,
                totalRisers:
                  mode === "averaged" ? totalRisers : undefined,
                stairWidth: defaultWidth,
              })
            }
            className="rounded-full border border-cyan-300/35 bg-cyan-300/10 px-4 py-2.5 text-sm text-cyan-100 transition hover:bg-cyan-300/20"
          >
            Create Stair
          </button>
        </div>
      </div>
    </div>
  );
}

function SimpleDrawingView({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white/72">Drawing</div>
        <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-amber-200/85">
          Coming soon
        </span>
      </div>
      <div
        className={`mt-4 flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-slate-950/50 p-8 text-center ${
          compact ? "min-h-[380px]" : "min-h-[520px]"
        }`}
      >
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl text-white/60">
          ↥
        </div>
        <div className="text-base font-medium text-white/82">
          Drop a PDF drawing here
        </div>
        <div className="mt-2 max-w-sm text-sm leading-6 text-white/52">
          Upload the sheet for this flight, annotate it, and have the AI
          pre-fill the form from what it sees.
        </div>
        <button
          type="button"
          disabled
          className="mt-5 cursor-not-allowed rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-white/35"
        >
          Choose file
        </button>
      </div>
    </div>
  );
}

function QuickAction({
  label,
  onClick,
  muted = false,
}: {
  label: string;
  onClick?: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
        muted
          ? "border-white/10 bg-white/[0.03] text-white/48"
          : "border-white/10 bg-white/[0.03] text-white/76 hover:border-white/20 hover:bg-white/[0.06]"
      } disabled:cursor-default`}
    >
      <span>⊞</span>
      <span>{label}</span>
    </button>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.18em] transition ${
        active
          ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100"
          : "border-white/10 text-white/55 hover:border-white/20 hover:bg-white/[0.05] hover:text-white/76"
      }`}
    >
      {children}
    </button>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function distributeRisers(total: number, numFlights: number): number[] {
  const base = Math.floor(total / numFlights);
  const remainder = total - base * numFlights;
  return Array.from({ length: numFlights }, (_, i) =>
    base + (i < remainder ? 1 : 0),
  );
}

function relativeEditedLabel(iso: string): string {
  const minutes = Math.max(
    1,
    Math.round((Date.now() - Date.parse(iso)) / 60000),
  );
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr ago`;
}
