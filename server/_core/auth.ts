import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import bcrypt from "bcryptjs";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import { createUser, getUserByEmail, getUserById, touchLastSignedIn, updatePassword } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0;

/** When enabled, new accounts must be activated by an admin before first use. */
const REQUIRE_APPROVAL = process.env.REQUIRE_ADMIN_APPROVAL !== "false";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getSecretKey() {
  if (!ENV.cookieSecret) {
    throw new Error("JWT_SECRET is not set");
  }
  return new TextEncoder().encode(ENV.cookieSecret);
}

function parseCookies(cookieHeader: string | undefined) {
  if (!cookieHeader) return new Map<string, string>();
  return new Map(Object.entries(parseCookieHeader(cookieHeader)));
}

async function signSession(userId: number): Promise<string> {
  const expirationSeconds = Math.floor((Date.now() + ONE_YEAR_MS) / 1000);
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSecretKey());
}

async function verifySession(token: string | undefined): Promise<number | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    const { userId } = payload as Record<string, unknown>;
    return typeof userId === "number" ? userId : null;
  } catch {
    return null;
  }
}

/** Verifies the session cookie (or Bearer header) on a request and returns the DB user, or null. */
export async function authenticateRequest(req: Request): Promise<User | null> {
  const cookies = parseCookies(req.headers.cookie);
  let token = cookies.get(COOKIE_NAME);

  if (!token) {
    const authHeader = req.headers.authorization;
    if (isNonEmptyString(authHeader) && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  const userId = await verifySession(token);
  if (!userId) return null;

  const user = await getUserById(userId);
  if (!user) return null;
  // Only fully activated accounts hold a valid session; suspension and
  // pending-approval both take effect immediately for existing sessions too.
  if (user.status !== "active") return null;

  return user;
}

function setSessionCookie(req: Request, res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    maxAge: ONE_YEAR_MS,
  });
}

/** Registers email/password auth routes: signup, login, logout, me. */
export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    const { email, password, patientName, birthYear } = (req.body ?? {}) as {
      email?: string;
      password?: string;
      patientName?: string;
      birthYear?: number | string;
    };

    if (!isNonEmptyString(email) || !EMAIL_RE.test(email.trim())) {
      res.status(400).json({ error: "بريد إلكتروني غير صالح" });
      return;
    }
    if (!isNonEmptyString(password) || password.length < 8) {
      res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
      return;
    }
    if (!isNonEmptyString(patientName) || patientName.trim().length < 2) {
      res.status(400).json({ error: "اسم المريض مطلوب" });
      return;
    }

    const year = Number(birthYear);
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(year) || year < 1900 || year > currentYear) {
      res.status(400).json({ error: "سنة الميلاد غير صالحة" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await getUserByEmail(normalizedEmail);
    if (existing) {
      res.status(409).json({ error: "هذا البريد مسجّل مسبقاً" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({
      email: normalizedEmail,
      passwordHash,
      patientName: patientName.trim(),
      birthYear: year,
      role: "user",
      status: REQUIRE_APPROVAL ? "pending" : "active",
      lastSignedIn: new Date(),
    });

    if (!user) {
      res.status(500).json({ error: "تعذّر إنشاء الحساب" });
      return;
    }

    // A pending account gets no session: it cannot be used until an admin activates it.
    if (user.status === "pending") {
      res.json({
        pending: true,
        message:
          "تم إنشاء حسابك بنجاح. الحساب قيد المراجعة، وسيتم تفعيله من قِبل المسؤول قريباً.",
      });
      return;
    }

    const token = await signSession(user.id);
    setSessionCookie(req, res, token);

    const { passwordHash: _omit, ...safeUser } = user;
    res.json({ user: safeUser });
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = (req.body ?? {}) as {
      email?: string;
      password?: string;
    };

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      res.status(400).json({ error: "البريد وكلمة المرور مطلوبان" });
      return;
    }

    const user = await getUserByEmail(email.trim().toLowerCase());
    const passwordMatches = user
      ? await bcrypt.compare(password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
      return;
    }

    if (user.status === "pending") {
      res.status(403).json({
        error: "حسابك قيد المراجعة ولم يُفعّل بعد. سيتم تفعيله من قِبل المسؤول قريباً.",
      });
      return;
    }

    if (user.status === "suspended") {
      res.status(403).json({ error: "تم إيقاف هذا الحساب. تواصل مع المسؤول." });
      return;
    }

    await touchLastSignedIn(user.id);

    const token = await signSession(user.id);
    setSessionCookie(req, res, token);

    const { passwordHash: _omit, ...safeUser } = user;
    res.json({ user: safeUser });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
    res.json({ success: true });
  });

  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: "يجب تسجيل الدخول" });
      return;
    }

    const { currentPassword, newPassword } = (req.body ?? {}) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!isNonEmptyString(currentPassword) || !isNonEmptyString(newPassword)) {
      res.status(400).json({ error: "كلمة المرور الحالية والجديدة مطلوبتان" });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" });
      return;
    }

    // The current password is always verified, so a hijacked session alone
    // cannot be used to take over the account.
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      res.status(403).json({ error: "كلمة المرور الحالية غير صحيحة" });
      return;
    }

    await updatePassword(user.id, await bcrypt.hash(newPassword, 10));
    res.json({ success: true });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const user = await authenticateRequest(req);
    if (!user) {
      res.json({ user: null });
      return;
    }
    const { passwordHash: _omit, ...safeUser } = user;
    res.json({ user: safeUser });
  });
}
