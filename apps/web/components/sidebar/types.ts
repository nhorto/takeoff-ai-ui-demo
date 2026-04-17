import type { FlightRecord, StairRecord } from "@/types/project";

export type OpenMode = "peek" | "newTab" | "toSide";

/**
 * Sidebar → center-pane panel-opener interface. `mode` controls dockview
 * placement: "peek" replaces the current peek tab (default single-click),
 * "newTab" always adds a persistent tab, "toSide" splits to the right of
 * the current active panel.
 */
export interface PanelOpener {
  openFlight: (stair: StairRecord, flight: FlightRecord, mode?: OpenMode) => void;
  openRailTemplate: (templateId: string, mode?: OpenMode) => void;
  openLadder: (ladderId: string, mode?: OpenMode) => void;
  openLandingTemplate: (templateId: string, mode?: OpenMode) => void;
}

export interface AddActions {
  onAddStair: () => void;
  onAddRail: () => void;
  onAddLadder: () => void;
  onAddLanding: () => void;
}
