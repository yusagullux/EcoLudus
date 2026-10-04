import type { LucideIcon } from "lucide-react";
import { Footprints, Smartphone, Sprout, TrendingUp, TreePine } from "lucide-react";
import { getCommunityStats } from "@/lib/community-stats";
import { BotanicalLabel, DashedTrail, IconDot, RewardChip, SectionShell } from "./primitives";

/**
 * Impact storytelling section: one live community number (total kg of CO₂
 * reduced by verified missions) framed as growth rings, two honest
 * real-world comparisons, and a milestone ladder that mentions the real
 * Ecologi tree planting. Stats come from the shared aggregate in
 * lib/community-stats.ts (zeros fallback keeps the section alive with no DB).
 */

/** Hand-drawn growth-ring graphic: rings with milestone ticks, a sprout
 *  growing past the inner rings, and a soft ground arc. */
function GrowthRings() {
  const ringFaint = "color-mix(in srgb, var(--text-accent) 22%, var(--border-subtle))";
  const ringMid = "color-mix(in srgb, var(--text-accent) 32%, var(--border-subtle))";
  const ringStrong = "color-mix(in srgb, var(--text-accent) 45%, var(--border-subtle))";
  const tick = "color-mix(in srgb, var(--text-accent) 60%, var(--border-default))";

  return (
    <figure className="fg-panel-alt relative flex items-center justify-center p-6 pb-14 sm:p-8 sm:pb-16">
      <svg viewBox="0 0 340 300" className="block h-auto w-full max-w-[320px]" aria-hidden="true">
        {/* growth rings — outermost dashed, like pencil marks on a ledger */}
        <circle cx="170" cy="150" r="118" fill="none" stroke={ringFaint} strokeWidth="1.5" strokeDasharray="2 7" />
        <circle cx="170" cy="150" r="86" fill="none" stroke={ringMid} strokeWidth="1.5" />
        <circle cx="170" cy="150" r="54" fill="none" stroke={ringStrong} strokeWidth="1.5" strokeDasharray="4 6" />

        {/* milestone ticks on the outermost ring */}
        <line x1="170" y1="32" x2="170" y2="46" stroke={tick} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="272" y1="91" x2="263" y2="96" stroke={tick} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="68" y1="91" x2="77" y2="96" stroke={tick} strokeWidth="2.5" strokeLinecap="round" />

        {/* ring labels */}
        <text x="178" y="42" fontSize="9" fontWeight="700" letterSpacing="0.08em" fill="var(--text-muted)">100 kg</text>
        <text x="76" y="154" fontSize="9" fontWeight="700" letterSpacing="0.08em" fill="var(--text-muted)" textAnchor="end">50 kg</text>
        <text x="108" y="154" fontSize="9" fontWeight="700" letterSpacing="0.08em" fill="var(--text-muted)" textAnchor="end">10 kg</text>

        {/* ground */}
        <path d="M92 226 Q170 208 248 226" fill="none" stroke={ringMid} strokeWidth="2" strokeLinecap="round" />

        {/* the growing sprout */}
        <path d="M170 224 C168 198 166 180 170 152" fill="none" stroke="var(--text-accent)" strokeWidth="5" strokeLinecap="round" />
        <path d="M170 136 C158 108 160 84 178 70 C194 84 192 110 176 134 Z" fill="color-mix(in srgb, var(--accent-lime) 50%, var(--bg-panel-alt))" />
        <path d="M170 160 C140 164 120 146 124 122 C128 102 152 98 166 116 C174 128 172 148 170 160 Z" fill="color-mix(in srgb, var(--accent-green) 70%, var(--bg-panel-alt))" />
        <path d="M170 156 C198 160 218 142 214 120 C212 102 194 96 180 112 C172 122 172 144 170 156 Z" fill="color-mix(in srgb, var(--accent-teal) 65%, var(--bg-panel-alt))" />
        <circle cx="184" cy="94" r="3.5" fill="var(--accent-gold)" />
        <circle cx="150" cy="130" r="3" fill="var(--accent-gold)" />
      </svg>
      <figcaption className="fg-botlabel absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
        Each ring is a community milestone
      </figcaption>
    </figure>
  );
}

const COMPARISONS: Array<{ icon: LucideIcon; text: string }> = [
  { icon: Smartphone, text: "0.5 kg of CO₂ is roughly a smartphone charged about 30 times." },
  { icon: Footprints, text: "Walking instead of driving 1.5 km saves roughly 0.2 kg of CO₂." }
];

const MILESTONES: Array<{
  icon: LucideIcon;
  title: string;
  body: string;
  chip: { kind: "coins" | "xp" | "carbon"; label: string };
}> = [
  { icon: Sprout, title: "Your first mission", body: "One small real-world action, logged and verified.", chip: { kind: "xp", label: "Day 1" } },
  { icon: TrendingUp, title: "Your first 10 kg", body: "Daily missions stack up, and your garden fills in.", chip: { kind: "carbon", label: "−10 kg" } },
  { icon: TreePine, title: "Community milestones", body: "Milestones plant real trees through Ecologi.", chip: { kind: "coins", label: "Real trees" } }
];

export async function ImpactShowcase() {
  const stats = await getCommunityStats();

  return (
    <SectionShell id="impact">
      <div className="max-w-2xl">
        <h2 className="font-serif text-3xl font-bold tracking-tight text-ink sm:text-4xl">Every mission leaves a mark</h2>
        <p className="mt-3 text-base leading-relaxed text-ink-soft">
          Small actions, verified one by one, add up to a number the whole community owns.
        </p>
      </div>

      <div className="fg-panel px-6 py-8 shadow-elev-1 sm:px-10 sm:py-10">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_minmax(280px,0.9fr)] lg:gap-12">
          <div className="flex flex-col">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-serif text-6xl font-bold leading-none tracking-tight text-ink tabular-nums sm:text-7xl">
                {Math.round(stats.totalCo2Reduced).toLocaleString()}
              </span>
              <span className="font-serif text-2xl font-bold text-ink-soft">kg CO₂</span>
            </div>
            <BotanicalLabel className="mt-3">Live community total</BotanicalLabel>
            <p className="mt-1 text-sm text-ink-soft">
              {stats.totalMissions === 0
                ? "First verified missions are being counted."
                : `Counted from ${stats.totalMissions.toLocaleString()} verified missions by ${stats.activeUsers.toLocaleString()} members.`}
            </p>

            <div className="mt-8 flex flex-col gap-3">
              {COMPARISONS.map((item) => (
                <div key={item.text} className="flex items-start gap-3">
                  <IconDot icon={item.icon} tint="var(--text-accent)" size="h-7 w-7" className="mt-0.5" />
                  <p className="text-sm leading-6 text-ink-soft">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <GrowthRings />
        </div>

        <DashedTrail className="mt-10" />

        <div className="mt-8 flex flex-col gap-2.5">
          {MILESTONES.map((milestone) => (
            <div key={milestone.title} className="fg-panel-alt flex items-center gap-4 px-4 py-3.5">
              <IconDot icon={milestone.icon} tint="var(--text-accent)" size="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">{milestone.title}</p>
                <p className="mt-0.5 text-sm text-ink-soft">{milestone.body}</p>
              </div>
              <RewardChip kind={milestone.chip.kind}>{milestone.chip.label}</RewardChip>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}