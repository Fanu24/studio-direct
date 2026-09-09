// Item 1: Firefox .m-reveal stranding, repeated. The original bug was
// non-deterministic (4/handful failures, different section each time), so a
// single passing run proves nothing. This does 3 independent fresh-context
// runs each across 5 long templates on Firefox (15 runs total), scrolling to
// the bottom with a realistic End-key press (respecting the site's
// scroll-behavior: smooth), and records every .m-reveal/.m-count element left
// below opacity 1. It also does one confirming run each on chromium/webkit to
// show the CSS (animation-timeline: view()) path still works.
import { chromium, firefox, webkit } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import templates from "./templates.mjs";

const BASE = "http://localhost:3100";
const LONG_TEMPLATES = [
  "home",
  "job-detail",
  "learn-hub",
  "rankings",
  "editorial-article",
  "salaries-index",
  "company-detail",
].map((id) => templates.find((t) => t.id === id));

async function scrollToBottomRealistic(page) {
  await page.click("body");
  await page.keyboard.press("End");
  // Poll for scroll to actually settle (smooth-scroll + IO/rAF sweep), never a
  // fixed sleep alone - wait on the real condition (scrollTop stable at max).
  await page.waitForFunction(
    () => {
      const d = document.documentElement;
      const atBottom = Math.abs(d.scrollTop + d.clientHeight - d.scrollHeight) < 5;
      return atBottom;
    },
    { timeout: 8000 },
  ).catch(() => {});
  // Then wait on the REAL completion condition: every .m-reveal/.m-count
  // element's opacity transition has finished (>=0.999), not a fixed sleep.
  // The deepest stagger levels (6-12) carry a 540ms transition-delay plus a
  // 620ms duration in the no-view()-timeline fallback, so a naive short sleep
  // taken right after the scroll settles catches them mid-transition (e.g.
  // opacity 0.90-0.96) and misreports that as "stuck" - it is just still
  // animating. Bound at 4s so a truly stuck element is still reported.
  await page
    .waitForFunction(
      () => {
        const els = Array.from(document.querySelectorAll(".m-reveal, .m-count"));
        return els.every((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return true;
          return parseFloat(getComputedStyle(el).opacity) >= 0.999;
        });
      },
      { timeout: 4000 },
    )
    .catch(() => {});
}

async function measureStuck(page) {
  return page.evaluate(() => {
    const els = Array.from(document.querySelectorAll(".m-reveal, .m-count"));
    const out = [];
    for (const el of els) {
      const s = getComputedStyle(el);
      const op = parseFloat(s.opacity);
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue; // not rendered
      if (op < 0.98) {
        out.push({
          tag: el.tagName.toLowerCase(),
          className: typeof el.className === "string" ? el.className.slice(0, 90) : "",
          text: (el.textContent || "").trim().slice(0, 60),
          opacity: op,
          isIn: el.classList.contains("is-in"),
        });
      }
    }
    return { total: els.length, stuck: out };
  });
}

const results = { firefoxRuns: [], crossEngineConfirm: [] };

// 3 independent runs x 5 templates = 15 Firefox runs.
{
  const browser = await firefox.launch();
  try {
    for (let run = 1; run <= 5; run++) {
      for (const t of LONG_TEMPLATES) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();
        let row = { run, template: t.id, url: t.url };
        try {
          const resp = await page.goto(BASE + t.url, { waitUntil: "networkidle", timeout: 30000 });
          row.status = resp ? resp.status() : null;
          await scrollToBottomRealistic(page);
          const m = await measureStuck(page);
          row.total = m.total;
          row.stuckCount = m.stuck.length;
          row.stuck = m.stuck;
        } catch (err) {
          row.error = String(err && err.message ? err.message : err);
        } finally {
          await context.close();
        }
        results.firefoxRuns.push(row);
        console.log(`[firefox run ${run}] ${t.id}: total=${row.total ?? "?"} stuck=${row.stuckCount ?? "ERR"}`);
      }
    }
  } finally {
    await browser.close();
  }
}

// One confirming run each on chromium and webkit for the same 5 templates.
for (const [name, launcher] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await launcher.launch();
  try {
    for (const t of LONG_TEMPLATES) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      let row = { engine: name, template: t.id, url: t.url };
      try {
        const resp = await page.goto(BASE + t.url, { waitUntil: "networkidle", timeout: 30000 });
        row.status = resp ? resp.status() : null;
        await scrollToBottomRealistic(page);
        const m = await measureStuck(page);
        row.total = m.total;
        row.stuckCount = m.stuck.length;
        row.stuck = m.stuck;
        // Confirm CSS path is actually active (view() timeline), not just
        // "everything happens to already be opacity 1" by accident.
        row.usesViewTimeline = await page.evaluate(() => CSS.supports("animation-timeline: view()"));
      } catch (err) {
        row.error = String(err && err.message ? err.message : err);
      } finally {
        await context.close();
      }
      results.crossEngineConfirm.push(row);
      console.log(`[${name}] ${t.id}: total=${row.total ?? "?"} stuck=${row.stuckCount ?? "ERR"} viewTimeline=${row.usesViewTimeline}`);
    }
  } finally {
    await browser.close();
  }
}

await writeFile(
  "C:\\Users\\dotat\\AppData\\Local\\Temp\\claude\\C--Users-dotat-Desktop-Saas-JOBS\\38b76097-e9bb-4f59-84c9-360866c2e361\\scratchpad\\verify\\reveal-firefox.json",
  JSON.stringify(results, null, 2),
);
console.log("DONE");
