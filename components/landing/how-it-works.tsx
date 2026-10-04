import { ClipboardCheck, Footprints, Sprout } from "lucide-react";
import { BotanicalLabel, RewardChip, SectionShell, Stamp, TintChip } from "./primitives";

/**
 * How it works — spec §2. The page's ONE numbered sequence: a winding dashed
 * trail connecting three stations (mission → garden → impact). Desktop: three
 * columns along one SVG curve whose number badges sit on the path itself;
 * mobile: the trail flips vertical and runs down the left edge with the same
 * badges pinned on it. Server component, rendered statically — the page's
 * motion budget belongs to the hero (spec: nothing else animates).
 */

// Same mix the .fg-trail border uses, reused for the SVG curve and the mobile
// vertical connector so both renderings of the trail agree.
const TRAIL_COLOR = "color-mix(in srgb, var(--text-accent) 35%, var(--border-default))";
const BADGE_RING = "color-mix(in srgb, var(--text-accent) 55%, var(--border-default))";

/** Round trail marker — a signed circle sitting on the path. Decorative (the
 *  stations are a real <ol>, so the sequence is conveyed semantically). */
function TrailBadge({ n, className = "" }: { n: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-9 w-9 place-items-center rounded-full font-serif text-base font-bold text-accent lg:h-10 lg:w-10 ${className}`}
      style={{
        background: "var(--bg-panel)",
        border: `2px solid ${BADGE_RING}`,
        boxShadow: "var(--shadow-card)"
      }}
    >
      {n}
    </span>
  );
}

/** Icon tile each station header holds its lucide glyph in. */
function StationIcon({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div className="fg-panel-alt grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-card)]">
      <span aria-hidden="true" style={{ color }}>
        {children}
      </span>
    </div>
  );
}

export function HowItWorks() {
  return (
    <SectionShell id="how-it-works">
      <div className="flex flex-col gap-12">
        {/* Intro — centered; the missions section runs its intro left-aligned. */}
        <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 text-center">
          <p className="text-sm font-bold text-accent">The daily loop</p>
          <h2 className="font-serif text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            How it works
          </h2>
          <p className="text-base leading-7 text-ink-soft">
            Missions give you XP and EcoPoints, EcoPoints grow your garden, and
            every mission logs carbon you didn't burn. Small steps, real totals.
          </p>
        </div>

        <div className="relative">
          {/* Desktop winding trail: a dashed curve passing through each badge's
              center. Badges center on 1/6, 1/2 and 5/6 of the width (no column
              gap), at 20px and 60px of this 80px-tall rail. The viewBox matches
              the rail 1:1 on the vertical axis so dash lengths stay even when
              the horizontal axis stretches. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 1000 80"
            preserveAspectRatio="none"
            fill="none"
            className="absolute top-0 right-0 left-0 hidden h-20 lg:block"
          >
            <path
              d="M167 20 C 267 20 333 60 500 60 C 667 60 733 20 833 20"
              stroke={TRAIL_COLOR}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="8 12"
            />
          </svg>

          <ol className="relative z-10 grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-0">
            {/* ── Station 1 — the mission ─────────────────── */}
            <li className="relative flex flex-col pl-14 lg:pl-0">
              {/* mobile connector: from this badge down into the next */}
              <div
                aria-hidden="true"
                className="absolute top-11 bottom-[-2.5rem] left-[17px] w-0 border-l-2 border-dashed lg:hidden"
                style={{ borderColor: TRAIL_COLOR }}
              />
              <TrailBadge n="1" className="absolute top-0 left-0 lg:static lg:mt-0" />
              <div className="fg-panel relative p-5 lg:mx-4 lg:mt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <StationIcon color="var(--accent-green)">
                    <ClipboardCheck className="h-5 w-5" />
                  </StationIcon>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <BotanicalLabel>XP</BotanicalLabel>
                    <RewardChip kind="xp">+60 XP</RewardChip>
                  </div>
                </div>
                <h3 className="mt-3 font-serif text-xl font-bold text-ink">Complete a daily mission</h3>
                <p className="mt-1.5 text-sm leading-6 text-ink-soft">
                  Pick something real and short — walk a trip you'd usually
                  drive, sort the recycling. Many missions are confirmed with a
                  quick AI photo check.
                </p>
                {/* The proof stamp lives here: this is where proof enters the loop. */}
                <div className="mt-3 flex justify-end pr-1">
                  <Stamp lines={["AI photo", "proof"]} size={60} />
                </div>
              </div>
            </li>

            {/* ── Station 2 — the garden ──────────────────── */}
            <li className="relative flex flex-col pl-14 lg:pl-0">
              <div
                aria-hidden="true"
                className="absolute top-11 bottom-[-2.5rem] left-[17px] w-0 border-l-2 border-dashed lg:hidden"
                style={{ borderColor: TRAIL_COLOR }}
              />
              <TrailBadge n="2" className="absolute top-0 left-0 lg:static lg:mt-10" />
              <div className="fg-panel relative p-5 lg:mx-4 lg:mt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <StationIcon color="var(--accent-sage)">
                    <Sprout className="h-5 w-5" />
                  </StationIcon>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <BotanicalLabel>EcoPoints</BotanicalLabel>
                    <RewardChip kind="coins">+45 EP</RewardChip>
                  </div>
                </div>
                <h3 className="mt-3 font-serif text-xl font-bold text-ink">Grow your garden</h3>
                <p className="mt-1.5 text-sm leading-6 text-ink-soft">
                  Spend your EcoPoints on seeds, plant new tiles, and species
                  join your collection — a field guide of everything you grow.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["Mint", "Tulip", "Lavender"].map((species) => (
                    <TintChip key={species} tint="var(--accent-sage)" tintText="var(--accent-sage-text)">
                      {species}
                    </TintChip>
                  ))}
                </div>
              </div>
            </li>

            {/* ── Station 3 — the impact ──────────────────── */}
            <li className="relative flex flex-col pl-14 lg:pl-0">
              <TrailBadge n="3" className="absolute top-0 left-0 lg:static lg:mt-0" />
              <div className="fg-panel relative p-5 lg:mx-4 lg:mt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <StationIcon color="var(--accent-teal)">
                    <Footprints className="h-5 w-5" />
                  </StationIcon>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <BotanicalLabel>Per quest</BotanicalLabel>
                    <RewardChip kind="carbon">−2 kg CO₂</RewardChip>
                  </div>
                </div>
                <h3 className="mt-3 font-serif text-xl font-bold text-ink">Log real impact</h3>
                <p className="mt-1.5 text-sm leading-6 text-ink-soft">
                  Every completed quest logs its carbon saving, so your impact
                  adds up in kilograms of CO₂ that never reached the air.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </SectionShell>
  );
}

export default HowItWorks;