import { desc, eq, sql } from "drizzle-orm";
import { adminAccessLog, users } from "../drizzle/schema";
import { getDb } from "./db";
import { getMedicalDashboardForUser } from "./medical";

/** Platform-level stats plus one row per account. No medical values here. */
export async function getAdminOverview() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      patientName: users.patientName,
      birthYear: users.birthYear,
      role: users.role,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
      visitCount: sql<number>`(SELECT COUNT(*) FROM medicalVisits v WHERE v.userId = users.id)`,
      resultCount: sql<number>`(SELECT COUNT(*) FROM medicalResults r JOIN medicalVisits v ON r.visitId = v.id WHERE v.userId = users.id)`,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  const totals = rows.reduce(
    (acc, r) => ({
      users: acc.users + 1,
      visits: acc.visits + Number(r.visitCount),
      results: acc.results + Number(r.resultCount),
    }),
    { users: 0, visits: 0, results: 0 }
  );

  return {
    totals,
    users: rows.map(r => ({
      ...r,
      visitCount: Number(r.visitCount),
      resultCount: Number(r.resultCount),
    })),
  };
}

/**
 * Returns another account's medical dashboard, and records the access.
 * The audit entry is written before the data is returned, so an access
 * can never happen without leaving a trace.
 */
export async function getUserRecordsAsAdmin(adminUserId: number, targetUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  const target = await db
    .select({ id: users.id, email: users.email, patientName: users.patientName })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (target.length === 0) throw new Error("المستخدم غير موجود.");

  await db.insert(adminAccessLog).values({
    adminUserId,
    targetUserId,
    action: "view_records",
  });

  const dashboard = await getMedicalDashboardForUser(targetUserId);
  return { target: target[0], dashboard };
}

/** The audit trail, most recent first. */
export async function getAdminAccessLog() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  return db
    .select({
      id: adminAccessLog.id,
      action: adminAccessLog.action,
      createdAt: adminAccessLog.createdAt,
      adminEmail: sql<string>`(SELECT email FROM users u WHERE u.id = adminAccessLog.adminUserId)`,
      targetEmail: sql<string>`(SELECT email FROM users u WHERE u.id = adminAccessLog.targetUserId)`,
    })
    .from(adminAccessLog)
    .orderBy(desc(adminAccessLog.createdAt))
    .limit(100);
}
