import { and, asc, eq, sql } from "drizzle-orm";
import { medicalResults, medicalVisits, profiles } from "../drizzle/schema";
import { getDb } from "./db";
import { deleteDocumentsForVisits } from "./documents";

/** Lists an account's profiles, primary first, with record counts. */
export async function listProfiles(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  return db
    .select({
      id: profiles.id,
      name: profiles.name,
      relation: profiles.relation,
      birthYear: profiles.birthYear,
      isPrimary: profiles.isPrimary,
      visitCount: sql<number>`(SELECT COUNT(*) FROM medicalVisits v WHERE v.profileId = profiles.id)`,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .orderBy(sql`profiles.isPrimary DESC`, asc(profiles.id));
}

/** Confirms a profile belongs to this account before it is used or changed. */
export async function assertOwnedProfile(userId: number, profileId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  const rows = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
    .limit(1);

  if (rows.length === 0) throw new Error("الملف غير موجود أو لا تملك صلاحية الوصول إليه.");
  return rows[0].id;
}

/** Returns the profile to show by default, creating one if the account has none. */
export async function getDefaultProfileId(userId: number, patientName?: string | null) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  const existing = await db
    .select({ id: profiles.id, isPrimary: profiles.isPrimary })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .orderBy(sql`profiles.isPrimary DESC`, asc(profiles.id))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const inserted = await db.insert(profiles).values({
    userId,
    name: patientName || "الملف الرئيسي",
    relation: "نفسي",
    isPrimary: true,
  });
  return Number(inserted[0].insertId);
}

export async function createProfile(
  userId: number,
  input: { name: string; relation: string | null; birthYear: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  const name = input.name.trim();
  if (name.length < 2) throw new Error("الاسم مطلوب.");

  if (input.birthYear !== null) {
    const y = Number(input.birthYear);
    if (!Number.isInteger(y) || y < 1900 || y > new Date().getFullYear()) {
      throw new Error("سنة الميلاد غير صالحة.");
    }
  }

  const inserted = await db.insert(profiles).values({
    userId,
    name: name.slice(0, 160),
    relation: input.relation?.trim().slice(0, 64) || null,
    birthYear: input.birthYear,
    isPrimary: false,
  });

  return { id: Number(inserted[0].insertId) };
}

export async function updateProfile(
  userId: number,
  profileId: number,
  patch: { name?: string; relation?: string | null; birthYear?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await assertOwnedProfile(userId, profileId);

  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const n = patch.name.trim();
    if (n.length < 2) throw new Error("الاسم مطلوب.");
    updates.name = n.slice(0, 160);
  }
  if (patch.relation !== undefined) {
    updates.relation = patch.relation?.trim().slice(0, 64) || null;
  }
  if (patch.birthYear !== undefined) {
    if (patch.birthYear !== null) {
      const y = Number(patch.birthYear);
      if (!Number.isInteger(y) || y < 1900 || y > new Date().getFullYear()) {
        throw new Error("سنة الميلاد غير صالحة.");
      }
    }
    updates.birthYear = patch.birthYear;
  }

  if (Object.keys(updates).length === 0) return { updated: false };
  await db.update(profiles).set(updates).where(eq(profiles.id, profileId));
  return { updated: true };
}

/** Deletes a profile and its records. The primary profile cannot be removed. */
export async function deleteProfile(userId: number, profileId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await assertOwnedProfile(userId, profileId);

  const target = await db
    .select({ isPrimary: profiles.isPrimary })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  if (target[0]?.isPrimary) {
    throw new Error("لا يمكن حذف الملف الرئيسي.");
  }

  const visits = await db
    .select({ id: medicalVisits.id })
    .from(medicalVisits)
    .where(eq(medicalVisits.profileId, profileId));

  // Storage cleanup MUST happen before the visit rows are deleted — see
  // deleteDocumentsForVisits for why the ordering matters.
  const { failedKeys } = await deleteDocumentsForVisits(visits.map((v) => v.id));

  for (const v of visits) {
    await db.delete(medicalResults).where(eq(medicalResults.visitId, v.id));
  }
  await db.delete(medicalVisits).where(eq(medicalVisits.profileId, profileId));
  await db.delete(profiles).where(eq(profiles.id, profileId));

  return { deleted: true, visitsRemoved: visits.length, storageCleanupFailed: failedKeys.length > 0 };
}
