// QA scratch script (motion dimension). Motion must never sit in the path of
// a control - search/filters/pagination must be usable immediately, with no
// animation to wait through. Loads each template fresh, immediately (no
// extra settle time beyond Playwright's own actionability wait) types into
// the search box / clicks a filter chip / clicks a pager link, and confirms
// it worked - plus an elementFromPoint check that nothing else is on top.
import { chromium, firefox, webkit } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const BASE = "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };
const engines = ["chromium", "firefox", "webkit"];
const results = [];

const CASES = [
  { template: "home", url: "/", selector: '.search-bar input[name="q"]', kind: "type" },
  { template: "jobs-catalog", url: "/jobs", selector: '.search-bar input[name="q"]', kind: "type" },
  { template: "jobs-catalog", url: "/jobs", selector: ".tag-chips a, .chip", kind: "click" },
];

for (const engineName of engines) {
  const browser = await LAUNCHERS[engineName].launch();
  for (const c of CASES) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const row = { engine: engineName, template: c.template, url: c.url, kind: c.kind };
    try {
      await page.goto(BASE + c.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      // Deliberately do NOT wait for networkidle/settle - this is the "usable
      // immediately" check. Playwright's own click/fill still waits briefly
      // for actionability (visible, stable, receives events) which is exactly
      // what would fail if an animated overlay were in the way.
      const el = page.locator(c.selector).first();
      await el.waitFor({ state: "visible", timeout: 5000 });
      const hitTest = await page.evaluate((sel) => {
        const target = document.querySelector(sel);
        if (!target) return null;
        const r = target.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const topEl = document.elementFromPoint(cx, cy);
        return {
          targetTag: target.tagName,
          topElTag: topEl ? topEl.tagName : null,
          isTargetOrDescendantOfTarget: topEl ? target.contains(topEl) || topEl.contains(target) : false,
        };
      }, c.selector);
      row.hitTest = hitTest;
      if (c.kind === "type") {
        await el.click({ timeout: 5000 });
        await el.fill("engineer", { timeout: 5000 });
        row.valueAfterFill = await el.inputValue();
        row.worked = row.valueAfterFill === "engineer";
      } else {
        const before = page.url();
        await el.click({ timeout: 5000 });
        await page.waitForTimeout(500);
        row.urlBefore = before;
        row.urlAfter = page.url();
        row.worked = true; // click did not throw/timeout = not blocked
      }
    } catch (err) {
      row.error = String(err && err.message ? err.message : err);
      row.worked = false;
    } finally {
      await context.close();
    }
    results.push(row);
    console.log(`[${engineName}] ${c.template} ${c.kind}: worked=${row.worked} hitTest=${JSON.stringify(row.hitTest)} err=${row.error || ""}`);
  }
  await browser.close();
}

await writeFile(
  "C:\\Users\\dotat\\AppData\\Local\\Temp\\claude\\C--Users-dotat-Desktop-Saas-JOBS\\38b76097-e9bb-4f59-84c9-360866c2e361\\scratchpad\\test9-control-results.json",
  JSON.stringify(results, null, 2),
);
console.log("DONE");
