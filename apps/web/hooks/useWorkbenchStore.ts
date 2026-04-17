import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { VariableValue } from "@shared/engine";
import { loadState, makeId, saveState, defaultState } from "@/lib/storage";
import type {
  FlightRecord,
  Ladder,
  LandingAssignment,
  LandingTemplate,
  PersistedState,
  ProjectState,
  RailAssignment,
  RailTemplate,
  RailType,
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
  duplicateStair: (stairId: string) => StairRecord | null;
  addFlight: (stairId: string) => { stair: StairRecord; flight: FlightRecord } | null;
  deleteFlight: (stairId: string, flightId: string) => void;
  duplicateFlight: (
    stairId: string,
    flightId: string,
  ) => { stair: StairRecord; flight: FlightRecord } | null;
  updateFlightStairValue: (
    stairId: string,
    flightId: string,
    key: string,
    value: VariableValue,
    draft?: string,
  ) => void;

  // Landing assignment mutations (per-flight)
  updateFlightLandingValue: (
    stairId: string,
    flightId: string,
    key: string,
    value: VariableValue,
    draft?: string,
  ) => void;
  toggleLanding: (stairId: string, flightId: string) => void;
  assignLandingToFlight: (
    stairId: string,
    flightId: string,
    templateId: string,
  ) => void;
  removeLandingFromFlight: (stairId: string, flightId: string) => void;

  // Rail template CRUD + assignment
  addRailTemplate: (name: string, type: RailType) => RailTemplate;
  updateRailTemplateValue: (templateId: string, key: string, value: VariableValue) => void;
  setRailTemplateType: (templateId: string, type: RailType) => void;
  renameRailTemplate: (templateId: string, name: string) => void;
  duplicateRailTemplate: (templateId: string) => RailTemplate | null;
  deleteRailTemplate: (templateId: string) => void;
  assignRailToFlight: (
    stairId: string,
    flightId: string,
    templateId: string,
  ) => RailAssignment | null;
  updateRailAssignmentValue: (
    stairId: string,
    flightId: string,
    assignmentId: string,
    key: string,
    value: VariableValue,
  ) => void;
  removeRailFromFlight: (
    stairId: string,
    flightId: string,
    assignmentId: string,
  ) => void;

  // Landing template CRUD
  addLandingTemplate: (name: string) => LandingTemplate;
  updateLandingTemplateValue: (templateId: string, key: string, value: VariableValue) => void;
  renameLandingTemplate: (templateId: string, name: string) => void;
  duplicateLandingTemplate: (templateId: string) => LandingTemplate | null;
  deleteLandingTemplate: (templateId: string) => void;

  // Ladders (standalone — not templated, not attached)
  addLadder: (name: string) => Ladder;
  updateLadderValue: (ladderId: string, key: string, value: VariableValue) => void;
  renameLadder: (ladderId: string, name: string) => void;
  duplicateLadder: (ladderId: string) => Ladder | null;
  deleteLadder: (ladderId: string) => void;

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

function mapFlight(
  state: WorkbenchStore,
  stairId: string,
  flightId: string,
  map: (f: FlightRecord) => FlightRecord,
  now: string,
): Partial<WorkbenchStore> {
  return {
    project: {
      ...state.project,
      stairs: state.project.stairs.map((s) =>
        s.id === stairId
          ? {
              ...s,
              flights: s.flights.map((f) => (f.id === flightId ? map(f) : f)),
              updatedAt: now,
            }
          : s,
      ),
      updatedAt: now,
    },
  };
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
              landing: null,
              rails: [],
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

      duplicateStair: (stairId) => {
        const state = get();
        const source = state.project.stairs.find((s) => s.id === stairId);
        if (!source) return null;

        const now = new Date().toISOString();
        const copy: StairRecord = {
          ...source,
          id: makeId("stair"),
          name: `${source.name} (Copy)`,
          flights: source.flights.map((f) => ({
            ...f,
            id: makeId("flight"),
            stairValues: { ...f.stairValues },
            landing: f.landing
              ? {
                  id: makeId("landingassign"),
                  templateId: f.landing.templateId,
                  values: { ...f.landing.values },
                }
              : null,
            rails: f.rails.map((r) => ({
              id: makeId("railassign"),
              templateId: r.templateId,
              sourceType: r.sourceType,
              values: { ...r.values },
            })),
            createdAt: now,
            updatedAt: now,
          })),
          createdAt: now,
          updatedAt: now,
        };

        set({
          project: {
            ...state.project,
            stairs: [...state.project.stairs, copy],
            updatedAt: now,
          },
        });

        return copy;
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
          landing: null,
          rails: [],
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

      duplicateFlight: (stairId, flightId) => {
        const state = get();
        const stair = state.project.stairs.find((s) => s.id === stairId);
        const source = stair?.flights.find((f) => f.id === flightId);
        if (!stair || !source) return null;

        const now = new Date().toISOString();
        const copy: FlightRecord = {
          id: makeId("flight"),
          order: stair.flights.length + 1,
          stairValues: { ...source.stairValues },
          landing: source.landing
            ? {
                id: makeId("landingassign"),
                templateId: source.landing.templateId,
                values: { ...source.landing.values },
              }
            : null,
          rails: source.rails.map((r) => ({
            id: makeId("railassign"),
            templateId: r.templateId,
            sourceType: r.sourceType,
            values: { ...r.values },
          })),
          createdAt: now,
          updatedAt: now,
        };

        const updatedStair = {
          ...stair,
          flights: [...stair.flights, copy],
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
        });

        return { stair: updatedStair, flight: copy };
      },

      updateFlightStairValue: (stairId, flightId, key, value, draft) => {
        const now = new Date().toISOString();
        set((state) => {
          const nextState = mapFlight(
            state,
            stairId,
            flightId,
            (f) => ({
              ...f,
              stairValues: { ...f.stairValues, [key]: value },
              updatedAt: now,
            }),
            now,
          );
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
          const nextState = mapFlight(
            state,
            stairId,
            flightId,
            (f) => {
              if (!f.landing) return f;
              return {
                ...f,
                landing: {
                  ...f.landing,
                  values: { ...f.landing.values, [key]: value },
                },
                updatedAt: now,
              };
            },
            now,
          );
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
        const state = get();
        const stair = state.project.stairs.find((s) => s.id === stairId);
        const flight = stair?.flights.find((f) => f.id === flightId);
        if (!flight) return;

        if (flight.landing) {
          get().removeLandingFromFlight(stairId, flightId);
        } else {
          // Fall back to the first landing template — migration + defaultState
          // guarantee at least "Default Landing" exists.
          const template = state.project.landingTemplates[0];
          if (!template) return;
          get().assignLandingToFlight(stairId, flightId, template.id);
        }
      },

      assignLandingToFlight: (stairId, flightId, templateId) => {
        const state = get();
        const template = state.project.landingTemplates.find((t) => t.id === templateId);
        if (!template) return;
        const now = new Date().toISOString();
        const assignment: LandingAssignment = {
          id: makeId("landingassign"),
          templateId,
          values: { ...template.values },
        };
        set((s) =>
          mapFlight(
            s,
            stairId,
            flightId,
            (f) => ({ ...f, landing: assignment, updatedAt: now }),
            now,
          ),
        );
      },

      removeLandingFromFlight: (stairId, flightId) => {
        const now = new Date().toISOString();
        set((state) => {
          const next = mapFlight(
            state,
            stairId,
            flightId,
            (f) => ({ ...f, landing: null, updatedAt: now }),
            now,
          );
          const drafts = { ...state.drafts };
          delete drafts[`${flightId}-landing`];
          next.drafts = drafts;
          return next;
        });
      },

      // ── Rail templates ────────────────────────────────────────────────────

      addRailTemplate: (name, type) => {
        const now = new Date().toISOString();
        const template: RailTemplate = {
          id: makeId("rail"),
          name,
          type,
          values: {},
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          project: {
            ...state.project,
            railTemplates: [...state.project.railTemplates, template],
            updatedAt: now,
          },
        }));
        return template;
      },

      updateRailTemplateValue: (templateId, key, value) => {
        const now = new Date().toISOString();
        set((state) => ({
          project: {
            ...state.project,
            railTemplates: state.project.railTemplates.map((t) =>
              t.id === templateId
                ? { ...t, values: { ...t.values, [key]: value }, updatedAt: now }
                : t,
            ),
            updatedAt: now,
          },
        }));
      },

      setRailTemplateType: (templateId, type) => {
        const now = new Date().toISOString();
        set((state) => ({
          project: {
            ...state.project,
            railTemplates: state.project.railTemplates.map((t) =>
              t.id === templateId ? { ...t, type, values: {}, updatedAt: now } : t,
            ),
            updatedAt: now,
          },
        }));
      },

      renameRailTemplate: (templateId, name) => {
        const now = new Date().toISOString();
        set((state) => ({
          project: {
            ...state.project,
            railTemplates: state.project.railTemplates.map((t) =>
              t.id === templateId ? { ...t, name, updatedAt: now } : t,
            ),
            updatedAt: now,
          },
        }));
      },

      duplicateRailTemplate: (templateId) => {
        const state = get();
        const source = state.project.railTemplates.find((t) => t.id === templateId);
        if (!source) return null;
        const now = new Date().toISOString();
        const copy: RailTemplate = {
          ...source,
          id: makeId("rail"),
          name: `${source.name} (Copy)`,
          values: { ...source.values },
          createdAt: now,
          updatedAt: now,
        };
        set({
          project: {
            ...state.project,
            railTemplates: [...state.project.railTemplates, copy],
            updatedAt: now,
          },
        });
        return copy;
      },

      deleteRailTemplate: (templateId) => {
        const now = new Date().toISOString();
        // Detach any assignments whose template is being deleted — they lose
        // their link but keep their per-instance values as orphan copies.
        set((state) => ({
          project: {
            ...state.project,
            railTemplates: state.project.railTemplates.filter((t) => t.id !== templateId),
            stairs: state.project.stairs.map((s) => ({
              ...s,
              flights: s.flights.map((f) => ({
                ...f,
                rails: f.rails.filter((r) => r.templateId !== templateId),
              })),
            })),
            updatedAt: now,
          },
        }));
      },

      assignRailToFlight: (stairId, flightId, templateId) => {
        const state = get();
        const template = state.project.railTemplates.find((t) => t.id === templateId);
        if (!template) return null;
        const now = new Date().toISOString();
        const assignment: RailAssignment = {
          id: makeId("railassign"),
          templateId,
          sourceType: template.type,
          values: { ...template.values },
        };
        set((s) =>
          mapFlight(
            s,
            stairId,
            flightId,
            (f) => ({
              ...f,
              rails: [...f.rails, assignment],
              updatedAt: now,
            }),
            now,
          ),
        );
        return assignment;
      },

      updateRailAssignmentValue: (stairId, flightId, assignmentId, key, value) => {
        const now = new Date().toISOString();
        set((state) =>
          mapFlight(
            state,
            stairId,
            flightId,
            (f) => ({
              ...f,
              rails: f.rails.map((r) =>
                r.id === assignmentId
                  ? { ...r, values: { ...r.values, [key]: value } }
                  : r,
              ),
              updatedAt: now,
            }),
            now,
          ),
        );
      },

      removeRailFromFlight: (stairId, flightId, assignmentId) => {
        const now = new Date().toISOString();
        set((state) =>
          mapFlight(
            state,
            stairId,
            flightId,
            (f) => ({
              ...f,
              rails: f.rails.filter((r) => r.id !== assignmentId),
              updatedAt: now,
            }),
            now,
          ),
        );
      },

      // ── Landing templates ────────────────────────────────────────────────

      addLandingTemplate: (name) => {
        const now = new Date().toISOString();
        const template: LandingTemplate = {
          id: makeId("landing"),
          name,
          values: {},
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          project: {
            ...state.project,
            landingTemplates: [...state.project.landingTemplates, template],
            updatedAt: now,
          },
        }));
        return template;
      },

      updateLandingTemplateValue: (templateId, key, value) => {
        const now = new Date().toISOString();
        set((state) => ({
          project: {
            ...state.project,
            landingTemplates: state.project.landingTemplates.map((t) =>
              t.id === templateId
                ? { ...t, values: { ...t.values, [key]: value }, updatedAt: now }
                : t,
            ),
            updatedAt: now,
          },
        }));
      },

      renameLandingTemplate: (templateId, name) => {
        const now = new Date().toISOString();
        set((state) => ({
          project: {
            ...state.project,
            landingTemplates: state.project.landingTemplates.map((t) =>
              t.id === templateId ? { ...t, name, updatedAt: now } : t,
            ),
            updatedAt: now,
          },
        }));
      },

      duplicateLandingTemplate: (templateId) => {
        const state = get();
        const source = state.project.landingTemplates.find((t) => t.id === templateId);
        if (!source) return null;
        const now = new Date().toISOString();
        const copy: LandingTemplate = {
          ...source,
          id: makeId("landing"),
          name: `${source.name} (Copy)`,
          values: { ...source.values },
          createdAt: now,
          updatedAt: now,
        };
        set({
          project: {
            ...state.project,
            landingTemplates: [...state.project.landingTemplates, copy],
            updatedAt: now,
          },
        });
        return copy;
      },

      deleteLandingTemplate: (templateId) => {
        const now = new Date().toISOString();
        // Remove assignments pointing at this template — existing values on
        // those assignments are lost alongside the template.
        set((state) => ({
          project: {
            ...state.project,
            landingTemplates: state.project.landingTemplates.filter(
              (t) => t.id !== templateId,
            ),
            stairs: state.project.stairs.map((s) => ({
              ...s,
              flights: s.flights.map((f) =>
                f.landing?.templateId === templateId
                  ? { ...f, landing: null }
                  : f,
              ),
            })),
            updatedAt: now,
          },
        }));
      },

      // ── Ladders (standalone) ─────────────────────────────────────────────

      addLadder: (name) => {
        const now = new Date().toISOString();
        const ladder: Ladder = {
          id: makeId("ladder"),
          name,
          values: {},
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          project: {
            ...state.project,
            ladders: [...state.project.ladders, ladder],
            updatedAt: now,
          },
        }));
        return ladder;
      },

      updateLadderValue: (ladderId, key, value) => {
        const now = new Date().toISOString();
        set((state) => ({
          project: {
            ...state.project,
            ladders: state.project.ladders.map((l) =>
              l.id === ladderId
                ? { ...l, values: { ...l.values, [key]: value }, updatedAt: now }
                : l,
            ),
            updatedAt: now,
          },
        }));
      },

      renameLadder: (ladderId, name) => {
        const now = new Date().toISOString();
        set((state) => ({
          project: {
            ...state.project,
            ladders: state.project.ladders.map((l) =>
              l.id === ladderId ? { ...l, name, updatedAt: now } : l,
            ),
            updatedAt: now,
          },
        }));
      },

      duplicateLadder: (ladderId) => {
        const state = get();
        const source = state.project.ladders.find((l) => l.id === ladderId);
        if (!source) return null;
        const now = new Date().toISOString();
        const copy: Ladder = {
          ...source,
          id: makeId("ladder"),
          name: `${source.name} (Copy)`,
          values: { ...source.values },
          createdAt: now,
          updatedAt: now,
        };
        set({
          project: {
            ...state.project,
            ladders: [...state.project.ladders, copy],
            updatedAt: now,
          },
        });
        return copy;
      },

      deleteLadder: (ladderId) => {
        const now = new Date().toISOString();
        set((state) => ({
          project: {
            ...state.project,
            ladders: state.project.ladders.filter((l) => l.id !== ladderId),
            updatedAt: now,
          },
        }));
      },

      // ── UI ───────────────────────────────────────────────────────────────

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
