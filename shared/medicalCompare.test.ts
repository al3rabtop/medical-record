import { describe, expect, it } from "vitest";
import { compareResults, normalizeTextValue, parseNumericValue, valuesAreEqual } from "./medicalCompare";

describe("parseNumericValue", () => {
  it("parses plain and Arabic-Indic numbers", () => {
    expect(parseNumericValue("4.8")).toBe(4.8);
    expect(parseNumericValue("٤.٨")).toBe(4.8);
    expect(parseNumericValue("1,234")).toBe(1234);
  });

  it("returns null for non-numeric text instead of guessing", () => {
    expect(parseNumericValue("Negative")).toBeNull();
    expect(parseNumericValue("0 - 1")).toBeNull();
    expect(parseNumericValue("<5")).toBeNull();
  });
});

describe("normalizeTextValue", () => {
  it("collapses case, dash variants, and surrounding whitespace", () => {
    expect(normalizeTextValue("Negative")).toBe(normalizeTextValue("NEGATIVE"));
    expect(normalizeTextValue("negative")).toBe(normalizeTextValue("NEGATIVE"));
    expect(normalizeTextValue("0 - 1")).toBe(normalizeTextValue("0–1"));
    expect(normalizeTextValue("0-1")).toBe(normalizeTextValue("0 – 1"));
  });
});

describe("valuesAreEqual — the four previously observed false changes", () => {
  it("4.8 vs 0.2 are genuinely different (never fuzzy-matched)", () => {
    expect(valuesAreEqual("4.8", "0.2")).toBe(false);
  });

  it("11.5 vs 34.3 are genuinely different", () => {
    expect(valuesAreEqual("11.5", "34.3")).toBe(false);
  });

  it("3.92 vs 13.5 are genuinely different", () => {
    expect(valuesAreEqual("3.92", "13.5")).toBe(false);
  });

  it("'Negative' vs '0 - 1' are genuinely different (a numeric reading is never equal to a non-numeric one)", () => {
    expect(valuesAreEqual("Negative", "0 - 1")).toBe(false);
  });

  it("does not confuse formatting differences with real changes", () => {
    expect(valuesAreEqual("Negative", "negative")).toBe(true);
    expect(valuesAreEqual("Negative", "NEGATIVE")).toBe(true);
    expect(valuesAreEqual("0 - 1", "0–1")).toBe(true);
    expect(valuesAreEqual("4.80", "4.8")).toBe(true);
  });
});

describe("compareResults — Case A/B/C/D from the smart-update spec", () => {
  const existing = [
    { code: "hemoglobin", label: "Hemoglobin", valueText: "13.2" },
    { code: "wbc", label: "WBC", valueText: "6.5" },
  ];

  it("Case: identical report produces zero new/changed tests", () => {
    const result = compareResults(existing, [
      { label: "Hemoglobin", value: "13.2" },
      { label: "WBC", value: "6.5" },
    ]);
    expect(result.newTests).toHaveLength(0);
    expect(result.changedTests).toHaveLength(0);
    expect(result.identicalLabels).toEqual(["Hemoglobin", "WBC"]);
  });

  it("Case B: same visit + genuinely new tests", () => {
    const result = compareResults(existing, [
      { label: "Hemoglobin", value: "13.2" },
      { label: "Platelets", value: "250" },
    ]);
    expect(result.newTests).toEqual([{ label: "Platelets", value: "250", unit: null }]);
    expect(result.changedTests).toHaveLength(0);
  });

  it("Case C: same visit + an updated value never overwrites silently — old and new are both surfaced", () => {
    const result = compareResults(existing, [{ label: "Hemoglobin", value: "14.9" }]);
    expect(result.changedTests).toEqual([
      { code: "hemoglobin", label: "Hemoglobin", oldValue: "13.2", newValue: "14.9", unit: null },
    ]);
  });

  it("Case D: new tests and changed values coexist and are reported separately", () => {
    const result = compareResults(existing, [
      { label: "Hemoglobin", value: "14.9" }, // changed
      { label: "WBC", value: "6.5" }, // identical
      { label: "Platelets", value: "250" }, // new
      { label: "Ferritin", value: "45" }, // new
    ]);
    expect(result.newTests.map((t) => t.label)).toEqual(["Platelets", "Ferritin"]);
    expect(result.changedTests).toEqual([
      { code: "hemoglobin", label: "Hemoglobin", oldValue: "13.2", newValue: "14.9", unit: null },
    ]);
    expect(result.identicalLabels).toEqual(["WBC"]);
  });

  it("matches by canonical code, not raw label text, across labs with different naming", () => {
    const result = compareResults(existing, [{ label: "الهيموغلوبين", value: "14.9" }]);
    expect(result.changedTests).toEqual([
      { code: "hemoglobin", label: "الهيموغلوبين", oldValue: "13.2", newValue: "14.9", unit: null },
    ]);
  });

  it("does not confuse a differential percent reading with its absolute-count sibling (the eosinophils regression)", () => {
    const priorEos = [{ code: "eosinophils", label: "Eosinophils", valueText: "4.8" }];
    // A later report using "#" shorthand for the ABSOLUTE count is a
    // different test entirely — it must show up as a new test, not as
    // eosinophils "changing" from 4.8 to 0.2.
    const result = compareResults(priorEos, [{ label: "EOS#", value: "0.2" }]);
    expect(result.newTests).toEqual([{ label: "EOS#", value: "0.2", unit: null }]);
    expect(result.changedTests).toHaveLength(0);
  });
});
