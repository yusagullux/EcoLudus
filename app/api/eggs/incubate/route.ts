import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { grantImpact } from "@/lib/impact-service";
import { PET_CATALOG, type PetSpecies } from "@/lib/catalog";

// Server-owned egg lifecycle. The collection page used to mutate eggs /
// hatchings / ecoPoints straight through `updateUserProfile`, and — worse —
// rolled the hatched pet with Math.random() *in the browser* and then wrote
// the chosen animal into `profile.animals`. A client could forge any pet at
// any rarity on demand. This route owns every egg mutation:
//
//   incubate — place an owned egg into a free incubator slot (spend the egg)
//   warm     — spend 10 eco to shave 15 min off the timer (capped at start)
//   instant  — spend eco to force the egg ready now
//   hatch    — validate the egg is ready (timing checked server-side), roll
//              the animal from animalRewards[rarity] SERVER-side, mint it into
//              profile.animals, remove the hatching, and fire a one-shot
//              source:"egg" Impact grant. Returns the rolled animal so the
//              client can reveal it cosmetically.
//
// incubate / warm / instant are spends (no Impact) and use a direct payload
// write. Only the actual hatch is a spine source.

type Rarity = "common" | "rare" | "epic" | "legendary";

// Mirrors the constants in app/(game)/collection/page.tsx — single source of
// truth lives here now (server-enforced).
const HATCH_DURATIONS: Record<Rarity, number> = {
  common: 60 * 60 * 1000, // 1 hour
  rare: 4 * 60 * 60 * 1000, // 4 hours
  epic: 12 * 60 * 60 * 1000, // 12 hours
  legendary: 24 * 60 * 60 * 1000 // 24 hours
};

const WARM_REDUCTION_MS = 15 * 60 * 1000;
const WARM_COST = 10;
const MAX_INCUBATOR_SLOTS = 3;

// One-shot Impact + XP granted the moment a pet is actually hatched. Rarer
// eggs grant more — hatching is a real, infrequent eco milestone, not a farm.
const HATCH_IMPACT: Record<Rarity, number> = { common: 8, rare: 20, epic: 45, legendary: 100 };
const HATCH_XP: Record<Rarity, number> = { common: 15, rare: 40, epic: 90, legendary: 200 };

const animalRewards: Record<Rarity, PetSpecies[]> = {
  common: PET_CATALOG.filter((p) => p.rarity === "common"),
  rare: PET_CATALOG.filter((p) => p.rarity === "rare"),
  epic: PET_CATALOG.filter((p) => p.rarity === "epic"),
  legendary: PET_CATALOG.filter((p) => p.rarity === "legendary")
};

function normalizeRarity(value: unknown): Rarity {
  return (["common", "rare", "epic", "legendary"] as Rarity[]).includes(value as Rarity)
    ? (value as Rarity)
    : "common";
}

const incubateSchema = z.object({
  action: z.enum(["incubate", "warm", "instant", "hatch"]),
  eggId: z.union([z.string(), z.number()]).optional(),
  hatchingId: z.string().min(1).optional()
});

function writePayload(userId: string, email: string, payload: Record<string, unknown>) {
  return sql(
    `insert into users (id, email, password_hash, payload)
     values ($1, $2, coalesce((select password_hash from users where id = $1), ''), $3::jsonb)
     on conflict (id) do update
     set email = excluded.email,
         payload = excluded.payload,
         updated_at = now()`,
    [userId, email, JSON.stringify(payload)]
  );
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  let parsed: z.infer<typeof incubateSchema>;
  try {
    parsed = incubateSchema.parse(await request.json());
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

    const email = userResult.rows[0].email;
    const profile = userResult.rows[0].payload ?? {};
    const now = Date.now();

    // ---------- incubate: place an owned egg into an incubator slot ----------
    if (parsed.action === "incubate") {
      if (parsed.eggId === undefined) {
        return NextResponse.json({ error: { code: "invalid-argument", message: "eggId is required" } }, { status: 400 });
      }
      const eggs = Array.isArray(profile.eggs) ? [...(profile.eggs as Array<Record<string, unknown>>)] : [];
      const hatchings = Array.isArray(profile.hatchings) ? [...(profile.hatchings as Array<Record<string, unknown>>)] : [];

      if (hatchings.length >= MAX_INCUBATOR_SLOTS) {
        return NextResponse.json(
          { error: { code: "eggs/no-slot", message: "All incubator slots are full. Hatch an egg to free up a slot." } },
          { status: 409 }
        );
      }

      const egg = eggs.find((e) => String(e.id) === String(parsed.eggId)) ?? null;
      if (!egg || Number(egg.count ?? 1) <= 0) {
        return NextResponse.json({ error: { code: "eggs/not-owned" } }, { status: 404 });
      }

      const rarity = normalizeRarity(egg.rarity);
      const nextEggs = eggs
        .map((e) => (String(e.id) === String(parsed.eggId) ? { ...e, count: Number(e.count ?? 1) - 1 } : e))
        .filter((e) => Number(e.count ?? 1) > 0);

      const newHatching: Record<string, unknown> = {
        id: `hatch-${now}-${Math.floor(Math.random() * 1000)}`,
        eggId: egg.id,
        name: String(egg.name ?? "Egg"),
        rarity,
        startTime: now,
        endTime: now + (HATCH_DURATIONS[rarity] ?? HATCH_DURATIONS.common),
        warmedCount: 0
      };

      const nextProfile = { ...profile, eggs: nextEggs, hatchings: [...hatchings, newHatching] };
      await writePayload(session.userId, email, nextProfile);

      return NextResponse.json({ success: true, action: "incubate", hatching: newHatching });
    }

    // ---- warm / instant / hatch all operate on a specific hatching ----
    if (!parsed.hatchingId) {
      return NextResponse.json({ error: { code: "invalid-argument", message: "hatchingId is required" } }, { status: 400 });
    }

    const hatchings = Array.isArray(profile.hatchings) ? [...(profile.hatchings as Array<Record<string, unknown>>)] : [];
    const hatching = hatchings.find((h) => String(h.id) === String(parsed.hatchingId)) ?? null;
    if (!hatching) {
      return NextResponse.json({ error: { code: "eggs/hatching-not-found" } }, { status: 404 });
    }

    // ---------- warm: spend 10 eco, shave 15 min off the timer ----------
    if (parsed.action === "warm") {
      const currentEco = Math.max(0, Number(profile.ecoPoints ?? 0) || 0);
      if (currentEco < WARM_COST) {
        return NextResponse.json(
          { error: { code: "eggs/insufficient-eco", message: `Need ${WARM_COST} EcoPoints to warm the egg.` } },
          { status: 400 }
        );
      }
      const startTime = Number(hatching.startTime ?? now);
      const currentEnd = Number(hatching.endTime ?? startTime);
      const nextEnd = Math.max(startTime, currentEnd - WARM_REDUCTION_MS);
      const warmedCount = Number(hatching.warmedCount ?? 0) + 1;

      const nextHatchings = hatchings.map((h) =>
        String(h.id) === String(parsed.hatchingId) ? { ...h, endTime: nextEnd, warmedCount } : h
      );
      const nextProfile = { ...profile, ecoPoints: currentEco - WARM_COST, hatchings: nextHatchings };
      await writePayload(session.userId, email, nextProfile);

      return NextResponse.json({
        success: true,
        action: "warm",
        ecoPoints: currentEco - WARM_COST,
        endTime: nextEnd,
        warmedCount
      });
    }

    // ---------- instant: spend eco to force the egg ready now ----------
    if (parsed.action === "instant") {
      const endTime = Number(hatching.endTime ?? now);
      const remaining = Math.max(0, endTime - now);
      const cost = Math.max(10, Math.ceil(remaining / (3 * 60 * 1000))); // 1 EP / 3 min, min 10
      const currentEco = Math.max(0, Number(profile.ecoPoints ?? 0) || 0);
      if (currentEco < cost) {
        return NextResponse.json(
          { error: { code: "eggs/insufficient-eco", message: `Need ${cost} EcoPoints to hatch instantly.` } },
          { status: 400 }
        );
      }

      const nextHatchings = hatchings.map((h) =>
        String(h.id) === String(parsed.hatchingId) ? { ...h, endTime: now } : h
      );
      const nextProfile = { ...profile, ecoPoints: currentEco - cost, hatchings: nextHatchings };
      await writePayload(session.userId, email, nextProfile);

      return NextResponse.json({ success: true, action: "instant", ecoPoints: currentEco - cost, cost });
    }

    // ---------- hatch: validate timing, roll the pet, mint it, grant Impact ----------
    const rarity = normalizeRarity(hatching.rarity);
    const endTime = Number(hatching.endTime ?? now);
    if (endTime > now) {
      return NextResponse.json(
        { error: { code: "eggs/not-ready", message: "This egg is not ready to hatch yet." } },
        { status: 425 }
      );
    }

    const rewardPool = animalRewards[rarity] ?? animalRewards.common;
    const reward = rewardPool[Math.floor(Math.random() * rewardPool.length)];

    const nextHatchings = hatchings.filter((h) => String(h.id) !== String(parsed.hatchingId));
    const animals = Array.isArray(profile.animals)
      ? [...(profile.animals as Array<Record<string, unknown>>)]
      : [];
    const existingIndex = animals.findIndex((a) => String(a.name) === String(reward.name));
    const hatchedAt = new Date().toISOString();
    if (existingIndex >= 0) {
      animals[existingIndex] = {
        ...animals[existingIndex],
        count: Number(animals[existingIndex].count ?? 1) + 1,
        hatchedAt
      };
    } else {
      animals.push({
        id: `${reward.name.toLowerCase()}-${now}`,
        name: reward.name,
        image: reward.image,
        rarity: reward.rarity,
        count: 1,
        active: false,
        happiness: 50,
        energy: 50,
        bond: 10,
        careStreak: 0,
        careActionsToday: 0,
        hatchedAt
      });
    }

    const granted = await grantImpact({
      userId: session.userId,
      source: "egg",
      baseXp: HATCH_XP[rarity],
      baseImpact: HATCH_IMPACT[rarity],
      meta: { hatchingId: parsed.hatchingId, animal: reward.name, rarity },
      payloadPatch: { hatchings: nextHatchings, animals }
    });

    return NextResponse.json({
      success: true,
      action: "hatch",
      animal: reward,
      level: granted?.level ?? null,
      xp: granted?.xp ?? null,
      impact: granted?.impact ?? null,
      ecoPoints: granted?.ecoPoints ?? null
    });
  } catch (error) {
    console.error("Egg incubate error:", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}