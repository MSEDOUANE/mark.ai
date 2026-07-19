#!/usr/bin/env node
/**
 * MarkAI driver — drives the running dev server with Playwright and takes
 * real screenshot files. Assumes the dev server is already up on
 * http://localhost:3000 (see SKILL.md "Run" section for how to start it).
 *
 * Usage:
 *   node .claude/skills/run-markai/driver.mjs <command> [args]
 *
 * Commands:
 *   smoke                    Full unauthenticated smoke pass: landing page,
 *                            click through to /login, screenshot both,
 *                            check console errors. Screenshots land in
 *                            .claude/skills/run-markai/screenshots/.
 *   goto <path>              Navigate to http://localhost:3000<path>,
 *                            screenshot it. E.g.: goto /dashboard
 *   theme-check              Inject real dashboard-pattern markup (card,
 *                            nested surface, muted text tiers, amber CTA
 *                            button) and screenshot it in both dark and
 *                            light data-theme — the fastest way to verify
 *                            the app-* CSS tokens without a login session.
 *
 * Requires: npx playwright (no permanent devDependency — see SKILL.md).
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname, "screenshots");
mkdirSync(SHOT_DIR, { recursive: true });

const BASE = process.env.MARKAI_BASE_URL ?? "http://localhost:3000";

async function withBrowser(fn) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  try {
    await fn(page, consoleErrors);
  } finally {
    await browser.close();
  }
  return consoleErrors;
}

async function cmdSmoke() {
  const errors = await withBrowser(async (page, consoleErrors) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.screenshot({ path: join(SHOT_DIR, "01-landing.png") });
    console.log("landing page title:", await page.title());

    await Promise.all([
      page.waitForURL("**/login", { timeout: 15000 }),
      page.getByRole("link", { name: "Enter workspace" }).click(),
    ]);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: join(SHOT_DIR, "02-login.png") });
    console.log("after click, url:", page.url());
    const bodyText = await page.textContent("body");
    console.log("login page renders form:", /Sign in|Log in|Email/i.test(bodyText ?? ""));
  });

  console.log(`console errors: ${errors.length}`);
  for (const e of errors) console.log("  -", e);
  console.log(`screenshots written to ${SHOT_DIR}`);
}

async function cmdGoto(path) {
  const safeName = (path || "/").replace(/[^a-z0-9]+/gi, "_") || "root";
  await withBrowser(async (page) => {
    const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
    console.log("status:", res?.status(), "final url:", page.url());
    await page.screenshot({ path: join(SHOT_DIR, `goto-${safeName}.png`) });
  });
  console.log(`screenshot written to ${SHOT_DIR}/goto-${safeName}.png`);
}

/**
 * Verifies the app-* theme tokens (globals.css) render correctly without
 * needing an authenticated session — injects markup matching real dashboard
 * component patterns (card, nested surface, text hierarchy, the amber CTA
 * button whose dark text must stay fixed in both themes) into the reachable
 * landing page, which already loads the same compiled stylesheet.
 */
async function cmdThemeCheck() {
  const snippet = `
    <div id="theme-verify-overlay" style="position:fixed;inset:0;z-index:99999;overflow:auto;padding:24px;" class="bg-app-bg text-app-text">
      <div style="max-width:640px;margin:0 auto;">
        <div class="rounded-2xl border border-app-border bg-app-surface p-6" style="margin-bottom:16px;">
          <h1 style="font-size:24px;font-weight:700;">Overview</h1>
          <p class="text-app-text-muted" style="margin-top:4px;font-size:14px;">Acme Org · user@example.com</p>
          <div class="border border-app-border-strong" style="margin-top:16px;border-radius:12px;padding:16px;">
            <p class="text-app-text-subtle" style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">Credits Remaining</p>
            <p style="font-size:28px;font-weight:700;margin-top:4px;">1,240</p>
          </div>
          <div class="bg-app-surface-2" style="margin-top:16px;border-radius:12px;padding:16px;">
            <p style="font-weight:600;">Nested surface card</p>
            <p class="text-app-text-muted" style="font-size:14px;margin-top:4px;">Secondary/muted description text inside a nested surface.</p>
          </div>
          <button class="bg-amber-400 text-zinc-950" style="margin-top:16px;border-radius:999px;padding:10px 20px;font-weight:700;border:none;">Primary CTA button</button>
        </div>
      </div>
    </div>`;

  await withBrowser(async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.evaluate((html) => {
      const el = document.createElement("div");
      el.innerHTML = html;
      document.body.appendChild(el.firstElementChild);
    }, snippet);

    await page.screenshot({ path: join(SHOT_DIR, "theme-dark.png") });
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await page.screenshot({ path: join(SHOT_DIR, "theme-light.png") });
  });
  console.log(`theme screenshots written to ${SHOT_DIR}/theme-dark.png and theme-light.png`);
}

const [, , cmd, ...args] = process.argv;
switch (cmd) {
  case "smoke": await cmdSmoke(); break;
  case "goto": await cmdGoto(args[0] ?? "/"); break;
  case "theme-check": await cmdThemeCheck(); break;
  default:
    console.error("Usage: node driver.mjs <smoke|goto <path>|theme-check>");
    process.exit(1);
}
