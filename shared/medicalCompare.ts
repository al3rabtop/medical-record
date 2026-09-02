/**
 * Pure comparison logic for the smart report-update pipeline. Kept separate
 * from server/medical.ts (which owns DB access) so the actual decision
 * rules — what counts as "the same value", what counts as "the same test" —
 * can be unit tested directly, without a database.
 */
import { resolveTestCode } from "./testCanon";

const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/**
 * Parses a lab value as a number, tolerating Arabic-Indic digits and
 * thousands separators. Returns null for anything that is not purely
 * numeric (e.g. "Negative", "0-1", "<5") — those are compared as text
 * instead, never coerced into a number.
 */
export function parseNumericValue(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC_DIGITS.indexOf(d)))
    .replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalizes non-numeric text for comparison: case, dash-variant characters
 * (en dash / em dash / non-breaking hyphen), and whitespace around a dash —
 * so "0 - 1", "0–1", and "0-1" compare equal, and "Negative"/"NEGATIVE"
 * compare equal. Never used on values that parsed as numeric.
 */
export function normalizeTextValue(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[‐-―−]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ");
}

/**
 * True when two reported values represent the same result. Numeric values
 * are compared as numbers (a tiny epsilon absorbs floating-point noise
 * only — 4.8 and 0.2 are never "close enough"). If exactly one side parses
 * as numeric and the other does not, they are different values — a numeric
 * reading must never be treated as equal to a non-numeric one. Otherwise
 * both sides are compared as normalized text.
 */
export function valuesAreEqual(oldValue: string, newValue: string): boolean {
  const oldNum = parseNumericValue(oldValue);
  const newNum = parseNumericValue(newValue);

  if (oldNum !== null && newNum !== null) {
    return Math.abs(oldNum - newNum) < 1e-9;
  }
  if (oldNum !== null || newNum !== null) return false;

  return normalizeTextValue(oldValue) === normalizeTextValue(newValue);
}

export type ExistingResult = { code: string; label: string; valueText: string };
export type IncomingResult = { label: string; abbr?: string | null; value: string; unit?: string | null };

export type NewTest = { label: string; value: string; unit: string | null };
export type ChangedTest = { code: string; label: string; oldValue: string; newValue: string; unit: string | null };

export type ResultComparison = {
  newTests: NewTest[];
  changedTests: ChangedTest[];
  /** Labels that matched an existing test with an equal value — nothing to do. */
  identicalLabels: string[];
};

/**
 * Compares an incoming report's results against what is already stored for
 * one visit, matched by canonical test code (never by raw label text, and
 * never by table position) so a test is recognized as "the same test"
 * regardless of which lab wrote which spelling/abbreviation for it.
 */
export function compareResults(existing: ExistingResult[], incoming: IncomingResult[]): ResultComparison {
  const byCode = new Map(existing.map((e) => [e.code, e]));

  const newTests: NewTest[] = [];
  const changedTests: ChangedTest[] = [];
  const identicalLabels: string[] = [];

  for (const r of incoming) {
    const code = resolveTestCode(r.label, r.abbr ?? null, r.unit ?? null);
    const prior = byCode.get(code);

    if (!prior) {
      newTests.push({ label: r.label, value: r.value, unit: r.unit ?? null });
    } else if (valuesAreEqual(prior.valueText, r.value)) {
      identicalLabels.push(r.label);
    } else {
      changedTests.push({ code, label: r.label, oldValue: prior.valueText, newValue: r.value, unit: r.unit ?? null });
    }
  }

  return { newTests, changedTests, identicalLabels };
}
