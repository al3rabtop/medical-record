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

/** Parses a reference range like "13–150" or "0-200" into numeric bounds. */
function parseRange(range: string | null): { min: number; max: number } | null {
  if (!range) return null;
  const m = range.replace(/[٫،]/g, ".").match(/(-?\d+(?:\.\d+)?)\s*[–—\-‑]\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const min = Number(m[1]);
  const max = Number(m[2]);
  if (Number.isNaN(min) || Number.isNaN(max)) return null;
  return { min, max };
}

/** Derives reassuring/follow_up by comparing the value against its reference range. */
export function deriveStatus(
  numericValue: number | null,
  referenceRange: string | null
): MedicalStatus {
  if (numericValue === null) return "unavailable";
  const range = parseRange(referenceRange);
  if (!range) return "unavailable";
  return numericValue >= range.min && numericValue <= range.max
    ? "reassuring"
    : "follow_up";
}

export type ReviewedResult = {
  label: string;
  category: string;
  value: string;
  numericValue: number | null;
  unit: string | null;
  referenceRange: string | null;
};

/** Saves a user-reviewed report as a visit plus its results. */
export async function saveReviewedReport(
  userId: number,
  input: {
    examDate: string;
    facility: string | null;
    physician: string | null;
    results: ReviewedResult[];
  }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  const withStatus = input.results.map(r => ({
    ...r,
    status: deriveStatus(r.numericValue, r.referenceRange),
  }));

  const abnormalCount = withStatus.filter(r => r.status === "follow_up").length;
  const visitNumber = `up-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const inserted = await db.insert(medicalVisits).values({
    userId,
    visitNumber,
    examDate: input.examDate,
    reportDate: input.examDate,
    reportType: "تحاليل مختبرية",
    facility: input.facility,
    physician: input.physician,
    source: "رفع يدوي",
    testCount: withStatus.length,
    abnormalCount,
  });

  const visitId = Number(inserted[0].insertId);

  // Codes must be unique per visit; derive from label and de-duplicate.
  const usedCodes = new Set<string>();
  const rows = withStatus.map(r => {
    const base =
      r.label
        .trim()
        .toLowerCase()
        .replace(/[^0-9a-zA-Z\u0600-\u06FF]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 60) || "result";
    let code = base;
    let i = 2;
    while (usedCodes.has(code)) code = `${base}_${i++}`;
    usedCodes.add(code);

    return {
      visitId,
      code,
      label: r.label.slice(0, 160),
      category: (r.category || "أخرى").slice(0, 80),
      numericValue: r.numericValue !== null ? String(r.numericValue) : null,
      valueText: r.value.slice(0, 80),
      unit: r.unit ? r.unit.slice(0, 32) : null,
      referenceRange: r.referenceRange ? r.referenceRange.slice(0, 80) : null,
      status: r.status,
    };
  });

  await db.insert(medicalResults).values(rows);

  return { visitId, visitNumber, resultCount: rows.length, abnormalCount };
}
