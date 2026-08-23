type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function clientAddress(request: Request): string {
  // Vercel and most reverse proxies provide x-real-ip. Fall back to the first
  // forwarded address for local/proxy deployments. This is intentionally only
  // a best-effort signal; production deployments should also enable a WAF or
  // managed rate limiter at the edge.
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function rateLimit(request: Request, namespace: string, limit: number, windowMs: number) {
  const now = Date.now();
  const key = `${namespace}:${clientAddress(request)}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
      if (buckets.size >= MAX_BUCKETS) buckets.delete(buckets.keys().next().value as string);
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: Math.ceil(windowMs / 1000) };
  }

  current.count += 1;
  if (current.count <= limit) {
    return { allowed: true, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
  }

  return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}

