import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MetricHistoryTable } from "./MetricHistoryDialog";
import { ar } from "@/i18n/ar";
import { LocaleProvider } from "@/contexts/LocaleContext";

describe("MetricHistoryTable", () => {
  it("renders imported historical and recent measurements together", () => {
    const markup = renderToStaticMarkup(
      <LocaleProvider>
        <MetricHistoryTable
          t={ar}
          history={[
            { examDate: "2022-02-01", value: "10.1", unit: "g/dL", referenceRange: "12-15", facility: "مختبر تجريبي", status: "follow_up" },
            { examDate: "2022-04-05", value: "12.1", unit: "g/dL", referenceRange: "12-15", facility: "مختبر تجريبي", status: "reassuring" },
            { examDate: "2026-05-31", value: "11.1", unit: "g/dL", referenceRange: "12-15", facility: "مختبر تجريبي", status: "follow_up" },
          ]}
        />
      </LocaleProvider>,
    );

    expect(markup).toContain("2022-02-01");
    expect(markup).toContain("2022-04-05");
    expect(markup).toContain("2026-05-31");
    expect(markup).toContain("الأحدث");
  });

  it("shows the newest exam date first, regardless of the ascending order it receives history in", () => {
    // Regression test: history is supplied oldest-first (see server/medical.ts
    // — MetricTrendChart and MetricCard's mini history strip both rely on
    // that order), but a history TABLE must read as a chronological list
    // with the newest record on top.
    const markup = renderToStaticMarkup(
      <LocaleProvider>
        <MetricHistoryTable
          t={ar}
          history={[
            { examDate: "2026-08-31", value: "10.1", unit: "g/dL", referenceRange: "12-15", facility: null, status: "follow_up" },
            { examDate: "2026-09-02", value: "12.1", unit: "g/dL", referenceRange: "12-15", facility: null, status: "reassuring" },
          ]}
        />
      </LocaleProvider>,
    );

    const olderIndex = markup.indexOf("2026-08-31");
    const newerIndex = markup.indexOf("2026-09-02");
    const badgeIndex = markup.indexOf("الأحدث");

    expect(newerIndex).toBeGreaterThan(-1);
    expect(olderIndex).toBeGreaterThan(-1);
    // The newer date must render before (above) the older one.
    expect(newerIndex).toBeLessThan(olderIndex);
    // The "latest" badge must sit with the newer row, not the older one.
    expect(badgeIndex).toBeGreaterThan(newerIndex);
    expect(badgeIndex).toBeLessThan(olderIndex);
  });
});
