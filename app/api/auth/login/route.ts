import { NextResponse } from "next/server";
import { z } from "zod";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { isDatabaseSetupError, sql } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { verifyHCaptcha } from "@/lib/hcaptcha";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  captchaToken: z.string().max(4096).optional()
});

// Fixed invalid bcrypt hash used so the "user not found" path runs a bcrypt
// compare of the same cost as the "wrong password" path. Without this, the
// missing-user branch returns before any bcrypt work, creating a measurable
// timing oracle (bcrypt cost 12 takes tens of ms) that lets an attacker tell
// whether an email is registered. Comparing the supplied password against
// this dummy hash always fails in ~the same time a real verify takes, so both
// failure paths are indistinguishable in timing AND in response code. The hash
// is a real cost-12 bcrypt hash of a throwaway string — it never authenticates
// anyone because no row carries it.
const DUMMY_PASSWORD_HASH =
  "$2b$12$VWeo7gCKZE7AYbicxtSFXuegYWiTBggSQukEPPBhvbr7qcqZvsC9.";

export async function POST(request: Request) {
  const limit = rateLimit(request, "auth-login", 10, 5 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: "auth/too-many-attempts", message: "Too many sign-in attempts. Try again later." } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const payload = loginSchema.parse(await request.json());
    if (!(await verifyHCaptcha(payload.captchaToken, request))) {
      return NextResponse.json(
        { error: { code: "auth/captcha-failed", message: "Please complete the security check and try again." } },
        { status: 403 }
      );
    }
    const email = payload.email.trim().toLowerCase();

    const result = await sql<{
      id: string;
      email: string;
      password_hash: string;
      email_verified: boolean;
      token_version: number;
      payload: Record<string, unknown>;
    }>(
      "select id, email, password_hash, email_verified, token_version, payload from users where email = $1 limit 1",
      [email]
    );

    const user = result.rows[0];

    // Anti-enumeration: whether or not the account exists, run a bcrypt compare
    // against a hash so the response time is dominated by the same bcrypt work,
    // and return a single generic credential error. Previously this returned
    // distinct codes (`auth/user-not-found` vs `auth/wrong-password`) and skipped
    // bcrypt entirely for missing users — two independent oracles an attacker
    // could use to map the registered-user set for credential stuffing.
    const hashToVerify = user?.password_hash ?? DUMMY_PASSWORD_HASH;
    const isValidPassword = await verifyPassword(payload.password, hashToVerify);

    if (!user || !isValidPassword) {
      return NextResponse.json(
        { error: { code: "auth/invalid-credentials", message: "Invalid email or password." } },
        { status: 401 }
      );
    }

    await setSessionCookie({
      sub: user.id,
      email: user.email,
      tokenVersion: Number(user.token_version)
    });

    // Unverified: cookie is set (soft gate — browse OK), but we return the
    // not-verified code so the client can prompt to resend. Timing is already
    // equalized by the bcrypt compare above, so this branch adds no oracle.
    if (!user.email_verified) {
      return NextResponse.json(
        { error: { code: "auth/email-not-verified", message: "Please verify your email to continue." } },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: {
        uid: user.id,
        email: user.email,
        displayName: String(user.payload?.displayName ?? user.email.split("@")[0])
      },
      emailVerified: true
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "auth/invalid-input", details: error.flatten() } },
        { status: 400 }
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: { code: "auth/invalid-json", message: "Invalid JSON payload" } },
        { status: 400 }
      );
    }

    console.error("Login error details:", error);
    if (isDatabaseSetupError(error)) {
      return NextResponse.json(
        {
          error: {
            code: "auth/database-not-configured",
            message: "The production database is not configured. Set DATABASE_URL before using authentication."
          }
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: { code: "auth/internal-error", message: "Login failed. Please try again." } },
      { status: 500 }
    );
  }
}
