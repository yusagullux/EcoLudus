"use client"

import { useState, type CSSProperties } from "react"
import { motion, useReducedMotion, type Transition } from "motion/react"
import { DashedTrail } from "@/components/landing/primitives"

// ── Interactive preview (design spec §8) ─────────────────────────────
// A click-to-grow diorama: sky-to-field wash, sun glow, tree-line
// silhouettes and one curved soil band; seven plots stand on the band and
// advance seed → sprout → flower on click. All color is color-mixed from
// theme vars so every [data-theme] palette renders correctly, and plot
// layout is hand-picked (never Math.random) so SSR and the first client
// render are identical.
// The click spring pop is the section's only animation; useReducedMotion
// swaps stages instantly instead.

type Stage = "seed" | "sprout" | "flower"

const STAGES: Stage[] = ["seed", "sprout", "flower"]

const STAGE_LABEL: Record<Stage, string> = {
  seed: "Seed",
  sprout: "Sprout",
  flower: "In bloom"
}

// Click-reward spring — same family as lib/animations' springTransition,
// a touch less damped so growth reads as one small overshoot.
const GROW_SPRING: Transition = { type: "spring", stiffness: 300, damping: 19 }
// Hover/lift feedback — direct parity with lib/animations' springTransition.
const HOVER_SPRING: Transition = { type: "spring", stiffness: 260, damping: 24 }

/** color-mix helper: `${pct}%` of `color` over `base` (a var or keyword). */
function mix(color: string, pct: number, base = "var(--bg-panel)") {
  return `color-mix(in srgb, ${color} ${pct}%, ${base})`
}

/** Warm earth tone — gold over orange keeps the soil hue theme-stable, then
 * softened toward the panel so the band reads as muted soil, not a neon wedge. */
function earth(goldPct: number) {
  return mix(mix("var(--accent-gold)", goldPct, "var(--accent-orange)"), 48, "var(--bg-panel)")
}

// Sky-to-field vertical wash: the panel-alt paper warmed by text-accent as
// it approaches the ground line.
const SKY_WASH = `linear-gradient(180deg, var(--bg-panel-alt) 0%, ${mix("var(--text-accent)", 14, "var(--bg-panel-alt)")} 55%, ${mix("var(--text-accent)", 34, "var(--bg-panel-alt)")} 100%)`

const MOUND_FILL = earth(40)
const MOUND_RIM = earth(62)

interface PlotSpec {
  id: string
  stage: Stage
  /** Desktop: horizontal anchor (%) and baseline distance from scene bottom (%). */
  x: number
  bottom: number
  /** Mobile: two rows along the same soil band (back = plots 1/3/5/7). */
  mobileX: number
  mobileBottom: number
  scale: number
  stem: string
  bloom: string
}

// Hand-picked layout (deterministic + hydration-safe): x positions and sizes
// vary so the row reads as a planted bed, not a grid; desktop baselines
// follow the soil band's wave. Mobile collapses into two rows along the same
// raised band — back row 1/3/5/7, front row 2/4/6.
const PLOTS: PlotSpec[] = [
  { id: "plot-1", stage: "seed",   x: 8,  bottom: 24.5, mobileX: 10, mobileBottom: 32, scale: 0.96, stem: "var(--accent-sage)",  bloom: "var(--accent-gold)" },
  { id: "plot-2", stage: "flower", x: 21, bottom: 26,   mobileX: 30, mobileBottom: 10, scale: 1.14, stem: "var(--accent-green)", bloom: "var(--accent-violet)" },
  { id: "plot-3", stage: "sprout", x: 34, bottom: 18.5, mobileX: 37, mobileBottom: 30, scale: 0.88, stem: "var(--accent-lime)",  bloom: "var(--accent-teal)" },
  { id: "plot-4", stage: "sprout", x: 48, bottom: 20.5, mobileX: 55, mobileBottom: 8,  scale: 1.0,  stem: "var(--accent-teal)",  bloom: "var(--accent-orange)" },
  { id: "plot-5", stage: "seed",   x: 62, bottom: 23.5, mobileX: 63, mobileBottom: 32, scale: 1.16, stem: "var(--accent-green)", bloom: "var(--accent-gold)" },
  { id: "plot-6", stage: "flower", x: 76, bottom: 22,   mobileX: 79, mobileBottom: 11, scale: 0.9,  stem: "var(--accent-sage)",  bloom: "var(--accent-violet)" },
  { id: "plot-7", stage: "sprout", x: 89, bottom: 21,   mobileX: 89, mobileBottom: 28, scale: 1.04, stem: "var(--accent-lime)",  bloom: "var(--accent-gold)" }
]

function initialStages(): Record<string, Stage> {
  return Object.fromEntries(PLOTS.map((p) => [p.id, p.stage]))
}

/** The earth mound every stage stands on — the plant's contact with the soil band. */
function Mound() {
  return (
    <g aria-hidden="true">
      <ellipse cx="32" cy="58.6" rx="22.5" ry="5.4" style={{ fill: MOUND_FILL }} />
      <ellipse cx="32" cy="57.4" rx="13.5" ry="3.4" style={{ fill: MOUND_RIM }} />
    </g>
  )
}

/** Hand-authored stage art, one 64×64 tile scaled per plot. Deterministic. */
function PlotArt({ stage, stem, bloom }: { stage: Stage; stem: string; bloom: string }) {
  const stemDeep = mix(stem, 55, "var(--bg-sidebar)")
  const stemFull = mix(stem, 88)
  const leafMid = mix(stem, 68)
  const leafSoft = mix(stem, 52)
  const petalFull = mix(bloom, 80)
  const petalSoft = mix(bloom, 56)

  if (stage === "seed") {
    return (
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" className="drop-shadow-sm">
        <Mound />
        <ellipse cx="32" cy="49.5" rx="5" ry="6.8" transform="rotate(16 32 49.5)" style={{ fill: stemDeep }} />
        <circle cx="30" cy="46.5" r="1.6" style={{ fill: mix("var(--bg-panel)", 70, "transparent") }} />
      </svg>
    )
  }

  if (stage === "sprout") {
    return (
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" className="drop-shadow-sm">
        <Mound />
        <path d="M32 55 C30.4 47 33.6 40 32 30.5" fill="none" style={{ stroke: stemFull, strokeWidth: 3, strokeLinecap: "round" }} />
        <ellipse cx="21.5" cy="41" rx="7.2" ry="4.2" transform="rotate(-36 21.5 41)" style={{ fill: leafMid }} />
        <ellipse cx="43" cy="43.5" rx="6.2" ry="3.8" transform="rotate(28 43 43.5)" style={{ fill: leafSoft }} />
        <ellipse cx="36.5" cy="29.5" rx="4.6" ry="2.7" transform="rotate(14 36.5 29.5)" style={{ fill: stemFull }} />
      </svg>
    )
  }

  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" className="drop-shadow-sm">
      <Mound />
      <path d="M32 55 C29 43 35 33 32 21" fill="none" style={{ stroke: stemFull, strokeWidth: 3.2, strokeLinecap: "round" }} />
      <ellipse cx="20" cy="43" rx="8" ry="4.6" transform="rotate(-34 20 43)" style={{ fill: leafMid }} />
      <ellipse cx="44" cy="45.5" rx="6.8" ry="4" transform="rotate(26 44 45.5)" style={{ fill: leafSoft }} />
      {/* Petal ring: 8 petals around (32, 15), alternating tints for layering */}
      {Array.from({ length: 8 }, (_, i) => (
        <ellipse
          key={i}
          cx="32"
          cy="6.5"
          rx="4.4"
          ry="7.4"
          transform={`rotate(${i * 45} 32 15)`}
          style={{ fill: i % 2 === 0 ? petalFull : petalSoft }}
        />
      ))}
      <circle cx="32" cy="15" r="5.3" style={{ fill: mix("var(--accent-gold)", 70, "var(--accent-orange)") }} />
      <circle cx="32" cy="15" r="2.1" style={{ fill: mix("var(--accent-orange)", 40, "var(--bg-sidebar)") }} />
    </svg>
  )
}

function PlotButton({
  plot,
  index,
  stage,
  popIn,
  reduced,
  onGrow
}: {
  plot: PlotSpec
  index: number
  stage: Stage
  popIn: boolean
  reduced: boolean
  onGrow: () => void
}) {
  return (
    <div
      className="absolute -translate-x-1/2 left-[var(--x)] bottom-[var(--b)] max-sm:left-[var(--mx)] max-sm:bottom-[var(--mb)]"
      style={
        {
          "--x": `${plot.x}%`,
          "--b": `${plot.bottom}%`,
          "--mx": `${plot.mobileX}%`,
          "--mb": `${plot.mobileBottom}%`,
          zIndex: 40 - Math.round(plot.bottom)
        } as CSSProperties
      }
    >
      <motion.button
        type="button"
        onClick={onGrow}
        title="Grow this plot"
        aria-label={`Plot ${index + 1}, ${STAGE_LABEL[stage].toLowerCase()}. Grow it`}
        className="block cursor-pointer rounded-xl p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-accent)]"
        initial={false}
        animate={{ scale: plot.scale }}
        whileHover={reduced ? undefined : { scale: plot.scale * 1.07, y: -2 }}
        whileTap={reduced ? undefined : { scale: plot.scale * 0.94 }}
        transition={HOVER_SPRING}
        style={{ transformOrigin: "50% 100%" }}
      >
        {reduced ? (
          <PlotArt stage={stage} stem={plot.stem} bloom={plot.bloom} />
        ) : (
          <motion.span
            key={stage}
            className="block origin-bottom"
            initial={popIn ? { scale: 0.55, y: 8 } : false}
            animate={{ scale: 1, y: 0 }}
            transition={GROW_SPRING}
          >
            <PlotArt stage={stage} stem={plot.stem} bloom={plot.bloom} />
          </motion.span>
        )}
      </motion.button>
      {/* Specimen tag under the plot — artifact label, so small-caps is allowed */}
      <span
        aria-hidden="true"
        className="fg-botlabel absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded-full px-1.5 py-0.5 whitespace-nowrap"
        style={{ background: mix("var(--bg-panel)", 74, "transparent") }}
      >
        {STAGE_LABEL[stage]}
      </span>
    </div>
  )
}

export function GardenPreview() {
  const reduced = useReducedMotion()
  const [stages, setStages] = useState<Record<string, Stage>>(initialStages)
  // Which plots have been clicked since load — their next stage change pops.
  // Initial render never animates (the load budget belongs to the hero).
  const [grown, setGrown] = useState<Record<string, boolean>>({})

  const growPlot = (id: string) => {
    setGrown((prev) => ({ ...prev, [id]: true }))
    setStages((prev) => ({
      ...prev,
      [id]: STAGES[(STAGES.indexOf(prev[id]) + 1) % STAGES.length]
    }))
  }

  const resetGarden = () => {
    setStages(initialStages())
    setGrown({})
  }

  const inBloom = PLOTS.filter((p) => stages[p.id] === "flower").length
  const stillGrowing = PLOTS.length - inBloom

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-xl text-center">
        {/* Sentence-case kicker (spec: no all-caps eyebrows above headings) */}
        <p className="text-sm font-bold text-accent">Interactive preview</p>
        <h2 className="mk-c-primary mt-2 font-serif text-3xl sm:text-4xl">A garden that answers back</h2>
        {/* Section intro caption — same text-base scale the other sections use */}
        <p className="mk-c-secondary mt-3 text-base leading-7">
          Click a plot to grow it. This is exactly how your garden responds to daily missions.
        </p>
      </div>

      {/* Diorama panel — solid paper frame around the scene. Inline var keeps
          the dialog radius despite .fg-panel's own (unlayered) radius-card. */}
      <div className="fg-panel mx-auto w-full max-w-4xl p-3 sm:p-6" style={{ borderRadius: "var(--radius-dialog)" }}>
        <div
          className="relative h-[300px] w-full overflow-hidden rounded-card border sm:h-[420px]"
          style={{ background: SKY_WASH, borderColor: "var(--border-subtle)" }}
        >
          {/* Sun: soft radial glow + small crisp disc (blur allowed, no backdrop-blur) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-[4%] top-[6%] h-24 w-24 rounded-full blur-2xl sm:h-36 sm:w-36"
            style={{
              background: `radial-gradient(circle, ${mix("var(--accent-gold)", 38, "transparent")} 0%, ${mix("var(--accent-gold)", 12, "transparent")} 48%, transparent 72%)`
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-[10%] top-[10%] h-4 w-4 rounded-full sm:h-5 sm:w-5"
            style={{ background: mix("var(--accent-gold)", 55, "var(--bg-panel)") }}
          />

          {/* Tree line: far rolling hills, then a nearer ridge with conifers */}
          <svg
            className="pointer-events-none absolute inset-x-0 bottom-[19%] h-[30%] w-full max-sm:bottom-[29%] max-sm:h-[24%]"
            viewBox="0 0 1200 220"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0 148 C 240 62 470 128 720 94 C 900 70 1060 118 1200 90 L 1200 220 L 0 220 Z"
              style={{ fill: mix("var(--text-accent)", 20, "var(--bg-panel-alt)") }}
            />
          </svg>
          <svg
            className="pointer-events-none absolute inset-x-0 bottom-[20%] h-[22%] w-full max-sm:bottom-[30%] max-sm:h-[17%]"
            viewBox="0 0 1200 220"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0 168 C 210 128 430 166 650 144 C 870 124 1040 156 1200 138 L 1200 220 L 0 220 Z"
              style={{ fill: mix("var(--text-accent)", 42, "var(--bg-panel-alt)") }}
            />
            {[[150, 30], [262, 24], [690, 28], [860, 22], [1035, 30]].map(([x, h], i) => (
              <path
                key={i}
                d={`M ${x} 156 L ${x + 12} ${156 - h} L ${x + 24} 156 Z`}
                style={{ fill: mix("var(--text-accent)", 48, "var(--bg-panel-alt)") }}
              />
            ))}
          </svg>

          {/* Curved soil band the plots stand on */}
          <svg
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[30%] w-full max-sm:h-[46%]"
            viewBox="0 0 1200 160"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0 44 C 200 8 400 62 600 34 C 800 10 1000 56 1200 30 L 1200 160 L 0 160 Z"
              style={{ fill: earth(30) }}
            />
            <path
              d="M0 52 C 210 22 420 70 620 44 C 820 22 1010 62 1200 40 L 1200 160 L 0 160 Z"
              style={{ fill: earth(44), opacity: 0.6 }}
            />
            {[[150, 108], [335, 130], [520, 104], [748, 128], [930, 112], [1115, 122]].map(([x, y], i) => (
              <ellipse key={i} cx={x} cy={y} rx="5" ry="2.4" style={{ fill: mix("var(--accent-orange)", 30, "var(--bg-sidebar)") }} />
            ))}
          </svg>

          {/* Plots — the interactive layer */}
          {PLOTS.map((plot, i) => (
            <PlotButton
              key={plot.id}
              plot={plot}
              index={i}
              stage={stages[plot.id]}
              popIn={Boolean(grown[plot.id])}
              reduced={Boolean(reduced)}
              onGrow={() => growPlot(plot.id)}
            />
          ))}
        </div>
      </div>

      <DashedTrail />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div aria-live="polite" className="flex flex-wrap items-center gap-2">
          <span className="fg-chip fg-chip-xp">{inBloom} in bloom</span>
          <span className="fg-chip fg-chip-carbon">{stillGrowing} still growing</span>
        </div>
        <button
          type="button"
          onClick={resetGarden}
          className="mk-c-accent cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-bold hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-accent)]"
        >
          Start over
        </button>
      </div>

      <p className="mk-c-muted text-center text-xs">In the game, growth comes from verified daily missions.</p>
    </div>
  )
}