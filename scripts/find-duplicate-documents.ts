/**
 * READ-ONLY diagnostic report on possible duplicate medical documents.
 *
 * This script never deletes, updates, or otherwise modifies anything — it
 * only runs SELECT queries and prints a report. Medical data must not be
 * changed by an automated script's own judgment; a human reviews this
 * output and decides what (if anything) to clean up.
 *
 * Run with: npx tsx scripts/find-duplicate-documents.ts
 * Requires DATABASE_URL, same as scripts/migrate.ts.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log("[find-duplicates] Connected (read-only).\n");

  // --- 1. Hard evidence: documents that are byte-for-byte identical (same
  // contentHash) and belong to the same user, but exist as separate rows.
  // This is the literal condition the exact-duplicate detection is meant to
  // prevent going forward — these rows predate that fix, or slipped through
  // a race condition before the unique index existed.
  console.log("=== Exact byte-duplicate documents (same user, same contentHash, >1 row) ===");
  const [hashDupes] = await conn.query(`
    SELECT
      COALESCE(d.userId, v.userId) AS userId,
      d.contentHash,
      COUNT(*) AS copies,
      GROUP_CONCAT(d.id ORDER BY d.id) AS documentIds,
      GROUP_CONCAT(DISTINCT d.visitId ORDER BY d.visitId) AS visitIds,
      GROUP_CONCAT(d.originalName ORDER BY d.id SEPARATOR ' | ') AS filenames,
      MIN(d.createdAt) AS firstUploaded,
      MAX(d.createdAt) AS lastUploaded
    FROM medicalDocuments d
    JOIN medicalVisits v ON v.id = d.visitId
    WHERE d.contentHash IS NOT NULL
    GROUP BY COALESCE(d.userId, v.userId), d.contentHash
    HAVING COUNT(*) > 1
    ORDER BY copies DESC
  `);
  const hashDupeRows = hashDupes as any[];
  if (hashDupeRows.length === 0) {
    console.log("None found.\n");
  } else {
    for (const row of hashDupeRows) {
      console.log(
        `userId=${row.userId} hash=${row.contentHash.slice(0, 12)}... copies=${row.copies} ` +
        `documentIds=[${row.documentIds}] visitIds=[${row.visitIds}] ` +
        `filenames="${row.filenames}" first=${row.firstUploaded} last=${row.lastUploaded}`
      );
    }
    console.log(`\n${hashDupeRows.length} hash-duplicate group(s) found — see above.\n`);
  }

  // --- 2. Documents stored before the contentHash column existed (or where
  // hashing failed silently for some other reason) — these cannot be
  // hash-matched at all, so a byte-identical re-upload of one of these would
  // not be caught by the exact-duplicate check. Purely informational.
  console.log("=== Documents with no recorded contentHash (cannot be hash-deduplicated) ===");
  const [noHash] = await conn.query(`
    SELECT COUNT(*) AS c FROM medicalDocuments WHERE contentHash IS NULL
  `);
  console.log(`${(noHash as any)[0].c} document row(s) have no contentHash.\n`);

  // --- 3. Heuristic (NOT hard evidence): separate visits for the same
  // profile, same exam date, whose result sets share several identical test
  // labels — a plausible sign that the same physical report was extracted
  // more than once into two different visits (e.g. because the original
  // document was never successfully stored the first time, so the hash
  // check had nothing to match against on the second upload). This can also
  // be a legitimate case of two real reports issued the same day, so it is
  // reported separately from the hard evidence above and needs a human to
  // open each pair and compare the actual values before deciding anything.
  console.log("=== Possible duplicate VISITS — same profile + exam date, overlapping test labels (heuristic, needs manual review) ===");
  const [visitPairs] = await conn.query(`
    SELECT
      v1.profileId,
      v1.examDate,
      v1.id AS visitA,
      v2.id AS visitB,
      COUNT(*) AS sharedLabels
    FROM medicalVisits v1
    JOIN medicalVisits v2
      ON v1.profileId = v2.profileId
     AND v1.examDate = v2.examDate
     AND v1.id < v2.id
    JOIN medicalResults r1 ON r1.visitId = v1.id
    JOIN medicalResults r2 ON r2.visitId = v2.id AND r2.code = r1.code
    WHERE v1.profileId IS NOT NULL
    GROUP BY v1.profileId, v1.examDate, v1.id, v2.id
    HAVING COUNT(*) >= 2
    ORDER BY sharedLabels DESC
  `);
  const visitPairRows = visitPairs as any[];
  if (visitPairRows.length === 0) {
    console.log("None found.\n");
  } else {
    for (const row of visitPairRows) {
      console.log(
        `profileId=${row.profileId} examDate=${row.examDate} visitA=${row.visitA} visitB=${row.visitB} sharedTestLabels=${row.sharedLabels}`
      );
    }
    console.log(
      `\n${visitPairRows.length} candidate pair(s) found — open each visit and compare values before deciding anything. ` +
      `Do NOT merge or delete automatically; some of these may be two genuinely separate reports issued the same day.\n`
    );
  }

  console.log("[find-duplicates] Done. No data was modified.");
  await conn.end();
}

main().catch(err => {
  console.error("[find-duplicates] FAILED:", err);
  process.exit(1);
});
