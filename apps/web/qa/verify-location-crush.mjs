// Item 3: long-location job title crush. Target job: "DeFi Trader -
// Proprietary Trading" at Radley James, location "New York City Metropolitan
// Area US" - the exact repro string named in the task, and confirmed (via a
// direct D1 query) to be the #1 row in the default job listing order, so it
// renders on the home page, /jobs, and the rankings page without needing
// pagination.
import { chromium, firefox, webkit } from "@playwright/test";

const BASE = "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };
const PAGES = ["/", "/top-web3-jobs"];
const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: "390x844", width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
];

async function measure(page) {
  return page.evaluate(() => {
    // Find the mobile board-row whose location text matches the target string.
    const rows = Array.from(document.querySelectorAll(".board-tr"));
    for (const row of rows) {
      const locEl = row.querySelector(".board-loc__text, .board-row__loc, [class*='loc']");
      const text = row.textContent || "";
      if (!text.includes("New York City Metropolitan Area")) continue;
      const titleEl = row.querySelector(".board-row__title, a.board-row__title, .board-col-job a, .board-row a");
      const style = titleEl ? getComputedStyle(titleEl) : null;
      const rect = titleEl ? titleEl.getBoundingClientRect() : null;
      return {
        found: true,
        titleTag: titleEl ? titleEl.tagName.toLowerCase() : null,
        titleClass: titleEl && typeof titleEl.className === "string" ? titleEl.className.slice(0, 80) : null,
        titleText: titleEl ? titleEl.textContent.trim().slice(0, 60) : null,
        titleWidthPx: rect ? Math.round(rect.width * 10) / 10 : null,
        titleHeightPx: rect ? Math.round(rect.height * 10) / 10 : null,
        titleVisibility: style ? style.visibility : null,
        titleDisplay: style ? style.display : null,
        titleOpacity: style ? style.opacity : null,
        rowDisplay: getComputedStyle(row).display,
        locFound: !!locEl,
      };
    }
    return { found: false, rowCount: rows.length };
  });
}

const results = [];

for (const engineName of ["chromium", "firefox", "webkit"]) {
  const browser = await LAUNCHERS[engineName].launch();
  for (const vp of VIEWPORTS) {
    for (const url of PAGES) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.deviceScaleFactor,
        hasTouch: vp.hasTouch,
        ...(engineName === "chromium" ? { isMobile: vp.isMobile } : {}),
      });
      const page = await context.newPage();
      let row = { engine: engineName, viewport: vp.name, url };
      try {
        await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 30000 });
        const m = await measure(page);
        Object.assign(row, m);
      } catch (err) {
        row.error = String(err && err.message ? err.message : err);
      } finally {
        await context.close();
      }
      results.push(row);
      console.log(
        `[${engineName}] ${vp.name} ${url}: found=${row.found} titleWidthPx=${row.titleWidthPx} titleText="${row.titleText}"`,
      );
    }
  }
  await browser.close();
}
console.log("DONE");
