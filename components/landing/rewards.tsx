import Image from "next/image";
import { SectionShell, RewardChip, TintChip } from "./primitives";

/**
 * Landing "Rewards & progression" showcase (spec §5).
 * No stat tiles — the section IS the progression: the nine real animal
 * medallions from /images/ecoquests-badges rise left→right like a growth
 * staircase. The badge order follows the game's medallion art (rabbit →
 * tiger); the XP numbers are the REAL level curve from lib/level-system.ts
 * (requiredXP(level) = 100·level + 25·level², so level 2 opens at 125 XP
 * and level 3 costs 175 more). One badge — level 3, the cat — is "you":
 * full-opacity, lifted, ringed; everything ahead dims progressively and
 * the very next medallion reads "Unlocked soon". Alongside: the daily
 * clear chest and a species egg as small real reward surfaces.
 *
 * Server component, rendered statically — the page's motion budget belongs
 * to the hero (spec: nothing else animates).
 */

type Badge = {
  animal: string;
  name: string;
  /** Level the medallion marks. */
  level: number;
  /** TOTAL XP needed to reach that level — real curve values. */
  totalXp: number;
};

// requiredXP(1)=125, then each rung adds 100 + 25·(2·level−1)… cumulative
// totals: L2=125, L3=300, L4=525, L5=800, L6=1125, L7=1500, L8=1925,
// L9=2400, L10=2925.
const BADGES: Badge[] = [
  { animal: "rabbit", name: "Rabbit", level: 2, totalXp: 125 },
  { animal: "cat", name: "Cat", level: 3, totalXp: 300 },
  { animal: "deer", name: "Deer", level: 4, totalXp: 525 },
  { animal: "fox", name: "Fox", level: 5, totalXp: 800 },
  { animal: "wolf", name: "Wolf", level: 6, totalXp: 1125 },
  { animal: "bear", name: "Bear", level: 7, totalXp: 1500 },
  { animal: "eagle", name: "Eagle", level: 8, totalXp: 1925 },
  { animal: "lion", name: "Lion", level: 9, totalXp: 2400 },
  { animal: "tiger", name: "Tiger", level: 10, totalXp: 2925 }
];

// "You" — level 3, 300 XP total: a plausible first-weeks profile.
const CURRENT_INDEX = 1;

export function RewardsShowcase() {
  return (
    <SectionShell id="rewards">
      {/* ── Heading + reward vocabulary ─────────────────── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-xl flex-col items-start gap-4">
          {/* Sentence-case kicker (spec: no all-caps eyebrows above headings) */}
          <p className="text-sm font-bold text-accent">Levels &amp; medallions</p>

          <h2 className="font-serif text-3xl leading-tight font-bold tracking-tight text-ink sm:text-4xl">
            Grow through nine animal medallions.
          </h2>

          <p className="max-w-md text-base leading-7 text-ink-soft sm:leading-8">
            Levels are pure XP — 125 XP opens level 2, 175 more opens level
            3, and every rung after that grows. Missions pay the XP; the
            medallion climbs with you.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RewardChip kind="xp">125 XP opens level 2</RewardChip>
          <RewardChip kind="coins">+45 EP per mission</RewardChip>
        </div>
      </div>

      {/* ── The growth staircase ────────────────────────── */}
      <div className="relative -mt-5">
        {/* One soft dawn glow rising behind the climb */}
        <div
          aria-hidden="true"
          className="absolute right-0 -top-6 h-48 w-[30rem] max-w-[70%] rounded-full blur-3xl"
          style={{
            background: "radial-gradient(ellipse, color-mix(in srgb, var(--accent-gold) 10%, transparent) 0%, transparent 70%)"
          }}
        />

        <ul className="no-scrollbar relative z-10 flex w-full items-end gap-1 overflow-x-auto px-2 pb-12 pt-4 sm:gap-2 lg:justify-center">
          {BADGES.map((b, i) => {
            const isCurrent = i === CURRENT_INDEX;
            const isNext = i === CURRENT_INDEX + 1;
            const earned = i < CURRENT_INDEX;

            const dist = i - CURRENT_INDEX;
            // Opacity + grayscale schedule: earned ≈ yours, current = you,
            // then the future recedes into grayscale haze. `dist` ≤ 2 stays
            // in color (the next step should feel within reach).
            const opacity = isCurrent ? 1 : earned ? 0.8 : Math.max(0.12, 0.62 - (dist - 1) * 0.14);
            const grayscale = dist > 2;

            return (
              <li
                key={b.animal}
                className="flex flex-col items-center gap-2"
                style={{
                  // Ascending staircase — each medallion a step higher.
                  // clamp keeps the climb composable on small screens.
                  marginBottom: `calc(${i} * clamp(6px, 1.1vw, 12px))`
                }}
              >
                {isCurrent ? (
                  <TintChip tint="var(--text-accent)">You are here</TintChip>
                ) : isNext ? (
                  <span className="fg-chip text-ink-muted" style={{ background: "color-mix(in srgb, var(--border-default) 35%, var(--bg-panel))" }}>
                    Unlocked soon
                  </span>
                ) : (
                  <span className="h-[1.55rem]" aria-hidden="true" />
                )}

                <div
                  className={`relative h-16 w-16 overflow-hidden rounded-full lg:h-[84px] lg:w-[84px] ${isCurrent ? "ring-2 ring-accent shadow-elev-3 lg:scale-110" : "shadow-elev-1"}`}
                  style={{ background: "color-mix(in srgb, var(--accent-green) 6%, var(--bg-panel))", filter: grayscale ? "grayscale(1)" : undefined, opacity }}
                >
                  <Image
                    src={`/images/ecoquests-badges/${b.animal}-badge-removedbg.png`}
                    alt={`${b.name} medallion — level ${b.level}`}
                    fill
                    sizes="(min-width: 1024px) 84px, 64px"
                    className="object-cover scale-110"
                  />
                </div>

                <span className="fg-botlabel text-center" style={{ color: isCurrent ? "var(--text-accent)" : undefined }}>
                  Level {b.level}
                </span>
                <span className="text-xs font-bold text-ink-muted" style={{ opacity: isCurrent ? 1 : 0.75 }}>
                  {b.totalXp} XP
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── The other reward surfaces, as real artifacts ── */}
      <div className="mx-auto flex max-w-3xl flex-col items-start justify-center gap-4 sm:flex-row sm:items-stretch">
        <div
          className="fg-panel-alt flex flex-1 items-center gap-4 p-4"
          style={{ background: "color-mix(in srgb, var(--accent-gold) 10%, var(--bg-panel-alt))" }}
        >
          <div
            className="relative h-16 w-16 shrink-0 overflow-hidden"
            style={{ background: "color-mix(in srgb, var(--accent-gold) 14%, var(--bg-panel-alt))", borderRadius: "30%", border: "1px solid color-mix(in srgb, var(--accent-gold) 30%, var(--border-default))" }}
          >
            <Image src="/images/chests/golden-chest.png" alt="Golden chest reward" fill sizes="64px" className="object-contain" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-ink">Daily clear chest</p>
            <p className="text-xs leading-5 text-ink-muted">
              Clear all of today&apos;s missions and a chest rolls its seed pool open.
            </p>
          </div>
        </div>

        <div
          className="fg-panel-alt flex flex-1 items-center gap-4 rounded-[var(--radius-card)] p-4"
          style={{ background: "color-mix(in srgb, var(--rarity-legendary) 10%, var(--bg-panel-alt))", transform: "rotate(-0.4deg)" }}
        >
          <div
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-line bg-surface"
          >
            <Image src="/images/eggs/legendary-egg.png" alt="Legendary species egg" fill sizes="64px" className="object-contain" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-ink">Species eggs hatch pets</p>
            <p className="text-xs leading-5 text-ink-muted">
              Spend EcoCoins on a mystery egg, wait out the hatch, meet a new companion.
            </p>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

export default RewardsShowcase;