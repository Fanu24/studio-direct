// QA scratch script (motion dimension). CSS theaters loop contract:
// base CSS = poster frame, keyframes start/end at poster, dissolve 3-8%,
// rebuild. Pauses offscreen (park viewport on the section first). Confirms
// clean loop (no seam jump) by sampling computed style across a full cycle,
// on all three engines (declarative CSS keyframes — no JS drives frames, so
// per-engine risk is about @supports/vendor timing, not logic).
import { chromium, firefox, webkit } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const BASE = "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };
const engines = ["chromium", "firefox", "webkit"];

// theater id -> { selector for a representative element, durationMs, prop to sample }
const PROBES = [
  { theater: "th1 (CareerPagesTheater)", selector: ".th1__sources .t-site--1", durationMs: 11000, prop: "borderColor" },
  { theater: "th1 (CareerPagesTheater) card", selector: ".th1__board .t-card--1", durationMs: 11000, prop: "opacity" },
  { theater: "th3 (SearchTheater) caret", selector: ".th3__caret", durationMs: 10000, prop: "visibility" },
  // `.th6 .t-chip` was the original probe here and it samples a chip that was
  // never animated - it reported animationName "none" on all three engines
  // whether the theater was working or not, so it could not have caught a
  // regression in it. The two elements below are the ones th6 actually drives.
  { theater: "th6 (OneBoardTheater) hidden chip", selector: ".th6__chip-hidden", durationMs: 11000, prop: "opacity" },
  { theater: "th6 (OneBoardTheater) plain card", selector: ".th6__card--plain", durationMs: 11000, prop: "opacity" },
];

const results = [];

for (const engineName of engines) {
  const browser = await LAUNCHERS[engineName].launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
  // Force playback (skip prefers-reduced-motion gating) and scroll each
  // theater's section into view so the offscreen-pause IntersectionObserver
  // does not freeze it, then hold there for sampling.
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(400);

  for (const probe of PROBES) {
    const row = { engine: engineName, ...probe };
    try {
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.scrollIntoView({ block: "center" });
      }, probe.selector);
      await page.waitForTimeout(300);
      const exists = await page.evaluate((sel) => !!document.querySelector(sel), probe.selector);
      row.exists = exists;
      if (!exists) {
        results.push(row);
        continue;
      }
      const sample = async () =>
        page.evaluate(
          ({ sel, prop }) => {
            const el = document.querySelector(sel);
            const s = getComputedStyle(el);
            return { value: s[prop], animationName: s.animationName, animationPlayState: s.animationPlayState };
          },
          { sel: probe.selector, prop: probe.prop },
        );
      const t0 = await sample();
      await page.waitForTimeout(probe.durationMs * 0.5);
      const tMid = await sample();
      // land just before the seam (95% of a cycle from t0) and just after (105%)
      await page.waitForTimeout(probe.durationMs * 0.44);
      const tPreSeam = await sample();
      await page.waitForTimeout(probe.durationMs * 0.12);
      const tPostSeam = await sample();
      row.t0 = t0;
      row.tMid = tMid;
      row.tPreSeam = tPreSeam;
      row.tPostSeam = tPostSeam;
      row.differsMidCycle = JSON.stringify(t0) !== JSON.stringify(tMid);
    } catch (err) {
      row.error = String(err && err.message ? err.message : err);
    }
    results.push(row);
    console.log(`[${engineName}] ${probe.theater} ${probe.prop}: t0=${JSON.stringify(row.t0)} mid=${JSON.stringify(row.tMid)}`);
  }
  await context.close();
  await browser.close();
}

await writeFile(
  "C:\\Users\\dotat\\AppData\\Local\\Temp\\claude\\C--Users-dotat-Desktop-Saas-JOBS\\38b76097-e9bb-4f59-84c9-360866c2e361\\scratchpad\\test5-theater-results.json",
  JSON.stringify(results, null, 2),
);
console.log("DONE");
