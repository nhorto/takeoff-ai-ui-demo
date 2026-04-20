import type { VariableDef, VariableValue } from "@shared/engine";
import { WizardForm } from "@/components/WizardForm";

/**
 * Render the subset of a template's variables whose `group` matches.
 * Hidden variables are already filtered out by WizardForm.
 */
export function GroupedFields({
  variables,
  group,
  values,
  onChange,
}: {
  variables: VariableDef[];
  group: string;
  values: Record<string, VariableValue>;
  onChange: (key: string, value: VariableValue) => void;
}) {
  const scoped = variables.filter((v) => v.group === group);
  if (scoped.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-white/56">
        No {group} fields defined on this template.
      </div>
    );
  }
  return (
    <WizardForm
      variables={scoped}
      values={values}
      onValueChange={onChange}
    />
  );
}
