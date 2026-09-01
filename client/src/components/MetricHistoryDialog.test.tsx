import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MetricHistoryTable } from "./MetricHistoryDialog";

describe("MetricHistoryTable", () => {
  it("renders imported historical and recent measurements together", () => {
    const markup = renderToStaticMarkup(
      <MetricHistoryTable
        history={[
          { examDate: "2022-02-01", value: "10.1", unit: "g/dL", referenceRange: "12-15", facility: "مختبر تجريبي", status: "follow_up" },
          { examDate: "2022-04-05", value: "12.1", unit: "g/dL", referenceRange: "12-15", facility: "مختبر تجريبي", status: "reassuring" },
          { examDate: "2026-05-31", value: "11.1", unit: "g/dL", referenceRange: "12-15", facility: "مختبر تجريبي", status: "follow_up" },
        ]}
      />,
    );

    expect(markup).toContain("2022-02-01");
    expect(markup).toContain("2022-04-05");
    expect(markup).toContain("2026-05-31");
    expect(markup).toContain("الأحدث");
  });
});
