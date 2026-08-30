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
        title VARCHAR(200) NOT NULL,
        storageKey VARCHAR(255) NOT NULL,
        mimeType VARCHAR(120),
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX medicalDocuments_visit_idx (visitId),
        CONSTRAINT medicalDocuments_visit_fk FOREIGN KEY (visitId)
          REFERENCES medicalVisits(id) ON DELETE CASCADE
      ) DEFAULT CHARSET=utf8mb4
    `);
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

  console.log("[migrate] Done.");
  await conn.end();
}

main().catch(err => {
  console.error("[migrate] FAILED:", err);
  process.exit(1);
});
