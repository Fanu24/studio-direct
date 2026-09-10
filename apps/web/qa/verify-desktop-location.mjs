// Item 4: desktop split-view table column widths (job 42%->37%, loc 12%->17%).
// table-layout: fixed, so thead th widths bind. Verify the location text is
// no longer crushed (12% of a half-width pane => 20-30px) and the job title
// column did not become the new casualty of the 5-point transfer.
import { chromium, firefox, webkit } from "@playwright/test";

const BASE = "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };
const WIDTHS = [1024, 1440, 1920];

async function measure(page) {
  return page.evaluate(() => {
    const table = document.querySelector(".board-table");
    if (!table) return { hasTable: false };
    const thead = table.querySelector("thead tr");
    const ths = thead ? Array.from(thead.children) : [];
    const jobTh = ths[0];
    const locTh = ths[2];
    const jobThRect = jobTh ? jobTh.getBoundingClientRect() : null;
    const locThRect = locTh ? locTh.getBoundingClientRect() : null;

    // Find the long-location row.
    const rows = Array.from(document.querySelectorAll(".board-tr"));
    let target = null;
    for (const row of rows) {
      if ((row.textContent || "").includes("New York City Metropolitan Area")) {
        target = row;
        break;
      }
    }
    const titleEl = target ? target.querySelector(".board-row__title") : null;
    const locEl = target ? target.querySelector(".board-loc__text") : null;
    const titleRect = titleEl ? titleEl.getBoundingClientRect() : null;
    const locRect = locEl ? locEl.getBoundingClientRect() : null;
    const locStyle = locEl ? getComputedStyle(locEl) : null;

    return {
      hasTable: true,
      jobThWidth: jobThRect ? Math.round(jobThRect.width) : null,
      locThWidth: locThRect ? Math.round(locThRect.width) : null,
      found: !!target,
      titleWidth: titleRect ? Math.round(titleRect.width) : null,
      titleHeight: titleRect ? Math.round(titleRect.height) : null,
      titleText: titleEl ? titleEl.textContent.trim().slice(0, 60) : null,
      locWidth: locRect ? Math.round(locRect.width) : null,
      locHeight: locRect ? Math.round(locRect.height) : null,
      locFullText: locEl ? locEl.textContent : null,
      locTextOverflow: locStyle ? locStyle.textOverflow : null,
      locScrollWidth: locEl ? locEl.scrollWidth : null,
      locClientWidth: locEl ? locEl.clientWidth : null,
    };
  });
}

const results = [];
for (const engineName of ["chromium", "firefox", "webkit"]) {
  const browser = await LAUNCHERS[engineName].launch();
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    let row = { engine: engineName, width };
    try {
      await page.goto(BASE + "/jobs", { waitUntil: "networkidle", timeout: 30000 });
      const m = await measure(page);
      Object.assign(row, m);
    } catch (err) {
      row.error = String(err && err.message ? err.message : err);
    } finally {
      await context.close();
    }
    results.push(row);
    console.log(
      `[${engineName}] ${width}px: jobTh=${row.jobThWidth} locTh=${row.locThWidth} titleW=${row.titleWidth} locW=${row.locWidth} locText="${row.locFullText}" locClipped=${row.locScrollWidth > row.locClientWidth}`,
    );
  }
  await browser.close();
}
console.log("DONE");
