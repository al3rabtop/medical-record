import { desc, sql } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Account-level statistics only.
 * Deliberately contains no medical values: the admin view reports how many
 * records exist, never what is in them.
 */
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
