import { NextResponse } from "next/server";
import { isDatabaseSetupError, sql } from "@/lib/db";
import { logError } from "@/lib/logger";

/**
 * Keep-alive cron — pings the database on a regular schedule so the Supabase
 * free-tier project does not auto-pause after inactivity. A paused project is
 * the most likely cause of the intermittent "cannot connect to Supabase"
 * errors: the first request after a pause fails/times out until it wakes.
 *
 * Secured with CRON_SECRET. Configured in vercel.json to run every 6 hours.
 * Always returns 200 so Vercel Cron does not flag wake-up latency as a failure.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let database: "connected" | "unavailable" = "unavailable";
  try {
    const db = await sql<{ ok: number }>("select 1 as ok");
    database = db.rows[0]?.ok === 1 ? "connected" : "unavailable";
  } catch (error) {
    // Don't fail the cron — the connection attempt itself helps wake a paused project.
    if (!isDatabaseSetupError(error)) {
      logError("Keep-alive DB ping failed", error);
    }
  }

  return NextResponse.json({ status: "ok", database, runAt: new Date().toISOString() });
}

// Vercel Cron Jobs send GET requests
export async function GET(request: Request) {
  return POST(request);
}
