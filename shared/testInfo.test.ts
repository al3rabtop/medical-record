import { describe, expect, it } from "vitest";
import { getLocalizedTestInfo, getLocalizedTestName } from "./testInfo";

describe("getLocalizedTestInfo — never mixes Arabic and English in one locale", () => {
  it("Arabic mode returns Arabic prose (about/why) and never the English fields", () => {
    const info = getLocalizedTestInfo("hemoglobin", "ar");
    expect(info?.about).not.toBeNull();
    expect(info?.why).not.toBeNull();
    expect(info?.abbr).toBeNull();
    expect(info?.clinical).toBeNull();
  });

  it("English mode returns English fields (abbr/clinical) and never the Arabic prose", () => {
    const info = getLocalizedTestInfo("hemoglobin", "en");
    expect(info?.abbr).toBe("Hemoglobin (Hb)");
    expect(info?.clinical).not.toBeNull();
    expect(info?.about).toBeNull();
    expect(info?.why).toBeNull();
  });

  it("a test with no 'why'/'clinical' entry (e.g. rbc) still respects the locale split for the fields it does have", () => {
    const ar = getLocalizedTestInfo("rbc", "ar");
    const en = getLocalizedTestInfo("rbc", "en");
    expect(ar?.about).not.toBeNull();
    expect(ar?.abbr).toBeNull();
    expect(en?.abbr).not.toBeNull();
    expect(en?.about).toBeNull();
  });

  it("returns null for an unknown code rather than inventing content", () => {
    expect(getLocalizedTestInfo("not_a_real_code", "ar")).toBeNull();
    expect(getLocalizedTestInfo("not_a_real_code", "en")).toBeNull();
  });
});

describe("getLocalizedTestName — test name never depends on the upload-time UI language", () => {
  // The exact scenarios from the report-upload-language bug: the resolved
  // name always comes from the canonical code + current locale, never from
  // whatever the raw stored label happened to be.
  it("Scenario 1/2 — an English-extracted label displays localized in both locales", () => {
    expect(getLocalizedTestName("hemoglobin", "en", "Hemoglobin")).toBe("Hemoglobin");
    expect(getLocalizedTestName("hemoglobin", "ar", "Hemoglobin")).toBe("الهيموغلوبين");
  });

  it("Scenario 3/4 — an Arabic-extracted label displays localized in both locales", () => {
    expect(getLocalizedTestName("hemoglobin", "ar", "الهيموغلوبين")).toBe("الهيموغلوبين");
    expect(getLocalizedTestName("hemoglobin", "en", "الهيموغلوبين")).toBe("Hemoglobin");
  });

  it("Scenario 5 — a historical record resolves correctly on locale switch without being rewritten", () => {
    // Same raw label, both locales requested — as if the user just flipped
    // the language switch on an old, already-saved card.
    const rawLabel = "Hemoglobin";
    expect(getLocalizedTestName("hemoglobin", "ar", rawLabel)).toBe("الهيموغلوبين");
    expect(getLocalizedTestName("hemoglobin", "en", rawLabel)).toBe("Hemoglobin");
  });

  it("strips the parenthetical abbreviation for the English display name", () => {
    expect(getLocalizedTestName("wbc", "en", "WBC")).toBe("White Blood Cells");
    expect(getLocalizedTestName("tsh", "en", "TSH")).toBe("Thyroid Stimulating Hormone");
  });

  it("falls back to the raw stored label when no canonical mapping exists, rather than guessing", () => {
    // egfr has no Arabic alias in the canon table and no TEST_INFO entry's
    // abbr is relevant in Arabic mode — must preserve the original text.
    expect(getLocalizedTestName("egfr", "ar", "eGFR")).toBe("eGFR");
    // A completely unknown/fallback code must never be translated or altered.
    expect(getLocalizedTestName("some_uncatalogued_test", "ar", "Some Uncatalogued Test")).toBe(
      "Some Uncatalogued Test"
    );
    expect(getLocalizedTestName("some_uncatalogued_test", "en", "فحص غير مصنف")).toBe("فحص غير مصنف");
  });
});
