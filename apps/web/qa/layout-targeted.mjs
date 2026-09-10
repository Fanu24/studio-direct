// apps/web/qa/layout-targeted.mjs
//
// Targeted layout checks for Task 9 (layout dimension), extending the
// generic qa/run.mjs `layout` check with the specific per-template DOM
// measurements the task called out: rank-overlay collision on the four
// named ranked pages at 360/390, page-2 tint suppression, the salary
// seniority chart's <480px table fallback, and the company-card grid's
// 3-2-1 collapse (plus a probe width outside the required viewport set to
// check a suspected CSS cascade-order gap between two stylesheets that both
// set --cols on the same element). Writes qa/out/layout-targeted.json.
//
// This is QA tooling, not application source - it measures, it does not fix.
import { chromium, firefox, webkit } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { smallTargets, VIEWPORTS } from "./harness.mjs";
import templates from "./templates.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };
const ENGINES = ["chromium", "firefox", "webkit"];

const RANKED_VIEWPORTS = [
  { name: "360x740", width: 360, height: 740, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: "390x844", width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
];

const RANKED_URLS = [
  "/highest-paid-developer-jobs",
  "/highest-paying-web3-jobs",
  "/highest-paid-designers-jobs",
  "/highest-paid-non-tech-jobs",
];

async function measureRankOverlay(page) {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll(".board-tr")).slice(0, 8);
    return rows.map((row) => {
      const rankEl = row.querySelector(".board-row__rank");
      const titleEl = row.querySelector(".board-row__title");
      const jobCol = row.querySelector(".board-col-job");
      if (!rankEl || !titleEl || !jobCol) {
        return { hasRank: !!rankEl, hasTitle: !!titleEl, hasCol: !!jobCol };
      }
      const rankRect = rankEl.getBoundingClientRect();
      const titleRect = titleEl.getBoundingClientRect();
      const colRect = jobCol.getBoundingClientRect();
      const colStyle = getComputedStyle(jobCol);
      const overlapsHorizontally = rankRect.right > titleRect.left;
      const overlapsVertically = !(rankRect.bottom < titleRect.top || rankRect.top > titleRect.bottom);
      const collides = overlapsHorizontally && overlapsVertically;
      return {
        hasRank: true,
        rankText: rankEl.textContent.trim(),
        rankRect: { left: rankRect.left, right: rankRect.right, top: rankRect.top, bottom: rankRect.bottom, width: rankRect.width },
        titleRect: { left: titleRect.left, right: titleRect.right, top: titleRect.top, bottom: titleRect.bottom },
        titleText: titleEl.textContent.trim().slice(0, 90),
        jobColPaddingLeft: colStyle.paddingLeft,
        jobColWidth: colRect.width,
        collides,
      };
    });
  });
}

async function measureTint(page) {
  return page.evaluate(() => {
    const table = document.querySelector(".board-table");
    if (!table) return { hasTable: false };
    const rows = Array.from(document.querySelectorAll(".board-tr")).slice(0, 5);
    const bg = rows.map((r) => getComputedStyle(r).backgroundColor);
    return {
      hasTable: true,
      tableClasses: table.className,
      hasRankedTopClass: table.classList.contains("board-table--ranked-top"),
      firstFiveRowBg: bg,
    };
  });
}

async function measureChartFallback(page) {
  return page.evaluate(() => {
    const viz = document.querySelector(".chart__viz");
    const table = document.querySelector(".chart__table");
    if (!viz || !table) return { hasChart: false, hasViz: !!viz, hasTable: !!table };
    const vizStyle = getComputedStyle(viz);
    const tableStyle = getComputedStyle(table);
    const vizRect = viz.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    return {
      hasChart: true,
      vizDisplay: vizStyle.display,
      tableDisplay: tableStyle.display,
      vizVisible: vizRect.width > 0 && vizRect.height > 0,
      tableVisible: tableRect.width > 0 && tableRect.height > 0,
    };
  });
}

async function measureCompanyGrid(page) {
  return page.evaluate(() => {
    const grid = document.querySelector(".company-grid");
    if (!grid) return { hasGrid: false };
    const style = getComputedStyle(grid);
    const cols = style.gridTemplateColumns.split(" ").length;
    return {
      hasGrid: true,
      gridTemplateColumns: style.gridTemplateColumns,
      colsComputed: cols,
      cssVarCols: style.getPropertyValue("--cols").trim(),
    };
  });
}

async function main() {
  const results = { rankOverlay: [], tint: [], chartFallback: [], companyGrid: [], comfortTargets: [] };

  for (const engineName of ENGINES) {
    const browser = await LAUNCHERS[engineName].launch();
    try {
      for (const viewport of RANKED_VIEWPORTS) {
        for (const url of RANKED_URLS) {
          const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            deviceScaleFactor: viewport.deviceScaleFactor,
            hasTouch: viewport.hasTouch,
            ...(engineName === "chromium" ? { isMobile: viewport.isMobile } : {}),
          });
          const page = await context.newPage();
          try {
            const resp = await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 30000 });
            const overlay = await measureRankOverlay(page);
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            results.rankOverlay.push({ url, viewport: viewport.name, engine: engineName, status: resp?.status() ?? null, overlay, pageOverflowPx: overflow });
          } catch (err) {
            results.rankOverlay.push({ url, viewport: viewport.name, engine: engineName, error: String(err) });
          } finally {
            await context.close();
          }
        }
      }

      for (const viewport of [RANKED_VIEWPORTS[0], { name: "1440x900", width: 1440, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }]) {
        for (const [label, url] of [["page1", "/highest-paid-developer-jobs"], ["page2", "/highest-paid-developer-jobs?page=2"]]) {
          const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            deviceScaleFactor: viewport.deviceScaleFactor,
            hasTouch: viewport.hasTouch,
            ...(engineName === "chromium" ? { isMobile: viewport.isMobile } : {}),
          });
          const page = await context.newPage();
          try {
            const resp = await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 30000 });
            const tint = await measureTint(page);
            results.tint.push({ url, label, viewport: viewport.name, engine: engineName, status: resp?.status() ?? null, tint });
          } catch (err) {
            results.tint.push({ url, label, viewport: viewport.name, engine: engineName, error: String(err) });
          } finally {
            await context.close();
          }
        }
      }

      for (const viewport of [RANKED_VIEWPORTS[0], RANKED_VIEWPORTS[1], { name: "768x1024", width: 768, height: 1024, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }]) {
        for (const url of ["/web3-salaries/backend-developer", "/web3-salaries/solana-vs-ethereum"]) {
          const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            deviceScaleFactor: viewport.deviceScaleFactor,
            hasTouch: viewport.hasTouch,
            ...(engineName === "chromium" ? { isMobile: viewport.isMobile } : {}),
          });
          const page = await context.newPage();
          try {
            const resp = await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 30000 });
            const chart = await measureChartFallback(page);
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            results.chartFallback.push({ url, viewport: viewport.name, engine: engineName, status: resp?.status() ?? null, chart, pageOverflowPx: overflow });
          } catch (err) {
            results.chartFallback.push({ url, viewport: viewport.name, engine: engineName, error: String(err) });
          } finally {
            await context.close();
          }
        }
      }

      const gridViewports = [
        { name: "360x740", width: 360, height: 740 },
        { name: "390x844", width: 390, height: 844 },
        { name: "600x900-probe", width: 600, height: 900 },
        { name: "768x1024", width: 768, height: 1024 },
        { name: "1024x768", width: 1024, height: 768 },
        { name: "1440x900", width: 1440, height: 900 },
        { name: "1920x1080", width: 1920, height: 1080 },
      ];
      for (const viewport of gridViewports) {
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
        const page = await context.newPage();
        try {
          const resp = await page.goto(BASE + "/web3-companies", { waitUntil: "networkidle", timeout: 30000 });
          const grid = await measureCompanyGrid(page);
          results.companyGrid.push({ viewport: viewport.name, width: viewport.width, engine: engineName, status: resp?.status() ?? null, grid });
        } catch (err) {
          results.companyGrid.push({ viewport: viewport.name, width: viewport.width, engine: engineName, error: String(err) });
        } finally {
          await context.close();
        }
      }
      // 5. Comfort-target sweep: interactive elements 24-43px on the two
      // touch viewports (390x844, 768x1024), across all 21 templates - the
      // task asks these be flagged separately from the <24px hard defect
      // the generic run.mjs check already covers via smallTargets(page,24).
      const touchViewports = VIEWPORTS.filter((v) => v.hasTouch);
      for (const viewport of touchViewports) {
        for (const template of templates) {
          const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            deviceScaleFactor: viewport.deviceScaleFactor,
            hasTouch: viewport.hasTouch,
            ...(engineName === "chromium" ? { isMobile: viewport.isMobile } : {}),
          });
          const page = await context.newPage();
          try {
            await page.goto(BASE + template.url, { waitUntil: "networkidle", timeout: 30000 });
            const under44 = await smallTargets(page, 44);
            const under24 = under44.filter((t) => t.width < 24 || t.height < 24);
            const comfortOnly = under44.filter((t) => t.width >= 24 && t.height >= 24);
            results.comfortTargets.push({
              template: template.id,
              url: template.url,
              viewport: viewport.name,
              engine: engineName,
              comfortIssueCount: comfortOnly.length,
              comfortIssues: comfortOnly.slice(0, 10),
              hardDefectCount: under24.length,
            });
          } catch (err) {
            results.comfortTargets.push({ template: template.id, url: template.url, viewport: viewport.name, engine: engineName, error: String(err) });
          } finally {
            await context.close();
          }
        }
      }
    } finally {
      await browser.close();
    }
  }

  await mkdir(path.join(__dirname, "out"), { recursive: true });
  await writeFile(path.join(__dirname, "out", "layout-targeted.json"), JSON.stringify(results, null, 2), "utf8");
  console.log("done");
}

main();
