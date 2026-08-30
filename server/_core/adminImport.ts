import { and, eq } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import { medicalResults, medicalVisits } from "../../drizzle/schema";
import { labsImportData } from "../_data/labsImportData";
import { getDb } from "../db";

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

/**
 * ONE-TIME admin import endpoint. Protected by ADMIN_IMPORT_SECRET.
 * GET /api/admin/import-labs?secret=...
 * Remove this route once the historical data has been imported.
 */
export function registerAdminImportRoute(app: Express) {
  app.get("/api/admin/import-labs", async (req: Request, res: Response) => {
    const secret = process.env.ADMIN_IMPORT_SECRET;
    if (!secret || req.query.secret !== secret) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }

    const rows: Row[] = labsImportData as unknown as Row[];

    const visitsMap = new Map<string, Row[]>();
    for (const row of rows) {
      const list = visitsMap.get(row.visitNumber) ?? [];
      list.push(row);
      visitsMap.set(row.visitNumber, list);
    }

    let visitCount = 0;
    let resultCount = 0;
    const log: string[] = [];

    for (const visitNumber of Array.from(visitsMap.keys())) {
      const items = visitsMap.get(visitNumber)!;
      const first = items[0];
      const abnormalCount = items.filter((i: Row) => i.status === "follow_up").length;

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

      log.push(`Visit ${visitNumber}: ${items.length} results`);
    }

    res.json({ success: true, visitCount, resultCount, log });
  });
}
