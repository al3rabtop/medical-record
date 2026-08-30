import { and, asc, desc, eq } from "drizzle-orm";
import { medicalResults, medicalVisits } from "../drizzle/schema";
import { getDb } from "./db";
import { classifyMedicalRecord, deriveTrend, interpretResultTrend, type MedicalStatus, type TrendInterpretation } from "../shared/medical";

export type ResultCard = {
  code: string;
  label: string;
  category: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  examDate: string;
  status: MedicalStatus;
  trend: ReturnType<typeof deriveTrend>;
  interpretation: TrendInterpretation;
  lastFive: Array<{ value: string; examDate: string; status: MedicalStatus }>;
  history: Array<{ value: string; examDate: string; status: MedicalStatus }>;
};

const priorityCodes = ["hemoglobin", "ferritin", "total_cholesterol", "ldl", "hba1c", "tsh", "urine_wbc"];

export async function getMedicalRecordsForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  const visits = await db
    .select()
    .from(medicalVisits)
    .where(eq(medicalVisits.userId, userId))
    .orderBy(desc(medicalVisits.examDate));

  const results = await db
    .select({
      id: medicalResults.id,
      visitId: medicalResults.visitId,
      code: medicalResults.code,
      label: medicalResults.label,
      category: medicalResults.category,
      numericValue: medicalResults.numericValue,
      valueText: medicalResults.valueText,
      unit: medicalResults.unit,
      referenceRange: medicalResults.referenceRange,
      status: medicalResults.status,
      examDate: medicalVisits.examDate,
    })
    .from(medicalResults)
    .innerJoin(medicalVisits, eq(medicalResults.visitId, medicalVisits.id))
    .where(eq(medicalVisits.userId, userId))
    .orderBy(desc(medicalVisits.examDate), asc(medicalResults.id));

  return { visits, results };
}

export function makeResultCards(
  rows: Array<{
    code: string;
    label: string;
    category: string;
    numericValue: string | null;
    valueText: string;
    unit: string | null;
    referenceRange: string | null;
    status: MedicalStatus;
    examDate: string;
  }>,
) {
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) grouped.set(row.code, [...(grouped.get(row.code) ?? []), row]);

  return Array.from(grouped.values())
    .map((series) => {
      const [latest, ...older] = series;
      const currentValue = latest.numericValue === null ? null : Number(latest.numericValue);
      const previousValue = older[0]?.numericValue === null || older[0] === undefined ? null : Number(older[0].numericValue);
      const history = [...series].reverse().map((item) => ({ value: item.valueText, examDate: item.examDate, status: item.status }));
      return {
        code: latest.code,
        label: latest.label,
        category: latest.category,
        value: latest.valueText,
        unit: latest.unit,
        referenceRange: latest.referenceRange,
        examDate: latest.examDate,
        status: latest.status,
        trend: deriveTrend(currentValue, previousValue),
        interpretation: interpretResultTrend({
          code: latest.code,
          current: currentValue,
          previous: previousValue,
          currentStatus: latest.status,
          previousStatus: older[0]?.status,
        }),
        lastFive: history.slice(-5),
        history,
      } satisfies ResultCard;
    })
    .sort((a, b) => {
      const aIndex = priorityCodes.indexOf(a.code);
      const bIndex = priorityCodes.indexOf(b.code);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
}

export async function getMedicalDashboardForUser(userId: number) {
  const { visits, results } = await getMedicalRecordsForUser(userId);
  const cards = makeResultCards(results);
  const classifiedVisits = visits.map((visit) => ({
    ...visit,
    ...classifyMedicalRecord(visit.reportType, visit.summary ?? "", visit.department ?? ""),
  }));
  const latestVisit = classifiedVisits[0] ?? null;
  const portalCounts = {
    laboratory: classifiedVisits.filter((visit) => visit.portal === "laboratory").length,
    radiology: classifiedVisits.filter((visit) => visit.portal === "radiology").length,
    physician: classifiedVisits.filter((visit) => visit.portal === "physician").length,
    pathology: classifiedVisits.filter((visit) => visit.portal === "pathology").length,
  };
  const portalLatest = {
    laboratory: classifiedVisits.find((visit) => visit.portal === "laboratory") ?? null,
    radiology: classifiedVisits.find((visit) => visit.portal === "radiology") ?? null,
    physician: classifiedVisits.find((visit) => visit.portal === "physician") ?? null,
    pathology: classifiedVisits.find((visit) => visit.portal === "pathology") ?? null,
  };

  return {
    latestVisit,
    visits: classifiedVisits,
    portalCounts,
    portalLatest,
    cards,
    followUp: cards.filter((card) => card.status === "follow_up"),
    reassuringCount: cards.filter((card) => card.status === "reassuring").length,
    unavailable: [
      { label: "وظائف الكلى", detail: "لا توجد نتيجة كرياتينين أو يوريا بعد نوفمبر 2025." },
      { label: "تحليل البول", detail: "لا توجد نتيجة بول بعد فبراير 2026." },
      { label: "الأشعة", detail: "أضيفت تقارير الأشعة التاريخية حتى أغسطس 2021؛ لا توجد تقارير أشعة أحدث مرفقة في السجل." },
    ],
  };
}
