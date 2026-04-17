import type { IDockviewPanelProps } from "dockview-react";
import { WelcomeView } from "@/components/WelcomeView";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";

export function WelcomePanel({ params }: IDockviewPanelProps<{ onAddStair: () => void; onOpenFlight: (stairId: string, flightId: string) => void }>) {
  const stairs = useWorkbenchStore((s) => s.project.stairs);

  return (
    <WelcomeView
      stairs={stairs}
      onAddStair={params.onAddStair}
      onSelectFlight={(stair, flight) => params.onOpenFlight(stair.id, flight.id)}
    />
  );
}
