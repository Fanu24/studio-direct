// apps/web/qa/verify-live-worker-errors.mjs
//
// After the first production deploy of the redesign, the tap-target tracer
// caught /web3-cities serving a Cloudflare "Workers - Errors and Exceptions"
// page - while a plain curl of the same URL answered 200 with real HTML four
// times in a row. A status code is not evidence that the page rendered: the
// interstitial is itself served with a 200 in some paths, and the failure did
// not reproduce on a single sequential request.
//
// This loads each route in a real browser, repeatedly, and reports anything
// that comes back as an error interstitial rather than the application - plus
// the wall-clock time per load, because the cities table is the heaviest page
// in the app and a Worker CPU-limit overrun would look exactly like this.
//
// Usage: node qa/verify-live-worker-errors.mjs [rounds]

import { chromium } from "@playwright/test";
import { writeSync } from "node:fs";

// console.log to a redirected file is buffered on Windows and nothing appears
// until the process exits - which, for a run this long, looks exactly like a
// hang. Write to fd 1 synchronously so progress is visible while it works.
const NEWLINE = String.fromCharCode(10);
const say = (line) => writeSync(1, line + NEWLINE);

const BASE = process.env.QA_BASE_URL ?? "https://gaming-web.xavier-ff2.workers.dev";
const ROUNDS = Number(process.argv[2] ?? 4);
const PAGES = [
  "/",
  "/jobs",
  "/web3-companies",
  "/web3-cities",
  "/web3-salaries",
  "/hire",
  "/faq",
  "/learn-web3",
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const failures = [];
const slowest = new Map();

for (let round = 1; round <= ROUNDS; round += 1) {
  for (const path of PAGES) {
    const started = Date.now();
    let status = 0;
    try {
      const response = await page.goto(BASE + path, { waitUntil: "load", timeout: 60000 });
      status = response?.status() ?? 0;
    } catch (error) {
      failures.push({ round, path, status: "navigation threw", detail: String(error).slice(0, 120) });
      continue;
    }
    const elapsed = Date.now() - started;
    slowest.set(path, Math.max(slowest.get(path) ?? 0, elapsed));

    const verdict = await page.evaluate(() => {
      const html = document.documentElement.outerHTML;
      // The interstitial is Cloudflare's, not ours: it carries cf-error-*
      // markup and never carries the app's own root surface.
      const isInterstitial = /cf-error-|Workers - Errors and Exceptions|cf-footer-item/.test(html);
      const hasApp = document.querySelector(".surface, main") != null;
      return { isInterstitial, hasApp, title: document.title.slice(0, 60) };
    });

    if (verdict.isInterstitial || !verdict.hasApp) {
      failures.push({ round, path, status, title: verdict.title, elapsed });
      say(`  ROUND ${round} ${path} -> ${status} ERROR PAGE ("${verdict.title}") in ${elapsed}ms`);
    }
  }
  say(`round ${round}/${ROUNDS} done, ${failures.length} failures so far`);
}

await browser.close();

say("\nslowest load per route:");
for (const [path, ms] of [...slowest.entries()].sort((a, b) => b[1] - a[1])) {
  say(`  ${String(ms).padStart(6)}ms  ${path}`);
}
say(`\n${ROUNDS * PAGES.length} loads, ${failures.length} served an error page.`);
process.exit(failures.length === 0 ? 0 : 1);
