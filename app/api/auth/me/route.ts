import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isDatabaseSetupError, sql } from "@/lib/db";
import { applyDailyStreak } from "@/lib/streak";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ user: null });
    }

    const result = await sql<{
      id: string;
      email: string;
      payload: Record<string, unknown>;
    }>("select id, email, payload from users where id = $1 limit 1", [session.userId]);

    const user = result.rows[0];
    if (!user) {
      return NextResponse.json({ user: null });
    }

    const nextPayload = applyDailyStreak(user.payload || {});
    const streakChanged =
      nextPayload.currentStreak !== user.payload.currentStreak ||
      nextPayload.longestStreak !== user.payload.longestStreak ||
      nextPayload.lastLoginDate !== user.payload.lastLoginDate;

    if (streakChanged) {
      await sql(
        "update users set payload = $2::jsonb, updated_at = now() where id = $1",
        [user.id, JSON.stringify(nextPayload)]
      );
    }

    return NextResponse.json({
      user: {
        uid: user.id,
        email: user.email,
        displayName: String(nextPayload.displayName ?? user.email.split("@")[0])
      }
    });
  } catch (error) {
    console.error("Session restore error:", error);
    if (isDatabaseSetupError(error)) {
      return NextResponse.json(
        { user: null, error: { code: "auth/database-not-configured" } },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { user: null, error: { code: "auth/session-restore-failed" } },
      { status: 503 }
    );
  }
}
