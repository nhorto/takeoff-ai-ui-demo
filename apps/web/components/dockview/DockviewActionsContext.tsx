import { createContext, useContext } from "react";
import type { OpenMode } from "@/components/dockview/DockviewWorkbench";

export interface DockviewActions {
  openFlight: (stairId: string, flightId: string, mode?: OpenMode) => void;
  openStair: (stairId: string, mode?: OpenMode) => void;
}

export const DockviewActionsContext = createContext<DockviewActions | null>(null);

export function useDockviewActions(): DockviewActions {
  const ctx = useContext(DockviewActionsContext);
  if (!ctx) {
    throw new Error("useDockviewActions must be used inside DockviewWorkbench");
  }
  return ctx;
}
