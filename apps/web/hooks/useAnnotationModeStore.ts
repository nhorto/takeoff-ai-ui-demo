import { create } from "zustand";

export type AnnotationTool = "pointer" | "rect" | "text";

export const ANNOTATION_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#facc15", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#f8fafc", // white
] as const;

export type AnnotationColor = (typeof ANNOTATION_COLORS)[number];

interface ModeState {
  tool: AnnotationTool;
  color: AnnotationColor;
  enabled: boolean;
}

interface AnnotationModeStore {
  modes: Record<string, ModeState>;
  getMode: (pdfId: string) => ModeState;
  setTool: (pdfId: string, tool: AnnotationTool) => void;
  setColor: (pdfId: string, color: AnnotationColor) => void;
  setEnabled: (pdfId: string, enabled: boolean) => void;
}

const DEFAULT_MODE: ModeState = {
  tool: "pointer",
  color: "#ef4444",
  enabled: false,
};

export const useAnnotationModeStore = create<AnnotationModeStore>((set, get) => ({
  modes: {},

  getMode: (pdfId) => get().modes[pdfId] ?? DEFAULT_MODE,

  setTool: (pdfId, tool) =>
    set((state) => ({
      modes: {
        ...state.modes,
        [pdfId]: { ...(state.modes[pdfId] ?? DEFAULT_MODE), tool },
      },
    })),

  setColor: (pdfId, color) =>
    set((state) => ({
      modes: {
        ...state.modes,
        [pdfId]: { ...(state.modes[pdfId] ?? DEFAULT_MODE), color },
      },
    })),

  setEnabled: (pdfId, enabled) =>
    set((state) => ({
      modes: {
        ...state.modes,
        [pdfId]: { ...(state.modes[pdfId] ?? DEFAULT_MODE), enabled },
      },
    })),
}));
