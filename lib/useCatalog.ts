"use client";

import useSWR from "swr";

// Shared SWR hooks for the public, read-only catalog endpoints.
//
// Performance (Phase 4a): shop + collection both load /api/catalog/shop, and
// the catalog only changes on deploy. These hooks share one SWR cache entry
// per endpoint, so navigating shop → collection (or re-mounting on a quick
// back-navigation) serves the cached response instantly instead of refetching.
// Dedupe is long (5 min) and focus revalidation is off — the data is static-ish
// and the reward routes re-validate everything server-side anyway.

async function catalogFetcher(url: string): Promise<any> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`catalog fetch failed: ${res.status}`);
  return res.json();
}

const CATALOG_OPTS = {
  revalidateOnFocus: false,
  dedupingInterval: 5 * 60_000
} as const;

type ShopCatalogEnvelope = {
  catalog?: { plants?: unknown[]; eggs?: unknown[]; chests?: unknown[] };
};
type SpeciesEnvelope = { pets?: unknown[]; seeds?: unknown[] };
type TeamTemplatesEnvelope = { templates?: unknown[] };

/** /api/catalog/shop — plants / eggs / chests (DB-backed catalog_items). */
export function useShopCatalog() {
  const { data, error, isLoading } = useSWR<ShopCatalogEnvelope>(
    "/api/catalog/shop",
    catalogFetcher,
    CATALOG_OPTS
  );
  const cat = data?.catalog;
  return {
    plants: Array.isArray(cat?.plants) ? cat.plants : [],
    eggs: Array.isArray(cat?.eggs) ? cat.eggs : [],
    chests: Array.isArray(cat?.chests) ? cat.chests : [],
    isLoading: isLoading && !data,
    error
  };
}

/** /api/catalog/species — pets + seeds (TS constants in lib/catalog). */
export function useSpeciesCatalog() {
  const { data, error, isLoading } = useSWR<SpeciesEnvelope>(
    "/api/catalog/species",
    catalogFetcher,
    CATALOG_OPTS
  );
  return {
    pets: Array.isArray(data?.pets) ? data.pets : [],
    seeds: Array.isArray(data?.seeds) ? data.seeds : [],
    isLoading: isLoading && !data,
    error
  };
}

/** /api/catalog/team-templates — team mission templates (display-only). */
export function useTeamTemplates() {
  const { data, error, isLoading } = useSWR<TeamTemplatesEnvelope>(
    "/api/catalog/team-templates",
    catalogFetcher,
    CATALOG_OPTS
  );
  return {
    templates: Array.isArray(data?.templates) ? data.templates : [],
    isLoading: isLoading && !data,
    error
  };
}