# EcoLudus smooth animations plan

**Goal:** Add orchestrated, polished animations across the app and landing page while respecting the existing theme system, accessibility (reduced motion), and React 19/React Compiler constraints.

**Scope:** Client UI only — reusable animation primitives, page transitions, toast/dialog choreography, staggered card/list entrances, smooth number changes, tab crossfades, and landing-page scroll reveals. No API or data logic changes.

---

## Current state

- Already has custom CSS keyframes in `globals.css` (`reveal-card`, `fade-in`, `softRise`, `animate-egg-shake`, `animate-modal-in`, `heart-pop`, etc.).
- Already uses Tailwind `transition`, `hover:-translate-y-*`, `active:scale-*`, `animate-pulse`.
- Already has modal `fade-in` + `animate-modal-in`, toast `fade-in`, mobile drawer `sheet-slide`.
- **Gaps:** no page-to-page transitions, no staggered entrances on most lists, no smooth number changes, tab content swaps instantly, landing sections are static on scroll, toast/dialog exit animations are absent.

---

## Approach options

### Option A — CSS-only polish (no new dependency)
- Add CSS stagger utilities (`stagger-*`, `page-fade`) and apply them to card grids and panels.
- Use CSS `@starting-style` / `view-transition` where supported for page fades.
- Skip number morphing and exit animations.
- **Best for:** minimal bundle impact; acceptable if user wants only subtle improvements.

### Option B — Add `motion` (framer-motion successor) **(Recommended)**
- Install `motion` for React (tree-shakable, declarative, React-19-safe).
- Build a small internal animation kit in `lib/animations.tsx`.
- Add `AnimatePresence` page transitions, staggered lists, animated numbers, tab crossfades, toast/dialog enter/exit.
- **Best for:** genuinely smooth, orchestrated motion with modest scope.

### Option C — Full motion system
- Option B plus scroll-triggered landing reveals, advanced micro-interactions (button press rings, checkbox morphs), and game-specific celebratory particle upgrades.
- **Best for:** maximum polish; touches the most files.

**Recommendation:** Option B. It gives the biggest perceived-smoothness win for a single new dependency and can be extended later into C.

---

## Implementation plan (Option B)

### Phase 1 — Foundation
1. Install `motion` (`npm i motion`).
2. Create `lib/animations.tsx` primitives:
   - `FadeIn` — opacity + translate wrapper with `amount` / `delay`.
   - `StaggerContainer` / `StaggerItem` — for grids and lists (stagger delay, reduced-motion fallback).
   - `AnimatedNumber` — count-up/down when a numeric value changes.
   - `AnimatedProgressBar` — motion width on value change.
   - `PageTransition` — `AnimatePresence` fade/slide wrapper for `app/(game)/layout.tsx` children.
   - `TabPanel` — crossfade wrapper for tabbed pages.
   - `ReducedMotion` helper / hook re-export from `motion`.
3. Add global reduced-motion guard in `globals.css` to disable motion primitives when `prefers-reduced-motion: reduce`.

### Phase 2 — Shared shell animations
4. `app/(game)/layout.tsx`
   - Wrap `{children}` in `<PageTransition>` so every authenticated route fades/slides in.
5. `lib/toast.tsx`
   - Replace static `fade-in` with enter slide-up + scale and exit slide-down + fade via `AnimatePresence`.
6. `components/ui/dialog.tsx`
   - Add `AnimatePresence` for backdrop fade and panel scale-in on open; reverse on close.

### Phase 3 — Page-level animations
7. `app/(game)/dashboard/page.tsx`
   - Wrap `PageHero` + `StatGrid` + `Panel`s in `StaggerContainer`.
   - Apply `StaggerItem` to quest rows and category progress cards.
   - Use `AnimatedNumber` for XP / EcoPoints / Level / Streak hero metrics and `AnimatedProgressBar` for level/pet bond bars.
8. `app/(game)/shop/page.tsx`
   - Animate EcoPoints hero metric with `AnimatedNumber`.
   - Wrap shop cards in `StaggerContainer`; crossfade tab panels with `TabPanel`.
9. `app/(game)/collection/page.tsx`
   - Wrap collection cards + incubator pods in `StaggerContainer`.
   - Crossfade tab panels with `TabPanel`.
   - Keep existing hatching/chest CSS particle animations (they are already polished); only wrap modal enter/exit with `AnimatePresence`.
10. `app/(game)/garden/page.tsx`
    - Stagger garden tiles and plantable items.
    - Animate harvest success with a brief scale pulse via `motion`.
11. `app/(game)/habits/page.tsx`
    - Streak calendar / habit list staggered entrance.
    - Crossfade weekly/monthly tabs.
12. `app/(game)/insights/page.tsx`
    - Stagger charts/stat panels; crossfade insight tabs.
13. `app/(game)/leaderboard/page.tsx`, `app/(game)/friends/page.tsx`, `app/(game)/team/page.tsx`
    - Stagger row entrances.
14. `app/(game)/impact/page.tsx`, `app/(game)/premium/page.tsx`, `app/(game)/settings/page.tsx`, `app/(game)/pets/page.tsx`, `app/(game)/profile/page.tsx`
    - Wrap panels/cards in `StaggerContainer` for consistent page-load rhythm.

### Phase 4 — Marketing page
15. `app/landing/page.tsx`
    - Add scroll-triggered `FadeIn` reveals for hero text, mockups, features, about, garden preview, and CTA.
    - Keep existing hover scale effects; just add entrance choreography on scroll.

### Phase 5 — Verification
16. Run `npm run lint`, `npm run typecheck`, `npm run build`.
17. Smoke-test with reduced-motion media query enabled.
18. Check Lighthouse performance / CLS; ensure animations do not regress layout stability.

---

## Files expected to change

1. `package.json` / `package-lock.json` — add `motion`.
2. `lib/animations.tsx` — new animation primitives.
3. `app/globals.css` — reduced-motion guard + optional helper utilities.
4. `app/(game)/layout.tsx` — page transition wrapper.
5. `lib/toast.tsx` — toast enter/exit motion.
6. `components/ui/dialog.tsx` — dialog enter/exit motion.
7. `app/(game)/dashboard/page.tsx` — stagger + animated numbers.
8. `app/(game)/shop/page.tsx` — stagger + tab crossfade.
9. `app/(game)/collection/page.tsx` — stagger + tab crossfade.
10. `app/(game)/garden/page.tsx` — tile stagger + harvest pulse.
11. `app/(game)/habits/page.tsx` — stagger + tab crossfade.
12. `app/(game)/insights/page.tsx` — stagger + tab crossfade.
13. `app/(game)/leaderboard/page.tsx` — row stagger.
14. `app/(game)/friends/page.tsx` — row stagger.
15. `app/(game)/team/page.tsx` — panel/card stagger.
16. `app/(game)/impact/page.tsx`, `premium/page.tsx`, `settings/page.tsx`, `pets/page.tsx`, `profile/page.tsx` — panel stagger.
17. `app/landing/page.tsx` — scroll-triggered reveals.

---

## Out of scope

- No API/route logic changes.
- No changes to quest/garden/shop reward calculations.
- No redesign of components or copy changes.
- No WebGL/three.js/canvas particle systems.

---

## Notes / constraints

- Project uses React 19 + React Compiler; `motion` is compatible. Avoid adding `useMemo` around motion configs — the compiler rejects it; pass props directly or use lazy `useState(() => ...)` if static initialization is needed.
- Respect `prefers-reduced-motion: reduce` everywhere; `motion` exposes `useReducedMotion`.
- Keep existing CSS animations (egg shake, chest glow, heat pulse, etc.) intact; they are already performant and theme-aware.
