export type MedicalStatus = "reassuring" | "follow_up" | "unavailable";
export type Trend = "ارتفع" | "انخفض" | "مستقر" | "بيانات غير متوفرة";
export type TrendInterpretation = {
  tone: "improving" | "worsening" | "stable" | "unavailable";
  label: string;
  detail: string;
};

export type RecordPortal = "laboratory" | "radiology" | "physician" | "pathology";
export type RadiologyModality = "CT" | "MRI" | "X-ray" | "Ultrasound" | "Fluoroscopy" | "Image-guided" | "Other";

export function classifyMedicalRecord(reportType: string, summary = "", department = ""): { portal: RecordPortal; modality: RadiologyModality | null } {
  const heading = reportType.toLowerCase();
  const text = `${reportType} ${summary} ${department}`.toLowerCase();

  if (text.includes("علم الأمراض") || text.includes("خزعة") || text.includes("pathology") || text.includes("biopsy")) {
    return { portal: "pathology", modality: text.includes("موجه") || text.includes("guided") ? "Image-guided" : null };
  }
  if (text.includes("تحاليل") || text.includes("مختبر") || text.includes("laboratory")) return { portal: "laboratory", modality: null };
  if (text.includes("تقرير طبي") || text.includes("زيارة") || text.includes("طبيب") || text.includes("oncology")) return { portal: "physician", modality: null };
  if (heading.includes("mri") || heading.includes("رنين")) return { portal: "radiology", modality: "MRI" };
  if (heading.includes("ct") || heading.includes("مقطعي")) return { portal: "radiology", modality: "CT" };
  if (heading.includes("fluoroscopy") || heading.includes("تألق") || heading.includes("الجهاز الهضمي")) return { portal: "radiology", modality: "Fluoroscopy" };
  if (heading.includes("ultrasound") || heading.includes("موجات فوق")) return { portal: "radiology", modality: "Ultrasound" };
  if (heading.includes("x-ray") || heading.includes("xray") || heading.includes("أشعة الصدر") || heading.includes("أشعة البطن") || heading.includes("أشعة صدر") || heading.includes("أشعة بطن")) return { portal: "radiology", modality: "X-ray" };
  if (text.includes("mri") || text.includes("رنين")) return { portal: "radiology", modality: "MRI" };
  if (text.includes("ct") || text.includes("مقطعي")) return { portal: "radiology", modality: "CT" };
  if (text.includes("fluoroscopy") || text.includes("تألق") || text.includes("الجهاز الهضمي")) return { portal: "radiology", modality: "Fluoroscopy" };
  if (text.includes("ultrasound") || text.includes("موجات فوق")) return { portal: "radiology", modality: "Ultrasound" };
  if (text.includes("x-ray") || text.includes("xray") || text.includes("أشعة الصدر") || text.includes("أشعة البطن") || text.includes("أشعة صدر") || text.includes("أشعة بطن")) return { portal: "radiology", modality: "X-ray" };
  return { portal: "radiology", modality: "Other" };
}

export function deriveTrend(current: number | null, previous: number | null): Trend {
  if (current === null || previous === null) return "بيانات غير متوفرة";
  if (Math.abs(current - previous) < 0.001) return "مستقر";
  return current > previous ? "ارتفع" : "انخفض";
}

export function statusLabel(status: MedicalStatus) {
  const labels: Record<MedicalStatus, string> = {
    reassuring: "مطمئن",
    follow_up: "يحتاج متابعة",
    unavailable: "بيانات غير متوفرة",
  };
  return labels[status];
}

const lowerIsUsuallyFavorable = new Set(["ferritin", "total_cholesterol", "ldl", "hba1c", "creatinine", "urea", "urine_wbc"]);
const higherIsUsuallyFavorable = new Set(["hemoglobin", "hematocrit", "rbc", "total_t3", "globulin", "vitamin_b12", "vitamin_d"]);

/** Explains the stored direction only; it does not diagnose or infer a cause. */
export function interpretResultTrend({
  code,
  current,
  previous,
  currentStatus,
  previousStatus,
}: {
  code: string;
  current: number | null;
  previous: number | null;
  currentStatus: MedicalStatus;
  previousStatus: MedicalStatus | undefined;
}): TrendInterpretation {
  if (current === null || previous === null) {
    return { tone: "unavailable", label: "بيانات المقارنة غير مكتملة", detail: "تظهر القيمة كما وردت، لكن لا توجد قيم رقمية قابلة للمقارنة." };
  }

  if (Math.abs(current - previous) < 0.001) {
    return currentStatus === "reassuring"
      ? { tone: "stable", label: "مستقر ومطمئن", detail: "لم يتغير عن القياس السابق المتاح." }
      : { tone: "stable", label: "مستقر ويحتاج متابعة", detail: "لم يتغير عن القياس السابق، مع استمرار الحاجة للمتابعة." };
  }

  if (currentStatus === "reassuring" && previousStatus === "follow_up") {
    return { tone: "improving", label: "تحسن مقارنة بالسابق", detail: "أحدث قيمة أصبحت ضمن تصنيف المتابعة المطمئن." };
  }

  if (currentStatus === "follow_up" && previousStatus === "reassuring") {
    return { tone: "worsening", label: "تغير ويحتاج متابعة", detail: "أحدث قيمة انتقلت إلى تصنيف يحتاج متابعة مقارنة بالقياس السابق." };
  }

  const direction = current > previous ? "up" : "down";
  const isFavorable = (lowerIsUsuallyFavorable.has(code) && direction === "down") || (higherIsUsuallyFavorable.has(code) && direction === "up");
  const isUnfavorable = (lowerIsUsuallyFavorable.has(code) && direction === "up") || (higherIsUsuallyFavorable.has(code) && direction === "down");

  if (isFavorable) {
    return currentStatus === "follow_up"
      ? { tone: "improving", label: "يتحسن تدريجياً", detail: "يتجه في اتجاه أفضل مقارنة بالقياس السابق، لكنه ما زال ضمن ما يحتاج متابعة." }
      : { tone: "improving", label: "تحسن مقارنة بالسابق", detail: "يتجه في اتجاه أفضل مقارنة بالقياس السابق." };
  }

  if (isUnfavorable) {
    return currentStatus === "follow_up"
      ? { tone: "worsening", label: "يتراجع ويحتاج متابعة", detail: "يتجه في اتجاه أقل ملاءمة مقارنة بالقياس السابق." }
      : { tone: "worsening", label: "يتراجع وما زال مطمئناً", detail: "تغيرت القيمة عن السابق في اتجاه أقل ملاءمة، لكنها ما زالت ضمن تصنيف المتابعة المطمئن." };
  }

  return { tone: "unavailable", label: "بيانات المقارنة غير مكتملة", detail: "توجد قيمة سابقة، لكن لا توجد قاعدة موثوقة لوصف اتجاه هذا المؤشر بتحسن أو تراجع." };
}
