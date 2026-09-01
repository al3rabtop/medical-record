import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { medicalResults } from "../../drizzle/schema";
import { resolveTestCodeDetailed } from "../../shared/testCanon";
import { TEST_INFO } from "../../shared/testInfo";
import { getDb } from "../db";

/**
 * ONE-TIME admin endpoint. Protected by ADMIN_IMPORT_SECRET.
 * GET /api/admin/fix-abbr?secret=...&dryRun=true
 *
 * The stored `abbr` is shown verbatim on every result card, so a wrong one
 * misinforms whoever reads the record — the clearest case being visit 17,
 * where the aspartate (AST) row carries abbr "ALT" from the original AI
 * extraction. This replaces an abbr with the canonical one whenever the
 * abbr contradicts what the Arabic label resolves to.
 *
 * Only genuine contradictions are touched. Rows whose abbr is merely
 * generic (e.g. "Mono" on a monocyte absolute-count row) are left alone,
 * because those are imprecise rather than wrong.
 */
export function registerFixAbbrRoute(app: Express) {
  app.get("/api/admin/fix-abbr", async (req: Request, res: Response) => {
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
        visitId: medicalResults.visitId,
        label: medicalResults.label,
        abbr: medicalResults.abbr,
      })
      .from(medicalResults);

    const fixes: Array<{
      id: number;
      visitId: number;
      label: string;
      oldAbbr: string | null;
      newAbbr: string;
      reason: string;
    }> = [];

    for (const row of rows) {
      const { conflict } = resolveTestCodeDetailed(row.label, row.abbr);
      if (!conflict) continue;

      // The label's own code is authoritative. Only rewrite when we have a
      // canonical abbreviation to replace it with, and when the two codes
      // are genuinely different tests rather than a base/variant pair
      // (e.g. neutrophils vs neutrophils_percent, where the stored abbr is
      // just less specific, not incorrect).
      const isVariantOfSame =
        conflict.fromLabel.startsWith(conflict.fromAbbr) ||
        conflict.fromAbbr.startsWith(conflict.fromLabel);
      if (isVariantOfSame) continue;

      const canonical = TEST_INFO[conflict.fromLabel]?.abbr;
      if (!canonical || canonical === row.abbr) continue;

      fixes.push({
        id: row.id,
        visitId: row.visitId,
        label: row.label,
        oldAbbr: row.abbr,
        newAbbr: canonical,
        reason: `abbr resolved to '${conflict.fromAbbr}' but label resolved to '${conflict.fromLabel}'`,
      });
    }

    if (!dryRun) {
      for (const fix of fixes) {
        await db
          .update(medicalResults)
          .set({ abbr: fix.newAbbr })
          .where(eq(medicalResults.id, fix.id));
      }
    }

    res.json({
      dryRun,
      totalResults: rows.length,
      fixCount: fixes.length,
      appliedCount: dryRun ? 0 : fixes.length,
      fixes,
    });
  });
}
