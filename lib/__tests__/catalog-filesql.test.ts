import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// Regression guard for the file-DB fallback. The file fallback in lib/db.ts
// (`fileSql`) string-matches the EXACT normalized SQL text of each query the
// app issues — a new query without a matching branch throws
// "Unsupported file database query" in local dev (no Postgres). This test
// asserts every catalog query issued by lib/catalog-server.ts has a matching
// `if (normalized === "...")` branch in lib/db.ts, so a refactor that changes
// a query string can't silently break the file fallback.
//
// See CLAUDE.md "Data layer — dual-mode Postgres / file store".

function normalizeSql(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

const dbSource = readFileSync(path.join(process.cwd(), "lib", "db.ts"), "utf8");
// Collapse whitespace in the db.ts source so a branch comparison that wraps
// across lines (e.g. `normalized ===\n  "select ..."`) matches the same form
// the runtime normalizeSql() produces.
const dbSourceFlat = normalizeSql(dbSource);
const catalogServerSource = readFileSync(
  path.join(process.cwd(), "lib", "catalog-server.ts"),
  "utf8"
);

// Pull the SHOP_COLUMNS constant out of catalog-server.ts so we reconstruct
// the real runtime query strings (catalog-server builds them via interpolation).
const shopColumnsMatch = catalogServerSource.match(
  /SHOP_COLUMNS\s*=\s*"([^"]+)"/
);
const shopColumns = shopColumnsMatch ? shopColumnsMatch[1] : "";

// Extract every catalog query passed to `sql(...)` — either a backtick template
// literal (shop queries, which interpolate SHOP_COLUMNS) or a double-quoted
// string (team-template queries). Expand `${SHOP_COLUMNS}` and normalize; these
// are the exact strings fileSql must handle.
const catalogQueries: string[] = [];
const sqlArgRegex = /sql<[^>]*>\(\s*(?:`([^`]+)`|"([^"]+)")/g;
let match: RegExpExecArray | null;
while ((match = sqlArgRegex.exec(catalogServerSource)) !== null) {
  const raw = match[1] ?? match[2] ?? "";
  if (!/catalog_items|team_mission_templates/.test(raw)) continue;
  const expanded = raw.replace(/\$\{SHOP_COLUMNS\}/g, shopColumns);
  catalogQueries.push(normalizeSql(expanded));
}

describe("catalog fileSql branches", () => {
  it("catalog-server issues catalog queries against catalog_items / team_mission_templates", () => {
    expect(catalogQueries.length).toBeGreaterThanOrEqual(4);
  });

  for (const query of catalogQueries) {
    it(`fileSql handles: ${query.slice(0, 60)}…`, () => {
      // The branch must exist as an exact-match comparison in db.ts. Both the
      // db source and the query are normalized the same way the runtime
      // normalizeSql() does, so a refactor that changes whitespace or casing
      // in either place is caught.
      expect(dbSourceFlat).toContain(`normalized === "${query}"`);
    });
  }

  it("file-fallback store seeds the shop catalog (EMPTY_STORE includes catalog_items)", () => {
    expect(dbSource).toMatch(/catalog_items:\s*SHOP_SEED_ROWS/);
  });

  it("file-fallback store seeds the team templates (EMPTY_STORE includes team_mission_templates)", () => {
    expect(dbSource).toMatch(/team_mission_templates:\s*TEAM_MISSION_TEMPLATES/);
  });
});