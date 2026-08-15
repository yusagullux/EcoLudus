import type { Booster } from "@/lib/types";

// Applies boosters to a quest completion. At most ONE xp-booster and ONE
// eco-booster are consumed (highest multiplier with charges > 0), so two XP
// boosters never multiply together (no exponential XP). Each consumed booster
// loses one charge; boosters reaching 0 charges are dropped from the array.
// Pure: returns a new array + multipliers; does not mutate input.
export function consumeBoostersForQuest(profile: {
  boosters?: Booster[];
}): { xpMul: number; ecoMul: number; boosters: Booster[]; consumed: string[] } {
  const input = profile.boosters ?? [];
  const consumed: string[] = [];
  const next: Booster[] = [];

  const pick = (kind: "xp" | "eco"): Booster | undefined => {
    const charged = input.filter((b) => b.kind === kind && b.charges > 0);
    if (charged.length === 0) return undefined;
    return charged.reduce((best, b) => (b.multiplier > best.multiplier ? b : best));
  };

  const xpPick = pick("xp");
  const ecoPick = pick("eco");

  for (const b of input) {
    const isXpPick = xpPick != null && b.id === xpPick.id && b.kind === "xp";
    const isEcoPick = ecoPick != null && b.id === ecoPick.id && b.kind === "eco";
    if (isXpPick || isEcoPick) {
      consumed.push(b.id);
      const remaining = b.charges - 1;
      if (remaining > 0) next.push({ ...b, charges: remaining });
      // else: drop (fully spent)
    } else {
      next.push(b);
    }
  }

  return {
    xpMul: xpPick ? xpPick.multiplier : 1,
    ecoMul: ecoPick ? ecoPick.multiplier : 1,
    boosters: next,
    consumed
  };
}