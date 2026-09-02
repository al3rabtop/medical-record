import { describe, expect, it } from "vitest";
import { classifyMedicalRecord } from "./medical";

describe("classifyMedicalRecord — a lab report must never be classified as radiology", () => {
  it("regression: a lab report whose title contains no recognised keyword is still classified as laboratory when it has stored results", () => {
    // This is the exact reported bug: a CBC report title/summary that
    // doesn't literally contain "تحاليل"/"مختبر"/"laboratory" used to fall
    // through every keyword check and land on the radiology default.
    const result = classifyMedicalRecord("نتيجة صورة الدم الكاملة", "", "", true);
    expect(result.portal).toBe("laboratory");
    expect(result.modality).toBeNull();
  });

  it("a report with stored lab results is classified as laboratory even if its text looks radiology-like", () => {
    // hasLabResults is checked first and is authoritative — the AI
    // extraction contract never populates results for a narrative
    // (radiology/pathology/physician) report, so this signal is trusted
    // over any keyword match.
    const result = classifyMedicalRecord("CT Report mentions blood count", "", "", true);
    expect(result.portal).toBe("laboratory");
  });

  it("keyword-based classification still works for genuine narrative reports with no stored results", () => {
    expect(classifyMedicalRecord("تحاليل مختبرية", "", "", false).portal).toBe("laboratory");
    expect(classifyMedicalRecord("تقرير أشعة رنين مغناطيسي", "", "", false)).toEqual({ portal: "radiology", modality: "MRI" });
    expect(classifyMedicalRecord("تقرير خزعة", "", "", false).portal).toBe("pathology");
    expect(classifyMedicalRecord("تقرير طبي - زيارة عيادة", "", "", false).portal).toBe("physician");
  });

  it("an unrecognisable narrative report with no results still falls back to radiology, unchanged from before", () => {
    // Not part of this fix's scope — only reports that actually have
    // stored lab results are protected from the fallback.
    expect(classifyMedicalRecord("تقرير غير معروف تماماً", "", "", false)).toEqual({ portal: "radiology", modality: "Other" });
  });
});
