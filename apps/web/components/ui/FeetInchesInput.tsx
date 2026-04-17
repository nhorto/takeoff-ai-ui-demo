import { useEffect, useMemo, useState } from "react";
import { formatFeetInches, parseLength } from "@shared/engine";

/**
 * Two-field feet/inches input that stores a canonical inches value.
 *
 * Users can type into either field normally. Power users can paste a full
 * expression (e.g. `4'6"`, `54in`, `1370 mm`) into either field and it will
 * be parsed into the canonical value and re-split across the two fields.
 */
export function FeetInchesInput({
  valueInches,
  onChange,
  disabled,
}: {
  valueInches: number | null;
  onChange: (nextInches: number | null) => void;
  disabled?: boolean;
}) {
  const split = useMemo(() => splitFeetInches(valueInches), [valueInches]);
  const [feetStr, setFeetStr] = useState(split.feet);
  const [inchesStr, setInchesStr] = useState(split.inches);

  // Push external value changes back into local strings unless the user is
  // mid-edit (the string already round-trips to the same canonical number).
  useEffect(() => {
    const current = combine(feetStr, inchesStr);
    if (current === valueInches) return;
    setFeetStr(split.feet);
    setInchesStr(split.inches);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueInches]);

  function commit(nextFeet: string, nextInches: string) {
    setFeetStr(nextFeet);
    setInchesStr(nextInches);
    onChange(combine(nextFeet, nextInches));
  }

  function handlePaste(raw: string, field: "feet" | "inches"): boolean {
    const trimmed = raw.trim();
    if (!trimmed) return false;
    // Only take the parse path if the input clearly has unit markers or
    // spacing — otherwise let the user type a plain number into one field.
    if (!/['"]|ft|in|mm|cm|feet|foot|inch|\s/.test(trimmed)) return false;
    try {
      const total = parseLength(trimmed);
      const next = splitFeetInches(total);
      setFeetStr(next.feet);
      setInchesStr(next.inches);
      onChange(total);
      return true;
    } catch {
      // Fall back to default handling for this field.
      if (field === "feet") setFeetStr(raw);
      else setInchesStr(raw);
      return true;
    }
  }

  return (
    <div className="grid grid-cols-2 items-stretch gap-2">
      <div className="flex items-stretch rounded-xl border border-white/10 bg-slate-950/75 focus-within:border-cyan-300/50 focus-within:ring-2 focus-within:ring-cyan-300/20">
        <input
          type="text"
          inputMode="decimal"
          disabled={disabled}
          placeholder="0"
          value={feetStr}
          onChange={(e) => commit(e.target.value, inchesStr)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (handlePaste(text, "feet")) e.preventDefault();
          }}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none"
          aria-label="Feet"
        />
        <span className="flex items-center pr-3 text-xs text-white/45">ft</span>
      </div>
      <div className="flex items-stretch rounded-xl border border-white/10 bg-slate-950/75 focus-within:border-cyan-300/50 focus-within:ring-2 focus-within:ring-cyan-300/20">
        <input
          type="text"
          inputMode="decimal"
          disabled={disabled}
          placeholder="0"
          value={inchesStr}
          onChange={(e) => commit(feetStr, e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (handlePaste(text, "inches")) e.preventDefault();
          }}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none"
          aria-label="Inches"
        />
        <span className="flex items-center pr-3 text-xs text-white/45">in</span>
      </div>
    </div>
  );
}

function splitFeetInches(value: number | null): { feet: string; inches: string } {
  if (value === null || !Number.isFinite(value)) {
    return { feet: "", inches: "" };
  }
  // Stored value is exactly zero — surface it on the inches side so the user
  // sees "0" rather than an empty field that looks unset.
  if (value === 0) return { feet: "", inches: "0" };
  const abs = Math.abs(value);
  const ft = Math.floor(abs / 12);
  const inches = abs - ft * 12;
  const signedFt = value < 0 && ft > 0 ? -ft : ft;
  const signedIn = value < 0 && ft === 0 ? -inches : inches;
  return {
    feet: signedFt === 0 ? "" : String(signedFt),
    inches: signedIn === 0 ? "" : trimDecimal(signedIn),
  };
}

function trimDecimal(n: number): string {
  if (Number.isInteger(n)) return String(n);
  // Show up to 4 decimal places but strip trailing zeros.
  return String(Number(n.toFixed(4)));
}

function combine(feetStr: string, inchesStr: string): number | null {
  const f = feetStr.trim();
  const i = inchesStr.trim();
  if (f === "" && i === "") return null;
  const ft = f === "" ? 0 : Number(f);
  const inches = i === "" ? 0 : Number(i);
  if (!Number.isFinite(ft) || !Number.isFinite(inches)) return null;
  return ft * 12 + inches;
}

// Exposed for unit consumers that want the preview display.
export function previewFeetInches(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "";
  try {
    return formatFeetInches(value);
  } catch {
    return "";
  }
}
