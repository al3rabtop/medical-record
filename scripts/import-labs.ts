/**
 * One-time import script for historical lab data (from Excel export).
 * Usage: DATABASE_URL="..." npx tsx scripts/import-labs.ts
 *
 * Reads scripts/labs-import-data.json (96 result rows grouped by visitNumber),
 * groups them into medicalVisits, and inserts medicalVisits + medicalResults.
 * Safe to re-run: uses visitNumber unique key and (visitId, code) unique key
 * to upsert rather than duplicate.
 */
import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { medicalResults, medicalVisits } from "../drizzle/schema";
import fs from "node:fs";
import path from "node:path";

type Row = {
  examDate: string;
  department: string | null;
  category: string;
  label: string;
  code: string;
  valueText: string;
  numericValue: number | null;
  unit: string | null;
  referenceRange: string | null;
  status: "reassuring" | "follow_up" | "unavailable";
  note: string | null;
  visitNumber: string;
  physician: string | null;
  facility: string | null;
  source: string | null;
  reportDate: string | null;
  reportType: string;
};

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const dataPath = path.resolve(import.meta.dirname, "labs-import-data.json");
  const rows: Row[] = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

  const db = drizzle(process.env.DATABASE_URL);

  // Group result rows by visitNumber
  const visitsMap = new Map<string, Row[]>();
  for (const row of rows) {
    const list = visitsMap.get(row.visitNumber) ?? [];
    list.push(row);
    visitsMap.set(row.visitNumber, list);
  }

  let visitCount = 0;
  let resultCount = 0;

  for (const [visitNumber, items] of visitsMap) {
    const first = items[0];
    const abnormalCount = items.filter(i => i.status === "follow_up").length;

    // Upsert visit
    const existing = await db
      .select({ id: medicalVisits.id })
      .from(medicalVisits)
      .where(eq(medicalVisits.visitNumber, visitNumber))
      .limit(1);

    let visitId: number;

    if (existing.length > 0) {
      visitId = existing[0].id;
      await db
        .update(medicalVisits)
        .set({
          examDate: first.examDate,
          reportDate: first.reportDate,
          reportType: first.reportType,
          department: first.department,
          physician: first.physician,
          facility: first.facility,
          source: first.source,
          testCount: items.length,
          abnormalCount,
        })
        .where(eq(medicalVisits.id, visitId));
    } else {
      const inserted = await db.insert(medicalVisits).values({
        visitNumber,
        examDate: first.examDate,
        reportDate: first.reportDate,
        reportType: first.reportType,
        department: first.department,
        physician: first.physician,
        facility: first.facility,
        source: first.source,
        testCount: items.length,
        abnormalCount,
      });
      visitId = Number(inserted[0].insertId);
    }
    visitCount++;

    // Upsert each result under this visit
    for (const item of items) {
      const values = {
        visitId,
        code: item.code,
        label: item.label,
        category: item.category,
        numericValue:
          item.numericValue !== null ? String(item.numericValue) : null,
        valueText: item.valueText,
        unit: item.unit,
        referenceRange: item.referenceRange,
        status: item.status,
        note: item.note,
      };

      const existingResult = await db
        .select({ id: medicalResults.id })
        .from(medicalResults)
        .where(
          and(
            eq(medicalResults.visitId, visitId),
            eq(medicalResults.code, item.code)
          )
        )
        .limit(1);

      if (existingResult.length > 0) {
        await db
          .update(medicalResults)
          .set(values)
          .where(eq(medicalResults.id, existingResult[0].id));
      } else {
        await db.insert(medicalResults).values(values);
      }
      resultCount++;
    }

    console.log(`Visit ${visitNumber}: ${items.length} results`);
  }

  console.log(`\nDone. Visits: ${visitCount}, Results: ${resultCount}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
