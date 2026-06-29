import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const result = await sql(
      "select id, email, payload from users order by created_at asc limit 100"
    );

    const users = result.rows.map((row) => ({
      id: row.id,
      displayName: (row.payload as any)?.displayName || "Anonymous",
      xp: (row.payload as any)?.xp || 0,
      level: (row.payload as any)?.level || 1,
      ecoPoints: (row.payload as any)?.ecoPoints || 0
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Get all users error:", error);
    return NextResponse.json(
      { error: { code: "internal-error" } },
      { status: 500 }
    );
  }
}
