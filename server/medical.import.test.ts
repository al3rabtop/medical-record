import { describe, expect, it } from "vitest";
import { getPublicMedicalDashboard } from "./medical";

describe("historical medical import", () => {
  it("includes the imported 2021–2022 visits and laboratory history in the public dashboard", async () => {
    const dashboard = await getPublicMedicalDashboard();

    expect(dashboard.visits.some((visit) => visit.visitNumber === "hist-20210607-biopsy")).toBe(true);
    expect(dashboard.visits.some((visit) => visit.visitNumber === "hist-20220405-lab")).toBe(true);
    expect(dashboard.visits.find((visit) => visit.visitNumber === "hist-20210706-ct")).toMatchObject({ portal: "radiology", modality: "CT" });
    expect(dashboard.visits.find((visit) => visit.visitNumber === "hist-20210727-mri")).toMatchObject({ portal: "radiology", modality: "MRI" });
    expect(dashboard.visits.find((visit) => visit.visitNumber === "hist-20210822-chest-xray")).toMatchObject({ portal: "radiology", modality: "X-ray" });
    expect(dashboard.visits.find((visit) => visit.visitNumber === "hist-20210615-oncology")).toMatchObject({ portal: "physician", modality: null });
    expect(dashboard.visits.find((visit) => visit.visitNumber === "hist-20210607-biopsy")).toMatchObject({ portal: "pathology" });
    expect(dashboard.portalCounts).toMatchObject({ laboratory: 9, radiology: 5, physician: 1, pathology: 2 });
    expect(dashboard.portalLatest.radiology).toMatchObject({ visitNumber: "hist-20210823-abd-xray" });
    expect(dashboard.portalLatest.physician).toMatchObject({ visitNumber: "hist-20210615-oncology" });
    expect(dashboard.visits.find((visit) => visit.visitNumber === "hist-20210615-oncology")?.facility).toBeNull();
    expect(dashboard.latestVisit).toMatchObject({ visitNumber: "1495995" });

    const hemoglobin = dashboard.cards.find((card) => card.code === "hemoglobin");
    expect(hemoglobin?.history).toEqual(expect.arrayContaining([
      expect.objectContaining({ examDate: "2022-02-01", value: "10.1" }),
      expect.objectContaining({ examDate: "2022-04-05", value: "12.1" }),
      expect.objectContaining({ examDate: "2026-05-31", value: "11.1" }),
    ]));
    expect(hemoglobin?.history.map((item) => item.examDate)).toEqual([
      "2022-02-01", "2022-03-01", "2022-04-05", "2025-02-18",
      "2025-08-23", "2025-11-18", "2026-02-22", "2026-05-31",
    ]);
    expect(hemoglobin?.lastFive.map((item) => item.examDate)).toEqual([
      "2025-02-18", "2025-08-23", "2025-11-18", "2026-02-22", "2026-05-31",
    ]);
  });
});
