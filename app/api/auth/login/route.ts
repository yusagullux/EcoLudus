import { NextResponse } from "next/server";
import { z } from "zod";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { isDatabaseSetupError, sql } from "@/lib/db";
import { applyDailyStreak } from "@/lib/streak";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128)
});

export async function POST(request: Request) {
  try {
    const payload = loginSchema.parse(await request.json());
    const email = payload.email.trim().toLowerCase();

    const result = await sql<{
      id: string;
      email: string;
      password_hash: string;
      payload: Record<string, unknown>;
    }>(
      "select id, email, password_hash, payload from users where email = $1 limit 1",
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return NextResponse.json(
        { error: { code: "auth/user-not-found" } },
        { status: 401 }
      );
    }

    const isValidPassword = await verifyPassword(payload.password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: { code: "auth/wrong-password" } },
        { status: 401 }
      );
    }

    await setSessionCookie({
      sub: user.id,
      email: user.email
    });

    const nextPayload = applyDailyStreak(user.payload || {});
    await sql(
      "update users set payload = $2::jsonb, updated_at = now() where id = $1",
      [user.id, JSON.stringify(nextPayload)]
    );

    return NextResponse.json({
      user: {
        uid: user.id,
        email: user.email,
        displayName: String(nextPayload.displayName ?? user.email.split("@")[0])
      }
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
