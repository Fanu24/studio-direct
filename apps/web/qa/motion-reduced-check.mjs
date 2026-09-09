// QA scratch script (motion dimension). prefers-reduced-motion: reduce across
// all 3 engines, on load (no scroll) — every .m-reveal / .m-count must already
// be visible (opacity 1, no transform), and the marquee must not be animating.
import { chromium, firefox, webkit } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import templates from "./templates.mjs";

const BASE = "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };
const engines = ["chromium", "firefox", "webkit"];
// Templates most likely to carry reveals/marquee/theaters — full 21 would be
// redundant since the CSS rule is global (@media prefers-reduced-motion),
// but we sample templates from every lane plus the home (marquee + theaters).
const sample = templates.filter((t) =>
  ["home", "job-detail", "pricing", "editorial-article", "funnel-seller-page", "auth", "rankings", "company-detail"].includes(t.id),
);

const results = [];

for (const engineName of engines) {
  const browser = await LAUNCHERS[engineName].launch();
  for (const t of sample) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    let row = { engine: engineName, template: t.id, url: t.url };
    try {
      const resp = await page.goto(BASE + t.url, { waitUntil: "networkidle", timeout: 30000 });
      row.status = resp ? resp.status() : null;
      await page.waitForTimeout(300);
      const data = await page.evaluate(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
        const marquees = Array.from(document.querySelectorAll(".m-marquee > *, .marquee__track"));
        const marqueeStates = marquees.map((m) => {
          const s = getComputedStyle(m);
          return { animationName: s.animationName, animationDuration: s.animationDuration, animationPlayState: s.animationPlayState };
        });
        const sheens = Array.from(document.querySelectorAll(".m-sheen"));
        const sheenStates = sheens.map((el) => {
          const after = getComputedStyle(el, "::after");
          return { animationName: after.animationName, animationDuration: after.animationDuration };
        });
        return { mq, revealCount: els.length, bad, marqueeCount: marquees.length, marqueeStates, sheenCount: sheens.length, sheenStates };
      });
      Object.assign(row, data);
    } catch (err) {
      row.error = String(err && err.message ? err.message : err);
    } finally {
      await context.close();
    }
    results.push(row);
    console.log(`[${engineName}] ${t.id}: mq=${row.mq} reveal=${row.revealCount} bad=${row.bad ? row.bad.length : "ERR"} marquee=${JSON.stringify(row.marqueeStates)}`);
  }
  await browser.close();
}

await writeFile(
  "C:\\Users\\dotat\\AppData\\Local\\Temp\\claude\\C--Users-dotat-Desktop-Saas-JOBS\\38b76097-e9bb-4f59-84c9-360866c2e361\\scratchpad\\test2-results.json",
  JSON.stringify(results, null, 2),
);
console.log("DONE");
