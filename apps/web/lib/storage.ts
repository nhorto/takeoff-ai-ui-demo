import { feet, inches } from "@shared/engine";
import type { PersistedState } from "@/types/project";

const STORAGE_KEY = "takeoffai-workbench-hybrid-v1";

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
  const groupA = createId("group");
  const groupB = createId("group");
  const stairAssembly = createId("assembly");
  const landingAssembly = createId("assembly");

  return {
    version: 1,
    project: {
      id: createId("project"),
      name: "North Yard Estimating Validation",
      summary:
        "Hybrid workbench prototype with grouped tree navigation, a persistent Welcome tab, and placeholder panels for future drawing review and AI assistance.",
      createdAt: now,
      updatedAt: now,
      groups: [
        {
          id: groupA,
          name: "Main Tower",
          note: "Primary tower assemblies the estimator references most often.",
          createdAt: now,
        },
        {
          id: groupB,
          name: "Roof Access",
          note: "Secondary package for ladder and rail scope around roof access.",
          createdAt: now,
        },
      ],
      assemblies: [
        {
          id: stairAssembly,
          groupId: groupA,
          templateId: "stair-channel",
          name: "Main Tower Stair 1",
          values: {
            heightBetweenLandings: feet(10),
            stairWidth: feet(4),
            stringerSize: "C12X20.7",
            riserHeight: inches(6.75),
            treadDepth: inches(11),
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: landingAssembly,
          groupId: groupA,
          templateId: "landing-channel",
          name: "Main Tower Landing 1",
          values: {
            widthOfLanding: feet(5),
            depthOfLanding: feet(5),
            frameSize: "C12X20.7",
            frontSize: "C8X11.5",
            crossMemberSize: "L3X3X1/4",
            flooring: "floor-plate",
            connectionType: "clips",
          },
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    ui: {
      selectedGroupId: groupA,
      selectedAssemblyId: stairAssembly,
      openTabs: [
        {
          id: "welcome",
          type: "welcome",
          title: "Welcome",
        },
        {
          id: `assembly-${stairAssembly}`,
          type: "assembly",
          title: "Main Tower Stair 1",
          assemblyId: stairAssembly,
        },
      ],
      activeTabId: "welcome",
      aiPanelOpen: true,
      workspaceMode: "workbench",
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
