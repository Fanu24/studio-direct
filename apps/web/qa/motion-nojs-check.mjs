// QA scratch script (motion dimension). JS disabled, all 3 engines — the path
// where an earlier attempt (inline script on <html>) broke hydration. Confirms
// content is visible with no scroll, no JS, on every engine.
import { chromium, firefox, webkit } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import templates from "./templates.mjs";

const BASE = "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };
const engines = ["chromium", "firefox", "webkit"];
const sample = templates.filter((t) =>
  ["home", "job-detail", "pricing", "editorial-article", "funnel-seller-page", "auth", "learn-hub", "company-detail"].includes(t.id),
);

const results = [];

for (const engineName of engines) {
  const browser = await LAUNCHERS[engineName].launch();
  for (const t of sample) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      javaScriptEnabled: false,
    });
    const page = await context.newPage();
    let row = { engine: engineName, template: t.id, url: t.url };
    try {
      const resp = await page.goto(BASE + t.url, { waitUntil: "load", timeout: 30000 });
      row.status = resp ? resp.status() : null;
      await page.waitForTimeout(300);
      const data = await page.evaluate(() => {
        // NOTE: page.evaluate still runs even with javaScriptEnabled:false —
        // Playwright injects it via CDP/protocol, not page <script> execution,
        // so this is a valid way to inspect the DOM/CSSOM in a "no page JS" load.
        const els = Array.from(document.querySelectorAll(".m-reveal, .m-count"));
        const bad = [];
        for (const el of els) {
          const s = getComputedStyle(el);
          const op = parseFloat(s.opacity);
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          if (op < 0.98) {
            bad.push({
              tag: el.tagName.toLowerCase(),
              className: typeof el.className === "string" ? el.className.slice(0, 80) : "",
              opacity: op,
            });
          }
        }
        return { revealCount: els.length, bad, bodyText: document.body.innerText.slice(0, 80) };
      });
      Object.assign(row, data);
    } catch (err) {
      row.error = String(err && err.message ? err.message : err);
    } finally {
      await context.close();
    }
    results.push(row);
    console.log(`[${engineName}] ${t.id}: reveal=${row.revealCount} bad=${row.bad ? row.bad.length : "ERR"}`);
  }
  await browser.close();
}

await writeFile(
  "C:\\Users\\dotat\\AppData\\Local\\Temp\\claude\\C--Users-dotat-Desktop-Saas-JOBS\\38b76097-e9bb-4f59-84c9-360866c2e361\\scratchpad\\test3-results.json",
  JSON.stringify(results, null, 2),
);
console.log("DONE");
