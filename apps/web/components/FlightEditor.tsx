import type { EvaluateResult, VariableValue } from "@shared/engine";
import { FlightForms } from "@/components/FlightForms";
import type { FlightRecord, StairRecord } from "@/types/project";

export function FlightEditor({
  stair,
  flight,
  stairEvaluation,
  landingEvaluation,
  stairDrafts,
  landingDrafts,
  onStairValueChange,
  onLandingValueChange,
  onToggleLanding,
  onExport,
  onDeleteFlight,
}: {
  stair: StairRecord;
  flight: FlightRecord;
  stairEvaluation: {
    result: EvaluateResult | null;
    error: string | null;
  } | null;
  landingEvaluation: {
    result: EvaluateResult | null;
    error: string | null;
  } | null;
  stairDrafts: Record<string, string>;
  landingDrafts: Record<string, string>;
  onStairValueChange: (
    key: string,
    value: VariableValue,
    draft?: string,
  ) => void;
  onLandingValueChange: (
    key: string,
    value: VariableValue,
    draft?: string,
  ) => void;
  onToggleLanding: () => void;
  onExport: () => void;
  onDeleteFlight: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xl font-semibold text-white">
            {stair.name}
            <span className="ml-2 text-base font-normal text-white/55">
              / Flight {flight.order}
            </span>
          </div>
          <div className="mt-2 text-sm text-white/55">
            {stair.inputMode === "averaged"
              ? "Averaged mode"
              : "Per-flight mode"}
            {stair.totalRisers
              ? ` · ${stair.totalRisers} total risers`
              : ""}
          </div>
        </div>
      </div>

      <FlightForms
        flight={flight}
        stairEvaluation={stairEvaluation}
        landingEvaluation={landingEvaluation}
        stairDrafts={stairDrafts}
        landingDrafts={landingDrafts}
        onStairValueChange={onStairValueChange}
        onLandingValueChange={onLandingValueChange}
        onToggleLanding={onToggleLanding}
        onExport={onExport}
        onDeleteFlight={onDeleteFlight}
      />
    </div>
  );
}
