import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { consumeResetToken } from "@/lib/auth-tokens";
import { sql } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6).max(128)
});

// POST — consume the reset token (single-use), hash the new password, bump
// token_version (revokes ALL sessions including this one → re-login). No new
// cookie is set. Rate-limited 10/hr.
export async function POST(request: Request) {
  const limit = rateLimit(request, "auth-reset", 10, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: "auth/too-many-attempts", message: "Too many requests. Try again later." } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const payload = resetSchema.parse(await request.json());
    const consumed = await consumeResetToken(payload.token);

    if (consumed.status === "invalid") {
      return NextResponse.json(
        { error: { code: "auth/invalid-token", message: "This reset link is invalid." } },
        { status: 401 }
      );
    }
    if (consumed.status === "expired") {
      return NextResponse.json(
        { error: { code: "auth/expired-token", message: "This reset link has expired." } },
        { status: 401 }
      );
    }
    if (consumed.status === "used") {
      return NextResponse.json(
        { error: { code: "auth/used-token", message: "This reset link has already been used." } },
        { status: 401 }
      );
    }

    const passwordHash = await hashPassword(payload.password);
    await sql(
      "update users set password_hash = $1, token_version = token_version + 1 where id = $2",
      [passwordHash, consumed.userId]
    );

    return NextResponse.json({ message: "Password updated. Please log in." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "auth/invalid-input", details: error.flatten() } },
        { status: 400 }
      );
    }
    console.error("reset-password error:", error);
    return NextResponse.json(
      { error: { code: "auth/internal-error", message: "Could not reset password." } },
      { status: 500 }
    );
  }
}