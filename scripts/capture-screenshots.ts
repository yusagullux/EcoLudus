// Regenerate the real-app screenshots used on the marketing landing page.
// Requires a running dev server and SESSION_SECRET from .env.local.
// Override defaults: SCREENSHOT_BASE_URL, SCREENSHOT_USER_ID, SCREENSHOT_USER_EMAIL.
import { chromium } from "playwright";
import { SignJWT } from "jose";

const SESSION_SECRET = process.env.SESSION_SECRET;
const BASE_URL = process.env.SCREENSHOT_BASE_URL || "http://localhost:3001";
const USER_ID = process.env.SCREENSHOT_USER_ID || "c5401553-ee3d-42b3-8a6b-9ff57af335cc";
const USER_EMAIL = process.env.SCREENSHOT_USER_EMAIL || "yusagullu06@gmail.com";

async function buildSessionCookie() {
  if (!SESSION_SECRET) {
    throw new Error("SESSION_SECRET env var required");
  }

  const token = await new SignJWT({ email: USER_EMAIL })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(USER_ID)
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(new TextEncoder().encode(SESSION_SECRET));

  return {
    name: "ecoquest_session",
    value: token,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax" as const
  };
}

async function main() {
  const cookie = await buildSessionCookie();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 1600 },
    deviceScaleFactor: 1
  });
  await context.addCookies([cookie]);

  const targets = [
    { url: "/dashboard", filename: "public/screenshot-daily-missions.png" },
    { url: "/garden", filename: "public/screenshot-virtual-garden.png" },
    { url: "/impact", filename: "public/screenshot-carbon-tracker.png" }
  ];

  for (const { url, filename } of targets) {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}${url}`, { waitUntil: "networkidle" });
    // Give animations/skeletons a moment to settle.
    await page.waitForTimeout(2500);
    await page.screenshot({ path: filename, fullPage: false });
    console.log("Captured", filename, "from", url);
    await page.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
