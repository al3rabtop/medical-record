/**
 * Non-interactive database migration, safe to run on every deploy.
 * Replaces `drizzle-kit push` in production because drizzle-kit's
 * interactive rename-detection prompts hang forever in a non-TTY
 * deploy environment (Railway), even with --force.
 *
 * Every statement here is idempotent (checked against information_schema
 * before running), so re-running this script is always safe.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

async function columnExists(
  conn: mysql.Connection,
  table: string,
  column: string
): Promise<boolean> {
  const [rows] = await conn.query(
    `SELECT COUNT(*) as cnt FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  return (rows as any)[0].cnt > 0;
}

async function tableExists(conn: mysql.Connection, table: string): Promise<boolean> {
  const [rows] = await conn.query(
    `SELECT COUNT(*) as cnt FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [table]
  );
  return (rows as any)[0].cnt > 0;
}

async function indexExists(
  conn: mysql.Connection,
  table: string,
  index: string
): Promise<boolean> {
  const [rows] = await conn.query(
    `SELECT COUNT(*) as cnt FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, index]
  );
  return (rows as any)[0].cnt > 0;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log("[migrate] Connected.");

  // --- users table: create fresh if it doesn't exist, or if it's still
  // the old Manus openId-based shape (no passwordHash column yet, table
  // currently has zero real accounts so this is safe to replace).
  const usersExists = await tableExists(conn, "users");
  const hasPasswordHash = usersExists && (await columnExists(conn, "users", "passwordHash"));

  if (!usersExists) {
    console.log("[migrate] Creating users table...");
    await conn.query(`
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(320) NOT NULL UNIQUE,
        passwordHash VARCHAR(100) NOT NULL,
        name TEXT,
        patientName VARCHAR(160) NULL,
        birthYear INT NULL,
        role ENUM('user','admin') NOT NULL DEFAULT 'user',
        status ENUM('pending','active','suspended') NOT NULL DEFAULT 'pending',
        canUpload BOOLEAN NOT NULL DEFAULT TRUE,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        lastSignedIn TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } else if (!hasPasswordHash) {
    console.log("[migrate] Replacing legacy Manus-era users table (no real accounts existed)...");
    await conn.query(`DROP TABLE users`);
    await conn.query(`
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(320) NOT NULL UNIQUE,
        passwordHash VARCHAR(100) NOT NULL,
        name TEXT,
        patientName VARCHAR(160) NULL,
        birthYear INT NULL,
        role ENUM('user','admin') NOT NULL DEFAULT 'user',
        status ENUM('pending','active','suspended') NOT NULL DEFAULT 'pending',
        canUpload BOOLEAN NOT NULL DEFAULT TRUE,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        lastSignedIn TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } else {
    console.log("[migrate] users table already up to date.");
  }

  // --- users: patientName / birthYear (added after initial accounts release)
  if (!(await columnExists(conn, "users", "patientName"))) {
    console.log("[migrate] Adding users.patientName...");
    await conn.query(`ALTER TABLE users ADD COLUMN patientName VARCHAR(160) NULL`);
  }
  if (!(await columnExists(conn, "users", "birthYear"))) {
    console.log("[migrate] Adding users.birthYear...");
    await conn.query(`ALTER TABLE users ADD COLUMN birthYear INT NULL`);
  }

  // --- medical tables: create when missing (fresh installs)
  if (!(await tableExists(conn, "medicalVisits"))) {
    console.log("[migrate] Creating medicalVisits...");
    await conn.query(`
      CREATE TABLE medicalVisits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NULL,
        visitNumber VARCHAR(32) NOT NULL UNIQUE,
        examDate VARCHAR(10) NOT NULL,
        reportDate VARCHAR(10),
        reportType VARCHAR(64) NOT NULL DEFAULT 'تحاليل مختبرية',
        department VARCHAR(128),
        physician VARCHAR(128),
        facility VARCHAR(160),
        source VARCHAR(128),
        testCount INT NOT NULL DEFAULT 0,
        abnormalCount INT NOT NULL DEFAULT 0,
        summary TEXT,
        summaryAr TEXT,
        clinicalText TEXT,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX medicalVisits_examDate_idx (examDate)
      ) DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await tableExists(conn, "medicalResults"))) {
    console.log("[migrate] Creating medicalResults...");
    await conn.query(`
      CREATE TABLE medicalResults (
        id INT AUTO_INCREMENT PRIMARY KEY,
        visitId INT NOT NULL,
        code VARCHAR(80) NOT NULL,
        label VARCHAR(160) NOT NULL,
        category VARCHAR(80) NOT NULL,
        numericValue DECIMAL(12,3),
        valueText VARCHAR(80) NOT NULL,
        unit VARCHAR(32),
        referenceRange VARCHAR(80),
        abbr VARCHAR(120),
        about VARCHAR(400),
        followUpDate VARCHAR(10),
        status ENUM('reassuring','follow_up','unavailable') NOT NULL DEFAULT 'unavailable',
        note TEXT,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX medicalResults_visit_idx (visitId),
        INDEX medicalResults_code_idx (code),
        UNIQUE INDEX medicalResults_visit_code_idx (visitId, code),
        CONSTRAINT medicalResults_visit_fk FOREIGN KEY (visitId)
          REFERENCES medicalVisits(id) ON DELETE CASCADE
      ) DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!(await tableExists(conn, "medicalDocuments"))) {
    console.log("[migrate] Creating medicalDocuments...");
    await conn.query(`
      CREATE TABLE medicalDocuments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        visitId INT NOT NULL,
        originalName VARCHAR(255) NOT NULL,
        storageKey VARCHAR(512) NOT NULL,
        mimeType VARCHAR(100) NOT NULL,
        fileSize INT NOT NULL DEFAULT 0,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX medicalDocuments_visit_idx (visitId),
        CONSTRAINT medicalDocuments_visit_fk FOREIGN KEY (visitId)
          REFERENCES medicalVisits(id) ON DELETE CASCADE
      ) DEFAULT CHARSET=utf8mb4
    `);
  } else {
    // Table pre-dates the compressed-original-report feature and may still have
    // its earlier (unused) shape — bring it up to date without touching any rows.
    if (!(await columnExists(conn, "medicalDocuments", "originalName"))) {
      console.log("[migrate] Adding medicalDocuments.originalName...");
      await conn.query(`ALTER TABLE medicalDocuments ADD COLUMN originalName VARCHAR(255) NOT NULL DEFAULT ''`);
    }
    if (!(await columnExists(conn, "medicalDocuments", "fileSize"))) {
      console.log("[migrate] Adding medicalDocuments.fileSize...");
      await conn.query(`ALTER TABLE medicalDocuments ADD COLUMN fileSize INT NOT NULL DEFAULT 0`);
    }
  }

  // --- users: moderation columns
  if (await tableExists(conn, "users")) {
    if (!(await columnExists(conn, "users", "status"))) {
      console.log("[migrate] Adding users.status...");
      // Pre-existing accounts predate approval gating, so they start active.
      await conn.query(`ALTER TABLE users ADD COLUMN status ENUM('pending','active','suspended') NOT NULL DEFAULT 'active'`);
    } else {
      // Widen the enum in place; existing values are preserved.
      console.log("[migrate] Ensuring users.status supports 'pending'...");
      await conn.query(`ALTER TABLE users MODIFY COLUMN status ENUM('pending','active','suspended') NOT NULL DEFAULT 'pending'`);
    }
    if (!(await columnExists(conn, "users", "canUpload"))) {
      console.log("[migrate] Adding users.canUpload...");
      await conn.query(`ALTER TABLE users ADD COLUMN canUpload BOOLEAN NOT NULL DEFAULT TRUE`);
    }
  }

  // --- profiles: one per tracked person, with automatic backfill so no
  // existing record is ever left without an owner.
  if (!(await tableExists(conn, "profiles"))) {
    console.log("[migrate] Creating profiles...");
    await conn.query(`
      CREATE TABLE profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        name VARCHAR(160) NOT NULL,
        relation VARCHAR(64),
        birthYear INT,
        isPrimary BOOLEAN NOT NULL DEFAULT FALSE,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX profiles_userId_idx (userId)
      ) DEFAULT CHARSET=utf8mb4
    `);
  }

  if (await tableExists(conn, "medicalVisits")) {
    if (!(await columnExists(conn, "medicalVisits", "profileId"))) {
      console.log("[migrate] Adding medicalVisits.profileId...");
      await conn.query(`ALTER TABLE medicalVisits ADD COLUMN profileId INT NULL`);
      await conn.query(`CREATE INDEX medicalVisits_profileId_idx ON medicalVisits(profileId)`);
    }

    // Give every account a primary profile named after its patient, then
    // attach that account's existing visits to it.
    const [accounts] = await conn.query(
      `SELECT u.id, u.patientName, u.birthYear FROM users u
       WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.userId = u.id)`
    );
    for (const acc of accounts as any[]) {
      console.log(`[migrate] Creating primary profile for user ${acc.id}...`);
      await conn.query(
        `INSERT INTO profiles (userId, name, relation, birthYear, isPrimary)
         VALUES (?, ?, ?, ?, TRUE)`,
        [acc.id, acc.patientName || "الملف الرئيسي", "نفسي", acc.birthYear ?? null]
      );
    }

    const [orphans] = await conn.query(
      `SELECT COUNT(*) AS c FROM medicalVisits WHERE profileId IS NULL AND userId IS NOT NULL`
    );
    if ((orphans as any)[0].c > 0) {
      console.log(`[migrate] Attaching ${(orphans as any)[0].c} visits to primary profiles...`);
      await conn.query(
        `UPDATE medicalVisits v
         JOIN profiles p ON p.userId = v.userId AND p.isPrimary = TRUE
         SET v.profileId = p.id
         WHERE v.profileId IS NULL`
      );
    }
  }

  // --- medicalResults.followUpDate: user-set re-check reminder
  if (await tableExists(conn, "medicalResults")) {
    if (!(await columnExists(conn, "medicalResults", "followUpDate"))) {
      console.log("[migrate] Adding medicalResults.followUpDate...");
      await conn.query(`ALTER TABLE medicalResults ADD COLUMN followUpDate VARCHAR(10) NULL`);
    }
  }

  // --- medicalVisits: narrative report fields
  if (await tableExists(conn, "medicalVisits")) {
    if (!(await columnExists(conn, "medicalVisits", "summaryAr"))) {
      console.log("[migrate] Adding medicalVisits.summaryAr...");
      await conn.query(`ALTER TABLE medicalVisits ADD COLUMN summaryAr TEXT NULL`);
    }
    if (!(await columnExists(conn, "medicalVisits", "clinicalText"))) {
      console.log("[migrate] Adding medicalVisits.clinicalText...");
      await conn.query(`ALTER TABLE medicalVisits ADD COLUMN clinicalText TEXT NULL`);
    }
  }

  // --- medicalResults: abbr / about (added with the test-info feature)
  if (await tableExists(conn, "medicalResults")) {
    if (!(await columnExists(conn, "medicalResults", "abbr"))) {
      console.log("[migrate] Adding medicalResults.abbr...");
      await conn.query(`ALTER TABLE medicalResults ADD COLUMN abbr VARCHAR(120) NULL`);
    }
    if (!(await columnExists(conn, "medicalResults", "about"))) {
      console.log("[migrate] Adding medicalResults.about...");
      await conn.query(`ALTER TABLE medicalResults ADD COLUMN about VARCHAR(400) NULL`);
    }
  }

  // --- medicalVisits.userId: add if missing (nullable, for backfill safety)
  const visitsHasUserId = await columnExists(conn, "medicalVisits", "userId");
  if (!visitsHasUserId) {
    console.log("[migrate] Adding medicalVisits.userId...");
    await conn.query(`ALTER TABLE medicalVisits ADD COLUMN userId INT NULL`);
    await conn.query(
      `ALTER TABLE medicalVisits ADD CONSTRAINT medicalVisits_userId_fk
       FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE`
    );
  } else {
    console.log("[migrate] medicalVisits.userId already present.");
  }

  const hasUserIdIndex = await indexExists(conn, "medicalVisits", "medicalVisits_userId_idx");
  if (!hasUserIdIndex) {
    console.log("[migrate] Adding index on medicalVisits.userId...");
    await conn.query(`CREATE INDEX medicalVisits_userId_idx ON medicalVisits(userId)`);
  }

  // --- smart report-update pipeline: hospital-sourced identifiers on the
  // visit, and a content hash on the document, so duplicate/update detection
  // no longer relies on exam date alone.
  if (await tableExists(conn, "medicalVisits")) {
    if (!(await columnExists(conn, "medicalVisits", "hospitalVisitNumber"))) {
      console.log("[migrate] Adding medicalVisits.hospitalVisitNumber...");
      await conn.query(`ALTER TABLE medicalVisits ADD COLUMN hospitalVisitNumber VARCHAR(64) NULL`);
      await conn.query(`CREATE INDEX medicalVisits_hospitalVisitNumber_idx ON medicalVisits(hospitalVisitNumber)`);
    }
    if (!(await columnExists(conn, "medicalVisits", "patientIdentifier"))) {
      console.log("[migrate] Adding medicalVisits.patientIdentifier...");
      await conn.query(`ALTER TABLE medicalVisits ADD COLUMN patientIdentifier VARCHAR(64) NULL`);
    }
  }

  if (await tableExists(conn, "medicalDocuments")) {
    if (!(await columnExists(conn, "medicalDocuments", "contentHash"))) {
      console.log("[migrate] Adding medicalDocuments.contentHash...");
      await conn.query(`ALTER TABLE medicalDocuments ADD COLUMN contentHash VARCHAR(64) NULL`);
      await conn.query(`CREATE INDEX medicalDocuments_contentHash_idx ON medicalDocuments(contentHash)`);
    }
  }

  // --- medicalDocuments.userId + a unique (userId, contentHash) index: the
  // database-level backstop against the exact-duplicate race condition (two
  // near-simultaneous uploads of the same file both passing the app-level
  // hash check before either commits). Denormalized from medicalVisits.userId
  // because MySQL cannot express a unique constraint across a join.
  if (await tableExists(conn, "medicalDocuments")) {
    if (!(await columnExists(conn, "medicalDocuments", "userId"))) {
      console.log("[migrate] Adding medicalDocuments.userId...");
      await conn.query(`ALTER TABLE medicalDocuments ADD COLUMN userId INT NULL`);
    }

    const [unbackfilled] = await conn.query(
      `SELECT COUNT(*) AS c FROM medicalDocuments d
       JOIN medicalVisits v ON v.id = d.visitId
       WHERE d.userId IS NULL AND v.userId IS NOT NULL`
    );
    if ((unbackfilled as any)[0].c > 0) {
      console.log(`[migrate] Backfilling userId on ${(unbackfilled as any)[0].c} medicalDocuments row(s) from their visit...`);
      await conn.query(
        `UPDATE medicalDocuments d
         JOIN medicalVisits v ON v.id = d.visitId
         SET d.userId = v.userId
         WHERE d.userId IS NULL AND v.userId IS NOT NULL`
      );
    }

    if (!(await indexExists(conn, "medicalDocuments", "medicalDocuments_user_hash_idx"))) {
      try {
        console.log("[migrate] Adding unique index medicalDocuments_user_hash_idx (userId, contentHash)...");
        await conn.query(
          `ALTER TABLE medicalDocuments ADD UNIQUE INDEX medicalDocuments_user_hash_idx (userId, contentHash)`
        );
      } catch (err) {
        // A duplicate (userId, contentHash) pair already existing in the
        // table (exactly the historical bug this migration exists to
        // prevent going forward) makes this ALTER fail. Do not let that
        // block the rest of the deploy, and do not delete anything on the
        // application's own judgment — surface it loudly so the existing
        // duplicate rows can be reviewed and cleaned up deliberately
        // (see scripts/find-duplicate-documents.ts), then this index can be
        // added by re-running this script.
        console.error(
          "[migrate] Could not add medicalDocuments_user_hash_idx — duplicate (userId, contentHash) rows likely already exist. " +
          "Run scripts/find-duplicate-documents.ts to review them, resolve manually, then re-run this migration. " +
          "Continuing without the constraint for now:",
          err
        );
      }
    }
  }

  // --- medicalResults.confidence: provenance for the AI's own self-reported
  // confidence at extraction time, previously computed but discarded before
  // ever reaching the database.
  if (await tableExists(conn, "medicalResults")) {
    if (!(await columnExists(conn, "medicalResults", "confidence"))) {
      console.log("[migrate] Adding medicalResults.confidence...");
      await conn.query(`ALTER TABLE medicalResults ADD COLUMN confidence ENUM('high','low') NULL`);
    }
  }

  console.log("[migrate] Done.");
  await conn.end();
}

main().catch(err => {
  console.error("[migrate] FAILED:", err);
  process.exit(1);
});
