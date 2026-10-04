import Image from "next/image";
import { BookOpen } from "lucide-react";
import { SectionShell } from "./primitives";

/**
 * Landing "Garden" showcase (spec §4) — the visual centerpiece.
 * A full-bleed DARK band: the background derives from `--bg-sidebar`
 * mixed toward `--text-accent` (same recipe as the `.mk-hero` surface),
 * so it stays an ink surface on all six themes without hardcoded hexes.
 * Inside a max-w-7xl shell: a moonlit horizon glow, two tree-line SVG
 * silhouettes, a soil band, and a shelf of real in-game plant photos in
 * round specimen frames with botanical tags + rarity chips — plus a
 * truthful discovery counter (14 plant species ship in the game) and a
 * rarity legend. Server component, rendered statically — the page's motion
 * budget belongs to the hero (spec: nothing else animates).
 */

// Text colors usable on the dark band in EVERY theme: the sidebar text
// vars are the "light ink on dark ink" pair, and `--text-accent` mixed
// toward the light text stays readable even on light themes (where the
// raw accent is a dark forest green).
const INK_ON_DARK = "var(--text-sidebar)";
const MUTED_ON_DARK = "var(--text-sidebar-muted)";
const ACCENT_ON_DARK = "color-mix(in srgb, var(--text-accent) 55%, var(--text-sidebar))";

type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

/** Rarity chip that stays readable on the dark band: mixes the (theme-
 *  invariant) rarity fill with the light sidebar text instead of the
 *  light `--bg-panel` the `.rarity-*-chip` classes are tinted against. */
function rarityChipStyle(rarity: Rarity) {
  return {
    background: `color-mix(in srgb, var(--rarity-${rarity}) 16%, var(--bg-sidebar))`,
    color: `color-mix(in srgb, var(--rarity-${rarity}) 72%, var(--text-sidebar))`,
    borderColor: `color-mix(in srgb, var(--rarity-${rarity}) 42%, var(--bg-sidebar))`
  } as const;
}

type Specimen = {
  src: string;
  genus: string;
  name: string;
  rarity: Rarity;
  /** Frame size in px — slightly varied so the shelf reads organic. */
  size: number;
  /** Downward arc offset: center specimens stand a touch lower, so the
   *  shelf follows the curve of the soil ellipse like a planet's horizon. */
  dip: number;
};

// The real shelf: quest-garden species from /images/plants, ascending in
// rarity. The game really has 14 plant species (all files in that dir).
const SPECIMENS: Specimen[] = [
  { src: "/images/plants/sunflower.png", genus: "Helianthus", name: "Sunflower", rarity: "common", size: 118, dip: 0 },
  { src: "/images/plants/mint.png", genus: "Mentha", name: "Mint", rarity: "common", size: 134, dip: 14 },
  { src: "/images/plants/basil.png", genus: "Ocimum", name: "Basil", rarity: "common", size: 122, dip: 26 },
  { src: "/images/plants/tulip.png", genus: "Tulipa", name: "Tulip", rarity: "uncommon", size: 152, dip: 34 },
  { src: "/images/plants/cherry_blossom.png", genus: "Prunus", name: "Cherry blossom", rarity: "rare", size: 132, dip: 26 },
  { src: "/images/plants/orchid.png", genus: "Orchis", name: "Orchid", rarity: "epic", size: 148, dip: 14 },
  { src: "/images/plants/goldentree.png", genus: "Aurelia", name: "Golden tree", rarity: "legendary", size: 170, dip: 0 }
];

const LEGEND: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

const DISCOVERED = 4;
const TOTAL_SPECIES = 14;

export function GardenShowcase() {
  const arc = 2 * Math.PI * 18;
  const discoveredRatio = DISCOVERED / TOTAL_SPECIES;

  return (
    <section
      id="garden"
      aria-label="Your garden"
      className="isolate overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, var(--bg-sidebar) 0%, color-mix(in srgb, var(--text-accent) 16%, var(--bg-sidebar)) 58%, color-mix(in srgb, var(--text-accent) 40%, var(--bg-sidebar)) 100%)",
        color: INK_ON_DARK
      }}
    >
      <SectionShell className="pt-16 pb-12 sm:pt-20 sm:pb-14 lg:pb-16 lg:pt-24">
        {/* ── Heading + field-guide stats ─────────────────── */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-xl flex-col items-start gap-4">
            {/* Sentence-case kicker (spec: no all-caps eyebrows above headings) */}
            <p className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: ACCENT_ON_DARK }}>
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              The field guide
            </p>

            <h2 className="font-serif text-3xl leading-tight font-bold tracking-tight sm:text-4xl" style={{ color: INK_ON_DARK }}>
              Every mission plants something.
            </h2>

            <p className="max-w-md text-base leading-7 sm:leading-8" style={{ color: MUTED_ON_DARK }}>
              Complete missions, discover species, and fill your field guide —
              a moonlit shelf that runs from common mint to a legendary golden
              tree.
            </p>
          </div>

          {/* Discovery counter + rarity legend */}
          <div className="flex flex-col items-start gap-4 lg:items-end">
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 44 44" role="img" aria-label={`${DISCOVERED} of ${TOTAL_SPECIES} plant species discovered`} className="h-11 w-11">
                <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4" stroke="color-mix(in srgb, var(--text-sidebar) 18%, transparent)" />
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                  stroke={ACCENT_ON_DARK}
                  strokeDasharray={`${arc * discoveredRatio} ${arc}`}
                  transform="rotate(-90 22 22)"
                />
              </svg>
              <div className="flex flex-col gap-0.5">
                <p className="font-serif text-xl leading-6 font-bold" style={{ color: INK_ON_DARK }}>
                  {DISCOVERED} <span style={{ color: MUTED_ON_DARK }}>of {TOTAL_SPECIES}</span>
                </p>
                <span className="fg-botlabel" style={{ color: MUTED_ON_DARK }}>
                  Species discovered
                </span>
              </div>
            </div>

            <ul aria-label="Rarity scale" className="flex flex-wrap items-center gap-1.5">
              {LEGEND.map((r) => (
                <li
                  key={r}
                  className="fg-chip"
                  style={rarityChipStyle(r)}
                >
                  {r[0].toUpperCase() + r.slice(1)}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── The moonlit shelf scene ─────────────────────── */}
        <div className="relative mt-6 pb-4">
          {/* Horizon glow — a warm blurred accent blob behind the canopy */}
          <div
            aria-hidden="true"
            className="absolute -top-20 left-1/2 h-56 w-[42rem] max-w-[110%] -translate-x-1/2 rounded-full blur-3xl"
            style={{
              background: "radial-gradient(ellipse, color-mix(in srgb, var(--accent-gold) 16%, transparent) 0%, transparent 72%)"
            }}
          />

          {/* Far tree line — misty pines in a faint ink tint. Full width
              of the viewport so the band feels open, not boxed. */}
          <svg
            aria-hidden="true"
            className="absolute bottom-[64px] left-1/2 h-40 w-screen -translate-x-1/2"
            viewBox="0 0 1600 180"
            preserveAspectRatio="none"
          >
            <path
              d="M0 180 L0 100 C140 88 260 112 400 104 C620 92 760 118 960 104 C1160 90 1300 116 1440 104 C1520 98 1570 104 1600 102 L1600 180 Z"
              fill="color-mix(in srgb, var(--text-accent) 14%, var(--bg-sidebar))"
            />
            <g fill="color-mix(in srgb, var(--text-accent) 26%, var(--bg-sidebar))">
              <path d="M220 104 l14 -34 l14 34 Z" />
              <path d="M246 104 l11 -26 l11 26 Z" />
              <path d="M780 112 l15 -38 l15 38 Z" />
              <path d="M1180 108 l13 -30 l13 30 Z" />
              <path d="M1206 108 l10 -22 l10 22 Z" />
              <path d="M1440 112 l12 -28 l12 28 Z" />
            </g>
          </svg>

          {/* Near tree line — broader canopy bumps, stronger tint */}
          <svg
            aria-hidden="true"
            className="absolute bottom-[48px] left-1/2 h-28 w-screen -translate-x-1/2"
            viewBox="0 0 1600 120"
            preserveAspectRatio="none"
          >
            <path
              d="M0 120 L0 84 Q40 62 80 80 Q104 54 140 76 Q180 50 224 72 Q280 46 336 70 Q420 54 480 74 Q560 50 640 72 Q740 48 840 70 Q960 52 1060 72 Q1160 46 1260 70 Q1360 50 1460 72 Q1540 60 1600 78 L1600 120 Z"
              fill="color-mix(in srgb, var(--text-accent) 34%, var(--bg-sidebar))"
            />
          </svg>

          {/* Soil band — the shelf ground the frames stand on. Its top
              edge lines up with the specimen captions' baseline. */}
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-1/2 h-[88px] w-screen -translate-x-1/2"
            style={{
              background: "linear-gradient(to bottom, transparent 0%, color-mix(in srgb, var(--text-accent) 46%, var(--bg-sidebar)) 100%)"
            }}
          />

          {/* Specimen shelf — horizontal scroll row on small screens,
              centered full row from md up. Each tag/chip sits in the soil. */}
          <ul className="no-scrollbar relative z-10 flex w-full items-start gap-3 overflow-x-auto px-2 py-6 sm:gap-5 lg:justify-center">
            {SPECIMENS.map((s) => (
              <li
                key={s.src}
                className="flex shrink-0 snap-center flex-col items-center gap-2"
                style={{ marginTop: s.dip }}
              >
                <div
                  className="relative aspect-square overflow-hidden rounded-full shadow-elev-2"
                  style={{
                    width: s.size,
                    height: s.size,
                    border: `2px solid color-mix(in srgb, var(--rarity-${s.rarity}) 55%, var(--bg-sidebar))`
                  }}
                >
                  <Image src={s.src} alt={`${s.name} — a plant you can grow in EcoLudus`} fill sizes={`${s.size}px`} className="object-cover" />
                </div>
                <span className="fg-botlabel" style={{ color: MUTED_ON_DARK }}>
                  {s.genus} · {s.name}
                </span>
                <span className="fg-chip" style={rarityChipStyle(s.rarity)}>
                  {s.rarity[0].toUpperCase() + s.rarity.slice(1)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </SectionShell>
    </section>
  );
}

export default GardenShowcase;