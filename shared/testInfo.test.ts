import { describe, expect, it } from "vitest";
import { getLocalizedTestInfo } from "./testInfo";

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
