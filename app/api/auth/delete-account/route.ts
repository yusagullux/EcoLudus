import { NextResponse } from "next/server";
import { z } from "zod";
import { clearSessionCookie, getSession, verifyPassword } from "@/lib/auth";
import { sql, transaction } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { verifyHCaptcha } from "@/lib/hcaptcha";

const deleteSchema = z.object({
  password: z.string().optional(),
  confirmation: z.literal("DELETE"),
  captchaToken: z.string().max(4096).optional()
});

// POST — permanent account deletion. Requires re-auth (password + typing
// "DELETE" + hCaptcha). Hard-deletes the user row (FK on delete cascade cleans
// mission_logs, mission_submissions, xp_transactions, etc.); team_active_missions
// has no user FK (user_id is in payload), so it's removed explicitly. A second
// request (retry after the cookie is cleared) finds no session and returns 401
// `auth/unauthenticated` — with stateless JWT auth a post-delete retry is
// indistinguishable from an unauthenticated probe, so 401 is the safe response
// (the spec's "200 idempotent" assumed a same-user retry stateless auth can't
// identify). Rate-limited 3/hr.
export async function POST(request: Request) {
  const limit = rateLimit(request, "auth-delete", 3, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: "auth/too-many-attempts", message: "Too many requests. Try again later." } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "auth/unauthenticated", message: "Sign in to continue." } },
      { status: 401 }
    );
  }

  let parsed;
  try {
    parsed = deleteSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Distinguish a wrong confirmation string from generic invalid input so
      // the UI can show the right message; neither reveals account state.
      const wrongConfirmation = (error.flatten().fieldErrors as Record<string, string[] | undefined>).confirmation?.[0];
      if (wrongConfirmation) {
        return NextResponse.json(
          { error: { code: "auth/invalid-confirmation", message: "Type DELETE to confirm." } },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: { code: "auth/invalid-input", details: error.flatten() } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "auth/invalid-json", message: "Invalid JSON payload" } },
      { status: 400 }
    );
  }

  if (!(await verifyHCaptcha(parsed.captchaToken, request))) {
    return NextResponse.json(
      { error: { code: "auth/captcha-failed", message: "Please complete the security check and try again." } },
      { status: 403 }
    );
  }

  // Re-auth: verify the password against the stored hash. A missing password is
  // treated as invalid credentials (password accounts always require it).
  if (!parsed.password || !(await verifyPasswordById(session.userId, parsed.password))) {
    return NextResponse.json(
      { error: { code: "auth/invalid-credentials", message: "Incorrect password." } },
      { status: 401 }
    );
  }

  try {
    // Cascade: remove the user's team membership (no FK on payload user_id),
    // then delete the user (FK cascade cleans the rest).
    await transaction(async (query) => {
      await query("delete from team_active_missions where payload->>'user_id' = $1", [session.userId]);
      await query("delete from users where id = $1", [session.userId]);
    });
  } catch (error) {
    console.error("delete-account error:", error);
    return NextResponse.json(
      { error: { code: "auth/internal-error", message: "Could not delete account." } },
      { status: 500 }
    );
  }

  await clearSessionCookie();
  return NextResponse.json({ message: "Account deleted." });
}

async function verifyPasswordById(userId: string, password: string): Promise<boolean> {
  const result = await sql<{ password_hash: string }>(
    "select password_hash from users where id = $1 limit 1",
    [userId]
  );
  const row = result.rows[0];
  if (!row) return false;
  return verifyPassword(password, row.password_hash);
}