"use client";

import useSWR from "swr";

// Shared SWR hook for /quests.json — the static quest definitions served from
// public/. The dashboard and insights pages both used to fetch + JSON.parse it
// in their own useEffect on every mount. One shared SWR key dedupes them and
// caches across navigations. The file is static (1h HTTP cache header), so the
// dedupe interval is long and focus revalidation is off.

async function questsFetcher(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("quests fetch failed");
  return res.json();
}

export function useQuests() {
  const { data, error, isLoading } = useSWR("/quests.json", questsFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60 * 60_000
  });
  return {
    quests: data ?? null,
    isLoading: isLoading && !data,
    error
  };
}