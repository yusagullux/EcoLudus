import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getImpactSince, getRecentImpact } from "@/lib/impact-service";

// Read-only Impact stats for the dashboard. This is the first place users see
// the spine: a "Impact this week" cell in the hero row. Returns the total
// Impact granted in the last 7 days plus a small recent-activity feed.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  try {
    const since = new Date(Date.now() - WEEK_MS).toISOString();
    const [weekImpact, recent] = await Promise.all([
      getImpactSince(session.userId, since),
      getRecentImpact(session.userId, since, 8)
    ]);

    return NextResponse.json({
      weekImpact,
      recent: recent.map((row) => ({
        source: row.source,
        amount: row.amount,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    console.error("Impact stats error:", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}