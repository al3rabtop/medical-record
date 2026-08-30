import bcrypt from "bcryptjs";
import { eq, isNull } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import { medicalVisits, users } from "../../drizzle/schema";
import { createUser, getDb, getUserByEmail } from "../db";

/**
 * ONE-TIME admin endpoint. Protected by ADMIN_IMPORT_SECRET.
 * GET /api/admin/bootstrap-owner?secret=...&email=...&password=...
 * Creates the account if it doesn't exist yet, then assigns every
 * ownerless (userId IS NULL) medicalVisits row to that account.
 * Safe to re-run: won't recreate the user, won't touch rows already owned.
 */
export function registerAdminBootstrapRoute(app: Express) {
  app.get("/api/admin/bootstrap-owner", async (req: Request, res: Response) => {
    const secret = process.env.ADMIN_IMPORT_SECRET;
    if (!secret || req.query.secret !== secret) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const email = String(req.query.email ?? "").trim().toLowerCase();
    const password = String(req.query.password ?? "");
    const patientName = String(req.query.patientName ?? "").trim();
    const birthYearRaw = Number(req.query.birthYear);
    const birthYear = Number.isInteger(birthYearRaw) ? birthYearRaw : null;

    if (!email || !password || password.length < 8) {
      res.status(400).json({ error: "email and password (>=8 chars) are required" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }

    let user = await getUserByEmail(email);
    let created = false;

    if (!user) {
      const passwordHash = await bcrypt.hash(password, 10);
      user = await createUser({
        email,
        passwordHash,
        patientName: patientName || null,
        birthYear,
        role: "admin",
        lastSignedIn: new Date(),
      });
      created = true;
    } else if (patientName || birthYear) {
      await db
        .update(users)
        .set({
          ...(patientName ? { patientName } : {}),
          ...(birthYear ? { birthYear } : {}),
        })
        .where(eq(users.id, user.id));
    }

    if (!user) {
      res.status(500).json({ error: "Failed to create user" });
      return;
    }

    const updateResult = await db
      .update(medicalVisits)
      .set({ userId: user.id })
      .where(isNull(medicalVisits.userId));

    res.json({
      success: true,
      created,
      userId: user.id,
      email: user.email,
      visitsAssigned: (updateResult as any)[0]?.affectedRows ?? "unknown",
    });
  });
}
