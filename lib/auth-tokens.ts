import { createHash, randomUUID } from "crypto";
import { sql } from "@/lib/db";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export function generateToken(): string {
  return randomUUID();
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function isoFromNow(ttlMs: number): string {
  return new Date(Date.now() + ttlMs).toISOString();
}

// Insert a hashed verification token (24h). Returns the RAW token — the caller
// puts it in the email link; only the hash is stored. Any prior unused
// verification token for this user is replaced first (file branch enforces this;
// for Postgres we delete-then-insert in one round-trip via the file-equivalent).
export async function createVerificationToken(userId: string): Promise<string> {
  const raw = generateToken();
  const tokenHash = hashToken(raw);
  const expiresAt = isoFromNow(VERIFICATION_TTL_MS);
  await sql(
    "insert into verification_tokens (id, user_id, token_hash, expires_at) values ($1, $2, $3, $4)",
    [randomUUID(), userId, tokenHash, expiresAt]
  );
  return raw;
}

export async function createResetToken(userId: string): Promise<string> {
  const raw = generateToken();
  const tokenHash = hashToken(raw);
  const expiresAt = isoFromNow(RESET_TTL_MS);
  await sql(
    "insert into password_reset_tokens (id, user_id, token_hash, expires_at) values ($1, $2, $3, $4)",
    [randomUUID(), userId, tokenHash, expiresAt]
  );
  return raw;
}

export type ConsumeResult =
  | { status: "ok"; userId: string }
  | { status: "expired" }
  | { status: "invalid" };

export type ResetConsumeResult =
  | { status: "ok"; userId: string }
  | { status: "expired" }
  | { status: "used" }
  | { status: "invalid" };

// Peek-then-delete so we can distinguish expired from invalid. Single-use: the
// row is deleted whether valid or expired, so a link can only ever be consumed
// once.
export async function consumeVerificationToken(raw: string): Promise<ConsumeResult> {
  const tokenHash = hashToken(raw);
  const peek = await sql<{ user_id: string; expires_at: string }>(
    "select user_id, expires_at from verification_tokens where token_hash = $1 limit 1",
    [tokenHash]
  );
  const row = peek.rows[0];
  if (!row) return { status: "invalid" };
  await sql("delete from verification_tokens where token_hash = $1", [tokenHash]);
  if (new Date(row.expires_at).getTime() <= Date.now()) return { status: "expired" };
  return { status: "ok", userId: row.user_id };
}

// Peek-then-mark-used so we can distinguish expired / reused / invalid. The
// used_at guard makes reuse impossible: once consumed, used_at is set and a
// second consume returns { status: "used" }.
export async function consumeResetToken(raw: string): Promise<ResetConsumeResult> {
  const tokenHash = hashToken(raw);
  const peek = await sql<{ user_id: string; expires_at: string; used_at: string | null }>(
    "select user_id, expires_at, used_at from password_reset_tokens where token_hash = $1 limit 1",
    [tokenHash]
  );
  const row = peek.rows[0];
  if (!row) return { status: "invalid" };
  if (row.used_at) return { status: "used" };
  if (new Date(row.expires_at).getTime() <= Date.now()) return { status: "expired" };
  await sql("update password_reset_tokens set used_at = now() where token_hash = $1", [tokenHash]);
  return { status: "ok", userId: row.user_id };
}