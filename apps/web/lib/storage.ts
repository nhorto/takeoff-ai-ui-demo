import { feet, ftIn } from "@shared/engine";
import type { PersistedState } from "@/types/project";

const STORAGE_KEY = "takeoffai-workbench-stair-v1";

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

  return {
    version: 1,
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
              landingValues: {
                widthOfLanding: feet(5),
                depthOfLanding: feet(5),
              },
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
              landingValues: {
                widthOfLanding: feet(5),
                depthOfLanding: feet(5),
              },
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
              landingValues: null,
              createdAt: now,
              updatedAt: now,
            },
          ],
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    ui: {
      selectedStairId: stairId,
      selectedFlightId: flight1,
      expandedStairIds: [stairId],
      openTabs: [
        {
          id: "welcome",
          type: "welcome",
          title: "Welcome",
        },
        {
          id: `flight-${flight1}`,
          type: "flight",
          title: "Main Tower Stair / Flight 1",
          stairId,
          flightId: flight1,
        },
      ],
      activeTabId: "welcome",
      aiPanelOpen: true,
      workspaceMode: "split",
    },
    drafts: {},
  };
}

export function loadState(): PersistedState {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();

  try {
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.version !== 1) return defaultState();
    return parsed;
  } catch {
    return defaultState();
  }
}

export function saveState(state: PersistedState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState(): PersistedState {
  const next = defaultState();
  saveState(next);
  return next;
}
