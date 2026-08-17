// Comprehensive polish smoke test.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";

const PAGES = [
  { name: "landing", path: "/" },
  { name: "login", path: "/login" },
  { name: "signup", path: "/signup" },
  { name: "privacy", path: "/legal/privacy" },
  { name: "terms", path: "/legal/terms" },
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
  { name: "notfound", path: "/not-a-page" },
];

const VIEWPORTS = [
  { label: "desktop", width: 1280, height: 900 },
  { label: "tablet", width: 768, height: 1024 },
  { label: "mobile", width: 390, height: 844 },
];

const results = [];

const browser = await chromium.launch({ headless: true });
try {
  for (const pageCfg of PAGES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const consoleErrors = [];
      const consoleWarnings = [];
      page.on("console", (m) => {
        const text = m.text();
        if (m.type() === "error") consoleErrors.push(text);
        else if (m.type() === "warning") consoleWarnings.push(text);
      });
      page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + e.message));

      const url = BASE + pageCfg.path;
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 25000 });
      } catch (e) {
        consoleErrors.push("GOTO_ERROR: " + e.message);
      }
      await page.waitForTimeout(1200);

      const finalUrl = page.url();
      const docOverflow = await page.evaluate(() => {
        const docWidth = document.documentElement.scrollWidth;
        const winWidth = window.innerWidth;
        return { docWidth, winWidth, overflowX: docWidth > winWidth + 1 };
      }).catch(() => ({ docWidth: 0, winWidth: 0, overflowX: false }));

      const title = await page.title().catch(() => "");
      const screenshotName = `scripts/_shot-${pageCfg.name}-${vp.label}.png`;
      await page.screenshot({ path: screenshotName, fullPage: true }).catch(() => {});

      results.push({
        page: pageCfg.name,
        viewport: vp.label,
        url,
        finalUrl,
        title,
        consoleErrors,
        consoleWarnings,
        docOverflow,
      });

      await context.close();
    }
  }

  // Print summary
  const issues = results.filter(r => r.consoleErrors.length || r.consoleWarnings.length || r.docOverflow.overflowX || r.finalUrl !== r.url);
  console.log(JSON.stringify({ total: results.length, withIssues: issues.length, results }, null, 2));
} finally {
  await browser.close();
}
