// User-journey test for Feedback.md review
// Signs up a fresh user, navigates the authenticated app, and emits a report + screenshots.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'screenshots', 'feedback-review');
const REPORT_PATH = join(OUT_DIR, 'report.json');

mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = `review-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_DISPLAY_NAME = 'Eco Tester';

const VIEWPORT = { width: 1280, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

const routes = [
  { path: '/', name: 'Landing' },
  { path: '/login', name: 'Login' },
  { path: '/signup', name: 'Signup' },
  { path: '/dashboard', name: 'Dashboard', auth: true },
  { path: '/habits', name: 'Habits', auth: true },
  { path: '/shop', name: 'Shop', auth: true },
  { path: '/collection', name: 'Collection', auth: true },
  { path: '/garden', name: 'Garden', auth: true },
  { path: '/pets', name: 'Pets', auth: true },
  { path: '/insights', name: 'Insights', auth: true },
  { path: '/impact', name: 'Impact', auth: true },
  { path: '/premium', name: 'Premium', auth: true },
  { path: '/profile', name: 'Profile', auth: true },
  { path: '/team', name: 'Team', auth: true },
  { path: '/friends', name: 'Friends', auth: true },
  { path: '/leaderboard', name: 'Leaderboard', auth: true },
  { path: '/settings', name: 'Settings', auth: true },
];

async function capture(page, name) {
  const path = join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function getPageInfo(page) {
  return await page.evaluate(() => {
    const titleEl = document.querySelector('title');
    const descEl = document.querySelector('meta[name="description"]');
    const h1s = Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim());
    const h2s = Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim()).slice(0, 6);
    return {
      title: titleEl?.textContent?.trim() ?? '',
      description: descEl?.getAttribute('content') ?? '',
      url: window.location.href,
      h1s,
      h2s,
    };
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const report = {
    testEmail: TEST_EMAIL,
    displayName: TEST_DISPLAY_NAME,
    startTime: new Date().toISOString(),
    pages: [],
    interactions: [],
    errors: [],
  };

  // 0. Landing page (before auth)
  await page.goto(`${BASE_URL}/landing`);
  await page.waitForLoadState('networkidle');
  await capture(page, '00-landing-desktop');
  report.pages.push({ ...await getPageInfo(page), route: '/landing', viewport: 'desktop' });

  // 0b. Login page
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await capture(page, '00-login-desktop');
  report.pages.push({ ...await getPageInfo(page), route: '/login', viewport: 'desktop' });

  // 1. Sign up via UI
  await page.goto(`${BASE_URL}/signup`);
  await page.waitForLoadState('networkidle');
  await capture(page, '01-signup-desktop');
  report.pages.push({ ...await getPageInfo(page), route: '/signup', viewport: 'desktop' });

  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.fill('input#displayName, input[name="displayName"], input[placeholder*="name" i]', TEST_DISPLAY_NAME).catch(() => {
    // displayName input may not exist
  });
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 }).catch(e => report.errors.push({ step: 'signup-redirect', message: e.message }));

  // 2. Dashboard — wait for auth + quest data to resolve, not just networkidle
  await page.waitForFunction(() => {
    return !document.body.innerText.includes('LOADING') || document.querySelector('h1') !== null;
  }, { timeout: 15000 });
  await page.waitForTimeout(500);
  await capture(page, '02-dashboard-desktop');
  report.pages.push({ ...await getPageInfo(page), route: '/dashboard', viewport: 'desktop' });

  // 3. Navigate all authenticated routes
  for (const route of routes.filter(r => r.auth)) {
    if (route.path === '/dashboard') continue;
    try {
      await page.goto(`${BASE_URL}${route.path}`);
      await page.waitForLoadState('networkidle');
      await capture(page, `${route.name.toLowerCase()}-desktop`);
      report.pages.push({ ...await getPageInfo(page), route: route.path, viewport: 'desktop' });
    } catch (e) {
      report.errors.push({ step: `nav-${route.path}`, message: e.message });
    }
  }

  // 4. Mobile viewport pass
  await page.setViewportSize(MOBILE_VIEWPORT);
  for (const route of [{ path: '/dashboard' }, { path: '/collection' }, { path: '/shop' }, { path: '/friends' }, { path: '/profile' }]) {
    try {
      await page.goto(`${BASE_URL}${route.path}`);
      await page.waitForLoadState('networkidle');
      await capture(page, `${route.path.replace('/', '')}-mobile`);
      report.pages.push({ ...await getPageInfo(page), route: route.path, viewport: 'mobile' });
    } catch (e) {
      report.errors.push({ step: `mobile-${route.path}`, message: e.message });
    }
  }

  // 5. Interaction: sidebar collapse on mobile
  try {
    const hamburger = await page.locator('button[aria-label*="menu"], button[aria-label*="Menu"], header button').first();
    if (await hamburger.count() > 0) {
      await hamburger.click();
      await page.waitForTimeout(400);
      await capture(page, 'sidebar-mobile-open');
      report.interactions.push({ name: 'mobile-sidebar-toggle', ok: true });
    }
  } catch (e) {
    report.interactions.push({ name: 'mobile-sidebar-toggle', ok: false, error: e.message });
  }

  // 6. Interaction: theme toggle
  try {
    const themeBtn = await page.locator('button[aria-label*="theme" i], button[title*="theme" i]').first();
    if (await themeBtn.count() > 0) {
      await themeBtn.click();
      await page.waitForTimeout(300);
      await capture(page, 'theme-dark');
      await themeBtn.click();
      await page.waitForTimeout(300);
      report.interactions.push({ name: 'theme-toggle', ok: true });
    }
  } catch (e) {
    report.interactions.push({ name: 'theme-toggle', ok: false, error: e.message });
  }

  // 7. Logout flow
  try {
    await page.setViewportSize(VIEWPORT);
    await page.goto(`${BASE_URL}/dashboard`);
    const logoutBtn = await page.locator('button:has-text("Log out"), a:has-text("Log out")').first();
    if (await logoutBtn.count() > 0) {
      await logoutBtn.click();
      await page.waitForURL(`${BASE_URL}/login`, { timeout: 10000 });
      await capture(page, 'logout-landing');
      report.interactions.push({ name: 'logout', ok: true });
    }
  } catch (e) {
    report.interactions.push({ name: 'logout', ok: false, error: e.message });
  }

  // 8. 404 page
  try {
    const page404 = await context.newPage();
    await page404.goto(`${BASE_URL}/nonexistent-page`);
    await page404.waitForLoadState('networkidle');
    await capture(page404, '404-page');
    report.pages.push({ ...await getPageInfo(page404), route: '/nonexistent-page', viewport: 'desktop' });
    await page404.close();
  } catch (e) {
    report.errors.push({ step: '404', message: e.message });
  }

  // Accessibility snapshot on a few key pages
  report.a11y = {};
  for (const route of ['/', '/login', '/signup', '/dashboard', '/collection', '/profile']) {
    const a11yPage = await context.newPage();
    await a11yPage.goto(`${BASE_URL}${route}`);
    await a11yPage.waitForLoadState('networkidle');
    // wait for dashboard content if needed
    if (route === '/dashboard') {
      await a11yPage.waitForFunction(() => !document.body.innerText.includes('LOADING') || document.querySelector('h1') !== null, { timeout: 15000 });
      await a11yPage.waitForTimeout(500);
    }
    const audit = await a11yPage.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      const missingAlt = images.filter(img => !img.hasAttribute('alt') || img.getAttribute('alt') === null).map(img => ({
        src: img.currentSrc || img.src,
        width: img.width,
        height: img.height
      }));
      const h1s = Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim());
      const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
      const missingLabel = inputs.filter(el => {
        const id = el.id;
        const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
        const hasLabel = id && !!document.querySelector(`label[for="${id}"]`);
        return !hasLabel && !aria && !el.placeholder;
      }).map(el => ({ tag: el.tagName, id: el.id, type: el.type }));
      return { missingAlt, h1s, missingLabel };
    });
    report.a11y[route] = audit;
    await a11yPage.close();
  }

  report.endTime = new Date().toISOString();
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log('Report written to:', REPORT_PATH);
  console.log('Screenshots in:', OUT_DIR);
  console.log('Pages tested:', report.pages.length);
  console.log('Errors:', report.errors.length);

  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
