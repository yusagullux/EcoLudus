import { NextResponse } from "next/server";
import { getTeamMissionTemplates } from "@/lib/catalog-server";
import { logError } from "@/lib/logger";

// Public read-only team mission templates. Reward values (xp/eco/needed) are
// not secret — they're shown on the team page — so this needs no session. The
// assign route re-validates by id server-side, so a client cannot start a
// mission with inflated rewards even if it tampers with what it renders.
export async function GET() {
  try {
    const templates = await getTeamMissionTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    logError("Catalog team-templates read error", error);
    return NextResponse.json(
      { error: { code: "internal-error" } },
      { status: 500 }
    );
  }
}