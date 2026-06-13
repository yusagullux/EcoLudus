import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const db = await sql<{ ok: number }>("select 1 as ok");

    return NextResponse.json({
      status: "ok",
      database: db.rows[0]?.ok === 1 ? "connected" : "unknown"
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        database: "unavailable",
        message: error instanceof Error ? error.message : "Database connection failed"
      },
      { status: 500 }
    );
  }
}
