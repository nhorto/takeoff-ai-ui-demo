import type { VariableValue } from "@shared/engine";
import { stairChannel } from "@shared/pa-library";
import { GroupedFields } from "@/components/FlightTabs/GroupedFields";

export function TreadsTab({
  values,
  onChange,
}: {
  values: Record<string, VariableValue>;
  onChange: (key: string, value: VariableValue) => void;
}) {
  return (
    <GroupedFields
      variables={stairChannel.variables}
      group="treads"
      values={values}
      onChange={onChange}
    />
  );
}
