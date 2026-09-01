import { describe, expect, it } from "vitest";
import { resolveTestCodeDetailed } from "./testCanon";

const code = (label: string, abbr?: string | null) =>
  resolveTestCodeDetailed(label, abbr ?? null).code;

describe("resolveTestCode — Arabic spelling variants", () => {
  it("treats ج/غ transliteration variants of haemoglobin as the same test", () => {
    expect(code("الهيموجلوبين")).toBe("hemoglobin");
    expect(code("الهيموغلوبين")).toBe("hemoglobin");
    expect(code("الهيموجلوبين السكري")).toBe("hba1c");
    expect(code("الهيموغلوبين السكري")).toBe("hba1c");
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
