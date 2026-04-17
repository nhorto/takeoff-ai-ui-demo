import { useMemo } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import { evaluatePA, type Item, type VariableValue } from "@shared/engine";
import {
  stairChannel,
  landingChannel,
  getTemplate,
  RAIL_TEMPLATE_BY_TYPE,
} from "@shared/pa-library";
import { FlightEditor } from "@/components/FlightEditor";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";

export function FlightPanel({
  params,
}: IDockviewPanelProps<{ stairId: string; flightId: string }>) {
  const { stairId, flightId } = params;

  const stair = useWorkbenchStore((s) =>
    s.project.stairs.find((st) => st.id === stairId),
  );
  const flight = stair?.flights.find((f) => f.id === flightId) ?? null;
  const updateStairValue = useWorkbenchStore((s) => s.updateFlightStairValue);
  const deleteFlight = useWorkbenchStore((s) => s.deleteFlight);

  const { items, errors } = useMemo(() => {
    const items: Item[] = [];
    const errors: { source: string; message: string }[] = [];
    if (!flight) return { items, errors };

    try {
      const stairResult = evaluatePA(stairChannel, flight.stairValues);
      items.push(...stairResult.items);
    } catch (error) {
      errors.push({
        source: "Stair",
        message: error instanceof Error ? error.message : "Evaluation error",
      });
    }

    if (flight.landing) {
      try {
        const landingResult = evaluatePA(landingChannel, flight.landing.values);
        items.push(...landingResult.items);
      } catch (error) {
        errors.push({
          source: "Landing",
          message: error instanceof Error ? error.message : "Evaluation error",
        });
      }
    }

    for (const rail of flight.rails) {
      const template = getTemplate(RAIL_TEMPLATE_BY_TYPE[rail.sourceType]);
      if (!template) {
        errors.push({
          source: `Rail (${rail.sourceType})`,
          message: `PA template not found`,
        });
        continue;
      }
      try {
        const railResult = evaluatePA(template, rail.values);
        items.push(...railResult.items);
      } catch (error) {
        errors.push({
          source: `Rail (${rail.sourceType})`,
          message: error instanceof Error ? error.message : "Evaluation error",
        });
      }
    }

    return { items, errors };
  }, [flight]);

  if (!stair || !flight) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/42">
        Flight not found. It may have been deleted.
      </div>
    );
  }

  const handleStairValueChange = (key: string, value: VariableValue) => {
    updateStairValue(stairId, flightId, key, value);
  };

  return (
    <FlightEditor
      stair={stair}
      flight={flight}
      items={items}
      errors={errors}
      onStairValueChange={handleStairValueChange}
      onDeleteFlight={() => {
        if (stair.flights.length <= 1) {
          window.alert("A stair must have at least one flight.");
          return;
        }
        if (
          !window.confirm(
            `Delete Flight ${flight.order} from "${stair.name}"?`,
          )
        )
          return;
        deleteFlight(stairId, flightId);
      }}
    />
  );
}
