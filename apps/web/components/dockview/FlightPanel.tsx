import { useMemo } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import { evaluatePA, type VariableValue } from "@shared/engine";
import { stairChannel, landingChannel } from "@shared/pa-library";
import { FlightForms } from "@/components/FlightForms";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";

export function FlightPanel({
  params,
}: IDockviewPanelProps<{ stairId: string; flightId: string }>) {
  const { stairId, flightId } = params;

  const stair = useWorkbenchStore((s) =>
    s.project.stairs.find((st) => st.id === stairId),
  );
  const flight = stair?.flights.find((f) => f.id === flightId) ?? null;
  const stairDrafts = useWorkbenchStore(
    (s) => s.drafts[`${flightId}-stair`] ?? {},
  );
  const landingDrafts = useWorkbenchStore(
    (s) => s.drafts[`${flightId}-landing`] ?? {},
  );
  const updateStairValue = useWorkbenchStore((s) => s.updateFlightStairValue);
  const updateLandingValue = useWorkbenchStore((s) => s.updateFlightLandingValue);
  const toggleLanding = useWorkbenchStore((s) => s.toggleLanding);
  const deleteFlight = useWorkbenchStore((s) => s.deleteFlight);

  const stairEvaluation = useMemo(() => {
    if (!flight) return null;
    try {
      const result = evaluatePA(stairChannel, flight.stairValues);
      return { result, error: null };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : "Evaluation error",
      };
    }
  }, [flight]);

  const landingEvaluation = useMemo(() => {
    if (!flight?.landing) return null;
    try {
      const result = evaluatePA(landingChannel, flight.landing.values);
      return { result, error: null };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : "Evaluation error",
      };
    }
  }, [flight]);

  if (!stair || !flight) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/42">
        Flight not found. It may have been deleted.
      </div>
    );
  }

  const handleStairValueChange = (key: string, value: VariableValue, draft?: string) => {
    updateStairValue(stairId, flightId, key, value, draft);
  };

  const handleLandingValueChange = (key: string, value: VariableValue, draft?: string) => {
    updateLandingValue(stairId, flightId, key, value, draft);
  };

  return (
    <div className="h-full overflow-auto px-6 py-5">
      <div className="space-y-5">
        <div>
          <div className="text-xl font-semibold text-white">
            {stair.name}
            <span className="ml-2 text-base font-normal text-white/55">
              / Flight {flight.order}
            </span>
          </div>
          <div className="mt-2 text-sm text-white/55">
            {stair.inputMode === "averaged" ? "Averaged mode" : "Per-flight mode"}
            {stair.totalRisers ? ` · ${stair.totalRisers} total risers` : ""}
          </div>
        </div>

        <FlightForms
          flight={flight}
          stairEvaluation={stairEvaluation}
          landingEvaluation={landingEvaluation}
          stairDrafts={stairDrafts}
          landingDrafts={landingDrafts}
          onStairValueChange={handleStairValueChange}
          onLandingValueChange={handleLandingValueChange}
          onToggleLanding={() => toggleLanding(stairId, flightId)}
          onExport={() => {}}
          onDeleteFlight={() => {
            if (stair.flights.length <= 1) {
              window.alert("A stair must have at least one flight.");
              return;
            }
            if (!window.confirm(`Delete Flight ${flight.order} from "${stair.name}"?`)) return;
            deleteFlight(stairId, flightId);
          }}
        />
      </div>
    </div>
  );
}
