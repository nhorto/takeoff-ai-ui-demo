import { landingChannel } from "@shared/pa-library";
import type { VariableValue } from "@shared/engine";
import { WizardForm } from "@/components/WizardForm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";
import type { FlightRecord } from "@/types/project";

export function LandingTab({
  stairId,
  flight,
}: {
  stairId: string;
  flight: FlightRecord;
}) {
  const landingTemplates = useWorkbenchStore(
    (s) => s.project.landingTemplates,
  );
  const assignLandingToFlight = useWorkbenchStore(
    (s) => s.assignLandingToFlight,
  );
  const removeLandingFromFlight = useWorkbenchStore(
    (s) => s.removeLandingFromFlight,
  );
  const updateFlightLandingValue = useWorkbenchStore(
    (s) => s.updateFlightLandingValue,
  );

  function handleValueChange(key: string, value: VariableValue) {
    updateFlightLandingValue(stairId, flight.id, key, value);
  }

  if (!flight.landing) {
    if (landingTemplates.length === 0) {
      return (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/55">
          No landing templates yet. Create one from the Landings tab in the
          sidebar.
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <div className="text-sm text-white/65">
          This flight has no landing. Pick a template to add one — you'll be
          able to override any value locally without changing the template.
        </div>
        <Select
          onValueChange={(templateId) =>
            assignLandingToFlight(stairId, flight.id, templateId)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose a landing template…" />
          </SelectTrigger>
          <SelectContent>
            {landingTemplates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  const current = landingTemplates.find((t) => t.id === flight.landing!.templateId);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
        <div className="min-w-0 text-sm">
          <div className="text-white/55">Landing template</div>
          <div className="truncate font-medium text-white/85">
            {current?.name ?? "(template deleted)"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select
            value={flight.landing.templateId}
            onValueChange={(templateId) =>
              assignLandingToFlight(stairId, flight.id, templateId)
            }
          >
            <SelectTrigger className="min-w-[160px]">
              <SelectValue placeholder="Change…" />
            </SelectTrigger>
            <SelectContent>
              {landingTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => removeLandingFromFlight(stairId, flight.id)}
            className="rounded-full border border-red-400/25 px-3 py-1.5 text-xs text-red-200/80 transition hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-100"
          >
            Remove
          </button>
        </div>
      </div>

      <WizardForm
        variables={landingChannel.variables}
        values={flight.landing.values}
        onValueChange={handleValueChange}
      />
    </div>
  );
}
