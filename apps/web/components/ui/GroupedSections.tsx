import type { VariableDef, VariableValue } from "@shared/engine";
import { WizardForm } from "@/components/WizardForm";

/**
 * Render PA variables as stacked sections, one per distinct `group` value,
 * preserving the order in which groups first appear. Used by the rail /
 * ladder / landing template editors — single-column scrollable forms with
 * section headers, no inner tabs.
 */
export function GroupedSections({
  variables,
  values,
  onValueChange,
  sectionLabels,
}: {
  variables: VariableDef[];
  values: Record<string, VariableValue>;
  onValueChange: (key: string, value: VariableValue) => void;
  sectionLabels?: Record<string, string>;
}) {
  const groups: string[] = [];
  for (const v of variables) {
    if (v.hidden) continue;
    const g = v.group ?? "";
    if (!groups.includes(g)) groups.push(g);
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => {
        const scoped = variables.filter((v) => (v.group ?? "") === group);
        const label = group
          ? sectionLabels?.[group] ?? titleCase(group)
          : null;
        return (
          <section key={group || "_default"}>
            {label && (
              <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-white/55">
                {label}
              </div>
            )}
            <WizardForm
              variables={scoped}
              values={values}
              onValueChange={onValueChange}
            />
          </section>
        );
      })}
    </div>
  );
}

function titleCase(s: string) {
  return s.replace(/(^|[-_\s])(\w)/g, (_, pre, c) =>
    (pre ? " " : "") + c.toUpperCase(),
  );
}
