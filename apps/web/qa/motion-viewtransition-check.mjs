// QA scratch script (motion dimension). experimental.viewTransition — confirm
// document.startViewTransition actually fires on same-document <Link>
// navigation in Chromium, and that navigation still works correctly (URL
// changes, destination content renders) in Firefox/WebKit, which lack the
// API and must fall back to a plain navigation.
import { chromium, firefox, webkit } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const BASE = "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };
const engines = ["chromium", "firefox", "webkit"];
const results = [];

for (const engineName of engines) {
  const browser = await LAUNCHERS[engineName].launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const row = { engine: engineName };
  try {
    await page.addInitScript(() => {
      window.__vtCalls = 0;
      window.__hasVT = typeof document.startViewTransition === "function";
      if (window.__hasVT) {
        const orig = document.startViewTransition.bind(document);
        document.startViewTransition = (cb) => {
          window.__vtCalls++;
          return orig(cb);
        };
      }
    });
    await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
    row.hasStartViewTransitionAPI = await page.evaluate(() => window.__hasVT);
    // nav-links: click the "Jobs" link (same-document App Router navigation).
    const before = await page.evaluate(() => window.location.pathname);
    await page.click('nav[aria-label="Primary"] a[href="/jobs"]');
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => window.location.pathname);
    row.navigatedFrom = before;
    row.navigatedTo = after;
    row.navigationWorked = after === "/jobs";
    row.startViewTransitionCallCount = await page.evaluate(() => window.__vtCalls);
    // Confirm the destination actually rendered real content, not a blank shell.
    row.destinationHasJobRows = await page.evaluate(
      () => document.querySelectorAll(".board-row, .job-row, table").length > 0,
    );
    row.destinationBodyTextSample = await page.evaluate(() => document.body.innerText.slice(0, 120));
  } catch (err) {
    row.error = String(err && err.message ? err.message : err);
  } finally {
    await context.close();
    await browser.close();
  }
  results.push(row);
  console.log(`[${engineName}] hasAPI=${row.hasStartViewTransitionAPI} vtCalls=${row.startViewTransitionCallCount} navWorked=${row.navigationWorked} to=${row.navigatedTo}`);
}

await writeFile(
  "C:\\Users\\dotat\\AppData\\Local\\Temp\\claude\\C--Users-dotat-Desktop-Saas-JOBS\\38b76097-e9bb-4f59-84c9-360866c2e361\\scratchpad\\test8-vt-results.json",
  JSON.stringify(results, null, 2),
);
console.log("DONE");
