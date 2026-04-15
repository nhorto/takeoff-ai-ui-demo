/**
 * Unit helpers. Inches is the canonical internal unit.
 *
 * This is strictly an internal convention — the UI accepts and displays
 * whatever format the estimator prefers. The engine and PA templates
 * always work in inches so arithmetic is consistent.
 *
 * See docs/plans/01-pa-engine.md §5.
 */

// ─── Input helpers (to canonical inches) ────────────────────────────────────

export const inches = (n: number): number => n;

export const feet = (n: number): number => n * 12;

export const mm = (n: number): number => n / 25.4;

export const ftIn = (f: number, i: number = 0): number => f * 12 + i;

// ─── Conversion helpers (canonical inches out) ──────────────────────────────

export const toFeet = (inchesValue: number): number => inchesValue / 12;

export const toMm = (inchesValue: number): number => inchesValue * 25.4;

// ─── Display helpers ────────────────────────────────────────────────────────

/**
 * Format an inches value as feet-and-inches.
 *   formatFeetInches(54)   === `4' 6"`
 *   formatFeetInches(54.5) === `4' 6 1/2"`
 *
 * Fractional inches are rounded to the nearest `1/fractionDenominator`,
 * and the fraction is reduced. Whole numbers produce no fraction.
 * Zero inches produces just the feet part (e.g. `4'`).
 */
export function formatFeetInches(
  inchesValue: number,
  fractionDenominator: number = 16,
): string {
  if (!Number.isFinite(inchesValue)) {
    throw new RangeError(`formatFeetInches: non-finite value ${inchesValue}`);
  }

  const negative = inchesValue < 0;
  const abs = Math.abs(inchesValue);

  const totalSixteenths = Math.round(abs * fractionDenominator);
  const ft = Math.floor(totalSixteenths / (12 * fractionDenominator));
  const remainder = totalSixteenths - ft * 12 * fractionDenominator;
  const whole = Math.floor(remainder / fractionDenominator);
  const frac = remainder - whole * fractionDenominator;

  const parts: string[] = [];
  if (ft > 0) parts.push(`${ft}'`);

  if (frac === 0) {
    if (whole > 0 || ft === 0) parts.push(`${whole}"`);
  } else {
    const [num, den] = reduceFraction(frac, fractionDenominator);
    if (whole > 0) {
      parts.push(`${whole} ${num}/${den}"`);
    } else {
      parts.push(`${num}/${den}"`);
    }
  }

  const out = parts.join(" ");
  return negative ? `-${out}` : out;
}

function reduceFraction(numerator: number, denominator: number): [number, number] {
  const g = gcd(numerator, denominator);
  return [numerator / g, denominator / g];
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * Format as decimal inches: formatInches(54.5) === `54.5"`.
 */
export function formatInches(inchesValue: number, decimals: number = 2): string {
  if (!Number.isFinite(inchesValue)) {
    throw new RangeError(`formatInches: non-finite value ${inchesValue}`);
  }
  return `${Number(inchesValue.toFixed(decimals))}"`;
}

// ─── Parsing ────────────────────────────────────────────────────────────────

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

/**
 * Parse a human-entered length into canonical inches.
 *
 *   "4' 6"         → 54
 *   "4'-6\""       → 54
 *   "4' 6 1/2\""   → 54.5
 *   "54"           → 54   (bare number = inches)
 *   "54 in"        → 54
 *   "4.5 ft"       → 54
 *   "1370 mm"      → 53.937...
 *
 * Throws ParseError on unrecognized input. Strict — will grow more
 * permissive as real estimator inputs reveal edge cases.
 */
export function parseLength(input: string): number {
  if (typeof input !== "string") {
    throw new ParseError(`parseLength: expected string, got ${typeof input}`);
  }

  const s = input.trim();
  if (s.length === 0) {
    throw new ParseError("parseLength: empty input");
  }

  // Explicit unit suffixes (mm, cm, ft, in)
  const mmMatch = /^(-?\d+(?:\.\d+)?)\s*(?:mm|millimet(?:er|re)s?)$/i.exec(s);
  if (mmMatch) return Number(mmMatch[1]) / 25.4;

  const cmMatch = /^(-?\d+(?:\.\d+)?)\s*(?:cm|centimet(?:er|re)s?)$/i.exec(s);
  if (cmMatch) return (Number(cmMatch[1]) * 10) / 25.4;

  const ftMatch = /^(-?\d+(?:\.\d+)?)\s*(?:ft|feet|foot)$/i.exec(s);
  if (ftMatch) return Number(ftMatch[1]) * 12;

  const inMatch = /^(-?\d+(?:\.\d+)?)\s*(?:in|inch(?:es)?|")$/i.exec(s);
  if (inMatch) return Number(inMatch[1]);

  // Feet + inches combined, with optional fraction.
  //   4'6"   4' 6"   4'-6"   4' 6 1/2"   4'6 1/2"
  const ftInMatch =
    /^(-?\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)[\s-]*(?:(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?\s*(?:"|in|inch(?:es)?)?)?$/i.exec(
      s,
    );
  if (ftInMatch) {
    const f = Number(ftInMatch[1]);
    const whole = ftInMatch[2] !== undefined ? Number(ftInMatch[2]) : 0;
    const num = ftInMatch[3] !== undefined ? Number(ftInMatch[3]) : 0;
    const den = ftInMatch[4] !== undefined ? Number(ftInMatch[4]) : 1;
    if (den === 0) throw new ParseError(`parseLength: zero denominator in "${input}"`);
    const sign = f < 0 ? -1 : 1;
    return f * 12 + sign * (whole + num / den);
  }

  // Pure inches with a fraction: 6 1/2" or 6 1/2
  const inFracMatch = /^(-?\d+)\s+(\d+)\/(\d+)\s*(?:"|in|inch(?:es)?)?$/i.exec(s);
  if (inFracMatch) {
    const whole = Number(inFracMatch[1]);
    const num = Number(inFracMatch[2]);
    const den = Number(inFracMatch[3]);
    if (den === 0) throw new ParseError(`parseLength: zero denominator in "${input}"`);
    const sign = whole < 0 ? -1 : 1;
    return whole + sign * (num / den);
  }

  // Pure fraction: 1/2 or 1/2"
  const fracMatch = /^(-?\d+)\/(\d+)\s*(?:"|in|inch(?:es)?)?$/i.exec(s);
  if (fracMatch) {
    const num = Number(fracMatch[1]);
    const den = Number(fracMatch[2]);
    if (den === 0) throw new ParseError(`parseLength: zero denominator in "${input}"`);
    return num / den;
  }

  // Bare number = inches
  const bareMatch = /^(-?\d+(?:\.\d+)?)$/.exec(s);
  if (bareMatch) return Number(bareMatch[1]);

  throw new ParseError(`parseLength: could not parse "${input}"`);
}
