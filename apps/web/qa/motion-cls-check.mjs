// QA scratch script (motion dimension). Layout shift (CLS) — Chromium only,
// the layout-shift PerformanceObserver entry type is not implemented in
// Firefox/WebKit (documented limitation, not skipped by oversight).
// Checks: /login Turnstile slot (reserved height claim) and home page overall
// (font swap + aurora gradient paint).
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import templates from "./templates.mjs";

const BASE = "http://localhost:3100";
const browser = await chromium.launch();
const results = [];

async function measureCLS(url, waitMs = 2500) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__shifts = [];
    try {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__shifts.push({
              value: entry.value,
              time: entry.startTime,
              sources: (entry.sources || []).map((s) => ({
                node: s.node ? (s.node.className || s.node.tagName) : null,
                prevRect: s.previousRect,
                currRect: s.currentRect,
              })),
            });
          }
        }
      });
      po.observe({ type: "layout-shift", buffered: true });
    } catch (e) {
      window.__shiftsError = String(e);
    }
  });
  const resp = await page.goto(BASE + url, { waitUntil: "load", timeout: 30000 });
  const status = resp ? resp.status() : null;
  await page.waitForTimeout(waitMs);
  const turnstileBox = await page.evaluate(() => {
    const el = document.querySelector(".auth-form__turnstile");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return { height: r.height, minHeight: s.minHeight, childCount: el.children.length };
  });
  const data = await page.evaluate(() => ({
    shifts: window.__shifts || [],
    shiftsError: window.__shiftsError || null,
    totalCLS: (window.__shifts || []).reduce((a, s) => a + s.value, 0),
  }));
  await context.close();
  return { status, turnstileBox, ...data };
}

for (const id of ["auth", "home"]) {
  const t = templates.find((tt) => tt.id === id);
  const r = await measureCLS(t.url);
  results.push({ template: id, url: t.url, ...r });
  console.log(`${id}: status=${r.status} totalCLS=${r.totalCLS} shiftCount=${r.shifts.length} turnstileBox=${JSON.stringify(r.turnstileBox)}`);
}

await browser.close();
await writeFile(
  "C:\\Users\\dotat\\AppData\\Local\\Temp\\claude\\C--Users-dotat-Desktop-Saas-JOBS\\38b76097-e9bb-4f59-84c9-360866c2e361\\scratchpad\\test7-cls-results.json",
  JSON.stringify(results, null, 2),
);
console.log("DONE");
