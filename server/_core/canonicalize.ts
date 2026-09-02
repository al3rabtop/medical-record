import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { medicalResults } from "../../drizzle/schema";
import { resolveTestCodeDetailed } from "../../shared/testCanon";
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
 * Collision prediction (two different tests in the same visit resolving
 * to the same code — which would violate the (visitId, code) unique
 * constraint) runs identically in both dry-run and apply mode, so the
 * preview is always an exact match for what apply will actually do.
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
        unit: medicalResults.unit,
        visitId: medicalResults.visitId,
      })
      .from(medicalResults);

    const changes: Array<{ id: number; visitId: number; label: string; from: string; to: string }> = [];
    const unmatched: Array<{ id: number; label: string; currentCode: string }> = [];
    // Rows whose stored `abbr` contradicts their label — the abbr is very
    // likely a bad extraction and should be reviewed/corrected at the source.
    const abbrConflicts: Array<{ id: number; visitId: number; label: string; abbr: string | null; usedCode: string; abbrSuggested: string }> = [];

    for (const row of rows) {
      const { code: canonical, matched, conflict } = resolveTestCodeDetailed(row.label, row.abbr, row.unit);
      if (conflict) {
        abbrConflicts.push({
          id: row.id,
          visitId: row.visitId,
          label: row.label,
          abbr: row.abbr,
          usedCode: conflict.fromLabel,
          abbrSuggested: conflict.fromAbbr,
        });
      }
      if (!matched) {
        unmatched.push({ id: row.id, label: row.label, currentCode: row.code });
        continue;
      }
      if (canonical !== row.code) {
        changes.push({ id: row.id, visitId: row.visitId, label: row.label, from: row.code, to: canonical });
      }
    }

    // Predict collisions in memory, identically for dry-run and apply: two
    // different result rows in the same visit both ending up on the same
    // code. Walk proposed changes in order, applying each only if its
    // target code is still free in that visit — otherwise skip it.
    const codesByVisit = new Map<number, Map<number, string>>();
    for (const row of rows) {
      if (!codesByVisit.has(row.visitId)) codesByVisit.set(row.visitId, new Map());
      codesByVisit.get(row.visitId)!.set(row.id, row.code);
    }

    const applied: typeof changes = [];
    const skipped: typeof changes = [];

    for (const change of changes) {
      const visitCodes = codesByVisit.get(change.visitId)!;
      const clash = Array.from(visitCodes.entries()).some(
        ([resultId, code]) => resultId !== change.id && code === change.to
      );
      if (clash) {
        skipped.push(change);
        continue;
      }
      visitCodes.set(change.id, change.to);
      applied.push(change);
    }

    if (!dryRun) {
      for (const change of applied) {
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
      appliedCount: dryRun ? 0 : applied.length,
      willApplyCount: applied.length,
      skippedCount: skipped.length,
      unmatchedCount: unmatched.length,
      abbrConflictCount: abbrConflicts.length,
      abbrConflicts: abbrConflicts.slice(0, 50),
      changes: applied.slice(0, 200),
      skipped: skipped.slice(0, 50),
    });
  });
}
