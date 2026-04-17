import type { EvaluateResult, VariableValue } from "@shared/engine";
import { stairChannel, landingChannel } from "@shared/pa-library";
import { ItemsTable } from "@/components/ItemsTable";
import { WizardForm } from "@/components/WizardForm";
import type { FlightRecord } from "@/types/project";

export function FlightForms({
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
  const hasLanding = flight.landing !== null;
  const allStairItems = stairEvaluation?.result?.items ?? [];
  const allLandingItems = landingEvaluation?.result?.items ?? [];
  const allItems = [...allStairItems, ...allLandingItems];

  return (
    <div className="space-y-6">
      {/* Stair section */}
      <div>
        <div className="text-sm font-medium text-white/72">Stair</div>
        <div className="mt-3">
          <WizardForm
            variables={stairChannel.variables}
            values={flight.stairValues}
            drafts={stairDrafts}
            onValueChange={onStairValueChange}
          />
        </div>
      </div>

      {/* Landing section */}
      <div>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-white/72">
            Landing
          </div>
          <button
            type="button"
            onClick={onToggleLanding}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              hasLanding
                ? "border-red-400/25 text-red-200/70 hover:border-red-400/50 hover:bg-red-500/10"
                : "border-cyan-300/25 text-cyan-200/70 hover:border-cyan-300/50 hover:bg-cyan-300/10"
            }`}
          >
            {hasLanding ? "Remove landing" : "+ Add landing"}
          </button>
        </div>
        {hasLanding && flight.landing && (
          <div className="mt-3">
            <WizardForm
              variables={landingChannel.variables}
              values={flight.landing.values}
              drafts={landingDrafts}
              onValueChange={onLandingValueChange}
            />
          </div>
        )}
      </div>

      {/* Items preview */}
      <div>
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-white/58">
            Items (live preview)
          </div>
          <button
            type="button"
            onClick={onExport}
            disabled={allItems.length === 0}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white/68 transition hover:border-white/20 hover:bg-white/[0.05] disabled:opacity-40"
          >
            Export CSV
          </button>
        </div>

        {stairEvaluation?.error && (
          <div className="mt-4 rounded-xl border border-red-400/18 bg-red-400/10 p-4 text-sm text-red-100">
            Stair: {stairEvaluation.error}
          </div>
        )}
        {landingEvaluation?.error && (
          <div className="mt-4 rounded-xl border border-red-400/18 bg-red-400/10 p-4 text-sm text-red-100">
            Landing: {landingEvaluation.error}
          </div>
        )}

        {allItems.length > 0 && (
          <div className="mt-4">
            <ItemsTable items={allItems} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onDeleteFlight}
          className="rounded-full border border-red-400/25 px-4 py-2.5 text-sm text-red-200/80 transition hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-100"
        >
          Delete Flight
        </button>
      </div>
    </div>
  );
}
