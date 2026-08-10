# EcoLudus UX/design bug-fix plan

**Goal:** Fix concrete usability/design bugs across the app without redesigning any page. Keep layouts, copy, and interaction flows unchanged; only correct theme breakages, tiny touch targets, inconsistent toast patterns, and hardcoded colors that hurt accessibility.

**Scope:** Client UI only — `app/(game)/*`, `components/*`, `app/error.tsx`, `app/not-found.tsx`, `app/globals.css` where token helpers are missing. No API/route logic changes.

---

## Findings ranked by severity

### P0 — Critical (illegible or broken on some themes)

1. **Team page hero uses glassmorphism with hardcoded white text**  
   `app/(game)/team/page.tsx:305-313` renders `border-white/15 bg-white/10 text-white text-moss-300`. On light/dawn/bloom themes the hero background is light, so white text is invisible. The glass tiles should use `var(--text-primary)` / `var(--text-secondary)` on a `var(--bg-panel-alt)` surface, or the shared `HeroMetric` component.

2. **Team page action buttons are theme-breaking**  
   `app/(game)/team/page.tsx:320-324` “Join via Code” uses `border-white/25 bg-white/10 text-cream-100`. `app/(game)/team/page.tsx:360-366` “Leave Team” uses `border-rose-300/60 bg-rose-500/10 text-rose-600` plus an inline `rgb(224 36 36 / 0.85)` override. These assume a dark hero background and become unreadable on light themes.

3. **Team page role pill hardcoded to dark forest**  
   `app/(game)/team/page.tsx:372-376` uses `bg-forest-950 text-cream-100`. On dark/liquid/aurora this works thanks to the inverted forest scale, but on dawn/bloom it clashes and should use `var(--pill-active-bg)` / `var(--pill-active-text)`.

### P1 — High (accessibility or consistency issues)

4. **Dashboard still uses a one-off custom toast**  
   `app/(game)/dashboard/page.tsx:80,271-274` has local `setToast`/`showToast` and a bottom-center pill at the bottom of the page. The rest of the app uses `useToast()` from `lib/toast.tsx` with success/error variants and a shared aria-live region. Migrate dashboard to `useToast()` for consistent UX and screen-reader behavior.

5. **ErrorBanner hardcoded to light-theme rose/amber surfaces**  
   `components/ui/error-banner.tsx` returns inline `{ borderColor: "#f2e5bb", background: "#fff9e6", color: "#92601b" }` / rose equivalents. These are unreadable on dark/liquid/aurora themes and do not respect the existing `bg-rose-50` dark-theme override in `globals.css`. Rewrite using `var(--bg-panel-alt)`, semantic `text-rose-600`/`text-amber-600`, and `var(--border-default)`.

6. **LoadingState full-page screen hardcoded to white**  
   `components/ui/loading-state.tsx` uses `bg-white ring-forest-900/10`. On dark themes this flashes a white screen. Use `var(--bg-page-solid)` and `var(--text-primary)`.

7. **Habits “Log habit” button is too small**  
   `app/(game)/habits/page.tsx:318-324` uses `rounded-full bg-forest-950 px-3 py-1 text-[10px]`. That is well below the 44×44 dp touch target and the `@media (pointer: coarse)` rule only sets `min-height`, not width. Replace with a shared `primaryButton`-style small variant (`min-h-9 px-4 py-2 text-xs`).

8. **Habits submission error banner hardcoded light rose**  
   `app/(game)/habits/page.tsx:458-460` uses `bg-rose-50 text-rose-700`. The dark-theme override in `globals.css` covers some cases, but an explicitly hardcoded banner in JSX should use theme tokens.

9. **Collection locked silhouette can disappear on dark themes**  
   `app/(game)/collection/page.tsx:79-88` uses `filter: brightness(0) opacity(0.55)` over `var(--bg-panel)`. On dark themes the panel is already near-black, so a black silhouette becomes invisible. Add a theme-aware locked overlay (`background: var(--bg-panel-alt); opacity: 0.6; filter: grayscale(1) brightness(0.7)`) so the silhouette is always visible.

10. **PublicProfile avatar ring hardcoded white**  
    `components/public-profile.tsx:101` uses `ring-2 ring-white/20`. On light themes this is invisible; use `ring-2 ring-[var(--border-subtle)]` or `ring-[var(--text-inverse)]`.

### P2 — Medium (polish / minor contrast)

11. **Impact page badge/dot use hardcoded emerald**  
    `app/(game)/impact/page.tsx` has a `bg-emerald-100 text-emerald-700` “Done” badge and a `bg-emerald-500` unread dot. Should use `var(--text-accent)`-derived chips so they fit every theme.

12. **Premium feature cards use `opacity-80`**  
    `app/(game)/premium/page.tsx:209` lowers opacity on all feature cards, reducing text contrast. Remove `opacity-80`; rely on `var(--bg-panel-alt)`.

13. **Premium plan highlight shadow uses hardcoded amber rgba**  
    `app/(game)/premium/page.tsx:153-155` uses `rgba(154,107,31,0.12)` and `rgba(201,154,58,0.2)`. Use `var(--shadow-lift)` and a subtle `var(--text-accent)` border instead.

14. **Settings theme checkmark uses hardcoded `#fff`**  
    `app/(game)/settings/page.tsx:315` checkmark uses `color: #fff` on `var(--text-accent)`. On light themes `--text-accent` is dark green, so white checkmark is low-contrast. Use `var(--text-inverse)`.

15. **Settings toggle knob uses hardcoded `bg-white`**  
    `app/(game)/settings/page.tsx:346` toggle pill knob is always white; on dawn/bloom it reads fine, but should be `var(--text-inverse)` for consistency.

16. **Dashboard streak milestone cards mix hardcoded colors + opacity**  
    `app/(game)/dashboard/page.tsx:568-588` milestone cards use hardcoded hex milestone colors and `opacity: claimed ? 0.6 : 1`. The opacity wash can make text hard to read. Keep the colors for “reached” state, but render claimed cards with a subtle strikethrough/“Claimed” pill instead of lowering whole-card opacity.

17. **Marketing shell shadows are forest-centric**  
    `components/marketing-shell.tsx` uses `rgba(16,33,20,0.16)` shadows. They look fine but don’t match aurora/liquid. Replace with `var(--shadow-lift)` where possible or lower-alpha black so shadows are neutral.

---

## Implementation plan

### Phase 1 — Critical theme fixes (Team page)
- `app/(game)/team/page.tsx`
  - Replace hero glass metric tiles with `HeroMetric` components inside the `PageHero` children.
  - Replace “Join via Code” with `secondaryButton` + a visible `var(--text-primary)` override for the light-hero context, or move the CTA out of the hero.
  - Replace “Leave Team” with a destructive button using `bg-rose-500/10` / `text-rose-600` only when on a dark hero; otherwise use a standard secondary button.
  - Replace role pill with `Pill active` (which already uses theme tokens).
  - Replace `StatGrid` hardcoded accents (`#4CAF50`, `#06B6D4`, `#F59E0B`, `#8B5CF6`) with theme-aware hexes from `game-ui` accents or derive from `var(--text-accent)`.

### Phase 2 — Shared primitives
- `components/ui/error-banner.tsx`
  - Remove inline hex style object; render warning variant with `bg-panel-alt border border-amber-300/40 text-amber-700` and error variant with `bg-panel-alt border border-rose-300/40 text-rose-700`. Use `style={{ background: "var(--bg-panel-alt)", borderColor: "var(--border-default)" }}` plus Tailwind semantic text classes. Add an `aria-live="assertive"` role if not already present.
- `components/ui/loading-state.tsx`
  - Swap `bg-white` → `bg-[var(--bg-page-solid)]`, swap `ring-forest-900/10` → `ring-[var(--border-default)]`, use `text-[var(--text-primary)]`.

### Phase 3 — Page-level fixes
- `app/(game)/dashboard/page.tsx`
  - Delete local `toast` state and bottom toast JSX.
  - Import `useToast` from `@/lib/toast` and call `toast.success(...)` / `toast.error(...)` / `toast.show(...)` where `showToast` is used today.
  - Streak milestones: keep colors, remove `opacity: 0.6` for claimed; add a small `Pill` or strikethrough to indicate claimed.
- `app/(game)/habits/page.tsx`
  - Replace “Log habit” button with a `primaryButton` small class (`min-h-9 px-4 py-2 text-xs`).
  - Replace hardcoded `bg-rose-50 text-rose-700` error banner with `ErrorBanner` component.
  - Replace `divide-[#e7ecdf]` with `divide-[var(--border-subtle)]`.
- `app/(game)/collection/page.tsx`
  - Change locked image style from `brightness(0) opacity(0.55)` to a theme-aware overlay approach: wrap image in a container with `bg-[var(--bg-panel-alt)]` and apply `grayscale(1) brightness(0.55)` only to the image.
- `app/(game)/impact/page.tsx`
  - Replace `bg-emerald-100 text-emerald-700` badge with `Pill active` or a custom chip using `var(--bg-panel-alt)` / `var(--text-accent)`.
  - Replace unread dot `bg-emerald-500` with `bg-[var(--text-accent)]`.
- `app/(game)/premium/page.tsx`
  - Remove `opacity-80` from feature cards.
  - Replace hardcoded amber shadow with `var(--shadow-lift)` and a `var(--text-accent)` 2px border.
- `app/(game)/settings/page.tsx`
  - Theme checkmark: use `color: var(--text-inverse)` instead of `#fff`.
  - Toggle knob: `bg-[var(--text-inverse)]`.
- `components/public-profile.tsx`
  - Avatar ring: `ring-2 ring-[var(--border-subtle)]`.
- `components/marketing-shell.tsx`
  - Replace hardcoded `rgba(16,33,20,…)` shadow values with `var(--shadow-lift)` / `var(--shadow-card)` where the shadow is on a marketing surface. Keep shadows neutral where the variable is unavailable.

### Phase 4 — Verification
- Run `npm run lint`.
- Run `npm run build`.
- If dev server is available, smoke-test switching themes on: Team (logged-in state), Dashboard, Habits modal, Collection locked cards, Settings toggle.

---

## Files expected to change

1. `app/(game)/team/page.tsx`
2. `components/ui/error-banner.tsx`
3. `components/ui/loading-state.tsx`
4. `app/(game)/dashboard/page.tsx`
5. `app/(game)/habits/page.tsx`
6. `app/(game)/collection/page.tsx`
7. `app/(game)/impact/page.tsx`
8. `app/(game)/premium/page.tsx`
9. `app/(game)/settings/page.tsx`
10. `components/public-profile.tsx`
11. `components/marketing-shell.tsx`
12. `app/globals.css` (only if a new token helper is needed; try to avoid)

---

## Out of scope

- No layout changes, no new pages, no redesign of any component.
- No changes to API routes, data fetching, or quest/garden logic.
- No new dependencies.
- No animation behavior changes beyond removing opacity-wash regressions.
