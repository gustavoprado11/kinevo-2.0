// CDP driver: one login, then capture each route's screenshot + console errors.
// Usage: node drive.mjs '<jsonAccount>' [baseUrl]
// Emits manifest JSON to stdout and PNGs to ./shots/.
import { chromium } from "playwright-core";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = resolve(__dirname, "shots");
mkdirSync(SHOTS, { recursive: true });

const account = JSON.parse(process.argv[2]);
const BASE = process.argv[3] || "http://localhost:3000";

// Trainer-side surfaces worth a visual smoke. Extend freely.
const ROUTES = [
  { key: "dashboard", path: "/dashboard" },
  { key: "students", path: "/students" },
  { key: "programs", path: "/programs" },
  { key: "financial", path: "/financial" },
  { key: "marketing", path: "/marketing/landing" },
  { key: "schedule", path: "/schedule" },
  { key: "forms", path: "/forms" },
  // /messages é redirect('/dashboard') — não é página navegável (chat é drawer na UI).
  { key: "exercises", path: "/exercises" },
  { key: "settings", path: "/settings" },
];

async function killAnimations(page) {
  // Animations (Framer Motion) + a long page make playwright's fullPage stitching
  // duplicate/ghost content. Freeze them before the screenshot.
  await page.addStyleTag({
    content: `*,*::before,*::after{animation:none!important;transition:none!important;
      animation-duration:0s!important;scroll-behavior:auto!important}`,
  }).catch(() => {});
}

async function stripOverlays(page) {
  // Skip the prescription preferences wizard if it popped, then nuke the tour.
  try {
    const skip = page.getByRole("button", { name: /Pular|Skip/i }).first();
    if (await skip.isVisible({ timeout: 500 }).catch(() => false)) await skip.click().catch(() => {});
  } catch {}
  await page.evaluate(() => {
    // Hide (don't remove) overlays — removing React-managed nodes triggers
    // spurious removeChild errors that would pollute the console-error signal.
    const hide = (el) => {
      el.style.setProperty("display", "none", "important");
      el.style.setProperty("pointer-events", "none", "important");
    };
    document.querySelectorAll('.z-onboarding, [class*="z-onboarding"]').forEach(hide);
    document.querySelectorAll('[aria-labelledby="preferences-wizard-title"]').forEach((e) => {
      const dlg = e.closest('[role="dialog"]') || e;
      hide(dlg);
      const ov = dlg.previousElementSibling;
      if (ov && ov.getAttribute("data-state")) hide(ov);
    });
    // Reset only the WINDOW scroll (auto-hide header). Do NOT zero inner
    // scroll containers — pages like /schedule intentionally scroll an inner
    // pane (calendar starts at 05h); zeroing it produced a fake "00:00" finding.
    window.scrollTo(0, 0);
  });
}

const cdp = await fetch(`${BASE.replace("3000", "9222")}/json/version`).then((r) => r.json());
const browser = await chromium.connectOverCDP("http://localhost:9222");
// Use the dedicated Chrome's default context — newContext() over CDP is rejected
// by some Chrome builds ("Browser context management is not supported"). Safe here
// because this is a throwaway profile, not Gustavo's session.
const ctx = browser.contexts()[0] || (await browser.newContext());
const page = ctx.pages()[0] || (await ctx.newPage());
await page.setViewportSize({ width: 1440, height: 900 });

const manifest = { base: BASE, chrome: cdp.Browser, routes: [], login: null };

// ---- login ----
try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.locator('input[type="email"]').first().pressSequentially(account.email, { delay: 8 });
  await page.locator('input[type="password"]').first().pressSequentially(account.password, { delay: 8 });
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/(dashboard|students|programs)/, { timeout: 30000 });
  manifest.login = "ok";
} catch (e) {
  manifest.login = "FAILED: " + e.message;
  manifest.loginShot = resolve(SHOTS, "login-failed.png");
  await page.screenshot({ path: manifest.loginShot, fullPage: true }).catch(() => {});
  writeFileSync(resolve(SHOTS, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest));
  await browser.close();
  process.exit(0);
}

// ---- per-route capture ----
for (const r of ROUTES) {
  const errors = [];
  const onConsole = (m) => m.type() === "error" && errors.push(m.text().slice(0, 300));
  const onPageErr = (e) => errors.push("pageerror: " + String(e).slice(0, 300));
  page.on("console", onConsole);
  page.on("pageerror", onPageErr);
  const entry = { key: r.key, path: r.path, errors, shot: null, httpOk: true, ms: 0 };
  const t0 = Date.now();
  try {
    const resp = await page.goto(`${BASE}${r.path}`, { waitUntil: "networkidle", timeout: 30000 });
    entry.status = resp?.status() ?? null;
    entry.httpOk = !resp || resp.status() < 400;
    await page.waitForTimeout(900); // let client render/animations settle
    await stripOverlays(page);
    await killAnimations(page);
    await page.waitForTimeout(300);
    const shot = resolve(SHOTS, `${r.key}.png`);
    // Viewport screenshot (above-the-fold), NOT fullPage: stitching a tall page
    // with animated/virtualized lists duplicated content (fake "/exercises dup").
    // The fold is also the highest-signal region for a visual smoke.
    await page.screenshot({ path: shot });
    entry.shot = shot;
  } catch (e) {
    entry.error = String(e).slice(0, 300);
    const shot = resolve(SHOTS, `${r.key}-error.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    entry.shot = shot;
  }
  entry.ms = Date.now() - t0;
  page.off("console", onConsole);
  page.off("pageerror", onPageErr);
  manifest.routes.push(entry);
}

writeFileSync(resolve(SHOTS, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest));
// Do NOT browser.close() — this is a shared CDP connection to a long-lived Chrome.
// Closing it leaves Chrome with 0 targets and breaks the next connectOverCDP handshake.
// Just drop the page reference; process exit disconnects cleanly.
await page.goto("about:blank").catch(() => {});
process.exit(0);
