import { describe, expect, it } from "vitest";
import { deriveTrend, interpretResultTrend, statusLabel } from "../shared/medical";
import { makeResultCards } from "./medical";

describe("medical timeline presentation", () => {
  it("describes a measurable decline without medical diagnosis", () => {
    expect(deriveTrend(11.1, 11.7)).toBe("انخفض");
  });

  it("reports unavailable trend when a comparable previous value is absent", () => {
    expect(deriveTrend(null, 2.7)).toBe("بيانات غير متوفرة");
  });

  it("uses the approved non-diagnostic Arabic status labels", () => {
    expect(statusLabel("follow_up")).toBe("يحتاج متابعة");
    expect(statusLabel("reassuring")).toBe("مطمئن");
  });

  it("keeps range-based urine readings as reported rather than calculating an average", () => {
    const cards = makeResultCards([
      { code: "urine_wbc", label: "كريات الدم البيضاء في البول", category: "البول", numericValue: null, valueText: "8–10 /HPF", unit: null, referenceRange: "غير مذكور", status: "follow_up" as const, examDate: "2026-02-22" },
      { code: "urine_wbc", label: "كريات الدم البيضاء في البول", category: "البول", numericValue: null, valueText: "6–8 /HPF", unit: null, referenceRange: "غير مذكور", status: "follow_up" as const, examDate: "2025-11-18" },
    ]);

    expect(cards[0]).toMatchObject({ value: "8–10 /HPF", trend: "بيانات غير متوفرة", lastFive: [{ value: "6–8 /HPF" }, { value: "8–10 /HPF" }] });
  });

  it("uses a calm trend explanation for a lower haemoglobin measurement", () => {
    expect(interpretResultTrend({ code: "hemoglobin", current: 11.1, previous: 11.7, currentStatus: "follow_up", previousStatus: "follow_up" }).label).toBe("يتراجع ويحتاج متابعة");
  });

  it("does not describe text-only range values as improved or worsened", () => {
    expect(interpretResultTrend({ code: "urine_wbc", current: null, previous: null, currentStatus: "follow_up", previousStatus: "follow_up" }).tone).toBe("unavailable");
  });

  it("uses unavailable rather than a fifth interpretation for an unknown direction rule", () => {
    expect(interpretResultTrend({ code: "unknown_marker", current: 7, previous: 5, currentStatus: "reassuring", previousStatus: "reassuring" }).tone).toBe("unavailable");
  });

  it("returns the most recent five values for direct display while retaining full history", () => {
    const rows = ["2026-05-31", "2026-02-22", "2025-11-18", "2025-08-23", "2025-02-18", "2024-11-18"].map((examDate, index) => ({ code: "hemoglobin", label: "الهيموغلوبين", category: "الدم", numericValue: String(11 + index / 10), valueText: String(11 + index / 10), unit: null, referenceRange: "12–15", status: "follow_up" as const, examDate }));
    const card = makeResultCards(rows)[0];
    expect(card.history).toHaveLength(6);
    expect(card.lastFive).toHaveLength(5);
    expect(card.lastFive[0]?.examDate).toBe("2025-02-18");
    expect(card.lastFive[4]?.examDate).toBe("2026-05-31");
  });
});
