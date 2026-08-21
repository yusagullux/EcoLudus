import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";

// Public profile of any user, by id. Session-gated (only authenticated users
// can browse other profiles) and curated — returns only public fields, never
// email, friend requests, settings, notifications, or trust internals.

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: { code: "invalid-argument" } }, { status: 400 });
  }

  try {
    const result = await sql<{ id: string; payload: Record<string, unknown> }>(
      "select id, email, payload from users where id = $1 limit 1",
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      return NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 });
    }

    const p = (row.payload ?? {}) as Record<string, unknown>;

    const profile = {
      id: row.id,
      displayName: String(p.displayName ?? "Anonymous"),
      profileImage: typeof p.profileImage === "string" ? p.profileImage : null,
      xp: Number(p.xp ?? 0),
      level: Number(p.level ?? 1),
      ecoPoints: Number(p.ecoPoints ?? 0),
      missionsCompleted: Number(p.missionsCompleted ?? 0),
      carbonReduced: Number(p.carbonReduced ?? 0),
      currentStreak: Number(p.currentStreak ?? 0),
      longestStreak: Number(p.longestStreak ?? 0),
      lastLoginDate: String(p.lastLoginDate ?? "Not tracked yet"),
      completedQuests: Array.isArray(p.completedQuests) ? (p.completedQuests as string[]) : [],
      // Public collection data (same fields exposed by the owner's /collection page).
      plants: Array.isArray(p.plants) ? p.plants : [],
      eggs: Array.isArray(p.eggs) ? p.eggs : [],
      animals: Array.isArray(p.animals) ? p.animals : [],
      seeds: Array.isArray(p.seeds) ? p.seeds : [],
      chests: Array.isArray(p.chests) ? p.chests : []
    };

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Get public profile error:", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}