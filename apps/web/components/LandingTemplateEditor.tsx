import { useMemo } from "react";
import { evaluatePA, type Item, type VariableValue } from "@shared/engine";
import { landingChannel } from "@shared/pa-library";
import { GroupedSections } from "@/components/ui/GroupedSections";
import { MaterialsPanel } from "@/components/MaterialsPanel";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";
import type { LandingTemplate } from "@/types/project";

export function LandingTemplateEditor({
  template,
}: {
  template: LandingTemplate;
}) {
  const updateValue = useWorkbenchStore((s) => s.updateLandingTemplateValue);
  const rename = useWorkbenchStore((s) => s.renameLandingTemplate);

  const { items, errors } = useMemo(() => {
    const items: Item[] = [];
    const errors: { source: string; message: string }[] = [];
    try {
      const result = evaluatePA(landingChannel, template.values);
      items.push(...result.items);
    } catch (error) {
      errors.push({
        source: template.name,
        message: error instanceof Error ? error.message : "Evaluation error",
      });
    }
    return { items, errors };
  }, [template.values, template.name]);

  function handleValueChange(key: string, value: VariableValue) {
    updateValue(template.id, key, value);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        <div className="space-y-6 px-6 py-5">
          <header>
            <div className="text-xs uppercase tracking-[0.18em] text-white/45">
              Landing template
            </div>
            <input
              type="text"
              value={template.name}
              onChange={(e) => rename(template.id, e.target.value)}
              className="mt-1 w-full truncate bg-transparent text-xl font-semibold text-white outline-none focus:ring-0"
            />
          </header>

          <GroupedSections
            variables={landingChannel.variables}
            values={template.values}
            onValueChange={handleValueChange}
          />
        </div>
      </div>

      <MaterialsPanel items={items} errors={errors} />
    </div>
  );
}
