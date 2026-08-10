import { chromium } from "playwright";
import fs from "fs";

const BASE = "http://localhost:3000";
const OUT = ".shots-audit";
fs.mkdirSync(OUT, { recursive: true });

const AUTH = {
  email: "ecotester@example.com",
  password: "TestPass123!"
};

const pages = [
  { name: "dashboard", path: "/dashboard" },
  { name: "habits", path: "/habits" },
  { name: "shop", path: "/shop" },
  { name: "collection", path: "/collection" },
  { name: "garden", path: "/garden" },
  { name: "pets", path: "/pets" },
  { name: "impact", path: "/impact" },
  { name: "team", path: "/team" },
  { name: "leaderboard", path: "/leaderboard" },
  { name: "friends", path: "/friends" },
  { name: "insights", path: "/insights" },
  { name: "profile", path: "/profile" },
  { name: "settings", path: "/settings" },
  { name: "landing", path: "/landing" }
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// Login
await page.goto(`${BASE}/login`);
await page.fill("input[type='email']", AUTH.email);
await page.fill("input[type='password']", AUTH.password);
await page.click("button[type='submit']");
await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });

for (const p of pages) {
  await page.goto(`${BASE}${p.path}`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${OUT}/${p.name}.png`, fullPage: true });
  console.log("Captured", p.name);
}

await browser.close();
console.log("Done");
