import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: { code: "auth/unauthenticated", message: "You must be signed in to fetch missions." } },
      { status: 401 }
    );
  }

  try {
    const result = await sql<{
      id: string;
      title: string;
      category: string;
      base_xp: number;
      repeat_window_seconds: number;
      metadata: Record<string, unknown>;
    }>(
      `select id, title, category, base_xp, repeat_window_seconds, metadata
       from missions
       where active = true and mission_type = 'private'
       order by title asc`
    );

    return NextResponse.json({
      success: true,
      missions: result.rows
    });
  } catch (error) {
    console.error("Failed to fetch private missions:", error);
    return NextResponse.json(
      { error: { code: "internal-error", message: "Failed to load habit missions." } },
      { status: 500 }
    );
  }
}
