import { NextResponse } from "next/server";
import { getTeamMissionTemplates } from "@/lib/catalog-server";
import { cachedJson } from "@/lib/api-cache";
import { logError } from "@/lib/logger";

// Public read-only team mission templates. Reward values (xp/eco/needed) are
// not secret — they're shown on the team page — so this needs no session. The
// assign route re-validates by id server-side, so a client cannot start a
// mission with inflated rewards even if it tampers with what it renders. The
// templates change only on deploy, so a 5-min server TTL + Cache-Control
// header layer the browser/CDN cache on top of the SWR client cache.
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_CONTROL = "public, max-age=300, s-maxage=300, stale-while-revalidate=600";

export async function GET() {
  try {
    const templates = await cachedJson("catalog:team-templates", CACHE_TTL_MS, () => getTeamMissionTemplates());
    return NextResponse.json(
      { templates },
      { headers: { "Cache-Control": CACHE_CONTROL } }
    );
  } catch (error) {
    logError("Catalog team-templates read error", error);
    return NextResponse.json(
      { error: { code: "internal-error" } },
      { status: 500 }
    );
  }
}