import bcrypt from "bcryptjs";
import { desc, eq, sql } from "drizzle-orm";
import { medicalResults, medicalVisits, users } from "../drizzle/schema";
import { getDb } from "./db";
import { deleteDocumentsForVisits } from "./documents";

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
      status: users.status,
      canUpload: users.canUpload,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
      visitCount: sql<number>`(SELECT COUNT(*) FROM medicalVisits v WHERE v.userId = users.id)`,
      resultCount: sql<number>`(SELECT COUNT(*) FROM medicalResults r JOIN medicalVisits v ON r.visitId = v.id WHERE v.userId = users.id)`,
    })
    .from(users)
    // Surface accounts awaiting approval first.
    .orderBy(sql`FIELD(users.status, 'pending', 'active', 'suspended')`, desc(users.createdAt));

  const totals = rows.reduce(
    (acc, r) => ({
      users: acc.users + 1,
      pending: acc.pending + (r.status === "pending" ? 1 : 0),
      visits: acc.visits + Number(r.visitCount),
      results: acc.results + Number(r.resultCount),
    }),
    { users: 0, pending: 0, visits: 0, results: 0 }
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
 * Admin management actions.
 *
 * Two invariants are enforced throughout, so an admin cannot lock themselves
 * out of the platform or leave it without an administrator:
 *  - an admin can never suspend, delete, or demote their own account;
 *  - the last remaining admin can never be demoted or deleted.
 */

async function assertNotSelf(adminUserId: number, targetUserId: number) {
  if (adminUserId === targetUserId) {
    throw new Error("لا يمكنك تنفيذ هذا الإجراء على حسابك أنت.");
  }
}

async function assertNotLastAdmin(targetUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  const target = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (target.length === 0) throw new Error("المستخدم غير موجود.");
  if (target[0].role !== "admin") return;

  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"));

  if (admins.length <= 1) {
    throw new Error("لا يمكن إزالة آخر حساب مسؤول في النظام.");
  }
}

/** Updates profile fields. Email uniqueness is checked before writing. */
export async function adminUpdateUser(
  targetUserId: number,
  patch: { email?: string; patientName?: string | null; birthYear?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  const updates: Record<string, unknown> = {};

  if (patch.email !== undefined) {
    const email = patch.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("بريد إلكتروني غير صالح.");
    }
    const taken = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (taken.length > 0 && taken[0].id !== targetUserId) {
      throw new Error("هذا البريد مستخدم في حساب آخر.");
    }
    updates.email = email;
  }

  if (patch.patientName !== undefined) {
    updates.patientName = patch.patientName?.trim() || null;
  }

  if (patch.birthYear !== undefined) {
    if (patch.birthYear !== null) {
      const year = Number(patch.birthYear);
      const currentYear = new Date().getFullYear();
      if (!Number.isInteger(year) || year < 1900 || year > currentYear) {
        throw new Error("سنة الميلاد غير صالحة.");
      }
    }
    updates.birthYear = patch.birthYear;
  }

  if (Object.keys(updates).length === 0) return { updated: false };

  await db.update(users).set(updates).where(eq(users.id, targetUserId));
  return { updated: true };
}

/** Sets a new password. The old one is never readable, only replaceable. */
export async function adminSetPassword(targetUserId: number, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  if (newPassword.length < 8) {
    throw new Error("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ passwordHash }).where(eq(users.id, targetUserId));
  return { updated: true };
}

/** Suspends or reactivates an account. */
export async function adminSetStatus(
  adminUserId: number,
  targetUserId: number,
  status: "pending" | "active" | "suspended"
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  if (status !== "active") {
    await assertNotSelf(adminUserId, targetUserId);
    await assertNotLastAdmin(targetUserId);
  }

  await db.update(users).set({ status }).where(eq(users.id, targetUserId));
  return { status };
}

/** Enables or disables report uploads for an account. */
export async function adminSetCanUpload(targetUserId: number, canUpload: boolean) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.update(users).set({ canUpload }).where(eq(users.id, targetUserId));
  return { canUpload };
}

/** Promotes or demotes an account. */
export async function adminSetRole(
  adminUserId: number,
  targetUserId: number,
  role: "user" | "admin"
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  if (role === "user") {
    await assertNotSelf(adminUserId, targetUserId);
    await assertNotLastAdmin(targetUserId);
  }

  await db.update(users).set({ role }).where(eq(users.id, targetUserId));
  return { role };
}

/** Permanently deletes an account together with all of its medical records. */
export async function adminDeleteUser(adminUserId: number, targetUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  await assertNotSelf(adminUserId, targetUserId);
  await assertNotLastAdmin(targetUserId);

  const visits = await db
    .select({ id: medicalVisits.id })
    .from(medicalVisits)
    .where(eq(medicalVisits.userId, targetUserId));

  // Storage cleanup MUST happen before the visit rows are deleted — see
  // deleteDocumentsForVisits for why the ordering matters.
  const { failedKeys } = await deleteDocumentsForVisits(visits.map((v) => v.id));

  for (const visit of visits) {
    await db.delete(medicalResults).where(eq(medicalResults.visitId, visit.id));
  }
  await db.delete(medicalVisits).where(eq(medicalVisits.userId, targetUserId));
  await db.delete(users).where(eq(users.id, targetUserId));

  return { deleted: true, visitsRemoved: visits.length, storageCleanupFailed: failedKeys.length > 0 };
}
