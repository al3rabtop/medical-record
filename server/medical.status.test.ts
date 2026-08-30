import { describe, expect, it } from "vitest";
import { deriveStatus } from "./medical";

describe("deriveStatus", () => {
  it("marks values inside the reference range as reassuring", () => {
    expect(deriveStatus(90, "13-150")).toBe("reassuring");
    expect(deriveStatus(13, "13-150")).toBe("reassuring");
    expect(deriveStatus(150, "13-150")).toBe("reassuring");
  });

  it("marks values outside the reference range as follow_up", () => {
    expect(deriveStatus(11.1, "12-15")).toBe("follow_up");
    expect(deriveStatus(206.6, "13-150")).toBe("follow_up");
  });

  it("supports en-dash ranges as they appear in Arabic reports", () => {
    expect(deriveStatus(2.7, "0.27–4.2")).toBe("reassuring");
    expect(deriveStatus(4.74, "0.27–4.2")).toBe("follow_up");
  });

  it("returns unavailable when the value or range is unusable", () => {
    expect(deriveStatus(null, "13-150")).toBe("unavailable");
    expect(deriveStatus(90, null)).toBe("unavailable");
    expect(deriveStatus(90, "غير مذكور")).toBe("unavailable");
  });
});

describe("deriveStatus with open-ended ranges", () => {
  it("handles upper-bound-only ranges like '< 55'", () => {
    expect(deriveStatus(9, "< 55")).toBe("reassuring");
    expect(deriveStatus(70, "< 55")).toBe("follow_up");
    expect(deriveStatus(0.196, "< 0.5")).toBe("reassuring");
  });

  it("handles lower-bound-only ranges like '> 40'", () => {
    expect(deriveStatus(50, "> 40")).toBe("reassuring");
    expect(deriveStatus(30, "> 40")).toBe("follow_up");
  });

  it("still flags out-of-range values in normal ranges from real reports", () => {
    expect(deriveStatus(52, "10 - 50")).toBe("follow_up");
    expect(deriveStatus(10.6, "7.4 - 10.4")).toBe("follow_up");
    expect(deriveStatus(73.8, "75 - 250")).toBe("follow_up");
    expect(deriveStatus(47.3, "39 - 52")).toBe("reassuring");
  });
});
