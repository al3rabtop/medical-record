import type { RadiologyModality, RecordPortal } from "@shared/medical";

const dateFormatter = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { year: "numeric", month: "long", day: "numeric" });

export function formatMedicalDate(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? date : dateFormatter.format(parsed);
}

export const portalLabels: Record<RecordPortal, string> = {
  laboratory: "التحاليل",
  radiology: "الأشعة",
  physician: "تقارير الأطباء",
  pathology: "الخزعات وعلم الأمراض",
};

export const modalityLabels: Record<RadiologyModality, string> = {
  CT: "أشعة مقطعية CT",
  MRI: "رنين مغناطيسي MRI",
  "X-ray": "أشعة سينية X-ray",
  Ultrasound: "موجات فوق صوتية",
  Fluoroscopy: "تصوير تألقي",
  "Image-guided": "إجراء موجّه بالتصوير",
  Other: "أشعة أخرى",
};
