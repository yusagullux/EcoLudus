import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  const db = await sql<{ ok: number }>("select 1 as ok");

  return NextResponse.json({
    status: "ok",
    database: db.rows[0]?.ok === 1 ? "connected" : "unknown"
  });
}
