import { and, asc, desc, eq } from "drizzle-orm";
import { medicalResults, medicalVisits } from "../drizzle/schema";
import { getDb } from "./db";
import { classifyMedicalRecord, deriveTrend, interpretResultTrend, type MedicalStatus, type TrendInterpretation } from "../shared/medical";
import { resolveTestCode } from "../shared/testCanon";
import { compareResults, valuesAreEqual } from "../shared/medicalCompare";
import { deleteDocumentsForVisits, findDocumentByHash } from "./documents";

export type ResultCard = {
  code: string;
  label: string;
  category: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  resultId: number;
  /** The visit this latest measurement came from. */
  visitId: number;
  abbr: string | null;
  about: string | null;
  followUpDate: string | null;
  examDate: string;
  status: MedicalStatus;
  trend: ReturnType<typeof deriveTrend>;
  interpretation: TrendInterpretation;
  lastFive: Array<{ visitId: number; value: string; unit: string | null; referenceRange: string | null; facility: string | null; examDate: string; status: MedicalStatus }>;
  /** Every visit that ever contributed a measurement for this test — used to look up all of its stored original reports, not just the latest visit's. */
  history: Array<{ visitId: number; value: string; unit: string | null; referenceRange: string | null; facility: string | null; examDate: string; status: MedicalStatus }>;
  /** True when this test's history mixes more than one unit across labs — flagged, never silently trusted. */
  hasUnitMismatch: boolean;
  /**
   * True when the reference range changed across measurements. Ranges vary
   * by lab and by assay kit, so two numbers judged against different ranges
   * are not directly comparable even when the unit matches.
   */
  hasRangeMismatch: boolean;
  /** Distinct labs seen in this test's history, when recorded. */
  facilities: string[];
};

const priorityCodes = ["hemoglobin", "ferritin", "total_cholesterol", "ldl", "hba1c", "tsh", "urine_wbc"];

export async function getMedicalRecordsForUser(userId: number, profileId?: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  // Scope by profile when given; userId stays in the filter as the security boundary.
  const scope = profileId
    ? and(eq(medicalVisits.userId, userId), eq(medicalVisits.profileId, profileId))
    : eq(medicalVisits.userId, userId);

  const visits = await db
    .select()
    .from(medicalVisits)
    .where(scope)
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
      abbr: medicalResults.abbr,
      about: medicalResults.about,
      followUpDate: medicalResults.followUpDate,
      status: medicalResults.status,
      examDate: medicalVisits.examDate,
      facility: medicalVisits.facility,
    })
    .from(medicalResults)
    .innerJoin(medicalVisits, eq(medicalResults.visitId, medicalVisits.id))
    .where(scope)
    .orderBy(desc(medicalVisits.examDate), asc(medicalResults.id));

  return { visits, results };
}

export function makeResultCards(
  rows: Array<{
    code: string;
    label: string;
    category: string;
    id: number;
    visitId: number;
    abbr?: string | null;
    about?: string | null;
    followUpDate?: string | null;
    facility?: string | null;
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
      // Each entry carries its own unit — different labs can report the same
      // canonical test in different units, and a shared column-wide unit
      // would silently mislabel older or newer values.
      const history = [...series].reverse().map((item) => ({
        visitId: item.visitId,
        value: item.valueText,
        unit: item.unit,
        // Reference ranges legitimately differ between labs and between
        // assay kits at the same lab, so each measurement keeps the range
        // it was actually judged against rather than borrowing the latest.
        referenceRange: item.referenceRange,
        facility: item.facility ?? null,
        examDate: item.examDate,
        status: item.status,
      }));
      return {
        code: latest.code,
        label: latest.label,
        category: latest.category,
        value: latest.valueText,
        unit: latest.unit,
        referenceRange: latest.referenceRange,
        resultId: latest.id,
        visitId: latest.visitId,
        abbr: latest.abbr ?? null,
        about: latest.about ?? null,
        followUpDate: latest.followUpDate ?? null,
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
        hasUnitMismatch: new Set(history.map(h => h.unit ?? "")).size > 1,
        hasRangeMismatch:
          new Set(history.map(h => (h.referenceRange ?? "").trim()).filter(Boolean)).size > 1,
        facilities: Array.from(
          new Set(history.map(h => h.facility).filter((f): f is string => Boolean(f)))
        ),
      } satisfies ResultCard;
    })
    .sort((a, b) => {
      // Newest measurement first, so a report uploaded today surfaces at the
      // top instead of being buried by a hand-written priority list.
      if (a.examDate !== b.examDate) return a.examDate < b.examDate ? 1 : -1;

      // Within the same date — typically one report with many tests — put
      // the ones needing attention above the reassuring ones.
      const rank = (status: MedicalStatus) =>
        status === "follow_up" ? 0 : status === "reassuring" ? 1 : 2;
      const statusDiff = rank(a.status) - rank(b.status);
      if (statusDiff !== 0) return statusDiff;

      // Finally, keep the common headline tests ahead of the rest so the
      // ordering stays stable and familiar rather than arbitrary.
      const aIndex = priorityCodes.indexOf(a.code);
      const bIndex = priorityCodes.indexOf(b.code);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
}

export async function getMedicalDashboardForUser(userId: number, profileId?: number) {
  const { visits, results } = await getMedicalRecordsForUser(userId, profileId);
  const cards = makeResultCards(results);
  const visitIdsWithResults = new Set(results.map((r) => r.visitId));
  const classifiedVisits = visits.map((visit) => ({
    ...visit,
    ...classifyMedicalRecord(visit.reportType, visit.summary ?? "", visit.department ?? "", visitIdsWithResults.has(visit.id)),
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

/**
 * Parses a reference range into numeric bounds.
 * Handles "13–150", "0-200", "< 55", "> 40", "<=8.6" and Arabic decimal marks.
 */
function parseRange(range: string | null): { min: number; max: number } | null {
  if (!range) return null;
  const norm = range.replace(/[٫،]/g, ".").replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

  const between = norm.match(/(-?\d+(?:\.\d+)?)\s*[–—\-‑]\s*(-?\d+(?:\.\d+)?)/);
  if (between) {
    const min = Number(between[1]);
    const max = Number(between[2]);
    if (!Number.isNaN(min) && !Number.isNaN(max)) return { min, max };
  }

  const upper = norm.match(/[<≤]\s*=?\s*(-?\d+(?:\.\d+)?)/);
  if (upper) {
    const max = Number(upper[1]);
    if (!Number.isNaN(max)) return { min: -Infinity, max };
  }

  const lower = norm.match(/[>≥]\s*=?\s*(-?\d+(?:\.\d+)?)/);
  if (lower) {
    const min = Number(lower[1]);
    if (!Number.isNaN(min)) return { min, max: Infinity };
  }

  return null;
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
  abbr?: string | null;
  about?: string | null;
  /** The AI extraction's own confidence for this value; null/absent for manually-entered results. */
  confidence?: "high" | "low" | null;
};

/** Saves a user-reviewed report as a visit plus its results. */
export async function saveReviewedReport(
  userId: number,
  profileId: number,
  input: {
    examDate: string;
    facility: string | null;
    physician: string | null;
    results: ReviewedResult[];
    reportType?: string | null;
    summaryAr?: string | null;
    clinicalText?: string | null;
    hospitalVisitNumber?: string | null;
    patientIdentifier?: string | null;
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
    profileId,
    visitNumber,
    hospitalVisitNumber: input.hospitalVisitNumber?.slice(0, 64) || null,
    patientIdentifier: input.patientIdentifier?.slice(0, 64) || null,
    examDate: input.examDate,
    reportDate: input.examDate,
    reportType: input.reportType || "تحاليل مختبرية",
    summaryAr: input.summaryAr ?? null,
    clinicalText: input.clinicalText ?? null,
    facility: input.facility,
    physician: input.physician,
    source: "رفع يدوي",
    testCount: withStatus.length,
    abnormalCount,
  });

  const visitId = Number(inserted[0].insertId);

  // Codes are resolved to a canonical form shared across labs (see testCanon),
  // and de-duplicated only within THIS visit (a visit can't have two rows
  // with the same code, but the same code across different visits is exactly
  // how history/trend grouping works).
  const usedCodes = new Set<string>();
  const rows = withStatus.map(r => {
    const base = resolveTestCode(r.label, r.abbr, r.unit);
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
      abbr: r.abbr ? r.abbr.slice(0, 120) : null,
      about: r.about ? r.about.slice(0, 400) : null,
      confidence: r.confidence ?? null,
      status: r.status,
    };
  });

  if (rows.length > 0) await db.insert(medicalResults).values(rows);

  return { visitId, visitNumber, resultCount: rows.length, abnormalCount };
}

/** Deletes a visit and all of its results, but only if it belongs to this user. */
export async function deleteVisitForUser(userId: number, visitId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  const owned = await db
    .select({ id: medicalVisits.id })
    .from(medicalVisits)
    .where(and(eq(medicalVisits.id, visitId), eq(medicalVisits.userId, userId)))
    .limit(1);

  if (owned.length === 0) {
    throw new Error("السجل غير موجود أو لا تملك صلاحية حذفه.");
  }

  // Storage cleanup MUST happen before the visit row is deleted — see
  // deleteDocumentsForVisits for why the ordering matters.
  const { failedKeys } = await deleteDocumentsForVisits([visitId]);

  // Results are removed explicitly so the delete works regardless of FK cascade setup.
  await db.delete(medicalResults).where(eq(medicalResults.visitId, visitId));
  await db.delete(medicalVisits).where(eq(medicalVisits.id, visitId));

  return { deleted: true, visitId, storageCleanupFailed: failedKeys.length > 0 };
}

/** Updates values on an existing result, but only within a visit this user owns. */
export async function updateResultForUser(
  userId: number,
  resultId: number,
  patch: {
    label?: string;
    value?: string;
    numericValue?: number | null;
    unit?: string | null;
    referenceRange?: string | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  const owned = await db
    .select({ id: medicalResults.id, visitId: medicalResults.visitId })
    .from(medicalResults)
    .innerJoin(medicalVisits, eq(medicalResults.visitId, medicalVisits.id))
    .where(and(eq(medicalResults.id, resultId), eq(medicalVisits.userId, userId)))
    .limit(1);

  if (owned.length === 0) {
    throw new Error("النتيجة غير موجودة أو لا تملك صلاحية تعديلها.");
  }

  const updates: Record<string, unknown> = {};
  if (patch.label !== undefined) updates.label = patch.label.trim().slice(0, 160);
  if (patch.value !== undefined) updates.valueText = patch.value.trim().slice(0, 80);
  if (patch.unit !== undefined) updates.unit = patch.unit?.trim().slice(0, 32) || null;
  if (patch.referenceRange !== undefined) {
    updates.referenceRange = patch.referenceRange?.trim().slice(0, 80) || null;
  }
  if (patch.numericValue !== undefined) {
    updates.numericValue = patch.numericValue !== null ? String(patch.numericValue) : null;
  }

  // Status is always recomputed so an edited value can never keep a stale flag.
  if (patch.numericValue !== undefined || patch.referenceRange !== undefined) {
    const current = await db
      .select({
        numericValue: medicalResults.numericValue,
        referenceRange: medicalResults.referenceRange,
      })
      .from(medicalResults)
      .where(eq(medicalResults.id, resultId))
      .limit(1);

    const nextNumeric =
      patch.numericValue !== undefined
        ? patch.numericValue
        : current[0]?.numericValue !== null && current[0]?.numericValue !== undefined
          ? Number(current[0].numericValue)
          : null;
    const nextRange =
      patch.referenceRange !== undefined ? patch.referenceRange : current[0]?.referenceRange ?? null;

    updates.status = deriveStatus(nextNumeric, nextRange);
  }

  if (Object.keys(updates).length === 0) return { updated: false };

  await db.update(medicalResults).set(updates).where(eq(medicalResults.id, resultId));

  // Keep the visit's abnormal counter consistent with its results.
  const siblings = await db
    .select({ status: medicalResults.status })
    .from(medicalResults)
    .where(eq(medicalResults.visitId, owned[0].visitId));

  await db
    .update(medicalVisits)
    .set({ abnormalCount: siblings.filter(r => r.status === "follow_up").length })
    .where(eq(medicalVisits.id, owned[0].visitId));

  return { updated: true };
}

/** Returns every result inside a visit the user owns, for editing. */
export async function getVisitResultsForUser(userId: number, visitId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  const owned = await db
    .select({ id: medicalVisits.id })
    .from(medicalVisits)
    .where(and(eq(medicalVisits.id, visitId), eq(medicalVisits.userId, userId)))
    .limit(1);

  if (owned.length === 0) throw new Error("السجل غير موجود.");

  return db
    .select({
      id: medicalResults.id,
      label: medicalResults.label,
      category: medicalResults.category,
      valueText: medicalResults.valueText,
      numericValue: medicalResults.numericValue,
      unit: medicalResults.unit,
      referenceRange: medicalResults.referenceRange,
      status: medicalResults.status,
    })
    .from(medicalResults)
    .where(eq(medicalResults.visitId, visitId))
    .orderBy(asc(medicalResults.id));
}

export type DuplicateCheckResult = {
  status: "new" | "exact_duplicate" | "partial" | "file_duplicate" | "conflict";
  visitId: number | null;
  examDate: string;
  existingCount: number;
  /** Tests in the upload that are not yet recorded for this visit. */
  newLabels: string[];
  /** Tests already recorded with the same value — nothing to do. */
  identicalLabels: string[];
  /** Tests already recorded but with a different value; the user decides. */
  changed: Array<{ label: string; oldValue: string; newValue: string; unit: string | null }>;
  /** What actually matched this to an existing visit — surfaced so the UI can be precise instead of just saying "duplicate". */
  matchedBy?: "hospitalVisitNumber" | "examDate";
};

/**
 * Decides whether an extracted report belongs to a visit already on record,
 * and if so, what is actually new or changed about it. Exam date alone is
 * never sufficient — two different hospital visits can share a date, and
 * the same hospital visit can legitimately produce several separate
 * documents over time (a pending test released later, a correction). The
 * hospital's own visit/encounter number (when the report has one) is the
 * strongest signal; exam date is only a fallback for reports that don't.
 */
export async function checkDuplicateReport(
  userId: number,
  profileId: number,
  input: {
    examDate: string;
    results: Array<{ label: string; value: string; abbr?: string | null; unit?: string | null }>;
    contentHash?: string | null;
    hospitalVisitNumber?: string | null;
    patientIdentifier?: string | null;
  }
): Promise<DuplicateCheckResult> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const { examDate, results } = input;

  // Defense in depth: the primary exact-file gate runs before the AI is
  // ever called (see server/_core/extract.ts), but a hash is checked again
  // here in case this is ever reached some other way.
  if (input.contentHash) {
    const hashMatch = await findDocumentByHash(userId, input.contentHash);
    if (hashMatch) {
      return {
        status: "file_duplicate",
        visitId: hashMatch.visitId,
        examDate,
        existingCount: 0,
        newLabels: [],
        identicalLabels: [],
        changed: [],
      };
    }
  }

  let visitRow: { id: number; patientIdentifier: string | null } | null = null;
  let matchedBy: DuplicateCheckResult["matchedBy"];

  if (input.hospitalVisitNumber) {
    const rows = await db
      .select({ id: medicalVisits.id, patientIdentifier: medicalVisits.patientIdentifier })
      .from(medicalVisits)
      .where(and(
        eq(medicalVisits.userId, userId),
        eq(medicalVisits.profileId, profileId),
        eq(medicalVisits.hospitalVisitNumber, input.hospitalVisitNumber)
      ))
      .limit(1);
    if (rows.length > 0) {
      visitRow = rows[0];
      matchedBy = "hospitalVisitNumber";

      // Never auto-merge across a patient-identifier mismatch — surface it
      // for manual review instead of silently attaching one patient's
      // report to another patient's visit just because a visit number
      // happened to match (visit numbers can be reused by a hospital, or
      // misread by extraction).
      if (visitRow.patientIdentifier && input.patientIdentifier && visitRow.patientIdentifier !== input.patientIdentifier) {
        return {
          status: "conflict",
          visitId: visitRow.id,
          examDate,
          existingCount: 0,
          newLabels: [],
          identicalLabels: [],
          changed: [],
          matchedBy: "hospitalVisitNumber",
        };
      }
    }
  }

  // Exam-date fallback only when the new report carries no hospital visit
  // number at all. If it DOES have one and it simply didn't match anything
  // above, that is confidently a different visit — falling back to exam
  // date here would risk merging two genuinely different hospital visits
  // that just happen to share a date.
  if (!visitRow && !input.hospitalVisitNumber) {
    const rows = await db
      .select({ id: medicalVisits.id, patientIdentifier: medicalVisits.patientIdentifier })
      .from(medicalVisits)
      .where(and(
        eq(medicalVisits.userId, userId),
        eq(medicalVisits.profileId, profileId),
        eq(medicalVisits.examDate, examDate)
      ))
      .limit(1);
    if (rows.length > 0) {
      visitRow = rows[0];
      matchedBy = "examDate";
    }
  }

  if (!visitRow) {
    return {
      status: "new",
      visitId: null,
      examDate,
      existingCount: 0,
      newLabels: results.map(r => r.label),
      identicalLabels: [],
      changed: [],
    };
  }

  const existing = await db
    .select({ code: medicalResults.code, label: medicalResults.label, valueText: medicalResults.valueText })
    .from(medicalResults)
    .where(eq(medicalResults.visitId, visitRow.id));

  const comparison = compareResults(existing, results);

  return {
    status: comparison.newTests.length === 0 && comparison.changedTests.length === 0 ? "exact_duplicate" : "partial",
    visitId: visitRow.id,
    examDate,
    existingCount: existing.length,
    newLabels: comparison.newTests.map(t => t.label),
    identicalLabels: comparison.identicalLabels,
    changed: comparison.changedTests.map(c => ({ label: c.label, oldValue: c.oldValue, newValue: c.newValue, unit: c.unit })),
    matchedBy,
  };
}

/** Adds results to an existing visit, optionally updating ones that changed. */
export async function mergeIntoVisit(
  userId: number,
  visitId: number,
  results: ReviewedResult[],
  updateChanged: boolean,
  identifiers?: { hospitalVisitNumber?: string | null; patientIdentifier?: string | null }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  const owned = await db
    .select({ id: medicalVisits.id, hospitalVisitNumber: medicalVisits.hospitalVisitNumber, patientIdentifier: medicalVisits.patientIdentifier })
    .from(medicalVisits)
    .where(and(eq(medicalVisits.id, visitId), eq(medicalVisits.userId, userId)))
    .limit(1);

  if (owned.length === 0) throw new Error("السجل غير موجود أو لا تملك صلاحية تعديله.");

  // Enforced here too, not just in checkDuplicateReport's advisory check —
  // a client could otherwise call this mutation directly with a visitId it
  // owns and results meant for a different patient. Only blocks when BOTH
  // sides actually have an identifier and they disagree; a visit with none
  // recorded yet is not treated as a conflict.
  if (
    owned[0].patientIdentifier &&
    identifiers?.patientIdentifier &&
    owned[0].patientIdentifier !== identifiers.patientIdentifier
  ) {
    throw new Error("رقم الزيارة يتبع سجل مريض مختلف — لا يمكن دمج هذا التقرير تلقائياً.");
  }

  // Backfill only — never overwrite an identifier this visit already has,
  // and never write one that conflicts with what is already stored
  // (checkDuplicateReport already refused to reach this point for a
  // conflicting patientIdentifier, but a visit created before this feature
  // existed may simply have no hospitalVisitNumber recorded yet).
  const patch: Partial<typeof medicalVisits.$inferInsert> = {};
  if (!owned[0].hospitalVisitNumber && identifiers?.hospitalVisitNumber) {
    patch.hospitalVisitNumber = identifiers.hospitalVisitNumber.slice(0, 64);
  }
  if (!owned[0].patientIdentifier && identifiers?.patientIdentifier) {
    patch.patientIdentifier = identifiers.patientIdentifier.slice(0, 64);
  }
  if (Object.keys(patch).length > 0) {
    await db.update(medicalVisits).set(patch).where(eq(medicalVisits.id, visitId));
  }

  const existing = await db
    .select({
      id: medicalResults.id,
      code: medicalResults.code,
      label: medicalResults.label,
      valueText: medicalResults.valueText,
    })
    .from(medicalResults)
    .where(eq(medicalResults.visitId, visitId));

  const byCode = new Map(existing.map(e => [e.code, e]));
  const usedCodes = new Set(existing.map(e => e.code));

  let added = 0;
  let updated = 0;

  for (const r of results) {
    const status = deriveStatus(r.numericValue, r.referenceRange);
    const code = resolveTestCode(r.label, r.abbr, r.unit);
    const prior = byCode.get(code);

    if (prior) {
      if (!updateChanged || valuesAreEqual(prior.valueText, r.value)) continue;
      await db
        .update(medicalResults)
        .set({
          valueText: r.value.slice(0, 80),
          numericValue: r.numericValue !== null ? String(r.numericValue) : null,
          unit: r.unit ? r.unit.slice(0, 32) : null,
          referenceRange: r.referenceRange ? r.referenceRange.slice(0, 80) : null,
          confidence: r.confidence ?? null,
          status,
        })
        .where(eq(medicalResults.id, prior.id));
      updated++;
      continue;
    }

    let finalCode = code;
    let i = 2;
    while (usedCodes.has(finalCode)) finalCode = `${code}_${i++}`;
    usedCodes.add(finalCode);

    await db.insert(medicalResults).values({
      visitId,
      code: finalCode,
      label: r.label.slice(0, 160),
      category: (r.category || "أخرى").slice(0, 80),
      numericValue: r.numericValue !== null ? String(r.numericValue) : null,
      valueText: r.value.slice(0, 80),
      unit: r.unit ? r.unit.slice(0, 32) : null,
      referenceRange: r.referenceRange ? r.referenceRange.slice(0, 80) : null,
      abbr: r.abbr ? r.abbr.slice(0, 120) : null,
      about: r.about ? r.about.slice(0, 400) : null,
      confidence: r.confidence ?? null,
      status,
    });
    added++;
  }

  const all = await db
    .select({ status: medicalResults.status })
    .from(medicalResults)
    .where(eq(medicalResults.visitId, visitId));

  await db
    .update(medicalVisits)
    .set({
      testCount: all.length,
      abnormalCount: all.filter(r => r.status === "follow_up").length,
    })
    .where(eq(medicalVisits.id, visitId));

  return { added, updated, total: all.length };
}


/** Sets or clears a follow-up reminder date on a user's own result. */
export async function setFollowUpDate(
  userId: number,
  resultId: number,
  followUpDate: string | null
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  if (followUpDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(followUpDate)) {
    throw new Error("تاريخ غير صالح.");
  }

  const owned = await db
    .select({ id: medicalResults.id })
    .from(medicalResults)
    .innerJoin(medicalVisits, eq(medicalResults.visitId, medicalVisits.id))
    .where(and(eq(medicalResults.id, resultId), eq(medicalVisits.userId, userId)))
    .limit(1);

  if (owned.length === 0) {
    throw new Error("النتيجة غير موجودة أو لا تملك صلاحية تعديلها.");
  }

  await db
    .update(medicalResults)
    .set({ followUpDate })
    .where(eq(medicalResults.id, resultId));

  return { updated: true };
}

/** Every reminder a user set, across all their tests, soonest first. Overdue ones sort first. */
export async function getReminders(userId: number, profileId?: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  const scope = profileId
    ? and(eq(medicalVisits.userId, userId), eq(medicalVisits.profileId, profileId))
    : eq(medicalVisits.userId, userId);

  const rows = await db
    .select({
      resultId: medicalResults.id,
      code: medicalResults.code,
      label: medicalResults.label,
      followUpDate: medicalResults.followUpDate,
      examDate: medicalVisits.examDate,
    })
    .from(medicalResults)
    .innerJoin(medicalVisits, eq(medicalResults.visitId, medicalVisits.id))
    .where(scope);

  // Keep only each code's most recent result (older reminders are stale once
  // a newer measurement for the same test exists).
  const latestByCode = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const existing = latestByCode.get(r.code);
    if (!existing || r.examDate > existing.examDate) latestByCode.set(r.code, r);
  }

  const today = new Date().toISOString().slice(0, 10);

  return Array.from(latestByCode.values())
    .filter(r => r.followUpDate !== null)
    .map(r => ({
      resultId: r.resultId,
      code: r.code,
      label: r.label,
      followUpDate: r.followUpDate as string,
      overdue: (r.followUpDate as string) < today,
    }))
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));
}
