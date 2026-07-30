import { NextResponse } from "next/server";
import { getPetCatalog, getSeedCatalog } from "@/lib/catalog-server";
import { cachedJson } from "@/lib/api-cache";

// Public read-only species catalog (pets + seeds). Like /api/catalog/shop,
// this is display-only — names/images aren't secret, and the hatch/chest
// routes re-validate rewards server-side, so a client can't forge anything by
// tampering with what it renders. Pets and seeds live as constants in
// lib/catalog.ts (no DB table — they have no runtime-editable values), so the
// data is fully static — a 5-min server TTL + Cache-Control header layer the
// browser/CDN cache on top of the SWR client cache (lib/useCatalog.ts).
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_CONTROL = "public, max-age=300, s-maxage=300, stale-while-revalidate=600";

type SpeciesPayload = { pets: ReturnType<typeof getPetCatalog>; seeds: ReturnType<typeof getSeedCatalog> };

export async function GET() {
  try {
    const payload = await cachedJson<SpeciesPayload>("catalog:species", CACHE_TTL_MS, async () => ({
      pets: getPetCatalog(),
      seeds: getSeedCatalog()
    }));
    return NextResponse.json(payload, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "internal-error" } },
      { status: 500 }
    );
  }
}