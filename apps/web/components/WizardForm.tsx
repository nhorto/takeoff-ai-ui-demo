import type { VariableDef, VariableValue } from "@shared/engine";
import { formatFeetInches, parseLength } from "@shared/engine";

interface WizardFormProps {
  variables: VariableDef[];
  values: Record<string, VariableValue>;
  drafts: Record<string, string>;
  onValueChange: (key: string, value: VariableValue, draft?: string) => void;
}

export function WizardForm({
  variables,
  values,
  drafts,
  onValueChange,
}: WizardFormProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {variables
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((variable) => (
          <FieldCard
            key={variable.key}
            variable={variable}
            value={values[variable.key]}
            draft={drafts[variable.key]}
            onValueChange={onValueChange}
          />
        ))}
    </div>
  );
}

interface FieldCardProps {
  variable: VariableDef;
  value: VariableValue;
  draft?: string;
  onValueChange: (key: string, value: VariableValue, draft?: string) => void;
}

function FieldCard({ variable, value, draft, onValueChange }: FieldCardProps) {
  const common =
    "mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20";

  return (
    <label className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-white">{variable.label}</div>
          <p className="mt-2 text-sm leading-6 text-white/55">
            {variable.description ?? fieldDescription(variable.type)}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
          {variable.type}
        </span>
      </div>

      {variable.type === "enum" ? (
        <select
          className={common}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onValueChange(variable.key, event.target.value)}
        >
          {variable.enumOptions?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : variable.type === "integer" || variable.type === "decimal" ? (
        <input
          className={common}
          type="number"
          step={variable.type === "integer" ? 1 : "any"}
          value={typeof value === "number" ? value : ""}
          onChange={(event) => {
            const next = event.target.value;
            onValueChange(
              variable.key,
              next === "" ? null : Number(next),
            );
          }}
        />
      ) : variable.type === "length" ? (
        <>
          <input
            className={common}
            type="text"
            value={draft ?? (typeof value === "number" ? formatFeetInches(value) : "")}
            placeholder={`Try 4' 6" or 54 in`}
            onChange={(event) => {
              const next = event.target.value;
              try {
                onValueChange(variable.key, parseLength(next), next);
              } catch {
                onValueChange(variable.key, value ?? null, next);
              }
            }}
          />
          <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-white/42">
            Stored internally in inches. The workbench accepts feet/inches, decimal
            feet, or millimeters.
          </div>
        </>
      ) : (
        <input
          className={common}
          type="text"
          value={typeof value === "string" ? value : ""}
          placeholder={variable.shapeFilter?.length ? variable.shapeFilter.join(", ") : "Enter designation"}
          onChange={(event) => onValueChange(variable.key, event.target.value)}
        />
      )}
    </label>
  );
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
