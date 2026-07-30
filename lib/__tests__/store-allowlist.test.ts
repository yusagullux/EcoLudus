import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// Regression guard for the /api/store user-field allowlist (audit finding C1).
// The generic document-store RPC lets an authenticated user write its own
// `users` document. Without an allowlist a client could mint the entire economy
// (`setDoc({ xp: 999999, ecoPoints: 999999 })`) or send `__increment__` sentinels
// on any field, or forge `verifiedQuestProofs` to bypass Gemini photo
// verification — making every locked reward route pointless.
//
// This test reads lib/document-store.ts as text and asserts:
//   1. the CLIENT_WRITABLE_USER_FIELDS set contains ONLY the cosmetic/profile
//      fields — every formerly-transitional field (garden, plants, animals,
//      activePet, currentDailyQuests, …) moved server-side in Phase 3 and must
//      NOT be client-writable, and no economy / inventory / verification / streak
//      gates are listed, and
//   2. setDocument's users branch + updateDocument route the client data through
//      filterClientUserFields so the gate can't be silently removed.
//
// It's a source-text contract (like catalog-filesql.test.ts) rather than a
// behavioral test because document-store.ts is `@ts-nocheck` and imports the
// dual-mode db pool — importing it in unit tests is brittle.

const source = readFileSync(path.join(process.cwd(), "lib", "document-store.ts"), "utf8");

function extractAllowlist(src: string): Set<string> {
  const match = src.match(/CLIENT_WRITABLE_USER_FIELDS\s*=\s*new Set<string>\(\s*\[([\s\S]*?)\]\s*\)/);
  if (!match) {
    throw new Error("CLIENT_WRITABLE_USER_FIELDS set not found in document-store.ts");
  }
  const fields = Array.from(match[1].matchAll(/"([a-zA-Z_]+)"/g)).map((m) => m[1]);
  return new Set(fields);
}

const allowlist = extractAllowlist(source);

describe("CLIENT_WRITABLE_USER_FIELDS allowlist", () => {
  const expectedAllowed = [
    // Cosmetic / profile (permanent) — the only client-writable user fields.
    "displayName", "profileImage", "settings", "theme", "preferences"
  ];

  it.each(expectedAllowed)("permits the cosmetic field %s", (field) => {
    expect(allowlist.has(field)).toBe(true);
  });

  const mustBlock = [
    // Economy — must never be client-writable
    "xp", "level", "ecoPoints", "impact", "impactBySource",
    "carbonReduced", "treesPlanted", "missionsCompleted", "trustScore",
    // Inventory — server-rolled only
    "eggs", "chests",
    // Streak / claim / milestone gates — re-trigger exploits
    "lastStreakRewardDay", "claimedSocialRewards",
    // Photo-verification map — written only by the locked /api/quests/verify route
    "verifiedQuestProofs",
    // Formerly transitional — now server-authoritative (Phase 3). These MUST be
    // blocked so a client can't forge a legendary onto a garden tile, max a
    // pet's stats, or rig the daily quest set. Server routes own them:
    // /api/garden/plant|remove, /api/pets/select, /api/quests/daily.
    "animals", "activePet", "garden", "plants", "seeds",
    "currentDailyQuests", "dailyQuestsCompleted", "lastQuestResetTime"
  ];

  it.each(mustBlock)("blocks the sensitive/formerly-transitional field %s", (field) => {
    expect(allowlist.has(field)).toBe(false);
  });

  it("contains exactly the five cosmetic fields (no extras slipped in)", () => {
    expect(allowlist.size).toBe(5);
    expect(Array.from(allowlist).sort()).toEqual(
      ["displayName", "preferences", "profileImage", "settings", "theme"]
    );
  });
});

describe("store write paths enforce the allowlist", () => {
  it("setDocument users branch merges with the live row and filters client fields", () => {
    expect(source).toContain("filterClientUserFields(data)");
    expect(source).toMatch(/if \(ref\.collection === "users"\)[\s\S]*?readUser\(ref\.id\)/);
  });

  it("updateDocument filters the client patch for the users collection before applyPatch", () => {
    expect(source).toContain("filterClientUserFields(updates)");
    expect(source).toContain("ref.collection === \"users\" ? filterClientUserFields(updates) : updates");
  });

  it("filterClientUserFields rejects __op sentinel values", () => {
    expect(source).toMatch(/"__op" in/);
  });
});