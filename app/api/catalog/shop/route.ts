import { NextResponse } from "next/server";
import { getShopCatalog, getDailyDeals } from "@/lib/catalog-server";
import { cachedJson } from "@/lib/api-cache";
import { logError } from "@/lib/logger";

// Public read-only shop catalog. Prices are not secret (they're shown on the
// shop page), so this needs no session. The buy route re-validates the price
// server-side by id, so this response is display-only — a client cannot buy
// at a cheaper price even if it tampers with what it renders. The catalog only
// changes on deploy (seeded by migrations), so a 5-min server TTL + a
// Cache-Control header layer the browser/CDN cache on top of the SWR client
// cache (lib/useCatalog.ts).
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_CONTROL = "public, max-age=300, s-maxage=300, stale-while-revalidate=600";

export async function GET() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const data = await cachedJson(`catalog:shop:${today}`, CACHE_TTL_MS, async () => {
      const catalog = await getShopCatalog();
      const dailyDeals = getDailyDeals();
      return { catalog, dailyDeals };
    });
    return NextResponse.json(
      data,
      { headers: { "Cache-Control": CACHE_CONTROL } }
    );
  } catch (error) {
    logError("Catalog shop read error", error);
    return NextResponse.json(
      { error: { code: "internal-error" } },
      { status: 500 }
    );
  }
}