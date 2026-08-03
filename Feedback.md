# EcoLudus Website Testing Feedback

This feedback is based on an automated audit and visual review of the EcoLudus Next.js app running locally on `http://localhost:3000`. Both desktop (1280×900) and mobile (390×844) viewports were tested, and a fresh test user was created to inspect authenticated pages.

---

## 1. Bugs and Problems

### A. Missing image alt text (accessibility & SEO)
- **Collection page** (`/collection`) — plant preview images for `mint.png`, `sunflower.png`, and `orchid.png` have no `alt` attribute.
- **Profile page** (`/profile`) — the small `sunflower.png` image in the "Collection Book" section has no `alt` attribute.
- **Impact:** Screen-reader users get no description of the image content, and search engines have less context.
- **Fix:** Add descriptive `alt` props to every `next/image` call (e.g., `alt="Mossy Fern plant illustration"`). For locked/unknown cards, use `alt=""` if the image is purely decorative.

### B. Duplicate `<h1>` headings on login/signup (desktop)
- **Login page** (`/login`) and **Signup page** (`/signup`) each render two visible `<h1>` elements on desktop:
  1. Marketing aside: "A focused operating room for sustainable habits."
  2. Form heading: "Return to your daily eco rhythm." / "Start building a greener routine."
- **Impact:** This violates WCAG 1.3.1 (Info and Relationships). A page should generally have a single `<h1>` that describes the page topic.
- **Fix:** Change the marketing aside heading to `<h2>` or `<p class="...">`. The form `<h1>` is the correct page title.

### C. Generic page titles across authenticated pages
- **Dashboard, Habits, Shop, Collection, Garden, Pets, Insights, Impact, Premium, Profile, Team, Friends, Leaderboard, Settings** all use the same browser tab title: `EcoLudus | Sustainable Habits & Rewards`.
- **Impact:** Poor UX when users have multiple tabs open; weak SEO.
- **Fix:** Export a unique `metadata.title` from each page, e.g. `Dashboard | EcoLudus`, `Plant Shop | EcoLudus`, etc.

### D. Long auto-generated display names overflow the UI
- New users who do not provide a display name get their email prefix as their name. The audit user `audit-1785767426831@example.com` became `audit-1785767426831`.
- This long string appears:
  - In the **sidebar user chip**, truncated awkwardly.
  - In the **dashboard hero** (`Welcome back, audit-1785767426831`), breaking the hero layout.
  - In the **profile hero**, taking the full width.
- **Impact:** Looks broken and unprofessional; email prefixes are not friendly identifiers.
- **Fix:**
  1. Add a **Display name** field to the signup form (the API already accepts it).
  2. Apply a `max-width`/ellipsis with a `title` tooltip for long names in the sidebar.
  3. Consider a friendlier default such as "Eco Explorer" instead of the raw email prefix.

### E. "Eco" counter on Collection hero is ambiguous
- The collection hero shows counters like `PLANTS 0/8`, `EGGS 0/4`, `PETS 0/13`, `SEEDS 0/8`, `CHESTS 0/4`, and then `ECO 0`.
- **Impact:** It is unclear what "ECO" counts (EcoPoints? eco-friendly actions?). The other counters use `X/Y discovered` semantics; this one does not.
- **Fix:** Rename to `ECOPOINTS` or `IMPACT`, and consider showing the unit/value format consistently.

### F. Horizontal overflow on mobile Friends page
- The mobile screenshot for `/friends` rendered at 420×2590 instead of the requested 390×844, indicating the page forces a wider viewport or has unwrapped content.
- **Impact:** Mobile users may experience horizontal scroll, which hurts usability.
- **Fix:** Audit the Friends page for `min-width`, long unbroken text (e.g. the player email/name strings), or grid columns that do not collapse on small screens.

### G. Empty metric states lack context
- **Dashboard hero** shows `IMPACT THIS WEEK 0` for a brand-new user with no explanation of what impact means.
- **Impact:** Users may not understand the metric or how to increase it.
- **Fix:** Add a tooltip, an info icon, or fallback microcopy when the value is zero (e.g., "Complete quests to see your weekly impact").

### H. Locked Collection cards lack visual affordance
- The locked plant cards on `/collection` are flat gray squares with a small lock icon and `???` label.
- **Impact:** Looks unfinished and does not convey "discoverable content" effectively.
- **Fix:** Use a subtle silhouette or gradient placeholder, or dim the actual species art, and add a hover tooltip such as "Complete quests to unlock".

### I. No custom 404 page
- A request to `/nonexistent-page` returned a plain HTTP 404 with no styled content.
- **Impact:** Users who mistype a URL get an unbranded error.
- **Fix:** Add `app/not-found.tsx` with the marketing shell and links back to `/landing` or `/dashboard`.

---

## 2. Visual Design Problems

### A. Repetitive dark-green hero on every authenticated page
- Every game page uses the same forest-green gradient hero banner. While consistent, it makes the app feel visually monotonous and flattens the information hierarchy.
- **Suggestion:** Vary the hero color/accent per section (e.g., blue for Insights, amber for Shop, purple for Team) or use a softer page header on secondary pages.

### B. Sidebar user chip is cramped with long names
- The user chip in the left sidebar truncates long display names without a tooltip, and the level/xp line is very close to the name.
- **Suggestion:** Enforce a max-width, add `title` attribute for full name, and slightly increase the vertical rhythm.

### C. Progress bars at 0% have very low visibility
- On `/dashboard`, `/profile`, and `/insights`, category progress bars at 0% are barely visible because the track and fill colors are too close.
- **Suggestion:** Increase the contrast of the empty track or add a subtle border so users can see where the bar begins.

### D. Uppercase button text with wide letter-spacing is hard to scan
- Buttons like `SELECT MISSIONS TO COMPLETE`, `LOG HABIT`, `VERIFY PROOF` use all-caps with tight sizing and wide tracking.
- **Suggestion:** Use sentence case for longer labels (e.g., "Select missions to complete") to improve readability.

### E. Premium page "Coming Soon" buttons look inactive
- The Pro and Team plan cards show `COMING SOON` buttons that are visually muted but still appear as buttons.
- **Suggestion:** Make it clearer that these are unavailable — use a badge/label instead of a button shape, or disable the button and add explanatory text.

### F. Double tab bars on Collection and Shop feel heavy
- Both `/collection` and `/shop` show two rows of tabs (category + rarity). On mobile this takes significant vertical space.
- **Suggestion:** Combine into a single filter row or use a dropdown/filter chip group that wraps more gracefully.

### G. Mobile dashboard metric cards are uneven
- The four metric cards on mobile dashboard (`Level 1`, `0`, `0.0 kg`, `1 day`) vary in height and wrapping because the labels break differently.
- **Suggestion:** Use a consistent two-column grid with fixed label height or stack them on very small screens.

### H. Dev-mode Next.js indicator overlays content
- A circular "N" indicator appears in the bottom-left corner of many screenshots. This is the Next.js dev-mode indicator and will not appear in production, but during local testing it can hide real UI issues (e.g., the logout button).
- **Suggestion:** Disable it during QA (`next.config.js` `devIndicators: false`) or mentally account for it in screenshots.

### I. "No friends yet" empty-state border is too subtle
- The dashed border around the empty friend board is light and easy to miss.
- **Suggestion:** Add an icon and a primary CTA to make the empty state more actionable.

---

## 3. Improvements That Should Be in This Website

### A. Page-level metadata
- Export unique `metadata` objects from each page for better SEO and tab management.

### B. Skeleton loaders for initial app load
- The dashboard shows a spinner while `useAuth` and daily quests load. Replacing this with skeleton cards would reduce perceived load time and prevent layout shift.

### C. Display name during signup
- The signup API already supports `displayName`; add it to the signup form so users do not end up with long email-prefix names.

### D. Tooltips and info icons for metrics
- Add tooltips to `IMPACT THIS WEEK`, `TRUST SCORE`, `BOND`, and `ECO` counters so new users understand what they mean.

### E. Consistent currency/unit formatting
- The app uses `EP`, `Eco`, `EcoPoints`, and `XP` somewhat interchangeably. Standardize on one term per currency and display it consistently.

### F. Keyboard focus improvements
- Ensure all interactive elements have visible `:focus-visible` rings. The audit did not catch violations, but the heavy custom styling makes it worth verifying manually with Tab navigation.

### G. Loading states for async buttons
- Buttons like `ADD` on Friends, `SAVE PROFILE`, and `COMPLETE MISSIONS` should show a spinner and disabled state while waiting for the server.

### H. Custom 404 and error pages
- Add `not-found.tsx` and a styled error boundary page so unhandled errors feel on-brand.

### I. Mobile tab overflow handling
- The Shop/Collection filter rows should scroll horizontally or collapse into a single filter when space is limited.

### J. More descriptive empty states
- Garden, Pets, Collection, and Friends all show text-only empty states. Adding small illustrations or iconography would make them friendlier.

### K. Client-side validation feedback
- The login/signup forms already validate length, but showing inline error messages while typing (not just after submit) would improve the experience.

### L. Review image dimension hints
- Several images rely on `fill` sizing without explicit `width`/`height` or `aspect-ratio`. Adding `sizes` and `style` dimensions where possible will reduce Cumulative Layout Shift.

---

## Test Artifacts

- Full-page screenshots: `screenshots/audit/`
- JSON audit report: `screenshots/audit/audit-report.json`
- Interaction test results: 6/6 passed (quest modal, theme switch, mobile drawer, logout, login, friends page load)
- Link validation: 0 broken internal links among checked public pages.

---

## 4. Certified Tester Review & Star Ratings

*Tested as a new user journey on 2026-08-03. Browser automation signed up a fresh account (`Eco Tester`), navigated every public and authenticated route on desktop (1280×900) and mobile (390×844), and captured a full screenshot set in `screenshots/feedback-review/`.*

### Overall verdict: ★★★★☆ (4.0 / 5)

The `feat/easier-quests` branch is a clear step up from the previous audit. Most of the quick-win improvements requested in Sections 1–3 have landed: unique page titles, a custom 404, per-page hero colors, better empty states, an optional display-name field, and fixed image alt text. The app now feels like a cohesive product rather than a collection of green pages. A handful of fit-and-finish issues keep it from a 5-star rating, but the core experience is solid.

| Category | Rating | Notes |
|----------|--------|-------|
| **UI / UX Design** | ★★★★☆ | Polished card system, consistent spacing, and per-page hero colors make each section distinct. Locked collection cards still look like empty gray placeholders, and the shop/collection filter bars overflow on mobile. |
| **SEO** | ★★★★☆ | Authenticated pages now have unique `metadata.title` and `description`. The landing page and login/signup pages still share the exact same generic title and description (`EcoLudus \| Sustainable Habits & Rewards`), which misses an opportunity for richer snippets. |
| **Accessibility** | ★★★★☆ | Image `alt` text issues from the previous audit appear resolved, and heading hierarchies are mostly clean. Quest checkboxes are wrapped in implicit `<label>` elements, which is valid but could be verified with a screen reader; focus-visible rings are present but subtle. |
| **Mobile Responsiveness** | ★★★☆☆ | Layouts generally adapt, but the Shop/Collection rarity tabs and the Collection category tabs scroll off-screen horizontally. The Friends page also shows slight horizontal overflow where long auto-generated names push the `Add` button partially out of frame. |
| **Performance / Perceived Speed** | ★★★☆☆ | The initial dashboard render shows a centered `LOADING...` spinner while `useAuth` and daily quests resolve. Replacing this with skeleton cards would make the app feel faster and reduce layout shift. Route transitions after the first load are snappy. |
| **Navigation & Information Architecture** | ★★★★★ | Sidebar grouping (Overview / Play / Collection / Social / EcoPoints) is clear, the mobile drawer works, and the custom `app/not-found.tsx` page is on-brand with useful CTAs. |
| **Content & Copy** | ★★★★☆ | Friendly, eco-themed tone throughout. Minor grammar slips remain: the streak cards say `1 days` instead of `1 day`, and some labels still use all-caps with wide tracking that is harder to scan. |
| **Functionality & Stability** | ★★★★☆ | Signup, login, logout, route navigation, sidebar toggle, and the 404 page all worked without errors. The dashboard content takes a moment to appear on first load, but everything is stable once loaded. |
| **Onboarding** | ★★★★☆ | The signup form now offers an optional **Display name** field, so new users no longer default to long email prefixes. A short inline explanation of the currency (`EP`, `Eco`, `EcoPoints`) on first use would help first-timers. |
| **Visual Polish & Consistency** | ★★★★☆ | Varied hero gradients (green, brown, blue, purple, maroon, dark) give each section personality, and the theme picker offers six cohesive palettes. Progress bars at 0% remain low-contrast, and the locked collection cards lack a "discoverable" silhouette treatment. |

### What improved since the last audit

- **Unique page metadata:** Every authenticated route now carries a specific title and description (e.g., `Dashboard | EcoLudus`, `Plant Shop | EcoLudus`).
- **Custom 404 page:** `/nonexistent-page` returns a styled, on-brand error page with `Back to home` and `Go to dashboard` buttons.
- **Display name at signup:** The signup form now includes an optional display-name input, and the dashboard/profile heroes greet the user by that name.
- **Per-page hero colors:** Shop, Friends, Team, Pets, Settings, and others now have distinct hero gradients, fixing the "every page is forest green" monotony.
- **Better empty states:** Team, Friends, Pets, and Garden empty states include icons and clear CTAs.
- **Alt text:** No missing `alt` attributes were detected on the key pages tested (`/landing`, `/login`, `/signup`, `/dashboard`, `/collection`, `/profile`).

### New issues found in this pass

1. **Dashboard initial load is a blank spinner.** On first authenticated load the dashboard displays a full-screen `LOADING...` state. Skeleton cards matching the final layout would improve perceived performance.
2. **Mobile filter overflow.** The Collection and Shop pages show two rows of filter chips; on a 390 px viewport the second row (rarity) is partially cut off and requires horizontal scrolling.
3. **Friends page horizontal pressure on mobile.** Long auto-generated player names (e.g., `team-test-1781345518072`, `audit-1785767426831`) push the `Add` button partially out of the viewport.
4. **Grammar consistency.** Streak cards display `1 days` instead of `1 day` in both the dashboard and profile sections.
5. **Generic marketing-page metadata.** `/landing`, `/login`, and `/signup` all share the same browser title and meta description. Giving each its own title would strengthen SEO and tab discoverability.
6. **Locked collection cards still feel unfinished.** They remain flat gray squares with a lock icon and `???` label; a subtle silhouette of the actual species art would make discovery feel more rewarding.

### Suggestions for the next iteration

- Replace the dashboard `LOADING...` spinner with a skeleton layout.
- Make the Shop/Collection filter chips horizontally scrollable as a single contained row, or collapse the two tab bars into one filter row on mobile.
- Truncate long player names with an ellipsis and `title` tooltip on the Friends page.
- Fix `1 days` → `1 day` and audit other pluralized counters.
- Add distinct `metadata.title` for `/landing`, `/login`, and `/signup`.
- Improve locked collection cards with a dimmed species silhouette and a hover tooltip such as "Complete quests to unlock".

---

*Feedback compiled on 2026-08-03. Tested against the `feat/easier-quests` branch with the local JSON file-store fallback (no Postgres configured). Test artifacts: `screenshots/feedback-review/`, `scripts/feedback-user-test.mjs`.*
