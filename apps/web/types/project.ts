import type { VariableValue } from "@shared/engine";

export type StairInputMode = "averaged" | "per-flight";

export interface FlightRecord {
  id: string;
  order: number;
  stairValues: Record<string, VariableValue>;
  landingValues: Record<string, VariableValue> | null;
  createdAt: string;
  updatedAt: string;
}

export interface StairRecord {
  id: string;
  name: string;
  inputMode: StairInputMode;
  totalRisers?: number;
  defaultStairWidth?: number;
  flights: FlightRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectState {
  id: string;
  name: string;
  summary: string;
  stairs: StairRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkbenchUiState {
  selectedStairId: string | null;
  selectedFlightId: string | null;
  expandedStairIds: string[];
  expandedFlightIds: string[];
  aiPanelOpen: boolean;
}

export interface PersistedState {
  version: 2;
  project: ProjectState;
  ui: WorkbenchUiState;
  drafts: Record<string, Record<string, string>>;
}
