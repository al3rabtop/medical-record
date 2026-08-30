import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import bcrypt from "bcryptjs";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import { createUser, getUserByEmail, getUserById, touchLastSignedIn } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0;

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
    const { email, password, name } = (req.body ?? {}) as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!isNonEmptyString(email) || !EMAIL_RE.test(email.trim())) {
      res.status(400).json({ error: "بريد إلكتروني غير صالح" });
      return;
    }
    if (!isNonEmptyString(password) || password.length < 8) {
      res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
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
      name: isNonEmptyString(name) ? name : null,
      role: "user",
      lastSignedIn: new Date(),
    });

    if (!user) {
      res.status(500).json({ error: "تعذّر إنشاء الحساب" });
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
