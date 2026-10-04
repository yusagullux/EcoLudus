import type { LucideIcon } from "lucide-react";
import { Feather, Flag, Flower2, Heart, Sprout, UsersRound } from "lucide-react";
import { BotanicalLabel, IconDot, RewardChip, SectionShell, Stamp } from "./primitives";

/**
 * Community section with summit framing: a copy block about teams, cheers and
 * shared quests beside a drawn summit scene with a flag on the peak, a podium
 * of three illustrative climber cards (generic names, never real user data),
 * and a shared team-goal progress strip. Purely server-rendered, no motion.
 */

function SummitHills() {
  const tintFar = "color-mix(in srgb, var(--accent-sage) 22%, var(--bg-panel-alt))";
  const tintNear = "color-mix(in srgb, var(--accent-sage) 38%, var(--bg-panel-alt))";
  const tintSoil = "color-mix(in srgb, var(--accent-gold) 20%, var(--bg-panel-alt))";

  return (
    <svg viewBox="0 0 460 190" className="block h-auto w-full" aria-hidden="true">
      {/* far ridge with the summit peak */}
      <path d="M0 190 L118 100 L212 156 L300 62 L390 142 L460 96 L460 190 Z" fill={tintFar} />
      {/* near ridge */}
      <path d="M0 190 L84 138 L182 172 L266 118 L352 164 L460 122 L460 190 Z" fill={tintNear} />
      {/* flag on the summit */}
      <line x1="300" y1="62" x2="300" y2="30" stroke="var(--text-accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M300 30 L332 39 L300 48 Z" fill="var(--accent-gold)" />
      <circle cx="300" cy="62" r="3.5" fill="var(--text-accent)" />
      {/* soil band */}
      <rect x="0" y="178" width="460" height="12" fill={tintSoil} />
    </svg>
  );
}

const FEATURES: Array<{ icon: LucideIcon; title: string; body: string; tint: string; tintText: string }> = [
  {
    icon: Heart,
    title: "Cheer a friend",
    body: "Friends can fire off a cheer when someone needs a push.",
    tint: "var(--accent-orange)",
    tintText: "var(--accent-orange-text)"
  },
  {
    icon: UsersRound,
    title: "Shared quests",
    body: "Friends can claim shared quests and finish them together.",
    tint: "var(--accent-violet)",
    tintText: "var(--accent-violet-text)"
  },
  {
    icon: Flag,
    title: "Team missions",
    body: "One shared team goal that everyone works toward.",
    tint: "var(--accent-gold)",
    tintText: "var(--accent-gold-text)"
  }
];

const CLIMBERS: Array<{ name: string; level: string; icon: LucideIcon; tint: string; tintText: string; elevated?: boolean }> = [
  {
    name: "Fern",
    level: "Lv 12",
    icon: Feather,
    tint: "var(--accent-green)",
    tintText: "var(--accent-green-text)"
  },
  {
    name: "Moss",
    level: "Lv 9",
    icon: Sprout,
    tint: "var(--accent-teal)",
    tintText: "var(--accent-teal-text)",
    elevated: true
  },
  {
    name: "Sprout",
    level: "Lv 7",
    icon: Flower2,
    tint: "var(--accent-gold)",
    tintText: "var(--accent-gold-text)"
  }
];

export function CommunitySection() {
  return (
    <SectionShell id="community">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        {/* copy block */}
        <div className="max-w-lg">
          <h2 className="font-serif text-3xl font-bold tracking-tight text-ink sm:text-4xl">Climbing is better together</h2>
          <p className="mt-4 text-base leading-relaxed text-ink-soft">
            Form a team, share the same quests, and pull each other up the hill. Friendly competition keeps the whole team climbing — nobody climbs alone.
          </p>

          <div className="mt-7 flex flex-col gap-3.5">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3">
                <IconDot icon={feature.icon} tint={feature.tint} tintText={feature.tintText} size="h-8 w-8" className="mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-ink">{feature.title}</p>
                  <p className="text-sm text-ink-soft">{feature.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* summit composition */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Stamp lines={["Team summit", "climb together"]} size={78} className="absolute right-2 top-2 z-10" />
            <div className="fg-panel-alt overflow-hidden">
              <SummitHills />
            </div>

            {/* climber podium — 3 in a row from the base breakpoint so the
                staircase never collapses into a blind stack; slightly tighter
                padding/type below sm, sm+ unchanged. The middle card stands
                a step higher. */}
            <div className="relative mt-3 grid grid-cols-3 gap-2 px-1 sm:gap-3 md:-mt-12 md:mt-0">
              {CLIMBERS.map((climber) => (
                <div
                  key={climber.name}
                  className={
                    climber.elevated
                      ? "fg-panel p-3 text-center shadow-elev-2 sm:p-5 md:-translate-y-5"
                      : "fg-panel mt-auto p-3 text-center sm:p-4"
                  }
                >
                  <IconDot
                    icon={climber.icon}
                    tint={climber.tint}
                    tintText={climber.tintText}
                    size="h-10 w-10 sm:h-12 sm:w-12"
                    iconSize="h-4 w-4 sm:h-5 sm:w-5"
                    className="mx-auto"
                  />
                  <p className={`mt-2 font-bold text-ink ${climber.elevated ? "text-xs sm:text-base" : "text-xs sm:text-sm"}`}>{climber.name}</p>
                  <span className="fg-chip fg-chip-coins mt-1.5 scale-90 sm:scale-100">{climber.level}</span>
                </div>
              ))}
            </div>
          </div>

          {/* shared team goal */}
          <div className="fg-panel-alt px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <BotanicalLabel>Team goal</BotanicalLabel>
              <RewardChip kind="carbon">36 kg to go</RewardChip>
            </div>
            <p className="mt-1.5 text-sm font-bold text-ink">64 of 100 kg saved this season</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--border-subtle)" }}>
              <div className="h-full rounded-full" style={{ width: "64%", background: "var(--text-accent)" }} />
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}