import type { FlightRecord, StairRecord } from "@/types/project";

/**
 * Sidebar → center-pane panel-opener interface. Phase 4 only wires flight
 * panels; rail/ladder/landing panel types are added in Phase 6 but the
 * interface already has them so sections can call through without a refactor.
 */
export interface PanelOpener {
  openFlight: (stair: StairRecord, flight: FlightRecord) => void;
  openRailTemplate: (templateId: string) => void;
  openLadder: (ladderId: string) => void;
  openLandingTemplate: (templateId: string) => void;
}

export interface AddActions {
  onAddStair: () => void;
  onAddRail: () => void;
  onAddLadder: () => void;
  onAddLanding: () => void;
}
