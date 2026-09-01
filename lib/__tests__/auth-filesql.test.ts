import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// Regression guard mirroring lib/__tests__/catalog-filesql.test.ts: the file-DB
// fallback in lib/db.ts (`fileSql`) string-matches the EXACT normalized SQL text
// of each query. Every auth query issued by lib/auth-tokens.ts, lib/auth.ts, and
// the auth API routes MUST have a matching `if (normalized === "...")` branch in
// lib/db.ts, or local dev (no Postgres) throws "Unsupported file database query".

function normalizeSql(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

const dbSource = readFileSync(path.join(process.cwd(), "lib", "db.ts"), "utf8").replace(/\s+/g, " ");

function hasBranch(sql: string) {
  const needle = `if (normalized === "${normalizeSql(sql)}")`;
  return dbSource.includes(needle);
}

const AUTH_QUERIES = [
  "select email_verified, token_version from users where id = $1 limit 1",
  "select id, email, password_hash, email_verified, token_version, payload from users where email = $1 limit 1",
  "insert into verification_tokens (id, user_id, token_hash, expires_at) values ($1, $2, $3, $4)",
  "select user_id, expires_at from verification_tokens where token_hash = $1 limit 1",
  "delete from verification_tokens where token_hash = $1",
  "insert into password_reset_tokens (id, user_id, token_hash, expires_at) values ($1, $2, $3, $4)",
  "select user_id, expires_at, used_at from password_reset_tokens where token_hash = $1 limit 1",
  "update password_reset_tokens set used_at = now() where token_hash = $1",
  "update users set email_verified = true, token_version = token_version + 1 where id = $1",
  "update users set password_hash = $1, token_version = token_version + 1 where id = $2",
  "delete from team_active_missions where payload->>'user_id' = $1",
  "delete from users where id = $1",
  "select password_hash from users where id = $1 limit 1"
];

describe("auth fileSql contract", () => {
  it.each(AUTH_QUERIES)("has a fileSql branch for: %s", (sql) => {
    expect(hasBranch(sql), `Missing fileSql branch for: ${sql}`).toBe(true);
  });
});