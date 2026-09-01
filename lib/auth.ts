import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { logger } from "@/lib/logger";

const SESSION_COOKIE_NAME = "ecoquest_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

type SessionPayload = {
  sub: string;
  email: string;
  tokenVersion: number;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }

  if (!secret) {
    logger.warn("SESSION_SECRET not configured — using development fallback secret");
  }

  return new TextEncoder().encode(secret || "development-fallback-session-secret-at-least-32-chars-long");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ email: payload.email, token_version: payload.tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export type Session = {
  userId: string;
  email: string;
  emailVerified: boolean;
  tokenVersion: number;
};

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    // Pin the accepted algorithm to HS256. The signing key is a symmetric
    // secret, so RS*/ES* alg-confusion isn't exploitable today, but locking the
    // verifier to the one algorithm we actually sign with is cheap
    // defense-in-depth: it guarantees a token claiming any other alg (now or
    // after a jose upgrade that loosens defaults) is rejected outright.
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"]
    });

    if (!payload.sub || typeof payload.email !== "string") {
      return null;
    }

    // Claim vs DB check. Old cookies (pre-feature) carry no token_version —
    // treat as 0, matching the DB default, so the deploy doesn't log everyone
    // out. A mismatch (password changed / email verified on another device)
    // revokes this session.
    const claimVersion = typeof payload.token_version === "number" ? payload.token_version : 0;

    const result = await sql<{ email_verified: boolean; token_version: number }>(
      "select email_verified, token_version from users where id = $1 limit 1",
      [payload.sub]
    );

    const row = result.rows[0];
    if (!row) return null;
    if (Number(row.token_version) !== claimVersion) return null;

    return {
      userId: payload.sub,
      email: payload.email,
      emailVerified: Boolean(row.email_verified),
      tokenVersion: Number(row.token_version)
    };
  } catch {
    return null;
  }
}

// Server-side soft gate for reward/action routes. Returns the session when the
// user is verified; otherwise a 401 response the route can return directly.
export async function requireVerifiedUser(): Promise<Session | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "auth/unauthenticated", message: "Sign in to continue." } },
      { status: 401 }
    );
  }
  if (!session.emailVerified) {
    return NextResponse.json(
      { error: { code: "auth/email-not-verified", message: "Please verify your email to continue." } },
      { status: 401 }
    );
  }
  return session;
}
