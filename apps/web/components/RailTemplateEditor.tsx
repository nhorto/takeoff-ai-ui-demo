import { useMemo } from "react";
import { evaluatePA, type Item, type VariableValue } from "@shared/engine";
import { getTemplate, RAIL_TEMPLATE_BY_TYPE } from "@shared/pa-library";
import { GroupedSections } from "@/components/ui/GroupedSections";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { MaterialsPanel } from "@/components/MaterialsPanel";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";
import type { RailTemplate, RailType } from "@/types/project";

const TYPE_OPTIONS: { value: RailType; label: string }[] = [
  { value: "picket", label: "Picket" },
  { value: "multi-line", label: "Multi-line" },
  { value: "cable", label: "Cable" },
  { value: "wall", label: "Wall" },
  { value: "assist", label: "Assist" },
];

export function RailTemplateEditor({ template }: { template: RailTemplate }) {
  const updateValue = useWorkbenchStore((s) => s.updateRailTemplateValue);
  const setType = useWorkbenchStore((s) => s.setRailTemplateType);
  const rename = useWorkbenchStore((s) => s.renameRailTemplate);

  const paTemplate = getTemplate(RAIL_TEMPLATE_BY_TYPE[template.type]);

  const { items, errors } = useMemo(() => {
    const items: Item[] = [];
    const errors: { source: string; message: string }[] = [];
    if (!paTemplate) {
      errors.push({
        source: `Rail (${template.type})`,
        message: "PA template not found",
      });
      return { items, errors };
    }
    try {
      const result = evaluatePA(paTemplate, template.values);
      items.push(...result.items);
    } catch (error) {
      errors.push({
        source: template.name,
        message: error instanceof Error ? error.message : "Evaluation error",
      });
    }
    return { items, errors };
  }, [paTemplate, template.values, template.name, template.type]);

  function handleValueChange(key: string, value: VariableValue) {
    updateValue(template.id, key, value);
  }

  function handleTypeChange(next: string) {
    if (next === template.type) return;
    if (
      !window.confirm(
        "Changing the rail type will reset this template's values to defaults for the new type. Continue?",
      )
    )
      return;
    setType(template.id, next as RailType);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        <div className="space-y-6 px-6 py-5">
          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                Rail template
              </div>
              <input
                type="text"
                value={template.name}
                onChange={(e) => rename(template.id, e.target.value)}
                className="mt-1 w-full truncate bg-transparent text-xl font-semibold text-white outline-none focus:ring-0"
              />
            </div>
            <div className="shrink-0">
              <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                Type
              </div>
              <Select value={template.type} onValueChange={handleTypeChange}>
                <SelectTrigger className="mt-1 min-w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </header>

          {paTemplate ? (
            <GroupedSections
              variables={paTemplate.variables}
              values={template.values}
              onValueChange={handleValueChange}
            />
          ) : (
            <div className="rounded-xl border border-red-400/18 bg-red-400/10 p-4 text-sm text-red-100">
              PA template for type "{template.type}" not found.
            </div>
          )}
        </div>
      </div>

      <MaterialsPanel items={items} errors={errors} />
    </div>
  );
}
