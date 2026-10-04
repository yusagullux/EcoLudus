# EcoLudus landing redesign — "Field Guide" design spec (2026-10-01)

Approved direction for the public website redesign. The landing page's concept:
**EcoLudus presents its world like a beautifully printed botanical expedition kit** —
seed packets, specimen labels, trail markers, stamps, and growth rings. Premium
nature-game identity: warm, alive, optimistic, collectible. NOT SaaS, NOT
corporate, NOT childish.

## Non-negotiables

- **Consume theme vars, never hardcode hexes** for surface/ink colors. The whole
  app has 6 runtime `[data-theme]` palettes. Available vars (see
  `app/globals.css`): `--bg-panel`, `--bg-panel-alt`, `--bg-sidebar` (dark ink
  surface on light themes), `--border-default`, `--border-subtle`,
  `--text-primary/secondary/muted/inverse`, `--text-sidebar(+/-muted)`,
  `--text-accent`, and the category palettes `--accent-green|lime|sage|gold|blue|teal|violet|slate|orange`
  (each with a `-text` variant that dark-theme-flips: `--accent-gold-text`, …),
  plus rarity vars `--rarity-common|uncommon|rare|epic|legendary` (+`-text`).
  Use `color-mix(in srgb, <var> N%, var(--bg-panel))` for tints.
  `--rarity-<r>` and `--accent-*` fills are identical in every theme, so
  category identity and rarity identity never shift.
- **Fonts stay**: Baloo 2 = display (`font-serif` alias in JSX, do not be
  confused — it resolves to `--font-heading`), Open Sans = body (`font-sans`).
- **Copy names things as users know them**: missions, garden, species,
  EcoPoints, XP, verified proof. Sentence case. No "dashboard" language.
- **Banned**: glassmorphism/backdrop-blur on landing surfaces, uniform 3-card
  grids, all-caps eyebrow labels above headings (small-caps is allowed ONLY on
  genuine artifacts: specimen tags, stamps, seed-packet labels), mid-dot meta
  strings ("a · b · c"), arrows appended to links, numbered markers except for a
  true sequence (the How-it-works trail).
- **Motion budget**: one orchestrated page-load growth moment in the hero,
  hover feedback, click-to-grow in the interactive preview. Nothing else animates.
  All motion library primitives honor `useReducedMotion()` (lib/animations.tsx).
- Every section is a **different composition** — no two sections may share the
  same layout recipe.

## Shared kit (already implemented — use it, extend it, don't reinvent)

`app/globals.css` "SEED-PACKET FIELD-GUIDE SYSTEM" block adds:

| Class | Purpose |
|---|---|
| `.fg-panel` | solid paper panel: bg-panel, border-default, radius-card, shadow-elev-1 |
| `.fg-panel-alt` | tinted inset panel: bg-panel-alt + border-subtle, no shadow |
| `.fg-chip` | base reward/infol pill — 0.2rem/0.6rem, 0.75rem font, 700 weight |
| `.fg-chip-coins` / `.fg-chip-xp` / `.fg-chip-carbon` | gold(green)/green/teal reward tints (EcoPoints / XP / kg CO₂) |
| `.fg-chip-rarity` | rarity-tinted chip — set color from inline style using the rarity `-text` var; parent supplies the rarity name in `style={{ "--r": … }}`? No — inline-style the chip with its rarity var pair. |
| `.fg-botlabel` | micro specimen tag: 0.625rem, 700, uppercase, 0.14em tracking, muted |
| `.fg-stamp` | circular verified stamp: 2px accent ring, accent text, uppercase micro, rotate(-8deg) |
| `.fg-trail` | dashed trail line: 2px dashed accent-mixed border |

`components/landing/primitives.tsx` exports (server-safe, no hooks):
`SectionShell` (max-w-7xl rhythm wrapper), `BotanicalLabel`, `RewardChip`
(`kind: "coins"|"xp"|"carbon"` + children), `Stamp` (`lines: string[]`),
`SpecimenFrame` (next/image photo in a rounded frame with optional rarity
ring + `BotanicalLabel` caption), `DashedTrail`.

## Page composition (app/page.tsx owns it)

```
MarketingShell ctaHref="/signup" ctaLabel="Start growing"
  HeroSection()            — components/landing/hero.tsx
  HowItWorks()   id="how-it-works"  — components/landing/how-it-works.tsx
  MissionsShowcase() id="missions"  — components/landing/missions.tsx
  GardenShowcase()   id="garden"    — components/landing/garden.tsx
  RewardsShowcase()  id="rewards"   — components/landing/rewards.tsx
  ImpactShowcase()   id="impact"    — components/landing/impact.tsx
  CommunitySection() id="community" — components/landing/community.tsx
  GardenPreview (upgraded, click-to-grow toy) id="preview" — components/garden-preview.tsx
  FinalCta()                         — components/landing/final-cta.tsx
```

Live data (`LiveStatsCard` aggregate, server component) is welcome inside hero /
impact but must use the kit above, not inline color-mix style blocks.

## Section art direction

1. **Hero** — asymmetric split. Left: story headline ("Play, protect, and grow
   a greener tomorrow."), one supporting sentence naming the loop (missions →
   XP/garden → real CO₂), CTAs ("Start growing", "I have an account").
   Right: a layered **garden diorama** — rounded scene box, sky-to-field
   gradient (panel-alt mixes), 3–5 depth layers (sun/blob glow, distant hill
   SVG silhouettes, soil band), specimen tiles built from real plant photos
   (`/images/plants/*.png`, 640² PNGs) in rarity-ring frames with tiny reward
   chips floating above, and a subtle staggered "grow in" entrance (ScaleIn /
   FadeIn with per-tile delay).

2. **How it works** — the ONE numbered sequence (content is truly sequential):
   a winding dashed trail connecting three stations: *Complete a daily mission →
   Grow your garden & collect species → Log real CO₂ impact*. Each station is a
   seed-packet panel with a lucide icon, a short sentence, and its reward
   vocabulary (XP chip, specimen chip, carbon chip). Number badges are round
   trail markers on the path, not type digits.

3. **Missions** — a **quest board**, not a list: one featured quest panel
   (large photo or icon tile + description + proof stamp + full reward row) with
   4–5 slim quest strips beside/below (category color dot from quests.json
   category accents, reward chips, one-line description). Use real quests from
   `public/quests.json`. Emphasize verification: rotate an `.fg-stamp`
   "AI photo proof" on the featured card.

4. **Garden** — the visual centerpiece: a **dark band** (mk-hero-style bg using
   `--bg-sidebar`). Depth staging: horizon glow, tree-line/hill silhouettes, a
   row of real plant photos in circular specimen frames standing on a soil arc —
   like a collectible shelf in moonlit garden. Each has its botanical-style
   specimen tag. Discovery counter ("4 of 14 species discovered") + rarity
   legend chips. Community framing: "every mission plants something".

5. **Rewards & progression** — no stat tiles. Lead with the real **badge
   medallions** (`/images/ecoquests-badges/*.png`: rabbit→cat→deer→fox→wolf→
   bear→eagle→lion→tiger) as an ascending progression path where the current
   level badge is lifted and the rest are dimmed — plus one chest (golden-chest)
   and an egg as "unlocks along the way". Explain XP→level→badge in one line.

6. **Impact** — visual storytelling: pick one hero number (live or curated) and
   build the section around it as a **growth ring / growing tree** graphic with
   milestone ticks; underneath, two small real-world comparisons
   ("0.5 kg CO₂ ≈ a smartphone charged ~30 times", "walking instead of driving
   ~1.5 km"). Use `AnimatedNumber` from lib/animations for the hero number.

7. **Community** — **summit** framing: a friendly podium of three "climber"
   cards (top of the leaderboard vibe — generic playful names, never real user
   data), a shared-goal progress ring (team missions), and a cheering mechanic
   mention. No corporate table.

8. **Interactive preview** — rebuilt `GardenPreview` (same file, keep
   click-to-grow): richer diorama scene (soil band + sun), the plant stages as
   polished SVGs (bigger, better shapes: mound soil, curving stems, layered
   leaves, petal ring flower), motion pop on stage change (spring scale, only
   on click), stage labels, "reset" affordance, and a caption tying it to the
   real game.

9. **Final CTA** — compact dark forest band: ink background (bg-sidebar),
   fireflies = 4–5 tiny accent dots with a slow drift (respect reduced motion),
   headline is the brand loop "Play. Protect. Grow." + one CTA ("Start your
   garden", /signup) + "Already playing? Sign in" link.

## Quality bar (all agents)

- Spacing rhythm consistent inside a section; alignment checked; typography
  scale consistent (display text-4xl/5xl, h2 max ~5xl — hierarchy via weight
  and color, not raw size).
- Hover/focus/active states on all interactive elements; `:focus-visible` ring
  comes free from globals.
- Mobile is first-class: hero, garden band, and podium get intentional mobile
  compositions (reorder, don't stack blindly).
- Images: `next/image` with explicit `sizes` for every photographic slot.
- No `backdrop-blur`, no rgba hardcodes where a var exists; no new dependencies.
- Keep copy short and plain-verb; every label does one job.