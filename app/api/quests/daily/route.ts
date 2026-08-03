import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { transaction, selectUserForUpdate } from "@/lib/db";
import { getAllQuestDefinitions } from "@/lib/carbon-calc";

// Server-validated daily-quest selection. The dashboard used to pick 5 quests
// client-side with Math.random() and write `currentDailyQuests` through
// `updateUserProfile`, so a client could rig the daily set to the 5 highest-XP
// quests and then complete them (quests/complete validates only that a
// completed quest is IN the stored set — it trusted the set itself). This
// route owns selection: under a row lock it picks 5 quests server-side from the
// catalog (excluding already-completed quests when possible), and writes the
// set + reset bookkeeping atomically. Idempotent within a UTC day — a same-day
// re-mount returns the already-selected set without re-rolling.

const DAILY_QUEST_COUNT = 5;

function isAfterMidnightUTC(lastResetTime: string | null | undefined): boolean {
  if (!lastResetTime) return true;
  const lastReset = new Date(lastResetTime);
  const now = new Date();
  const lastDate = `${lastReset.getUTCFullYear()}-${lastReset.getUTCMonth()}-${lastReset.getUTCDate()}`;
  const nowDate = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
  return lastDate !== nowDate;
}

// Deterministic-enough shuffle without Math.random (banned in some runtimes).
// Seeded by userId + the UTC date so the same user gets a stable set for the
// day, but different users / days get different sets.
function seededShuffle<T>(items: T[], seed: string): T[] {
  const arr = [...items];
  // xfnv1a hash → 32-bit seed
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let s = h >>> 0;
  const rand = () => {
    // mulberry32
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function POST() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  try {
    const allQuests = await getAllQuestDefinitions();

    return await transaction(async (query) => {
      const result = await selectUserForUpdate<{ payload: Record<string, unknown> }>(query, session.userId!);
      const locked = result.rows[0];
      if (!locked) {
        return NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 });
      }

      const profile = locked.payload ?? {};
      const lastReset = profile.lastQuestResetTime as string | undefined;
      const currentDailyQuests = Array.isArray(profile.currentDailyQuests)
        ? (profile.currentDailyQuests as unknown[]).map(String)
        : [];

      // Idempotent within the UTC day: if we already selected today, return the
      // existing set (don't re-roll on every mount).
      if (lastReset && currentDailyQuests.length > 0 && !isAfterMidnightUTC(lastReset)) {
        return NextResponse.json({
          success: true,
          currentDailyQuests,
          lastQuestResetTime: lastReset,
          reset: false
        });
      }

      const completedQuests = Array.isArray(profile.completedQuests)
        ? (profile.completedQuests as unknown[]).map(String)
        : [];

      let available = allQuests.filter((q) => !completedQuests.includes(q.id));
      if (available.length === 0) available = allQuests;
      if (available.length === 0) {
        return NextResponse.json({ error: { code: "quests/catalog-empty" } }, { status: 500 });
      }

      // Bias the daily set toward easy quests so new and casual users get a
      // friendly, low-friction set. Partition by difficulty, seed-shuffle each
      // bucket, then concatenate easy → medium → hard before slicing. Because
      // `completedQuests` is lifetime-cumulative and excluded above, users work
      // through the easy pool first, then medium, then hard — a natural
      // easy→hard progression over their lifetime (the pool resets to all
      // quests once everything is done, so easy ones come back around).
      const dayKey = new Date().toISOString().slice(0, 10);
      const seed = `${session.userId}:${dayKey}`;
      const easy = seededShuffle(
        available.filter((q) => q.difficulty === "easy"),
        seed
      );
      const medium = seededShuffle(
        available.filter((q) => q.difficulty === "medium"),
        seed
      );
      const hard = seededShuffle(
        available.filter((q) => q.difficulty === "hard"),
        seed
      );
      const ordered = [...easy, ...medium, ...hard];
      const selectedIds = ordered.slice(0, DAILY_QUEST_COUNT).map((q) => q.id);

      const now = new Date().toISOString();
      const nextPayload = {
        ...profile,
        lastQuestResetTime: now,
        currentDailyQuests: selectedIds,
        dailyQuestsCompleted: [],
        verifiedQuestProofs: {}
      };
      await query("update users set payload = $1::jsonb, updated_at = now() where id = $2", [
        JSON.stringify(nextPayload),
        session.userId
      ]);

      return NextResponse.json({
        success: true,
        currentDailyQuests: selectedIds,
        lastQuestResetTime: now,
        reset: true
      });
    });
  } catch (error) {
    console.error("Daily quest selection error:", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}