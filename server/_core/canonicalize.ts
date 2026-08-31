import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { medicalResults } from "../../drizzle/schema";
import { resolveTestCode } from "../../shared/testCanon";
import { getDb } from "../db";

/**
 * ONE-TIME admin endpoint. Protected by ADMIN_IMPORT_SECRET.
 * GET /api/admin/canonicalize-codes?secret=...&dryRun=true
 *
 * Recomputes each result's code using the canonical alias table and
 * updates it in place, so tests that were split across cards purely
 * because of label wording (e.g. "TSH" vs a differently-worded Arabic
 * label) merge back into one card's history. Nothing about the value,
 * unit, or reference range is touched.
 *
 * Run with dryRun=true first to preview what would change.
 * Safe to re-run: results already on their canonical code are untouched.
 */
export function registerCanonicalizeRoute(app: Express) {
  app.get("/api/admin/canonicalize-codes", async (req: Request, res: Response) => {
    const secret = process.env.ADMIN_IMPORT_SECRET;
    if (!secret || req.query.secret !== secret) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const dryRun = req.query.dryRun === "true";

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }

    const rows = await db
      .select({
        id: medicalResults.id,
        code: medicalResults.code,
        label: medicalResults.label,
        abbr: medicalResults.abbr,
        visitId: medicalResults.visitId,
      })
      .from(medicalResults);

    const changes: Array<{ id: number; visitId: number; label: string; from: string; to: string }> = [];

    for (const row of rows) {
      const canonical = resolveTestCode(row.label, row.abbr);
      if (canonical !== row.code) {
        changes.push({ id: row.id, visitId: row.visitId, label: row.label, from: row.code, to: canonical });
      }
    }

    const skipped: typeof changes = [];

    if (!dryRun) {
      for (const change of changes) {
        // Guard against a collision: two different tests in the same visit
        // both resolving to the same canonical code would violate the
        // (visitId, code) unique constraint. Skip those rather than crash
        // the whole batch — they need a human look either way.
        const siblings = await db
          .select({ id: medicalResults.id, code: medicalResults.code })
          .from(medicalResults)
          .where(eq(medicalResults.visitId, change.visitId));

        const clash = siblings.some(s => s.id !== change.id && s.code === change.to);
        if (clash) {
          skipped.push(change);
          continue;
        }

        try {
          await db
            .update(medicalResults)
            .set({ code: change.to })
            .where(eq(medicalResults.id, change.id));
        } catch (err) {
          console.error(`[canonicalize] Failed on result ${change.id} (${change.label}):`, err);
          skipped.push(change);
        }
      }
    }

    res.json({
      dryRun,
      totalResults: rows.length,
      changedCount: changes.length,
      appliedCount: dryRun ? 0 : changes.length - skipped.length,
      skippedCount: skipped.length,
      changes: changes.slice(0, 200),
      skipped: skipped.slice(0, 50),
    });
  });
}
