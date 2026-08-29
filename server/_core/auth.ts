import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import bcrypt from "bcryptjs";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0;

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

async function signSession(openId: string, name: string): Promise<string> {
  const expirationSeconds = Math.floor((Date.now() + ONE_YEAR_MS) / 1000);
  return new SignJWT({ openId, name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSecretKey());
}

async function verifySession(
  token: string | undefined
): Promise<{ openId: string; name: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    const { openId, name } = payload as Record<string, unknown>;
    if (!isNonEmptyString(openId)) return null;
    return { openId, name: isNonEmptyString(name) ? name : "" };
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

  const session = await verifySession(token);
  if (!session) return null;

  const user = await db.getUserByOpenId(session.openId);
  if (!user) return null;

  await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
  return user;
}

/** Registers local email/password auth routes: login, logout, me. */
export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = (req.body ?? {}) as {
      email?: string;
      password?: string;
    };

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const validEmail = process.env.AUTH_EMAIL;
    const validPasswordHash = process.env.AUTH_PASSWORD_HASH;

    if (!validEmail || !validPasswordHash) {
      console.error(
        "[Auth] AUTH_EMAIL / AUTH_PASSWORD_HASH are not configured"
      );
      res.status(500).json({ error: "Auth not configured" });
      return;
    }

    const emailMatches =
      email.trim().toLowerCase() === validEmail.trim().toLowerCase();
    const passwordMatches =
      emailMatches && (await bcrypt.compare(password, validPasswordHash));

    if (!emailMatches || !passwordMatches) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const openId = validEmail.trim().toLowerCase();
    await db.upsertUser({
      openId,
      email: openId,
      loginMethod: "password",
      role: "admin",
      lastSignedIn: new Date(),
    });

    const token = await signSession(openId, openId);
    res.cookie(COOKIE_NAME, token, {
      ...getSessionCookieOptions(req),
      maxAge: ONE_YEAR_MS,
    });

    const user = await db.getUserByOpenId(openId);
    res.json({ user });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
    res.json({ success: true });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const user = await authenticateRequest(req);
    res.json({ user });
  });
}
