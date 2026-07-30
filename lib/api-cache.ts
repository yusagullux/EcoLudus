// Tiny per-instance in-memory TTL cache for read-only API responses whose data
// changes only on deploy (catalogs, community aggregates). Each server
// process/lambda keeps its own cache; the TTL bounds staleness across
// instances. Pair with a `Cache-Control: public, max-age=<ttl>` header so the
// browser/CDN cache and this server cache layer.
//
// (Not a replacement for the file-DB or Postgres layer — purely an
// optional memoization wrapper for GET handlers that read static-ish data.)

type Entry = { data: unknown; expiresAt: number };

const store = new Map<string, Entry>();

/**
 * Return `loader()`'s result, cached under `key` for `ttlMs`. On the first
 * call (or after expiry) runs the loader and caches the result. Concurrent
 * callers within the TTL share the cached value.
 */
export async function cachedJson<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() < hit.expiresAt) {
    return hit.data as T;
  }
  const data = await loader();
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

/** Drop a cached key (e.g. after a catalog reseed in dev). */
export function invalidateCache(key: string): void {
  store.delete(key);
}