import { NextResponse } from "next/server";
import { processMilestonesForAllUsers } from "@/lib/rewards-sync";

/**
 * Nightly cron job — plants trees for users who have hit milestones.
 * Secured with CRON_SECRET. Configured in vercel.json to run at 02:00 UTC daily.
 *
 * Manual test:
 *   curl -X POST /api/cron/process-rewards \
 *     -H "Authorization: Bearer <CRON_SECRET>"
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processMilestonesForAllUsers();

    return NextResponse.json({
      success: true,
      processed: result.processed,
      treesPlanted: result.treesPlanted,
      runAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Cron: reward processing error:", error);
    return NextResponse.json(
      { error: "Processing failed", message: String(error) },
      { status: 500 }
    );
  }
}

// Vercel Cron Jobs send GET requests
export async function GET(request: Request) {
  return POST(request);
}
