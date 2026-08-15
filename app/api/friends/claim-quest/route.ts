import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { transaction, selectUserForUpdate } from "@/lib/db";
import { grantProgression, type ProgressionUser } from "@/lib/progression";

// Server-validated social-quest claim. The friends page used to grant the
// quest's XP + eco straight through `updateUserProfile` after a client-side
// progress check, so a client could claim any reward (or re-claim) at will.
// This route re-derives the quest progress from stored state (cheersGiven /
// friends count), enforces the target, blocks re-claims via
// `claimedSocialRewards`, and routes the reward through the spine.
//
// Social quests are meta-achievements over social activity (cheers given,
// friends added), so the grant uses source:"friend".

type Metric = "friends" | "cheersGiven";

type SocialQuest = {
  id: string;
  title: string;
  target: number;
  metric: Metric;
  xp: number;
  eco: number;
};

// Mirrors SOCIAL_QUESTS in app/(game)/friends/page.tsx — server is the source
// of truth for targets and rewards so a client can't forge them.
const SOCIAL_QUESTS: SocialQuest[] = [
  { id: "first_friend", title: "Add your first friend", target: 1, metric: "friends", xp: 35, eco: 20 },
  { id: "give_three_cheers", title: "Give 3 cheers", target: 3, metric: "cheersGiven", xp: 55, eco: 30 },
  { id: "squad_of_five", title: "Form a squad of 5", target: 5, metric: "friends", xp: 100, eco: 75 }
];

const claimSchema = z.object({ questId: z.string().min(1) });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  let parsed: z.infer<typeof claimSchema>;
  try {
    parsed = claimSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: "invalid-argument", details: error.flatten() } }, { status: 400 });
    }
    throw error;
  }

  try {
    // Read → re-claim guard → progress check → grant inside one transaction with
    // a row lock on the user row. The `claimedSocialRewards` re-claim guard is
    // checked against the locked row, so two concurrent claims can no longer
    // both pass the guard and double-grant the quest's XP/eco (the lost-update
    // class fixed in the other reward routes — see the reward-routes-lost-update
    // note). grantImpact shares the lock via `tx` (no re-read, no nested tx).
    // note). grantProgression shares the lock via `tx` (no re-read, no nested tx).
    return await transaction(async (query) => {
      const userResult = await selectUserForUpdate<ProgressionUser>(query, session.userId!);
      if (userResult.rowCount === 0) {
        return NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 });
      }

      const quest = SOCIAL_QUESTS.find((q) => q.id === parsed.questId) ?? null;
      if (!quest) {
        return NextResponse.json({ error: { code: "social-quest/not-found" } }, { status: 404 });
      }

      const user = userResult.rows[0];
      const profile = user.payload ?? {};
      const claimedSocialRewards = Array.isArray(profile.claimedSocialRewards)
        ? (profile.claimedSocialRewards as string[])
        : [];
      if (claimedSocialRewards.includes(quest.id)) {
        return NextResponse.json(
          { error: { code: "social-quest/already-claimed", message: "You've already claimed this reward." } },
          { status: 409 }
        );
      }

      // Re-derive progress from stored state — never trust the client's number.
      const friends = Array.isArray(profile.friends) ? (profile.friends as unknown[]) : [];
      const socialStats = (profile.socialStats ?? {}) as Record<string, unknown>;
      const progress =
        quest.metric === "friends"
          ? friends.length
          : Math.max(0, Number(socialStats.cheersGiven ?? 0));

      if (progress < quest.target) {
        return NextResponse.json(
          { error: { code: "social-quest/not-complete", message: "You haven't met the goal for this reward yet." } },
          { status: 425 }
        );
      }

      const granted = await grantProgression({
        userId: session.userId,
        source: "friend",
        baseXp: quest.xp,
        eco: quest.eco,
        meta: { questId: quest.id, metric: quest.metric, target: quest.target },
        payloadPatch: { claimedSocialRewards: [...claimedSocialRewards, quest.id] },
        // Share the locked transaction so the re-claim guard + reward grant are
        // one atomic unit.
        tx: { query, user }
      });

      return NextResponse.json({
        success: true,
        questId: quest.id,
        xpAwarded: quest.xp,
        ecoAwarded: quest.eco,
        level: granted?.level ?? null,
        xp: granted?.xp ?? null,
        ecoPoints: granted?.ecoPoints ?? null
      });
    });
  } catch (error) {
    console.error("Social quest claim error:", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}