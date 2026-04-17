import type { VariableValue } from "@shared/engine";

export type StairInputMode = "averaged" | "per-flight";

export type RailType = "picket" | "multi-line" | "cable" | "wall" | "assist";

export interface RailTemplate {
  id: string;
  name: string;
  type: RailType;
  values: Record<string, VariableValue>;
  createdAt: string;
  updatedAt: string;
}

export interface RailAssignment {
  id: string;
  templateId: string;
  sourceType: RailType;
  values: Record<string, VariableValue>;
}

export interface LandingTemplate {
  id: string;
  name: string;
  values: Record<string, VariableValue>;
  createdAt: string;
  updatedAt: string;
}

export interface LandingAssignment {
  id: string;
  templateId: string;
  values: Record<string, VariableValue>;
}

export interface Ladder {
  id: string;
  name: string;
  values: Record<string, VariableValue>;
  createdAt: string;
  updatedAt: string;
}

export interface FlightRecord {
  id: string;
  order: number;
  stairValues: Record<string, VariableValue>;
  landing: LandingAssignment | null;
  rails: RailAssignment[];
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
  railTemplates: RailTemplate[];
  landingTemplates: LandingTemplate[];
  ladders: Ladder[];
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
  version: 3;
  project: ProjectState;
  ui: WorkbenchUiState;
  drafts: Record<string, Record<string, string>>;
}
