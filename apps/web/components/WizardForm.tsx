import type { VariableDef, VariableValue } from "@shared/engine";
import { formatFeetInches } from "@shared/engine";
import { FieldCard, fieldInputClass } from "@/components/ui/FieldCard";
import { FeetInchesInput } from "@/components/ui/FeetInchesInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

interface WizardFormProps {
  variables: VariableDef[];
  values: Record<string, VariableValue>;
  onValueChange: (key: string, value: VariableValue) => void;
}

export function WizardForm({ variables, values, onValueChange }: WizardFormProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {variables
        .filter((variable) => !variable.hidden)
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((variable) => (
          <FieldRenderer
            key={variable.key}
            variable={variable}
            value={values[variable.key]}
            onValueChange={onValueChange}
          />
        ))}
    </div>
  );
}

function FieldRenderer({
  variable,
  value,
  onValueChange,
}: {
  variable: VariableDef;
  value: VariableValue;
  onValueChange: (key: string, value: VariableValue) => void;
}) {
  const description = variable.description ?? fieldDescription(variable.type);

  return (
    <FieldCard label={variable.label} description={description} badge={variable.type}>
      {variable.type === "enum" ? (
        <Select
          value={typeof value === "string" ? value : undefined}
          onValueChange={(v) => onValueChange(variable.key, v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {variable.enumOptions?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : variable.type === "integer" || variable.type === "decimal" ? (
        <input
          className={fieldInputClass}
          type="number"
          step={variable.type === "integer" ? 1 : "any"}
          value={typeof value === "number" ? value : ""}
          onChange={(event) => {
            const next = event.target.value;
            onValueChange(variable.key, next === "" ? null : Number(next));
          }}
        />
      ) : variable.type === "length" ? (
        <div className="space-y-2">
          <FeetInchesInput
            valueInches={typeof value === "number" ? value : null}
            onChange={(next) => onValueChange(variable.key, next)}
          />
          {typeof value === "number" && (
            <div className="text-xs text-white/40">
              = {safeFormat(value)}
            </div>
          )}
        </div>
      ) : (
        <input
          className={fieldInputClass}
          type="text"
          value={typeof value === "string" ? value : ""}
          placeholder={
            variable.shapeFilter?.length
              ? variable.shapeFilter.join(", ")
              : "Enter designation"
          }
          onChange={(event) => onValueChange(variable.key, event.target.value)}
        />
      )}
    </FieldCard>
  );
}

function safeFormat(value: number): string {
  try {
    return formatFeetInches(value);
  } catch {
    return `${value}"`;
  }
}

function fieldDescription(type: VariableDef["type"]): string {
  switch (type) {
    case "length":
      return "Length-aware input used by the PA engine.";
    case "dimension":
      return "AISC or supplemental designation string.";
    case "enum":
      return "Controlled choice rendered from the template.";
    case "integer":
      return "Whole-number estimator input.";
    case "decimal":
      return "Decimal estimator input.";
  }
}
