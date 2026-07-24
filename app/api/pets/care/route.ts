import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { grantImpact } from "@/lib/impact-service";

// Server-validated pet care. The pets page used to mutate XP/eco/stat fields
// straight through `updateUserProfile`, which was trivially forgeable (a client
// could send any XP/eco it wanted). This route owns the care mutation:
// it validates the pet exists, enforces the 5/day eco-reward cap per pet, applies
// the stat bumps, and routes any XP/eco through the spine. Pet care is a *small*
// daily reward, so it grants XP (and eco for paid actions) but Impact is left at
// 0 here — the companion biome grows from real eco activity, not from snacking
// (see the gamification plan: "Pet care boosts vitality, not biome").

const careSchema = z.object({
  petId: z.string().min(1),
  action: z.enum(["snack", "train", "play", "pet"])
});

// Mirrors the constants in app/(game)/pets/page.tsx — single source of truth
// lives here now (server-enforced). The client no longer decides reward amounts.
const ACTION_TABLE: Record<string, { stat: "energy" | "bond" | "happiness"; amount: number; cost: number; xp: number; eco: number }> = {
  snack: { stat: "energy", amount: 18, cost: 8, xp: 8, eco: 0 },
  train: { stat: "bond", amount: 12, cost: 0, xp: 18, eco: 4 },
  play: { stat: "happiness", amount: 14, cost: 4, xp: 12, eco: 2 },
  pet: { stat: "happiness", amount: 2, cost: 0, xp: 2, eco: 0 } // free "pet" tap
};

const MAX_ECO_ACTIONS_PER_DAY = 5;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function clampStat(value: unknown, fallback: number) {
  return Math.max(0, Math.min(100, Number(value ?? fallback) || fallback));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  let parsed: z.infer<typeof careSchema>;
  try {
    parsed = careSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: "invalid-argument", details: error.flatten() } }, { status: 400 });
    }
    throw error;
  }

  try {
    const userResult = await sql<{ email: string; payload: Record<string, unknown> }>(
      "select id, email, payload from users where id = $1 limit 1",
      [session.userId]
    );
    if (userResult.rowCount === 0) {
      return NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 });
    }

    const profile = userResult.rows[0].payload ?? {};
    const animals = Array.isArray(profile.animals)
      ? (profile.animals as Array<Record<string, unknown>>).map((pet) => ({ ...pet }))
      : [];

    const pet = animals.find((entry) => String(entry.id) === parsed.petId) ?? null;
    if (!pet) {
      return NextResponse.json({ error: { code: "pets/not-found" } }, { status: 404 });
    }

    const action = ACTION_TABLE[parsed.action];
    const today = todayKey();
    const lastCareDate = String(pet.lastCareDate ?? "");
    const isNewCareDay = lastCareDate !== today;
    const careActionsToday = isNewCareDay ? 0 : Math.max(0, Number(pet.careActionsToday ?? 0));

    // Enforce the daily eco-reward cap server-side (the whole point of moving this here).
    if (action.eco > 0 && careActionsToday >= MAX_ECO_ACTIONS_PER_DAY) {
      return NextResponse.json(
        { error: { code: "pets/eco-cap-reached", message: `Daily eco reward limit reached for this companion (${MAX_ECO_ACTIONS_PER_DAY}/day).` } },
        { status: 429 }
      );
    }

    // Validate the eco cost can be paid.
    const currentEco = Math.max(0, Number(profile.ecoPoints ?? 0) || 0);
    if (action.cost > 0 && currentEco < action.cost) {
      return NextResponse.json(
        { error: { code: "pets/insufficient-eco", message: `Need ${action.cost} EcoPoints for this action.` } },
        { status: 400 }
      );
    }

    const ecoGained = action.eco > 0 && careActionsToday < MAX_ECO_ACTIONS_PER_DAY ? action.eco : 0;

    const nextAnimals = animals.map((entry) => {
      if (String(entry.id) !== parsed.petId) return entry;
      const currentStatValue = clampStat(entry[action.stat], action.stat === "bond" ? 10 : 50);
      return {
        ...entry,
        [action.stat]: Math.min(100, currentStatValue + action.amount),
        happiness: Math.min(
          100,
          clampStat(entry.happiness, 50) + (action.stat === "happiness" ? 0 : 4)
        ),
        petsGiven: Number(entry.petsGiven ?? 0) + 1,
        careActionsToday: careActionsToday + 1,
        careStreak: isNewCareDay ? Number(entry.careStreak ?? 0) + 1 : Number(entry.careStreak ?? 0),
        lastCareDate: today,
        lastPettedAt: new Date().toISOString()
      };
    });

    const granted = await grantImpact({
      userId: session.userId,
      source: "petCare",
      baseXp: action.xp,
      baseImpact: 0, // pet care feeds vitality (Phase 2), not the spine
      eco: ecoGained - action.cost, // net eco delta (reward minus cost)
      meta: { action: parsed.action, petId: parsed.petId, petName: String(pet.name ?? "") },
      payloadPatch: { animals: nextAnimals }
    });

    return NextResponse.json({
      success: true,
      action: parsed.action,
      petId: parsed.petId,
      xpAwarded: action.xp,
      ecoGained,
      ecoSpent: action.cost,
      careActionsToday: careActionsToday + 1,
      ecoCapReached: careActionsToday + 1 >= MAX_ECO_ACTIONS_PER_DAY && action.eco > 0,
      level: granted?.level ?? null,
      xp: granted?.xp ?? null,
      ecoPoints: granted?.ecoPoints ?? currentEco - action.cost + ecoGained
    });
  } catch (error) {
    console.error("Pet care error:", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}