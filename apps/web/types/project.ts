import type { VariableValue } from "@shared/engine";

export interface Group {
  id: string;
  name: string;
  note: string;
  createdAt: string;
}

export interface AssemblyRecord {
  id: string;
  groupId: string;
  templateId: string;
  name: string;
  values: Record<string, VariableValue>;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectState {
  id: string;
  name: string;
  summary: string;
  groups: Group[];
  assemblies: AssemblyRecord[];
  createdAt: string;
  updatedAt: string;
}

export type WorkspaceMode = "workbench" | "drawing" | "split";

export interface OpenTab {
  id: string;
  type: "welcome" | "assembly";
  title: string;
  assemblyId?: string;
}

export interface WorkbenchUiState {
  selectedGroupId: string | null;
  selectedAssemblyId: string | null;
  openTabs: OpenTab[];
  activeTabId: string;
  aiPanelOpen: boolean;
  workspaceMode: WorkspaceMode;
}

export interface PersistedState {
  version: 1;
  project: ProjectState;
  ui: WorkbenchUiState;
  drafts: Record<string, Record<string, string>>;
}
