# Next Steps Plan — EcoLudus

## Decisions from planning

1. **Merge `feat/easier-quests` into `main` now** (no textual conflicts detected).
2. **Commit the current uncommitted work as a single PR** (public-profile Collection Book + image optimization + `scripts/optimize-images.mjs`).

---

## Phase 0 — Stabilize and commit the current work tree

**Goal:** Get `main` to a clean, shippable state before bringing in the branch.

1. Remove the stale `eslint-disable` directive in `components/ui/dialog.tsx:136` that is now unused. This is the only lint failure (`npm run lint` currently exits with 1 warning).
2. Revert the auto-generated change in `next-env.d.ts` (it is produced by Next.js dev/build and should not be committed).
3. Verify the current uncommitted code still builds and type-checks after those two cleanups:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run build`
   - `npm run test`
4. Stage and commit one PR containing:
   - `components/public-profile.tsx` — Pokédex-style Collection Book with plants/eggs/animals/seeds/chests tabs.
   - `app/(game)/profile/page.tsx` — pass the new collection arrays into `PublicProfileView`.
   - `app/api/users/[id]/route.ts` — expose public collection fields for other users' profiles.
   - All optimized PNGs under `public/images/{pets,plants,eggs,chests}/`.
   - `scripts/optimize-images.mjs` — the Sharp-based asset-optimization script.
   - **Not** `next-env.d.ts`.
5. Push the PR/branch. **Do not merge `feat/easier-quests` until this PR is in `main`.**

**Risk note:** The uncommitted `components/public-profile.tsx` imports `PillTabBar` from `@/components/ui/pill-tab-bar.tsx`. The diff of `feat/easier-quests` vs `main` shows that branch **deletes** `components/ui/pill-tab-bar.tsx`. That will become a real problem only after the merge; we will handle it in Phase 1.

---

## Phase 1 — Merge `feat/easier-quests` and reconcile

**Goal:** Bring the 28-commit branch into `main` and fix any resulting breakage.

1. From a fresh `main` (after Phase 0 is merged), run:
   ```bash
   git merge feat/easier-quests --no-ff -m "merge: design polish, easier quests, perf, and animation primitives from feat/easier-quests"
   ```
2. Resolve any modify/delete or semantic conflicts. Likely hotspots:
   - `components/ui/pill-tab-bar.tsx` was deleted by the branch but is used by the new Collection Book. Options:
     - **A.** Restore the file (small, harmless) so both old and new UI keep working.
     - **B.** Replace the Collection Book's `PillTabBar` usage with the branch's preferred tab primitive (probably `SegmentedControl` or `PillFilterBar`) — preferred if the branch truly deprecated `PillTabBar`.
   - `app/(game)/profile/page.tsx`, `components/public-profile.tsx`, `app/api/users/[id]/route.ts` — modified in both the uncommitted PR and the branch; the merge-tree check showed no textual conflicts, but verify the final files make sense.
   - `app/api/cosmetics/equip/route.ts`, `app/api/cosmetics/unequip/route.ts`, `app/api/notifications/read/route.ts`, `components/notification-bell.tsx` — deleted by the branch; confirm whether those subsystems are intentionally dropped on `main` or should be restored.
3. Run the full green check again:
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```
4. If any of the above fail, fix them before proceeding. Do **not** move to Phase 2 with a red build.

---

## Phase 2 — Validate the merged baseline

**Goal:** Confirm the merged `main` is production-ready.

1. Run the green-check commands one more time from a clean working tree.
2. Do a quick smoke test in the browser or with Playwright:
   - `/login` → `/dashboard`
   - `/collection` loads and shows tabs
   - `/shop` shows daily deals
   - `/profile` shows the Collection Book
   - public profile (`/profile/[id]`) shows another user's collection
3. If the smoke test surfaces issues, fix them as follow-up commits.

---

## Phase 3 — Pick the next feature

After the baseline is clean, choose one of these. They are listed from smallest/riskiest-cleanup to biggest/new-capability.

### A. Polish the Collection Book (quick win, builds on Phase 0)
- Add a "Copy public profile link" button to the owner's profile.
- Add a shareable OpenGraph image for `/profile/[id]`.
- Add unit tests for the public profile API and `PublicProfileView` rendering.
- De-duplicate the `CardImage`/`CollectionCardImage` rendering logic between `app/(game)/collection/page.tsx` and `components/public-profile.tsx` — right now they are two near-copies.

### B. Testing / reliability foundation
- Add a Playwright smoke test: signup/login → dashboard → complete a daily quest.
- Add missing unit tests for `chest-rewards.ts`, `boosters.ts`, `cosmetics.ts`.
- Add a test that the image-optimization script runs without error.
- This is invisible to users but is the safest investment before any marketing push.

### C. Real-world impact dashboard (high-leverage, user-facing)
- `lib/rewards-sync.ts` already plants trees via Ecologi; add a user-visible "Trees planted" counter and milestone celebration in `/impact`.
- Add a milestone share card (image export or copy-to-clipboard summary).
- Wire milestone progress into the dashboard hero.

### D. Daily rotating shop + special deals (medium, game-economy)
- The shop already has a `dailyDeals` concept, but the rotation logic may be static. Make the rotation deterministic per UTC day, add deal rarity weights, and add "last chance" countdown UX.
- Consider adding a "refresh" mechanism or flash sales.

### E. Booster + cosmetics UI (medium, depends on merge outcome)
- If the merge keeps cosmetics, build the equip/unequip UI and mission-booster flow.
- If cosmetics were intentionally dropped, this item becomes a no-op and we skip it.

---

## Suggested order

**Phase 0 → Phase 1 → Phase 2 → A → B → C**

That gives a clean baseline, a polished existing feature, a safety net of tests, and then a visible real-impact feature.
