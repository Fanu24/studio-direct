// QA scratch script (motion dimension). LCP needs a PerformanceObserver
// registered with buffered:true BEFORE navigation completes — entries are
// not retroactively available from plain getEntriesByType() otherwise.
// Chromium only (LCP API is not implemented by Firefox/WebKit).
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import templates from "./templates.mjs";

const BASE = "http://localhost:3100";
const N = 5;

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const results = {};
const browser = await chromium.launch();
for (const t of templates) {
  const lcps = [];
  for (let i = 0; i < N; i++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__lcp = null;
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) window.__lcp = last.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
      } catch {}
    });
    try {
      await page.goto(BASE + t.url, { waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(800);
      // Force-finalize LCP the way real browsers do: any input/visibility
      // change stops LCP reporting, so reading it after a short settle
      // (no input) plus a page.evaluate poke is close enough for comparison.
      const lcp = await page.evaluate(() => window.__lcp);
      if (typeof lcp === "number") lcps.push(lcp);
    } catch (err) {
      console.log(`${t.id} sample ${i} error: ${err}`);
    } finally {
      await context.close();
    }
  }
  results[t.id] = { url: t.url, lcpSamples: lcps, lcpMedianMs: lcps.length ? median(lcps) : null };
  console.log(`${t.id}: lcpMedian=${results[t.id].lcpMedianMs} (n=${lcps.length}) samples=${JSON.stringify(lcps)}`);
}
await browser.close();

await writeFile(
  "C:\\Users\\dotat\\AppData\\Local\\Temp\\claude\\C--Users-dotat-Desktop-Saas-JOBS\\38b76097-e9bb-4f59-84c9-360866c2e361\\scratchpad\\test6b-lcp-results.json",
  JSON.stringify(results, null, 2),
);
console.log("DONE");
