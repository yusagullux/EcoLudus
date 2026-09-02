import { NextResponse } from "next/server";
import { z } from "zod";
import { createResetToken } from "@/lib/auth-tokens";
import { sendEmail, appUrl, logDevAuthLink } from "@/lib/email";
import { buildPasswordResetEmailHtml, buildPasswordResetEmailText } from "@/lib/email-templates/auth-emails";
import { sql } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { verifyHCaptcha } from "@/lib/hcaptcha";

const forgotSchema = z.object({
  email: z.string().email(),
  captchaToken: z.string().max(4096).optional()
});

const GENERIC = { message: "If the email exists, a reset link was sent." };

// Anti-enumeration: always 200 with the same body, regardless of whether the
// email is registered. Only create + send if the user exists. Rate-limited 5/hr.
export async function POST(request: Request) {
  const limit = rateLimit(request, "auth-forgot", 5, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: "auth/too-many-attempts", message: "Too many requests. Try again later." } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const payload = forgotSchema.parse(await request.json());
    if (!(await verifyHCaptcha(payload.captchaToken, request))) {
      return NextResponse.json(
        { error: { code: "auth/captcha-failed", message: "Please complete the security check and try again." } },
        { status: 403 }
      );
    }

    const email = payload.email.trim().toLowerCase();
    const result = await sql<{ id: string; payload: Record<string, unknown> }>(
      "select id, email, password_hash, email_verified, token_version, payload from users where email = $1 limit 1",
      [email]
    );
    const user = result.rows[0];

    if (user) {
      const rawToken = await createResetToken(user.id);
      const resetUrl = `${appUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
      const displayName = String(user.payload?.displayName ?? email.split("@")[0]);
      const emailResult = await sendEmail({
        to: email,
        toName: displayName,
        subject: "Reset your password — EcoLudus",
        html: buildPasswordResetEmailHtml({ displayName, email, resetUrl }),
        text: buildPasswordResetEmailText({ displayName, email, resetUrl })
      });
      logDevAuthLink("Password reset", resetUrl, emailResult);
    }

    // Same response whether or not the email exists.
    return NextResponse.json(GENERIC);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Still 200-ish? No — invalid input is a client bug, return 400 but do
      // not reveal existence. Use the generic message to avoid enumeration.
      return NextResponse.json(GENERIC, { status: 400 });
    }
    console.error("forgot-password error:", error);
    // Swallow — never reveal provider/email state.
    return NextResponse.json(GENERIC);
  }
}