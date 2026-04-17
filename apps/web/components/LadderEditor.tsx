import { useMemo } from "react";
import { evaluatePA, type Item, type VariableValue } from "@shared/engine";
import { standardLadder } from "@shared/pa-library";
import { GroupedSections } from "@/components/ui/GroupedSections";
import { MaterialsPanel } from "@/components/MaterialsPanel";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";
import type { Ladder } from "@/types/project";

export function LadderEditor({ ladder }: { ladder: Ladder }) {
  const updateValue = useWorkbenchStore((s) => s.updateLadderValue);
  const rename = useWorkbenchStore((s) => s.renameLadder);

  const { items, errors } = useMemo(() => {
    const items: Item[] = [];
    const errors: { source: string; message: string }[] = [];
    try {
      const result = evaluatePA(standardLadder, ladder.values);
      items.push(...result.items);
    } catch (error) {
      errors.push({
        source: ladder.name,
        message: error instanceof Error ? error.message : "Evaluation error",
      });
    }
    return { items, errors };
  }, [ladder.values, ladder.name]);

  function handleValueChange(key: string, value: VariableValue) {
    updateValue(ladder.id, key, value);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        <div className="space-y-6 px-6 py-5">
          <header>
            <div className="text-xs uppercase tracking-[0.18em] text-white/45">
              Ladder
            </div>
            <input
              type="text"
              value={ladder.name}
              onChange={(e) => rename(ladder.id, e.target.value)}
              className="mt-1 w-full truncate bg-transparent text-xl font-semibold text-white outline-none focus:ring-0"
            />
          </header>

          <GroupedSections
            variables={standardLadder.variables}
            values={ladder.values}
            onValueChange={handleValueChange}
          />
        </div>
      </div>

      <MaterialsPanel items={items} errors={errors} />
    </div>
  );
}
