import { NextResponse } from "next/server";
import { isDatabaseSetupError, sql } from "@/lib/db";

export async function GET() {
  try {
    const db = await sql<{ ok: number }>("select 1 as ok");

    return NextResponse.json({
      status: "ok",
      database: db.rows[0]?.ok === 1 ? "connected" : "unknown"
    });
  } catch (error) {
    const setupError = isDatabaseSetupError(error);

    return NextResponse.json(
      {
        status: "error",
        database: "unavailable",
        code: setupError ? "database-not-configured" : "database-unavailable",
        message: setupError
          ? "The production database is not configured."
          : "Database connection failed."
      },
      { status: setupError ? 503 : 500 }
    );
  }
}
