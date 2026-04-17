import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { VariableValue } from "@shared/engine";
import { loadState, makeId, saveState, defaultState } from "@/lib/storage";
import type {
  FlightRecord,
  PersistedState,
  ProjectState,
  StairInputMode,
  StairRecord,
} from "@/types/project";

export interface AddStairConfig {
  name: string;
  numFlights: number;
  mode: StairInputMode;
  totalRisers?: number;
  stairWidth: number;
}

interface WorkbenchStore extends PersistedState {
  // Project mutations
  updateProject: (project: ProjectState) => void;
  addStair: (config: AddStairConfig) => { stair: StairRecord; firstFlight: FlightRecord };
  deleteStair: (stairId: string) => string[];
  renameStair: (stairId: string, name: string) => void;
  addFlight: (stairId: string) => { stair: StairRecord; flight: FlightRecord } | null;
  deleteFlight: (stairId: string, flightId: string) => void;
  updateFlightStairValue: (
    stairId: string,
    flightId: string,
    key: string,
    value: VariableValue,
    draft?: string,
  ) => void;
  updateFlightLandingValue: (
    stairId: string,
    flightId: string,
    key: string,
    value: VariableValue,
    draft?: string,
  ) => void;
  toggleLanding: (stairId: string, flightId: string) => void;

  // UI mutations
  setSelectedFlight: (stairId: string | null, flightId: string | null) => void;
  toggleExpandedStair: (stairId: string) => void;
  toggleExpandedFlight: (flightId: string) => void;
  isFlightExpanded: (flightId: string, searchActive: boolean) => boolean;
  toggleAiPanel: () => void;

  // Reset
  reset: () => void;
}

function distributeRisers(total: number, numFlights: number): number[] {
  const base = Math.floor(total / numFlights);
  const remainder = total - base * numFlights;
  return Array.from({ length: numFlights }, (_, i) =>
    base + (i < remainder ? 1 : 0),
  );
}

export const useWorkbenchStore = create<WorkbenchStore>()(
  subscribeWithSelector((set, get) => {
    const initial = loadState();

    return {
      ...initial,

      updateProject: (nextProject) =>
        set({
          project: { ...nextProject, updatedAt: new Date().toISOString() },
        }),

      addStair: (config) => {
        const now = new Date().toISOString();
        const stairId = makeId("stair");

        let risersPerFlight: number[] | null = null;
        if (config.mode === "averaged" && config.totalRisers) {
          risersPerFlight = distributeRisers(config.totalRisers, config.numFlights);
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

        set((state) => ({
          project: {
            ...state.project,
            stairs: [...state.project.stairs, newStair],
            updatedAt: now,
          },
          ui: {
            ...state.ui,
            selectedStairId: stairId,
            selectedFlightId: flights[0].id,
            expandedStairIds: [...state.ui.expandedStairIds, stairId],
          },
        }));

        return { stair: newStair, firstFlight: flights[0] };
      },

      deleteStair: (stairId) => {
        const state = get();
        const target = state.project.stairs.find((s) => s.id === stairId);
        if (!target) return [];

        const flightIds = target.flights.map((f) => f.id);
        const nextDrafts = { ...state.drafts };
        for (const fId of flightIds) {
          delete nextDrafts[`${fId}-stair`];
          delete nextDrafts[`${fId}-landing`];
        }

        set({
          project: {
            ...state.project,
            stairs: state.project.stairs.filter((s) => s.id !== stairId),
            updatedAt: new Date().toISOString(),
          },
          ui: {
            ...state.ui,
            selectedStairId:
              state.ui.selectedStairId === stairId ? null : state.ui.selectedStairId,
            selectedFlightId: flightIds.includes(state.ui.selectedFlightId ?? "")
              ? null
              : state.ui.selectedFlightId,
            expandedStairIds: state.ui.expandedStairIds.filter((id) => id !== stairId),
          },
          drafts: nextDrafts,
        });

        return flightIds;
      },

      renameStair: (stairId, name) => {
        const now = new Date().toISOString();
        set((state) => ({
          project: {
            ...state.project,
            stairs: state.project.stairs.map((s) =>
              s.id === stairId ? { ...s, name, updatedAt: now } : s,
            ),
            updatedAt: now,
          },
        }));
      },

      addFlight: (stairId) => {
        const state = get();
        const stair = state.project.stairs.find((s) => s.id === stairId);
        if (!stair) return null;

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

        const updatedStair = {
          ...stair,
          flights: [...stair.flights, newFlight],
          updatedAt: now,
        };

        set({
          project: {
            ...state.project,
            stairs: state.project.stairs.map((s) =>
              s.id === stairId ? updatedStair : s,
            ),
            updatedAt: now,
          },
          ui: {
            ...state.ui,
            selectedStairId: stairId,
            selectedFlightId: newFlight.id,
          },
        });

        return { stair: updatedStair, flight: newFlight };
      },

      deleteFlight: (stairId, flightId) => {
        const state = get();
        const stair = state.project.stairs.find((s) => s.id === stairId);
        if (!stair) return;

        const now = new Date().toISOString();
        const nextFlights = stair.flights
          .filter((f) => f.id !== flightId)
          .map((f, i) => ({ ...f, order: i + 1 }));

        const nextDrafts = { ...state.drafts };
        delete nextDrafts[`${flightId}-stair`];
        delete nextDrafts[`${flightId}-landing`];

        set({
          project: {
            ...state.project,
            stairs: state.project.stairs.map((s) =>
              s.id === stairId ? { ...s, flights: nextFlights, updatedAt: now } : s,
            ),
            updatedAt: now,
          },
          ui: {
            ...state.ui,
            selectedFlightId:
              state.ui.selectedFlightId === flightId
                ? null
                : state.ui.selectedFlightId,
          },
          drafts: nextDrafts,
        });
      },

      updateFlightStairValue: (stairId, flightId, key, value, draft) => {
        const now = new Date().toISOString();
        set((state) => {
          const nextState: Partial<WorkbenchStore> = {
            project: {
              ...state.project,
              stairs: state.project.stairs.map((s) =>
                s.id === stairId
                  ? {
                      ...s,
                      flights: s.flights.map((f) =>
                        f.id === flightId
                          ? { ...f, stairValues: { ...f.stairValues, [key]: value }, updatedAt: now }
                          : f,
                      ),
                      updatedAt: now,
                    }
                  : s,
              ),
              updatedAt: now,
            },
          };
          if (draft !== undefined) {
            nextState.drafts = {
              ...state.drafts,
              [`${flightId}-stair`]: {
                ...(state.drafts[`${flightId}-stair`] ?? {}),
                [key]: draft,
              },
            };
          }
          return nextState;
        });
      },

      updateFlightLandingValue: (stairId, flightId, key, value, draft) => {
        const now = new Date().toISOString();
        set((state) => {
          const nextState: Partial<WorkbenchStore> = {
            project: {
              ...state.project,
              stairs: state.project.stairs.map((s) =>
                s.id === stairId
                  ? {
                      ...s,
                      flights: s.flights.map((f) =>
                        f.id === flightId
                          ? {
                              ...f,
                              landingValues: { ...f.landingValues!, [key]: value },
                              updatedAt: now,
                            }
                          : f,
                      ),
                      updatedAt: now,
                    }
                  : s,
              ),
              updatedAt: now,
            },
          };
          if (draft !== undefined) {
            nextState.drafts = {
              ...state.drafts,
              [`${flightId}-landing`]: {
                ...(state.drafts[`${flightId}-landing`] ?? {}),
                [key]: draft,
              },
            };
          }
          return nextState;
        });
      },

      toggleLanding: (stairId, flightId) => {
        const now = new Date().toISOString();
        set((state) => ({
          project: {
            ...state.project,
            stairs: state.project.stairs.map((s) =>
              s.id === stairId
                ? {
                    ...s,
                    flights: s.flights.map((f) =>
                      f.id === flightId
                        ? { ...f, landingValues: f.landingValues !== null ? null : {}, updatedAt: now }
                        : f,
                    ),
                    updatedAt: now,
                  }
                : s,
            ),
            updatedAt: now,
          },
        }));
      },

      setSelectedFlight: (stairId, flightId) =>
        set((state) => ({
          ui: { ...state.ui, selectedStairId: stairId, selectedFlightId: flightId },
        })),

      toggleExpandedStair: (stairId) =>
        set((state) => ({
          ui: {
            ...state.ui,
            expandedStairIds: state.ui.expandedStairIds.includes(stairId)
              ? state.ui.expandedStairIds.filter((id) => id !== stairId)
              : [...state.ui.expandedStairIds, stairId],
          },
        })),

      toggleExpandedFlight: (flightId) =>
        set((state) => ({
          ui: {
            ...state.ui,
            expandedFlightIds: state.ui.expandedFlightIds.includes(flightId)
              ? state.ui.expandedFlightIds.filter((id) => id !== flightId)
              : [...state.ui.expandedFlightIds, flightId],
          },
        })),

      isFlightExpanded: (flightId, searchActive) => {
        if (searchActive) return true;
        return get().ui.expandedFlightIds.includes(flightId);
      },

      toggleAiPanel: () =>
        set((state) => ({
          ui: { ...state.ui, aiPanelOpen: !state.ui.aiPanelOpen },
        })),

      reset: () => {
        const fresh = defaultState();
        set({ ...fresh });
      },
    };
  }),
);

useWorkbenchStore.subscribe(
  (state) => ({ version: state.version, project: state.project, ui: state.ui, drafts: state.drafts }),
  (slice) => saveState(slice as PersistedState),
  { equalityFn: (a, b) => a === b },
);
