import { useMemo, useState } from "react";
import type { VariableValue } from "@shared/engine";
import { getTemplate, RAIL_TEMPLATE_BY_TYPE } from "@shared/pa-library";
import { WizardForm } from "@/components/WizardForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/Dialog";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";
import type { FlightRecord, RailAssignment, RailType } from "@/types/project";

const TYPE_LABEL: Record<RailType, string> = {
  picket: "Picket",
  "multi-line": "Multi-line",
  cable: "Cable",
  wall: "Wall",
  assist: "Assist",
};

export function RailTab({
  stairId,
  flight,
}: {
  stairId: string;
  flight: FlightRecord;
}) {
  const railTemplates = useWorkbenchStore((s) => s.project.railTemplates);
  const assignRail = useWorkbenchStore((s) => s.assignRailToFlight);
  const [pickerOpen, setPickerOpen] = useState(false);

  const grouped = useMemo(() => {
    const byType: Record<RailType, typeof railTemplates> = {
      picket: [],
      "multi-line": [],
      cable: [],
      wall: [],
      assist: [],
    };
    for (const t of railTemplates) byType[t.type].push(t);
    return byType;
  }, [railTemplates]);

  function handlePick(templateId: string) {
    assignRail(stairId, flight.id, templateId);
    setPickerOpen(false);
  }

  return (
    <div className="space-y-4">
      {flight.rails.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/55">
          No rails on this flight yet.
        </div>
      ) : (
        <div className="space-y-4">
          {flight.rails.map((rail) => (
            <RailAssignmentCard
              key={rail.id}
              stairId={stairId}
              flightId={flight.id}
              rail={rail}
            />
          ))}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={railTemplates.length === 0}
          className="rounded-full border border-cyan-300/25 px-4 py-2 text-sm text-cyan-200/80 transition hover:border-cyan-300/50 hover:bg-cyan-300/10 hover:text-cyan-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Add rail
        </button>
        {railTemplates.length === 0 && (
          <span className="ml-3 text-xs text-white/45">
            Create a rail template from the Rails tab in the sidebar first.
          </span>
        )}
      </div>

      <Dialog
        open={pickerOpen}
        onOpenChange={(open) => setPickerOpen(open)}
      >
        <DialogContent className="max-w-lg">
          <DialogTitle>Add rail to flight</DialogTitle>
          <DialogDescription>
            Pick a template. The flight gets an editable copy — later edits to
            the template won't change this copy.
          </DialogDescription>

          <div className="mt-5 max-h-[60vh] space-y-4 overflow-auto pr-1">
            {(Object.keys(grouped) as RailType[]).map((type) => {
              const list = grouped[type];
              if (list.length === 0) return null;
              return (
                <div key={type}>
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                    {TYPE_LABEL[type]}
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {list.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handlePick(t.id)}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-sm text-white/80 transition hover:border-cyan-300/40 hover:bg-cyan-300/5"
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RailAssignmentCard({
  stairId,
  flightId,
  rail,
}: {
  stairId: string;
  flightId: string;
  rail: RailAssignment;
}) {
  const railTemplates = useWorkbenchStore((s) => s.project.railTemplates);
  const updateValue = useWorkbenchStore((s) => s.updateRailAssignmentValue);
  const removeRail = useWorkbenchStore((s) => s.removeRailFromFlight);

  const template = railTemplates.find((t) => t.id === rail.templateId);
  const paTemplate = getTemplate(RAIL_TEMPLATE_BY_TYPE[rail.sourceType]);

  function handleValueChange(key: string, value: VariableValue) {
    updateValue(stairId, flightId, rail.id, key, value);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm">
          <div className="text-white/55">
            {TYPE_LABEL[rail.sourceType]} rail
          </div>
          <div className="truncate font-medium text-white/85">
            {template?.name ?? "(template deleted)"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => removeRail(stairId, flightId, rail.id)}
          className="shrink-0 rounded-full border border-red-400/25 px-3 py-1.5 text-xs text-red-200/80 transition hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-100"
        >
          Remove
        </button>
      </div>

      {paTemplate ? (
        <WizardForm
          variables={paTemplate.variables}
          values={rail.values}
          onValueChange={handleValueChange}
        />
      ) : (
        <div className="text-sm text-red-200/80">
          PA template for type "{rail.sourceType}" not found.
        </div>
      )}
    </div>
  );
}
