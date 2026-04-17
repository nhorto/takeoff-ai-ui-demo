import type { VariableValue } from "@shared/engine";
import { stairChannel } from "@shared/pa-library";
import { GroupedFields } from "@/components/FlightTabs/GroupedFields";

export function StringersTab({
  values,
  onChange,
}: {
  values: Record<string, VariableValue>;
  onChange: (key: string, value: VariableValue) => void;
}) {
  return (
    <GroupedFields
      variables={stairChannel.variables}
      group="stringers"
      values={values}
      onChange={onChange}
    />
  );
}
