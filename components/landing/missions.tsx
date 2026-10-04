import Image from "next/image";
import Link from "next/link";
import { Recycle, ShieldCheck } from "lucide-react";
import { BotanicalLabel, RewardChip, SectionShell, Stamp, TintChip } from "./primitives";

/**
 * Missions — spec §3: a quest board, not a list. One large featured mission
 * panel (photo tile + description + proof stamp + full reward row) with slim
 * quest strips beside/below it. Values are real quests read from
 * public/quests.json (recycling_1, transportation_2, energy_1, energy_3,
 * water_1, recycling_3). Server component, rendered statically — the page's
 * motion budget belongs to the hero (spec: nothing else animates).
 */

type QuestStrip = {
  title: string;
  category: string;
  // Category accent — fills don't shift across themes, so a plain fill is safe.
  accent: string;
  desc: string;
  xp: string;
  ep: string;
  carbon: string;
};

const STRIPS: QuestStrip[] = [
  {
    title: "Walk or bike a short distance",
    category: "Transportation",
    accent: "var(--accent-blue)",
    desc: "Leave the car for one short trip and go on foot or by bike.",
    xp: "+60 XP",
    ep: "+45 EP",
    carbon: "−2 kg CO₂"
  },
  {
    title: "Use natural light instead of a lamp",
    category: "Energy saving",
    accent: "var(--accent-gold)",
    desc: "Open the curtains and read or work by daylight.",
    xp: "+55 XP",
    ep: "+40 EP",
    carbon: "−1.2 kg CO₂"
  },
  {
    title: "Use a cup while brushing",
    category: "Water saving",
    accent: "var(--accent-teal)",
    desc: "Rinse from a cup instead of leaving the tap running.",
    xp: "+40 XP",
    ep: "+25 EP",
    carbon: "−0.1 kg CO₂"
  },
  {
    title: "Match pot size to the burner",
    category: "Energy saving",
    accent: "var(--accent-gold)",
    desc: "Keep the pot matched to the burner so no heat escapes.",
    xp: "+40 XP",
    ep: "+25 EP",
    carbon: "−0.2 kg CO₂"
  },
  {
    title: "Organize home recycling",
    category: "Recycling",
    accent: "var(--accent-green)",
    desc: "Sort paper, plastic, and glass into the right bins.",
    xp: "+55 XP",
    ep: "+40 EP",
    carbon: "−1.5 kg CO₂"
  }
];

export function MissionsShowcase() {
  return (
    <SectionShell id="missions">
      <div className="flex flex-col gap-10">
        {/* Intro — left-aligned (the how-it-works intro is centered). */}
        <div className="flex max-w-2xl flex-col gap-3">
          <p className="text-sm font-bold text-accent">Missions</p>
          <h2 className="font-serif text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Today's quest board
          </h2>
          <p className="text-base leading-7 text-ink-soft">
            A fresh set of small, real-world actions every day — each one
            carrying proof, XP, EcoPoints, and a carbon number.
          </p>
        </div>

        <div className="grid items-stretch gap-4 lg:grid-cols-[1.6fr_1fr] lg:gap-6">
          {/* ── Featured mission ─────────────────────────── */}
          <article className="fg-panel overflow-hidden">
            <div className="grid h-full sm:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)]">
              {/* Photo tile with the verification stamp pressed on it */}
              <div className="relative min-h-52 w-full sm:min-h-0">
                <Image
                  src="/images/forest.webp"
                  alt="A sunlit forest — the outdoors where missions happen"
                  fill
                  sizes="(min-width: 1024px) 280px, (min-width: 640px) 240px, 100vw"
                  className="object-cover"
                />
                <Stamp
                  lines={["AI photo", "proof"]}
                  size={86}
                  className="absolute top-3 right-3 z-10"
                />
                <div
                  className="absolute bottom-3 left-3 grid h-11 w-11 place-items-center rounded-full"
                  style={{
                    background: "var(--bg-panel)",
                    border: "1px solid var(--border-default)",
                    boxShadow: "var(--shadow-card)"
                  }}
                >
                  <span aria-hidden="true" style={{ color: "var(--accent-green)" }}>
                    <Recycle className="h-5 w-5" />
                  </span>
                </div>
              </div>

              {/* The mission itself */}
              <div className="flex flex-col gap-3 p-6 lg:p-7">
                <BotanicalLabel>Featured mission</BotanicalLabel>
                <h3 className="font-serif text-2xl font-bold text-ink lg:text-[1.7rem]">
                  Pick up 2 trash items
                </h3>
                <p className="text-sm leading-6 text-ink-soft sm:text-[0.95rem]">
                  Collect two pieces of trash and put them in the right
                  recycling bin — a small act with a big dent in plastic waste.
                </p>
                <div className="flex flex-wrap gap-2">
                  <TintChip tint="var(--accent-green)" tintText="var(--accent-green-text)">
                    Recycling
                  </TintChip>
                  <span className="fg-chip border-line bg-surface-alt text-ink-soft">Easy</span>
                </div>
                <div className="mt-auto flex flex-col gap-3 pt-3">
                  <p className="inline-flex flex-wrap items-center gap-1.5 text-sm font-semibold text-accent">
                    <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Snap a photo — the AI check confirms it before XP lands.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <RewardChip kind="xp">+60 XP</RewardChip>
                    <RewardChip kind="coins">+45 EP</RewardChip>
                    <RewardChip kind="carbon">−2.5 kg CO₂</RewardChip>
                  </div>
                </div>
              </div>
            </div>
          </article>

          {/* ── Quest strips (slim rows, real quest data) ── */}
          <ul className="flex flex-col justify-between gap-3">
            {STRIPS.map((quest) => (
              <li
                key={quest.title}
                className="fg-panel flex flex-col gap-1.5 p-3.5"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: quest.accent }}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-bold text-ink">{quest.title}</span>
                  <span className="ml-auto shrink-0 text-xs font-semibold text-ink-muted">
                    {quest.category}
                  </span>
                </div>
                <p className="text-xs leading-5 text-ink-soft">{quest.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  <RewardChip kind="xp">{quest.xp}</RewardChip>
                  <RewardChip kind="coins">{quest.ep}</RewardChip>
                  <RewardChip kind="carbon">{quest.carbon}</RewardChip>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Quiet close-out */}
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="text-sm text-ink-muted">
            Most missions take two minutes — and every one is logged.
          </p>
          <Link
            href="/dashboard"
            className="text-sm font-bold text-accent underline-offset-4 transition hover:underline"
          >
            Browse all missions in the game
          </Link>
        </div>
      </div>
    </SectionShell>
  );
}

export default MissionsShowcase;