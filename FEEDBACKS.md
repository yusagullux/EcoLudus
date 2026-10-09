# EcoLudus — Full QA Audit (2026-10-07)

> **Fix status (2026-10-08):** P0–P2 code findings are fixed and verified in the live app. Status per finding: C1 ✅ (payload-based `shop/duplicate-purchase` guard inside the row-locked transaction + client ref guard; reproduced live: click 1 → 200, click 2 → 409 — `scratch/qa/verify-fixes.json`), C2 ✅ (dashboard now says "Verify your email to unlock today's missions" for unverified sessions), UX 1 ✅ (shop pill now reads "Need N more"), B1 ✅ (shared `lib/quest-progress.ts`; both pages render identical totals from quests.json, verified), B2 ✅ (falls back to the most recently acquired owned pet; Rabbit companion panel renders), B3 ✅ (copy now states XP scales with trust), B5 ✅ (`/terms`, `/privacy` redirect to `/legal/*`), B6 ✅ (widget renders from hCaptcha's `onload`; warning count 0), UX 2 ✅ (rejection banner leads with a bold summary + bulleted reasoning), UX 11/P2-11 ✅ ("Tap to verify" stamp states the card action). Not code-fixable here: Design 1 species art (no better assets exist; current art already maps 1:1 to species) — needs art. Untested areas in §9 unchanged. Verification: `npm test` 143/143, `tsc --noEmit` clean, `eslint` clean.

Tester: Claude Code, driving the real site (dev server, localhost:3000, file-DB mode) headlessly with repo Playwright (`chromium.launch()`), as a real user: every page, form, modal, and flow interactively exercised. Evidence: JSONL logs + full-page screenshots in `scratch/qa/` (gitignored).

**Scope tested:** logged-out crawl (landing, login, signup, forgot/reset/verify-email, legal pages, guest guards) · auth flows (validation, unknown account, weak password, anti-enumeration) · fresh signup → dashboard · 14 game pages × 3 viewports (1280/768/390) · quests (select, text proof via Gemini, photo proof incl. rejection path, complete, rewards) · habits logbook end-to-end · shop (buy, chest open) · garden (plot select, plant) · team (create, assign mission) · settings (profile save, theme switch) · profile page · collection Pokédex · pets · leaderboard · friends · insights · premium · notifications · 404 · delete-account end-to-end (wrong password, confirmation typing, hard delete).

---

## Summary

The app is in solid shape for its stage. The core loop **works end-to-end**: signup → (verify) → daily quests → proof verification (text and photo, real Gemini calls) → completion with XP/EcoPoints/chest rolls → shop purchases → chest/egg opening → garden planting → team create + mission assign → habit logbook submission with AI approval → real CO₂ accounting with nice copy ("14.9 kg CO₂ — about 894 phone charges"). Sessions, guards, anti-enumeration, account deletion, and persistence all behaved correctly. No horizontal overflow anywhere at any viewport; empty states and the 404 are handled; dark mode persists.

The genuinely serious defects found are narrow but real:

1. **A double-click on a shop "Buy" button can complete two purchases** (reproduced twice: EP 2369→2269→2169 and 2069→1969, two `/api/shop/buy` calls 82 ms apart, both 200). No client disable-in-flight or server idempotency guard.
2. **New-user activation is broken by copy, not function**: an unverified fresh signup lands on a dashboard that says "Fresh quests arrive with the daily reset — check back soon", which is false — the real blocker is that quests are skipped until email verification. The user is never told to verify.
3. **The shop communicates "can't afford" with a pill reading "+255 EP"**, which reads like a reward/bonus, not a shortfall — no buy affordance, no explanation.

Not retracted-then-rewritten notes: an earlier suspicion of "silent photo-proof rejection" was **retracted** after a clean reproduction — the 422 reasoning *does* render in a red banner inside the verify dialog (see `scratch/qa/shots/p422-after-response.png`).

Untestable in this environment (called out honestly in §9): egg hatch >1 h, garden harvest timers, avatar upload resize, cron routes, weekly impact email, production (non-file-DB) behavior.

---

## Critical Issues

### C1 — Shop "Buy" has no double-click/idempotency protection → duplicate purchases
- **Severity:** Critical (money-equivalent currency loss, trivially triggered by impatient users or flaky taps on mobile)
- **Location:** `app/(game)/shop/page.tsx` (`handleBuy`, ~line 71) + `app/api/shop/buy/route.ts` (no idempotency/race guard found)
- **Steps (reproduced twice):**
  1. Log in with a user holding ≥200 EP.
  2. Open `/shop`, rapidly double-click a "Buy" button (Common Egg, 100 EP).
  3. Observe network: two `POST /api/shop/buy` requests fire 82 ms apart; both return 200.
- **Expected:** One purchase; the second click is ignored (button disabled while `isBuying`, in-flight ref, or a server-side idempotency key / short per-user rate limit).
- **Actual:** Two purchases, EP reduced twice (2369→2169; verified again 2069→1969, `scratch/qa/dblbuy2.json`, `scratch/qa/dblbuy.json`).
- **Recommended fix:** Both ends: (a) in `handleBuy`, guard with a ref (`if (buyingIdRef.current) return`) and disable buttons while a purchase is in flight — note `isBuying` state alone is not enough because two clicks land before re-render; (b) server-side, reject a second buy of the same item within ~2 s per user, or accept a client-generated `requestId` and dedupe.

### C2 — Unverified new users get a false "quests arrive with the daily reset" message
- **Severity:** Critical (activation funnel — the first thing every new user sees is misleading)
- **Location:** `app/(game)/dashboard/page.tsx` ~line 184 (`if (isResetNeeded && !emailVerified) setQuests([])`) and the empty-state copy it produces; signup session intentionally soft-gates (correct), but the UI never says why quests are missing.
- **Steps:**
  1. Sign up a fresh account (session cookie granted, email unverified).
  2. Land on `/dashboard`.
- **Expected:** Empty state says "Verify your email to unlock today's missions" + resend link/pill.
- **Actual:** "No missions today — Fresh quests arrive with the daily reset — check back soon." The user waits for a reset that is not the cause; the actual gate (verification) is invisible. (Bonus: login *does* say "Please verify your email to continue", so the correct message already exists elsewhere.)
- **Recommended fix:** Branch the empty state on `emailVerified`: show a verification callout (reuse the resend flow from `auth-card.tsx`) instead of the daily-reset copy.

---

## Bugs

### B1 — Quest-category progress differs between Dashboard and Profile (and disagrees with itself)
- **Severity:** Medium
- **Location:** Dashboard "Quest progress" chips vs Profile "Quest Category Progress" (`app/(game)/profile/page.tsx`, dashboard aggregator)
- **Steps:** With one completed Gardening quest (today, qa user): open `/dashboard`, scroll to "Quest progress"; open `/profile`, compare.
- **Expected:** Same totals from one source of truth.
- **Actual:** Dashboard: `Recycling 0/10 · Energy Saving 0/12 · Transportation 0/7 · Water Saving 0/6 · Clean-Up 0/6 · Gardening & Nature 0/6 · Sustainable Living 1/16`. Profile: same first five, but `Gardening & Nature 1/10` and **no** "Sustainable Living". The completed quest is counted in Profile but not Dashboard, and the denominators differ (6 vs 10; 7 categories vs 6).
- **Recommended fix:** Extract one shared function (e.g. in `lib/`) that computes category progress from `missionsCompleted`/`mission_logs` + `quests.json`, and render both pages from it. Decide whether Sustainable Living is a real category and include or drop it in both.

### B2 — Dashboard "No companion yet" while Pets page shows an owned Rabbit
- **Severity:** Medium (works for freshly-hatched pets; misfires for pets without an `active` flag — seed/legacy/imported data)
- **Location:** `app/(game)/dashboard/page.tsx:320-322` — `activePetId = profile?.activePet || profileAnimals.find(pet.active)?.id`, with **no fallback to the first owned pet**.
- **Steps:** User has `payload.animals = [{ id: "pet_rabbit", name: "Rabbit", acquiredAt: … }]` with no `active: true` and no `profile.activePet`. Dashboard shows "No companion yet / Open a chest to find a species egg…"; `/pets` shows the Rabbit.
- **Expected:** If the user owns any pet, show it (most recent owned as the companion).
- **Actual:** "No companion yet", inviting the user to buy something they already have.
- **Recommended fix:** Final fallback `|| profileAnimals[profileAnimals.length - 1]?.id`.

### B3 — Habit logbook: approved submission paid 9 XP of the advertised 25 XP
- **Severity:** Medium (contradicts the page's own copy — "Approved submissions give full XP")
- **Location:** `/habits` logbook modal → `POST /api/private-missions/submit`; trust modulation lives in `lib/private-mission-verification.ts` / `lib/trust-system.ts`.
- **Steps:** Log "Drink more water" (25 base XP) with before 2 / after 8, a specific description, high confidence. Response: `APPROVED, confidence 95, realism_score 95`. Trust went 1→4.
- **Expected:** Per the "/habits" page copy, an approved first entry should pay ~25 XP.
- **Actual:** XP went 1064→1073 (+9).
- **Recommended fix:** Either the copy is wrong (say "XP scales with your trust score until you build history") or the trust multiplier is double-penalizing at very low trust. Align copy with behavior; consider a floor (e.g. min 60% of base XP for APPROVED with confidence ≥ 90).

### B4 — Stale `lib/level-system` references in the wild / stale docs table
- **Severity:** Low (documentation hazard only — runtime formulas match)
- **Location:** `docs/` (declared stale in CLAUDE.md) keeps the old 9-step Cat→Lion level table; actual formula `requiredXP(level) = 100·level + 25·level²` verified live (level 5 → 1125 XP boundary observed exactly: 1073 XP, "52 XP to next").
- **Recommended fix:** None in code. When `docs/` is retired, delete the table with it.

### B5 — `/terms` and `/privacy` 404 (real pages are `/legal/terms`, `/legal/privacy`)
- **Severity:** Low (nothing links to the 404ing paths today; landing footer + settings correctly use `/legal/*`)
- **Steps:** `GET /terms` → 404, `GET /legal/terms` → 200.
- **Recommended fix:** Add redirects in `next.config` (or `vercel.json`) from `/terms`,`/privacy` → `/legal/*` so external links/search-index drift never 404s.

### B6 — hCaptcha `render=explicit` without `onload` warning on every auth page load
- **Severity:** Low (console noise in prod too, per warning text; script still functions)
- **Location:** hCaptcha script tag in auth-card component / signup, login, forgot-password, delete-account.
- **Steps:** Open `/login`; console: `[hCaptcha] should not render before js api is fully loaded. render=explicit should be used in combination with onload.`
- **Recommended fix:** Append `&onload=<cb>` to the `api.js` URL and render inside the callback, per hCaptcha docs.

---

## UI / UX Problems

1. **"Cannot afford" affordance is a reward-shaped pill.** When a user lacks EcoPoints, the Buy button is replaced by `+{shortfall} EP` (`app/(game)/shop/page.tsx:221`). `+255 EP` reads exactly like a bonus you'd earn, not how much you're short. Screenshot: `scratch/qa/shots/dbg-shop.png`. Fix: "Need 255 more EP", or keep the Buy button disabled with a progress hint ("82/335 EP"). Also no feedback when the user *can* afford but clicks during an edge case (silent no-op).
2. **Photo-rejection error is thorough but visually crammed.** The red banner in the verify dialog dumps Gemini's full multi-line reasoning ("The image displays a solid green background with the word 'random'…") with no summary line. Fix: lead with one bold sentence ("This photo doesn't show you using stairs"), then the reasoning as secondary text. Screenshot: `scratch/qa/shots/p422-after-response.png`.
3. **Quest-card click opens the proof modal (no visual affordance).** Clicking a quest card opens the verification dialog; nothing on the card suggests the card is clickable or that this is what happens. A "Verify proof" hint or chevron would remove the trial-and-error.
4. **Habit completion doesn't visibly reset the card.** After an APPROVED habit submission, the card still reads "Log habit" among "3 AVAILABLE" — no check state or "Logged today" badge. The XP did land (1064→1073); the UI just doesn't reflect it in place.
5. **Profile "Edit profile" leads to Settings.** Non-obvious: the button is on the profile page but editing happens under `/settings` ("Your Info"). Works, but a first-time user hesitates. Either edit inline on `/profile` or rename the destination.
6. **Delete-account link is a danger-zone `<a>` that navigates to a full page** — this is actually fine (arguably safer than a modal), but nothing on the Settings list prepares you for a page transition; consider stating "This opens a confirmation page."

---

## Design Problems

1. **Species art is placeholder-reused, breaking the collection book's promise.** In `lib/catalog.ts` the plant catalog maps unrelated species to unrelated images: Golden Daisy→`sunflower.png`, Mossy Fern→`mint.png`, Spotted Aloe→`basil.png`, Aurora Blossom→`cherry_blossom.png`, Ember Cactus→`dragonfruit.png`. The Pokédex ("Rare finds · Collection Book") therefore shows misleading art for undiscovered→discovered entries — discovering a Golden Daisy shows it as a sunflower. Eggs/chests have the same reuse. This is fine as a stopgap, but it actively undermines the "discover all species" loop, which is your core retention hook.
2. **Theme system is strong** — the Light/Forest/Dark/Liquid/Dawn/Bloom/Aurora set is distinctive and persists correctly across reloads. No change needed; noting it as verified-good, since "replace the theme system" is the wrong instinct after a redesign.
3. **Inconsistent category naming across surfaces** ("Clean-Up Missions" chip vs "Clean-Up"; "Rare finds" section title vs per-tab counters) — cosmetic but adds cognitive load in the Pokédex.
4. **Dashboard "No companion yet" panel** markets chest purchases to a user who already owns a pet (see B2) — copy and data disagree.

---

## Feature Recommendations

### Add
1. **Verify-email callout on the dashboard** for unverified sessions (C2) — highest-leverage addition, small work.
2. **Buy-button in-flight + idempotency guard** (C1) — client ref + server dedupe.
3. **Insufficient-funds clarity on shop** (UX 1).
4. **Pet-ownership fallback** (B2).
5. **A "logged today" state on habit cards after an approved submission** (UX 4).

### Improve
1. **Unify quest-category progress** into one shared module (B1).
2. **Habit XP copy honesty** (B3) — state how trust affects payouts; the current copy promises "full XP" and pays 9/25.
3. **LCP for above-fold images** — add `loading="eager"` (currently `priority` semantics) for the landing hero `forest.webp` and the first card image on `/pets`, `/profile`, `/shop` (Next warning shown in dev logs on each load).
4. **Signup latency** — signup takes ~1.3 s POST + hCaptcha load; fine for prod, but consider loading the hCaptcha script lazily/async so it never sits in the critical path of first paint.

### Remove
1. Nothing structural. Resist any instinct to rebuild the auth, store RPC, or dual-mode data layer — all verified working. The `/terms`+`/privacy` orphan routes (B5) can be removed or redirected rather than recreated.

---

## Performance / Technical Issues

1. **Shop buy race** (C1) — the most important technical finding; also indicates `/api/shop/buy` doesn't serialize purchases per user, which under real concurrency (two tabs) can overspend balances or double-grant inventory. Same pattern likely merits a look in other POST-award routes (quest complete already looks guarded by the daily row lock; shop buy is not).
2. **Dev-console noise from hCaptcha** on every auth page (B6) — noisy but benign.
3. **`next/image` LCP warnings** on `/`, `/pets`, `/profile`, `/shop` (above-fold image not eager) — cheap fix, real CWV impact in prod.
4. **Signup POST measured ~1.26 s application-code** (bcrypt cost 12 is the bulk — appropriate for security, just don't add work to that path).
5. **File-DB fallback fragility (by design, but flagging for awareness):** every new SQL query needs an exact-match branch in `fileSql` or dev throws `Unsupported file database query`. The catalog tests guard this; keep the pattern for any new route work.
6. Not measured: production DB latency, cron routes, `xp_transactions`/`trust_history` write volume — out of scope for a UI QA pass in file-DB mode.

---

## Accessibility

What I could verify from DOM + keyboard-adjacent evidence:
- ✅ Dialogs use `role="dialog"`; the quest-photo inputs are real `<input type="file">` with `sr-only` classes and stable IDs.
- ✅ Shop buttons carry `focus-visible:outline-none focus-visible:ring-2` styles (visible focus affordances exist in code).
- ⚠️ **Delete-account + danger zone is a link (`<a>`, not `<button>`)** — works, but a destructive navigation should be announced appropriately (it navigates, so `<a>` is semantically defensible; just ensure it's not styled to look like a tertiary control).
- ⚠️ **hCaptcha itself is an a11y chokepoint** for keyboard users (third-party; consider documenting its accessibility mode in a help link).
- ⚠️ The photo-rejection banner text is long and small-font; contrast of red-on-cream was sufficient in screenshot but re-verify in Liquid/Bloom themes, where translucent glass surfaces sit under text.
- Not tested with a screen reader / full keyboard-only pass — recommend one before launch.

---

## Responsive / Mobile Issues

- ✅ **Zero horizontal overflow on all 14 game pages at 1280×900, 768×1024, and 390×844** (overflowX probed in every crawl).
- ✅ Mobile hamburger drawer opens/navigates correctly at 390×844.
- ✅ Sidebar layout holds at 900 px height (earlier clipping suspicion retracted after measuring).
- ✅ Shop, dashboard, profile, settings all readable and tappable at phone width; buttons keep ≥44 px touch targets (min-h-11 classes).
- ⚠️ Not verified at 390 px: proof modal upload flows (file picking can't be exercised meaningfully headlessly on mobile viewports) and the theme-switcher row wrap. Recommend a quick manual pass on a real phone.

---

## Polish / App-Store Quality

- ✅ 404 page custom and styled; `/legal/terms`, `/legal/privacy` present; landing footer consistent; premium page honest "Coming Soon"; notifications empty state friendly.
- ✅ Delete-account: full danger flow (password + typing "DELETE" + confirm), wrong password shows a clean inline error, success hard-deletes the row (verified in the data file) and lands the user on the landing page. This is genuinely good.
- ✅ Forgot-password anti-enumeration (always 200, generic copy) verified with unknown email.
- ✅ Bogus verify/reset tokens render clean error pages rather than crashing.
- ✅ Auth error codes are consistent Firebase-style (`auth/invalid-credentials`, `auth/email-not-verified`, …) and mapped to human copy.
- ⚠️ Console shows "localhost detected" hCaptcha dev noise — dev-only, fine; ensure it's gone in prod build.
- ⚠️ Species art placeholders (Design 1) are the single biggest gap between current polish and "store-ready".

---

## Priority Roadmap

### P0 — fix now
1. **C1** shop double-purchase race (client guard + server dedupe).
2. **C2** unverified-dashboard copy: tell the user to verify email, not to wait for a reset.

### P1 — next sprint
3. Shop insufficient-funds affordance (UX 1).
4. Category-progress unification (B1).
5. Companion fallback (B2) + matching dashboard copy.
6. Habit XP copy/payout alignment (B3).

### P2 — quality pass
7. Species art for the 5 mismatched plants (+ eggs/chests when art exists).
8. Photo-rejection message hierarchy (summary + detail).
9. `/terms`, `/privacy` redirects (B5).
10. `next/image` eager loading for the four flagged heroes.
11. Quest-card "verify proof" affordance.

### P3 — polish
12. hCaptcha `onload` combo to silence the warning (B6); lazy-load the script.
13. Theme contrast re-verify for banner text on Liquid/Bloom.
14. Keyboard-only + screen-reader pass before launch.
15. Retire stale `docs/` level table when the Pages site is decommissioned.

---

## Untested / out of scope (stated plainly)

- Egg hatch (>1 h timer), garden harvest timers — longer than the session window.
- Avatar upload + server-side square resize; weekly impact email (SendGrid); cron routes (`CLON_SECRET`-gated) — no clock/control to exercise them honestly in this pass.
- Production Postgres behavior (all testing was file-DB mode), real Brevo email delivery, rate-limit behavior under load.
- The full keyboard-only/screen-reader pass (§ Accessibility notes are code+DOM observations, not a live SR session).

## Retracted findings (checked, did not reproduce)

- ~~"Photo-proof rejection is silent"~~ — 422 reasoning renders in a red banner in the dialog; earlier observation was a test-script artifact (`scratch/qa/proof-flow3.json` snapshot timing).
- ~~"Sidebar clips at 900 px viewport"~~ — measured, fits.
- ~~"Completion state doesn't persist after reload"~~ — hydration-race in my test script; state persists.