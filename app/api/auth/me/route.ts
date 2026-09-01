import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isDatabaseSetupError, sql } from "@/lib/db";

// Pure read — the session bootstrap. It must NOT write: a GET that mutates the
// user row is (a) a full-payload overwrite with no row lock, so it clobbers any
// concurrent reward grant (lost-update class, audit H6), and (b) un-cacheable, so
// it re-runs on every navigation instead of being served from cache. The daily
// streak counter + milestone rewards are persisted atomically under a row lock
// by POST /api/streak/apply (called by the dashboard on mount); this route just
// reports identity for the client. Swr-friendly: callers may cache this.
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

    return NextResponse.json({
      user: {
        uid: user.id,
        email: user.email,
        displayName: String(user.payload?.displayName ?? user.email.split("@")[0])
      },
      emailVerified: session.emailVerified,
      profile: user.payload ?? {}
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
