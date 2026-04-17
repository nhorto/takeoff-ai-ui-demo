import { feet, ftIn } from "@shared/engine";
import type {
  LandingAssignment,
  LandingTemplate,
  PersistedState,
  ProjectState,
} from "@/types/project";

const STORAGE_KEY = "takeoffai-workbench-stair-v3";
const DOCKVIEW_LAYOUT_KEY = "takeoffai-dockview-layout-v1";
const LEGACY_V2_KEY = "takeoffai-workbench-stair-v2";
const LEGACY_V1_KEY = "takeoffai-workbench-stair-v1";

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now()
    .toString(36)
    .slice(-4)}`;
}

export function makeId(prefix: string): string {
  return createId(prefix);
}

export function defaultState(): PersistedState {
  const now = new Date().toISOString();
  const stairId = createId("stair");
  const flight1 = createId("flight");
  const flight2 = createId("flight");
  const flight3 = createId("flight");

  const defaultLandingTemplate: LandingTemplate = {
    id: createId("landing"),
    name: "Default Landing",
    values: {
      widthOfLanding: feet(5),
      depthOfLanding: feet(5),
    },
    createdAt: now,
    updatedAt: now,
  };

  const landingFor = (
    values: Record<string, number | string | null>,
  ): LandingAssignment => ({
    id: createId("landingassign"),
    templateId: defaultLandingTemplate.id,
    values,
  });

  return {
    version: 3,
    project: {
      id: createId("project"),
      name: "North Yard Estimating Validation",
      summary:
        "Hybrid workbench prototype with stair-centric tree navigation and flight-level editing.",
      createdAt: now,
      updatedAt: now,
      stairs: [
        {
          id: stairId,
          name: "Main Tower Stair",
          inputMode: "per-flight",
          defaultStairWidth: ftIn(3, 6),
          flights: [
            {
              id: flight1,
              order: 1,
              stairValues: {
                numTreads: 14,
                numRisers: 15,
                stairWidth: ftIn(3, 6),
              },
              landing: landingFor({
                widthOfLanding: feet(5),
                depthOfLanding: feet(5),
              }),
              rails: [],
              createdAt: now,
              updatedAt: now,
            },
            {
              id: flight2,
              order: 2,
              stairValues: {
                numTreads: 14,
                numRisers: 15,
                stairWidth: ftIn(3, 6),
              },
              landing: landingFor({
                widthOfLanding: feet(5),
                depthOfLanding: feet(5),
              }),
              rails: [],
              createdAt: now,
              updatedAt: now,
            },
            {
              id: flight3,
              order: 3,
              stairValues: {
                numTreads: 12,
                numRisers: 13,
                stairWidth: ftIn(3, 6),
              },
              landing: null,
              rails: [],
              createdAt: now,
              updatedAt: now,
            },
          ],
          createdAt: now,
          updatedAt: now,
        },
      ],
      railTemplates: [],
      landingTemplates: [defaultLandingTemplate],
      ladders: [],
    },
    ui: {
      selectedStairId: stairId,
      selectedFlightId: flight1,
      expandedStairIds: [stairId],
      expandedFlightIds: [],
      aiPanelOpen: true,
    },
    drafts: {},
  };
}

function migrateV1(raw: string): unknown | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1) return null;
    return {
      version: 2,
      project: parsed.project,
      ui: {
        selectedStairId: parsed.ui?.selectedStairId ?? null,
        selectedFlightId: parsed.ui?.selectedFlightId ?? null,
        expandedStairIds: parsed.ui?.expandedStairIds ?? [],
        expandedFlightIds: parsed.ui?.expandedFlightIds ?? [],
        aiPanelOpen: parsed.ui?.aiPanelOpen ?? true,
      },
      drafts: parsed.drafts ?? {},
    };
  } catch {
    return null;
  }
}

// v2 kept landing values inline on the flight as `landingValues` and knew
// nothing about rails, ladders, or landing templates. v3 adds a single
// "Default Landing" template for existing assignments so the template→copy
// pattern holds from day one.
function migrateV2ToV3(parsed: {
  version: number;
  project: {
    id: string;
    name: string;
    summary: string;
    stairs: Array<{
      id: string;
      name: string;
      inputMode: "averaged" | "per-flight";
      totalRisers?: number;
      defaultStairWidth?: number;
      flights: Array<{
        id: string;
        order: number;
        stairValues: Record<string, number | string | null>;
        landingValues: Record<string, number | string | null> | null;
        createdAt: string;
        updatedAt: string;
      }>;
      createdAt: string;
      updatedAt: string;
    }>;
    createdAt: string;
    updatedAt: string;
  };
  ui: {
    selectedStairId: string | null;
    selectedFlightId: string | null;
    expandedStairIds: string[];
    expandedFlightIds?: string[];
    aiPanelOpen: boolean;
  };
  drafts: Record<string, Record<string, string>>;
}): PersistedState {
  const now = new Date().toISOString();
  const defaultLandingTemplate: LandingTemplate = {
    id: createId("landing"),
    name: "Default Landing",
    values: {},
    createdAt: now,
    updatedAt: now,
  };

  const nextProject: ProjectState = {
    id: parsed.project.id,
    name: parsed.project.name,
    summary: parsed.project.summary,
    createdAt: parsed.project.createdAt,
    updatedAt: parsed.project.updatedAt,
    stairs: parsed.project.stairs.map((s) => ({
      id: s.id,
      name: s.name,
      inputMode: s.inputMode,
      totalRisers: s.totalRisers,
      defaultStairWidth: s.defaultStairWidth,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      flights: s.flights.map((f) => ({
        id: f.id,
        order: f.order,
        stairValues: f.stairValues,
        landing:
          f.landingValues === null
            ? null
            : {
                id: createId("landingassign"),
                templateId: defaultLandingTemplate.id,
                values: f.landingValues,
              },
        rails: [],
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),
    })),
    railTemplates: [],
    landingTemplates: [defaultLandingTemplate],
    ladders: [],
  };

  return {
    version: 3,
    project: nextProject,
    ui: {
      selectedStairId: parsed.ui.selectedStairId,
      selectedFlightId: parsed.ui.selectedFlightId,
      expandedStairIds: parsed.ui.expandedStairIds,
      expandedFlightIds: parsed.ui.expandedFlightIds ?? [],
      aiPanelOpen: parsed.ui.aiPanelOpen,
    },
    drafts: parsed.drafts,
  };
}

export function loadState(): PersistedState {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.version === 3) {
        if (!parsed.ui.expandedFlightIds) parsed.ui.expandedFlightIds = [];
        return parsed;
      }
    } catch {
      /* fall through */
    }
  }

  const legacyV2 = window.localStorage.getItem(LEGACY_V2_KEY);
  if (legacyV2) {
    try {
      const parsed = JSON.parse(legacyV2);
      if (parsed.version === 2) {
        const migrated = migrateV2ToV3(parsed);
        saveState(migrated);
        return migrated;
      }
    } catch {
      /* fall through */
    }
  }

  const legacyV1 = window.localStorage.getItem(LEGACY_V1_KEY);
  if (legacyV1) {
    const v2 = migrateV1(legacyV1);
    if (v2) {
      const migrated = migrateV2ToV3(v2 as Parameters<typeof migrateV2ToV3>[0]);
      saveState(migrated);
      return migrated;
    }
  }

  return defaultState();
}

export function saveState(state: PersistedState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState(): PersistedState {
  const next = defaultState();
  saveState(next);
  window.localStorage.removeItem(DOCKVIEW_LAYOUT_KEY);
  return next;
}

export function loadDockviewLayout(): object | null {
  const raw = window.localStorage.getItem(DOCKVIEW_LAYOUT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveDockviewLayout(layout: object): void {
  window.localStorage.setItem(DOCKVIEW_LAYOUT_KEY, JSON.stringify(layout));
}
