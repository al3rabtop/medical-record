import { describe, expect, it } from "vitest";
import { resolveTestCodeDetailed } from "./testCanon";

const code = (label: string, abbr?: string | null, unit?: string | null) =>
  resolveTestCodeDetailed(label, abbr ?? null, unit ?? null).code;

describe("resolveTestCode — Arabic spelling variants", () => {
  it("treats ج/غ transliteration variants of haemoglobin as the same test", () => {
    expect(code("الهيموجلوبين")).toBe("hemoglobin");
    expect(code("الهيموغلوبين")).toBe("hemoglobin");
    expect(code("الهيموجلوبين السكري")).toBe("hba1c");
    expect(code("الهيموغلوبين السكري")).toBe("hba1c");
  });

  it("resolves an English-extracted label and its Arabic-extracted counterpart to the SAME canonical code, never two separate tests", () => {
    // Guards against the report-language bug creating duplicate results:
    // a report uploaded while the UI was English and one uploaded while it
    // was Arabic must land on the same trend card, not fragment into
    // "Hemoglobin" and "الهيموغلوبين" as if they were different tests.
    expect(code("Hemoglobin")).toBe(code("الهيموغلوبين"));
    expect(code("WBC")).toBe(code("كريات الدم البيضاء"));
    expect(code("Creatinine")).toBe(code("الكرياتينين"));
  });

  it("treats cholesterol and globulin spelling variants as the same test", () => {
    expect(code("الكوليسترول الكلي")).toBe("total_cholesterol");
    expect(code("الكولسترول الكلي")).toBe("total_cholesterol");
    expect(code("الجلوبيولين في المصل")).toBe("globulin");
    expect(code("الغلوبيولين في المصل")).toBe("globulin");
  });

  it("normalises hamza and ta-marbuta forms", () => {
    expect(code("الألبومين في المصل")).toBe("albumin");
    expect(code("الالبومين في المصل")).toBe("albumin");
    expect(code("الألبيومين في المصل")).toBe("albumin");
  });
});

describe("resolveTestCode — tests that must never be merged", () => {
  it("keeps ratio tests separate from the tests they mention", () => {
    expect(code("نسبة الألبومين للجلوبيولين")).toBe("albumin_globulin_ratio");
    expect(code("نسبة الألبيومين إلى الجلوبيولين")).toBe("albumin_globulin_ratio");
    expect(code("نسبة الكوليسترول إلى HDL")).toBe("cholesterol_hdl_ratio");
    expect(code("نسبة الكولسترول إلى HDL")).toBe("cholesterol_hdl_ratio");
    // The base tests themselves are unaffected.
    expect(code("الكوليسترول HDL")).toBe("hdl");
    expect(code("الألبومين في المصل")).toBe("albumin");
  });

  it("keeps urine tests separate from their blood namesakes", () => {
    expect(code("خلايا الدم الحمراء في البول")).toBe("urine_rbc");
    expect(code("خلايا الدم الحمراء")).toBe("rbc");
    expect(code("الكريات البيضاء في البول")).toBe("urine_wbc");
    expect(code("الكريات البيضاء")).toBe("wbc");
    expect(code("الجلوكوز في البول")).toBe("urine_glucose");
    expect(code("الجلوكوز (الصيام)")).toBe("glucose");
  });

  it("keeps differential percentages separate from absolute counts", () => {
    expect(code("النيتروفيل النسبة")).toBe("neutrophils_percent");
    expect(code("النيتروفيل العدد")).toBe("neutrophils_absolute");
    expect(code("العدلات")).toBe("neutrophils");

    expect(code("الحمضات النسبة المئوية")).toBe("eosinophils_percent");
    expect(code("الحمضات العدد المطلق")).toBe("eosinophils_absolute");
    expect(code("الحمضات")).toBe("eosinophils");
  });

  it("resolves '#'/'%' lab shorthand for differential counts to the correct sibling, not the bare code", () => {
    // Regression test: normalisation strips punctuation, so "EOS%"/"EOS#" and
    // bare "EOS" used to collapse to the same lookup key, and the percent
    // alias's Object.entries position silently overwrote the bare one —
    // "EOS#" (absolute count) was misresolved as eosinophils_percent, which
    // showed up as a false "changed value" between two reports using
    // different shorthand for the same underlying (correct, unchanged) test.
    expect(code("EOS")).toBe("eosinophils");
    expect(code("EOS%")).toBe("eosinophils_percent");
    expect(code("EOS#")).toBe("eosinophils_absolute");
    expect(code("Eosinophils Absolute Count")).toBe("eosinophils_absolute");

    expect(code("NEUT")).toBe("neutrophils");
    expect(code("NEUT%")).toBe("neutrophils_percent");
    expect(code("NEUT#")).toBe("neutrophils_absolute");
  });

  it("uses the reported unit to disambiguate a bare differential-count label with no %/# marker in the text", () => {
    // Real-world regression: a report prints one row "Eosinophils" with two
    // number columns (percent and absolute count), so the label text alone
    // carries no qualifier — only the unit column distinguishes them. Before
    // this fix, both resolved to the bare "eosinophils" code, so whichever
    // number landed in the database depended on extraction order: a later
    // upload of the SAME differential panel could silently replace a
    // percentage (e.g. 4.8%) with an absolute count (e.g. 0.2 x10^3/uL),
    // showing up as a false "value changed from 4.8 to 0.2" even though
    // neither real-world quantity had changed.
    expect(code("Eosinophils", null, "%")).toBe("eosinophils_percent");
    expect(code("Eosinophils", null, "10^3/uL")).toBe("eosinophils_absolute");
    expect(code("Eosinophils", null, "x10^9/L")).toBe("eosinophils_absolute");
    expect(code("Eosinophils", null, "cells/uL")).toBe("eosinophils_absolute");
    expect(code("Eosinophils", null, "K/uL")).toBe("eosinophils_absolute");
    // No unit at all still resolves to the bare code, unchanged.
    expect(code("Eosinophils", null, null)).toBe("eosinophils");
    // A unit that isn't a %/absolute-count marker (e.g. hematocrit's own "%")
    // must not be redirected for tests with no percent/absolute sibling.
    expect(code("Hematocrit", null, "%")).toBe("hematocrit");
  });

  it("keeps MCH/MCHC separate from plain haemoglobin", () => {
    expect(code("متوسط محتوى الهيموغلوبين")).toBe("mch");
    expect(code("متوسط تركيز الهيموغلوبين")).toBe("mchc");
    expect(code("الهيموغلوبين")).toBe("hemoglobin");
  });
});

describe("resolveTestCode — label wins over a contradictory abbreviation", () => {
  it("resolves ALT/AST from the label even when the stored abbr is swapped", () => {
    // Production rows carry a swapped abbr from the original extraction.
    const aspartate = resolveTestCodeDetailed("إنزيم ناقل أمين الأسبارتات", "ALT");
    const alanine = resolveTestCodeDetailed("إنزيم ناقل أمين الألانين", "AST");

    expect(aspartate.code).toBe("ast");
    expect(alanine.code).toBe("alt");
    expect(aspartate.conflict).toEqual({ fromLabel: "ast", fromAbbr: "alt" });
    expect(alanine.conflict).toEqual({ fromLabel: "alt", fromAbbr: "ast" });
  });

  it("still uses the abbreviation when the label alone is unrecognised", () => {
    expect(code("فحص غير معروف تماماً", "TSH")).toBe("tsh");
  });
});

describe("resolveTestCode — unknown tests", () => {
  it("reports no match rather than inventing one", () => {
    const r = resolveTestCodeDetailed("فحص غريب جداً غير معروف XYZ", null);
    expect(r.matched).toBe(false);
  });
});
