// QA scratch script (motion dimension). Per-template TTFB (Navigation Timing
// responseStart - startTime, all 3 engines) and LCP (PerformanceObserver
// largest-contentful-paint, chromium only — not implemented by Firefox/WebKit).
// N samples per template, sequential, against the shared contended server —
// report medians, per README guidance (absolute numbers are noisy under
// concurrent load from the other 3 QA agents; relative comparisons are the
// reliable signal).
import { chromium, firefox, webkit } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import templates from "./templates.mjs";

const BASE = "http://localhost:3100";
const N = 5;

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function measureOnce(page, url) {
  const resp = await page.goto(BASE + url, { waitUntil: "load", timeout: 30000 });
  const status = resp ? resp.status() : null;
  // Let LCP settle a bit more after load.
  await page.waitForTimeout(500);
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const ttfb = nav ? nav.responseStart - nav.startTime : null;
    let lcp = null;
    try {
      const entries = performance.getEntriesByType("largest-contentful-paint");
      if (entries.length) lcp = entries[entries.length - 1].startTime;
    } catch {
      lcp = null;
    }
    return { ttfb, lcp };
  });
  return { status, ...timing };
}

const results = {};

// Chromium: TTFB + LCP, N samples per template.
{
  const browser = await chromium.launch();
  for (const t of templates) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    // LCP must be observed via a PerformanceObserver registered before load
    // finishes to be reliably buffered; getEntriesByType also works because
    // largest-contentful-paint entries are buffered by spec.
    const ttfbs = [];
    const lcps = [];
    let status = null;
    for (let i = 0; i < N; i++) {
      try {
        const r = await measureOnce(page, t.url);
        status = r.status;
        if (typeof r.ttfb === "number") ttfbs.push(r.ttfb);
        if (typeof r.lcp === "number") lcps.push(r.lcp);
      } catch (err) {
        console.log(`chromium ${t.id} sample ${i} error: ${err}`);
      }
    }
    await context.close();
    results[t.id] = {
      url: t.url,
      status,
      chromium: {
        ttfbSamples: ttfbs,
        ttfbMedianMs: ttfbs.length ? median(ttfbs) : null,
        lcpSamples: lcps,
        lcpMedianMs: lcps.length ? median(lcps) : null,
      },
    };
    console.log(`[chromium] ${t.id}: ttfbMedian=${results[t.id].chromium.ttfbMedianMs} lcpMedian=${results[t.id].chromium.lcpMedianMs} (n=${ttfbs.length})`);
  }
  await browser.close();
}

// Firefox + WebKit: TTFB only (no LCP API). TTFB is overwhelmingly server +
// network time, not engine-dependent, so we only cross-check a handful of
// templates here (rather than repeat all 21 x N x 2 engines) to confirm the
// chromium numbers are not a chromium-only artifact - full N samples per
// template, same as chromium, just fewer templates.
const crossCheckIds = ["home", "salaries-index", "rankings", "jobs-catalog", "editorial-article"];
const crossCheckTemplates = templates.filter((t) => crossCheckIds.includes(t.id));
for (const engineName of ["firefox", "webkit"]) {
  const launcher = engineName === "firefox" ? firefox : webkit;
  const browser = await launcher.launch();
  for (const t of crossCheckTemplates) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const ttfbs = [];
    for (let i = 0; i < N; i++) {
      try {
        const r = await measureOnce(page, t.url);
        if (typeof r.ttfb === "number") ttfbs.push(r.ttfb);
      } catch (err) {
        console.log(`${engineName} ${t.id} sample ${i} error: ${err}`);
      }
    }
    await context.close();
    results[t.id][engineName] = {
      ttfbSamples: ttfbs,
      ttfbMedianMs: ttfbs.length ? median(ttfbs) : null,
    };
    console.log(`[${engineName}] ${t.id}: ttfbMedian=${results[t.id][engineName].ttfbMedianMs} (n=${ttfbs.length})`);
  }
  await browser.close();
}

await writeFile(
  "C:\\Users\\dotat\\AppData\\Local\\Temp\\claude\\C--Users-dotat-Desktop-Saas-JOBS\\38b76097-e9bb-4f59-84c9-360866c2e361\\scratchpad\\test6-perf-results.json",
  JSON.stringify(results, null, 2),
);
console.log("DONE");
