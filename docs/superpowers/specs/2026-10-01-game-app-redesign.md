# EcoLudus app redesign — "Living Garden" app identity (2026-10-01)

Design brief: make the logged-in app feel like a **premium cozy environmental
game** (App-Store-feature quality), not a web dashboard. Keep ALL existing
functionality, routes, data, and API behavior intact. This spec governs the
game-route redesign; it extends the identity established by the landing
redesign (`docs/superpowers/specs/2026-10-01-landing-visual-redesign.md`) — same
theme-var system, same fonts, same field-guide spirit — but with an app-grade
interaction language: bigger touch targets, quest-card energy, satisfying
feedback, bottom navigation on mobile.

## Identity: "Your living field notebook"

The landing marketed the botanical expedition kit; the app IS the kit in active
use. Today's missions are the daily forage, levels are pressed progress, the
garden is the living heart, impact is the logbook tally. Warm paper panels,
hand-stamped verifications, specimens pinned in rarity frames.

## Non-negotiables

- **Theme vars only** for color (all 6 `[data-theme]` palettes must hold):
  `--bg-panel`, `--bg-panel-alt`, `--bg-sidebar`, `--border-default/subtle`,
  `--text-primary/secondary/muted/inverse`, `--text-sidebar(-muted)`,
  `--text-accent`, `--accent-green|lime|sage|gold|blue|teal|violet|slate|orange`
  (±`-text`), `--rarity-*` (±`-text`). Tints via
  `color-mix(in srgb, <var> N%, var(--bg-panel))`. Never hardcode hexes.
- **Fonts stay**: Baloo 2 = `font-serif` (display), Open Sans = body.
- **Gameplay logic is frozen**: same handlers, endpoints, payload fields,
  error mappings, dialog flows. Restyling only; a wrapper may be swapped for
  an equal-behavior kit component only when its props cover every use site.
- Fragile zones (do NOT restructure): dashboard photo-proof flow (FileReader/
  base64/camera inputs, Gemini 422 passthrough) + its intentionally-fragile
  quest-sync effect; collection's hand-rolled fullscreen reveal modals
  (particles, crack stages, NEW-discovery ref snapshot, Escape/scroll-lock);
  settings' keyed `SettingsForm` remount + canvas avatar upload; habits'
  verdict/trust result rendering; pets' heart particles + double-drift caveat.
- **No new dependencies.** Every animated component honors `useReducedMotion()`.
- **No ambient background loops on app pages** (no landing-style fireflies).
  Motion is action feedback + entrances; entrances max one staggered moment
  per screen.
- Copy: player vocabulary, sentence case, plain verbs. No "dashboard/stats/
  metrics/manage" language.
- Touch targets ≥ 44px (buttons ≥ 48px primary).

## Banned (dashboard tells)

- Repeating `PageHero`-gradient + `StatGrid` + stacked `Panel`s skeleton on
  every page (the current disease). Each page gets its own composition.
- Stat walls above the fold (max 3 compact stats visible before content).
- Table-like row dumps for collectibles/rankings that deserve medallions.
- `backdrop-blur` on any app surface; emoji standing in for real iconography.
- Uniform card grids of identical cards everywhere (variate scale/emphasis).

## Design-system foundation (owns + contracts)

Agents must use the REUSED existing vocabulary: `fg-chip(-coins/-xp/-carbon)`,
`fg-stamp`, `fg-botlabel`, rarity chip/border vars, `t-panel/t-card/t-input`,
`chip-danger/success/warning`, forest/cream scales, shadows `shadow-elev-1/2/3`,
radii `--radius-card/dialog/input`. New shared pieces:

| Piece | Owner | Notes |
|---|---|---|
| `components/bottom-nav.tsx` (NEW) | Shell agent | Mobile bottom tab bar: 5 items (Home `/dashboard`, Missions `/habits`, Garden `/garden`, Shop `/shop`, Collection `/collection`)… see Shell assignment. Fixed bottom, `bg-sidebar` surface, blur ONLY on the nav bar is allowed (navigation chrome, not content), safe-area padded, labels 0.6875rem, active = filled icon tile + `--text-sidebar`/accent per theme (nav bar is the `--bg-sidebar` ink surface on light themes). |
| `components/game-ui.tsx` (restyle in place) | Kit agent | Keep EVERY existing export + its prop contract (12 pages render them). Restyle internals; upgrade the dashboard-tell pieces (`PageHero` → friendlier page header, buttons → 48px friendly set, `StatGrid`/`Panel` visual refresh). ADD new exports for the wave-2 pages: `QuestCard` (daily quest game card), `StreakFlame` (streak medallion + dots), `LevelProgressRing` (SVG ring w/ XP-to-label), `MiniShelf` (horizontal collectible strip), `PageHeader` (light header, no hero band). |
| `components/ui/empty-state.tsx` | Kit agent | Expressive: hand-drawn-feel SVG scene (sprout/doodle ground line) + friendlier copy slot + action button. |
| `components/ui/skeleton.tsx` | Kit agent | Align shapes with the new card language. |
| `app/globals.css` | Kit agent ONLY (appender role) | May append new `.ap-*` utility classes at the end of the file. Landing/mk/fg blocks untouched. |
| `app/(game)/layout.tsx`, `components/sidebar.tsx` | Shell agent | Desktop sidebar restyle; mobile: keep 56px top bar (restyled) + ADD bottom nav; drawer stays as the overflow menu ("More"). Main padding gains bottom-nav clearance (`pb` + safe-area). Loading skeleton updated to match. |

Wave-2 page agents must NOT edit `globals.css`, `game-ui.tsx`, or shared UI
primitives — if the kit lacks something, inline `color-mix` styles + Tailwind
are the fallback, and the gap is REPORTED in the agent's summary.

## Wave assignments (disjoint file ownership)

- **A — App shell**: `app/(game)/layout.tsx`, `components/sidebar.tsx`, `components/bottom-nav.tsx` (new).
- **B — Design-system kit**: `components/game-ui.tsx`, `components/ui/empty-state.tsx`, `components/ui/skeleton.tsx`, `components/ui/dialog.tsx` + `components/ui/confirm-dialog.tsx` (light radius/shadow polish only), `app/globals.css` (append-only).
- **C — Home screen**: `app/(game)/dashboard/page.tsx`. The flagship (direction below).
- **D — Forage & logbook**: `app/(game)/habits/page.tsx`, `app/(game)/insights/page.tsx`.
- **E — Living garden**: `app/(game)/garden/page.tsx`, `app/(game)/pets/page.tsx`.
- **F — Collectibles**: `app/(game)/collection/page.tsx`, `app/(game)/shop/page.tsx`.
- **G — Social**: `app/(game)/team/page.tsx`, `app/(game)/friends/page.tsx`, `app/(game)/leaderboard/page.tsx`.
- **H — Quiet pages**: `app/(game)/settings/page.tsx`, `app/(game)/premium/page.tsx`.

Wave 2 runs only after A + B land (pages import the new kit exports).

## Art direction per page

### C — Home (`/dashboard`, flagship)

Order = Today's mission → Progress → Rewards → Garden/Collection → Impact:

1. **Greeting row (no hero panel)**: level-ring avatar (SVG ring showing XP
   progress around the Avatar), "Good {time-of-day}, {name}" + one warm
   status line ("Your garden has 3 plots ready"), streak flame chip.
2. **Dominant: Today's missions card stack** (fg-panel container): header row
   ("Today's missions" + "2 of 5" count pill + time-left chip from existing
   `timeLeft` ticker), then quest items as REAL QUEST CARDS — category icon
   tile (color-mix of category accent), title, why-it-matters line, reward
   chips (fg-chip family), state machine: round select button → proof-needed
   stamp (fg-stamp, tappable) → done check with spring pop. Verified-quest
   state from `verifiedQuestIds` must stay visibly distinct.
3. **Primary action**: big full-width primary button "Complete N missions"
   (existing `completeSelectedMissions`; disabled until selection).
4. **Progress strip (one compact card)**: `LevelProgressRing` + streak dots
   (7-day from `currentDailyQuestsCompleted` data already in page) + next
   badge teaser ("Wolf at 1125 XP"; badge art from `/images/ecoquests-badges`).
5. **Garden & collection teaser**: horizontal `MiniShelf` of owned plants
   (real `/images/plants/*.png`) + species count → link to garden; active pet
   bubble (bond %) → link to pets.
6. **Impact line**: carbonReduced as one friendly number + comparison
   ("≈ N phone charges").
Keep + restyle (logic frozen): streak reward dialog, proof dialog
(SegmentedControl text/photo, camera inputs), completion popup → celebratory
reward card (RewardGlow + chips + floating XP number), category progress row.
Remove the dead `PhotoVerification` import. Demote the 3 `MetricCard` stats:
they fold into the greeting/progress strips or drop from view (data stays in
profile).

### D — Habits (`/habits`) + Insights (`/insights`)

- **Habits = the private logbook**: page header "Your eco-habit logbook" +
  trust meter as a leaf gauge (0–100 from `trustScore`, leaf icon segments);
  missions as logbook entry cards (title, category color, XP chip, "Log"
  button ≥44px); keep the submission dialog structure (before/after,
  description, ConfidenceSelector) — restyle inputs friendlier; **result
  dialog**: verdict as a rotated ink STAMP (APPROVED green / PARTIAL gold /
  REJECTED red — `fg-stamp` treatment, not a banner) + reasoning + trust
  delta row.
- **Insights = adventure almanac**: kill the 6-tile StatGrid → journey
  framing: big streak ring + 7-day trend as a small CSS bar garden (bars as
  leaf-topped stems, today highlighted), category distribution as a planted
  bed of category-icon flowers sized by share, XP/Eco progression as a
  growth-arc graphic toward the next level/badge. All derived data unchanged.

### E — Garden (`/garden`) + Pets (`/pets`)

- **Garden**: the tile board is the hero — full-width garden BED presentation
  (soil-band backdrop behind the tile grid via color-mix), tiles as plots
  with real plant art, growth bars as tiny stems, locked tiles = faint
  dotted plots with "Unlock — {cost} EP" price tag; harvest pop animation
  kept (+ one confetti-lite scale pop on Harvest All). Plantables inventory →
  seed-packet cards. Merge the 3 dashboard-ish panels into ONE compact
  action bar ("Harvest All" + counts) above the bed; plant-status rows become
  bed notes. Rules guide becomes a 3-step illustrated trail.
- **Pets**: portrait as a big habitat scene card (tinted by mood via
  computeVitals), tap-to-pet with heart particles (kept), vitals as three
  small ring gauges (Happiness/Energy/Bond) instead of bars, care actions as
  3 big friendly buttons; stat cards panel → one expressive "care notes"
  card; pet picker cards keep Active badge + rarity ring.

### F — Collection (`/collection`) + Shop (`/shop`)

- **Collection**: field-guide album. Keep ALL reveal-modal choreography
  byte-compatible (particles, crack stages, shake, Escape/scroll-lock). Page
  header = "Your field guide" + discovered-X-of-Y as inked progress; tabs stay
  `PillTabBar` (restyle via kit if cheap); locked entries = silhouette with a
  "?" leaf mark; discovered = rarity-ringed specimen frame + count badge
  (existing components, restyled). Incubator = cozy incubator card with warm
  glow (color-mix), timer chips.
- **Shop = daily market stall**: prominent reset countdown as a market-open
  chip; deal cards as seed packets — rarity ring, discount as a rotated
  price-sticker, big price + Buy button (48px); shortfall state shows "+N EP"
  hint honestly. Keep single-buy lockout + error mapping.

### G — Team + Friends + Leaderboard

- **Team**: joined view = team banner card (roundel crest icon, team name,
  code as fg-stamp-style copy tag, members as avatar cluster + count); 3
  assigned missions as cooperative mission cards (shared progress bars,
  contributor energy, Submit Progress button); mission library cards with
  difficulty chips; team leaderboard rows get rank medallions. Unjoined =
  illustrated EmptyState + big Create/Join buttons. Dialog/branches unchanged.
- **Friends**: friend rows as small character cards (avatar, level chip, XP);
  Cheer = heart-burst icon button with tiny pop (cap honored); quests panel
  = 3 friendly challenge cards (kept); find-players search stays; requests
  get Accept/Decline as distinct friendly buttons. Remove behind
  ConfirmDialog.
- **Leaderboard**: keep podium (gold halo) — polish it (real badge art for
  your rank level? keep scope small: podium + medallion-ranked rows) + your
  row pinned/highlighted. SegmentedControl tabs stay.

### H — Settings + Premium (quiet polish)

- Same structure and contracts; restyle to the kit (friendly buttons, inputs,
  theme preview cards keep live var previews), Danger Zone stays quiet-red.
- Premium: align with kit visuals; keep all CTAs disabled; friendly "coming
  soon" empty vibe. Lowest effort.

## Quality bar (all agents)

- Every interactive element: visible focus ring (globals provides), hover,
  active press (scale 95–98%), disabled state. 40px+ tappable rows.
- Spring feedback via lib/animations (`StaggerContainer/Item`, `FadeIn`,
  `AnimatedNumber`, `AnimatedProgressBar`, `MotionPresence`) — short (≤400ms),
  never blocking input.
- Mobile is first-class: every page checked at 390px; one intentional mobile
  composition choice per page (reorder/scale, not blind stacking). Desktop:
  content max-width ~1100px stays.
- Images: `next/image` + explicit `sizes`.
- Keep `PageTransition` in the layout; navigation transition stays smooth.
- Reduced motion: everything still readable with animations off.
- Report any kit gaps + any logic you had to touch (aim: zero).