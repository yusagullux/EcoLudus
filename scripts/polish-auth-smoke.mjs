// Authenticated polish smoke test: sign up a fresh user, then visit every game route.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const EMAIL = process.env.TEST_EMAIL || `polish-${Date.now()}@ecoludus.test`;
const PASSWORD = process.env.TEST_PASSWORD || "TestPass123!";

const GAME_PAGES = [
  { name: "dashboard", path: "/dashboard" },
  { name: "habits", path: "/habits" },
  { name: "shop", path: "/shop" },
  { name: "collection", path: "/collection" },
  { name: "garden", path: "/garden" },
  { name: "pets", path: "/pets" },
  { name: "insights", path: "/insights" },
  { name: "impact", path: "/impact" },
  { name: "premium", path: "/premium" },
  { name: "profile", path: "/profile" },
  { name: "team", path: "/team" },
  { name: "friends", path: "/friends" },
  { name: "leaderboard", path: "/leaderboard" },
  { name: "settings", path: "/settings" },
];

const VIEWPORTS = [
  { label: "desktop", width: 1280, height: 900 },
  { label: "tablet", width: 768, height: 1024 },
  { label: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

// Sign up
await page.goto(BASE + "/signup", { waitUntil: "networkidle" });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.fill('input#displayName, input[name="displayName"]', "Polish Tester");
await page.click('button[type="submit"]');
await page.waitForURL(/\/(dashboard|login)$/, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);

if (!page.url().includes("/dashboard")) {
  console.log("Signup did not redirect to dashboard; current:", page.url());
  // If already exists, try login
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard$/, { timeout: 15000 });
}

const results = [];

for (const pg of GAME_PAGES) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const consoleErrors = [];
    const consoleWarnings = [];
    const handler = (m) => {
      const text = m.text();
      if (m.type() === "error") consoleErrors.push(text);
      else if (m.type() === "warning") consoleWarnings.push(text);
    };
    page.on("console", handler);
    const pe = (e) => consoleErrors.push("PAGEERROR: " + e.message);
    page.on("pageerror", pe);

    const url = BASE + pg.path;
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 25000 });
    } catch (e) {
      consoleErrors.push("GOTO_ERROR: " + e.message);
    }
    await page.waitForTimeout(1500);

    const finalUrl = page.url();
    const docOverflow = await page.evaluate(() => ({
      docWidth: document.documentElement.scrollWidth,
      winWidth: window.innerWidth,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    })).catch(() => ({ docWidth: 0, winWidth: 0, overflowX: false }));
    const title = await page.title().catch(() => "");
    await page.screenshot({ path: `scripts/_shot-${pg.name}-${vp.label}.png`, fullPage: true }).catch(() => {});

    results.push({ page: pg.name, viewport: vp.label, url, finalUrl, title, consoleErrors, consoleWarnings, docOverflow });

    page.off("console", handler);
    page.off("pageerror", pe);
  }
}

const issues = results.filter(r => r.consoleErrors.length || r.consoleWarnings.length || r.docOverflow.overflowX || r.finalUrl !== r.url);
console.log(JSON.stringify({ total: results.length, withIssues: issues.length, issues, results }, null, 2));
await browser.close();
