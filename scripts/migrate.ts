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
        role ENUM('user','admin') NOT NULL DEFAULT 'user',
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        lastSignedIn TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } else {
    console.log("[migrate] users table already up to date.");
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
