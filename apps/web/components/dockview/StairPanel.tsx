import type { IDockviewPanelProps } from "dockview-react";
import { StairEditor } from "@/components/StairEditor";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";
import { useDockviewActions } from "@/components/dockview/DockviewActionsContext";

export function StairPanel({
  params,
}: IDockviewPanelProps<{ stairId: string }>) {
  const { stairId } = params;
  const { openFlight } = useDockviewActions();

  const stair = useWorkbenchStore((s) =>
    s.project.stairs.find((st) => st.id === stairId),
  );
  const renameStair = useWorkbenchStore((s) => s.renameStair);
  const addFlight = useWorkbenchStore((s) => s.addFlight);
  const deleteStair = useWorkbenchStore((s) => s.deleteStair);
  const deleteFlight = useWorkbenchStore((s) => s.deleteFlight);
  const duplicateFlight = useWorkbenchStore((s) => s.duplicateFlight);

  if (!stair) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-white/58">
          Stair not found. It may have been deleted.
        </div>
      </div>
    );
  }

  const handleAddFlight = () => {
    const result = addFlight(stairId);
    if (result) openFlight(stairId, result.flight.id, "newTab");
  };

  const handleDeleteStair = () => {
    if (!window.confirm(`Delete "${stair.name}" and all its flights?`)) return;
    deleteStair(stairId);
  };

  const handleDeleteFlight = (flightId: string) => {
    if (stair.flights.length <= 1) {
      window.alert("A stair must have at least one flight.");
      return;
    }
    const flight = stair.flights.find((f) => f.id === flightId);
    if (!flight) return;
    if (!window.confirm(`Delete Flight ${flight.order} from "${stair.name}"?`))
      return;
    deleteFlight(stairId, flightId);
  };

  return (
    <StairEditor
      stair={stair}
      onRenameStair={(name) => renameStair(stairId, name)}
      onAddFlight={handleAddFlight}
      onOpenFlight={(flightId, mode = "peek") =>
        openFlight(stairId, flightId, mode)
      }
      onDeleteStair={handleDeleteStair}
      onDeleteFlight={handleDeleteFlight}
      onDuplicateFlight={(flightId) => duplicateFlight(stairId, flightId)}
    />
  );
}
