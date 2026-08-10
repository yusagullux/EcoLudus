import { timingSafeEqual } from "crypto";

/**
 * Constant-time verification of the `CRON_SECRET` bearer token used by the
 * `/api/cron/*` jobs. Replaces the prior `authHeader !== \`Bearer ${secret}\``
 * check, which short-circuits on the first mismatched byte and is a classic
 * timing oracle: over many requests an attacker can progressively recover the
 * secret by measuring response time. `timingSafeEqual` compares every byte in
 * constant time regardless of where the first difference lies.
 *
 * Returns true only when the `authorization` header is exactly
 * `Bearer <CRON_SECRET>`. When the secret is unset (cron not configured) every
 * request is rejected, matching the previous fail-closed behaviour.
 *
 * The length guard is required because `timingSafeEqual` throws on unequal
 * buffer lengths; the comparison itself is constant-time over the shared
 * length. Knowing the token length leaks nothing useful (the `Bearer ` prefix
 * is public and the remaining length is not secret material).
 */
export function verifyCronSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;
  if (authHeader.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}