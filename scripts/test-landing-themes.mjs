import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = "screenshots/landing-themes";
mkdirSync(OUT, { recursive: true });

const THEMES = ["light", "dark", "liquid", "dawn", "bloom", "aurora"];
const BASE = "http://localhost:3000/landing";

const browser = await chromium.launch({ headless: true });

const results = [];

for (const theme of THEMES) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1800 },
    deviceScaleFactor: 1
  });
  // Set the theme in localStorage before first paint. The inline theme script
  // in app/layout.tsx reads localStorage["ecoludus.theme"] pre-hydration.
  await context.addInitScript((t) => {
    try { localStorage.setItem("ecoludus.theme", t); } catch (e) {}
  }, theme);

  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto(BASE, { waitUntil: "networkidle" });
  const applied = await page.getAttribute("html", "data-theme");
  await page.waitForTimeout(600);

  const path = `${OUT}/${theme}.png`;
  await page.screenshot({ path, fullPage: true });

  const probe = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const s = getComputedStyle(el);
      return { color: s.color, bg: s.backgroundColor };
    };
    return {
      h1: pick("h1"),
      heroCard: pick(".mk-hero"),
      cta: pick('a[href="/signup"]')
    };
  });

  results.push({ theme, applied, errors: errors.slice(0, 5), probe, path });
  await context.close();
}

await browser.close();

console.log(JSON.stringify(results, null, 2));