// apps/web/qa/verify-jobs-above-fold.mjs
//
// "subito che si vede la lista di job, non devi scrollare" - the first job row
// has to be visible on arrival, not after a scroll. That is a measurement, not
// a taste call: find the top of the first job row and compare it to the fold.
//
// Reports, per viewport: where the hero ends, where the first job row starts,
// and how much of that row is above the fold.
//
// Usage: node qa/verify-jobs-above-fold.mjs [chromium|firefox|webkit]

import { chromium, firefox, webkit } from "@playwright/test";
import { writeSync } from "node:fs";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };
const engineName = process.argv[2] ?? "chromium";
const NEWLINE = String.fromCharCode(10);
const say = (line) => writeSync(1, line + NEWLINE);

// Laptop heights are the ones that matter: 900 and 800 are the common desktop
// folds, 740/844 the phones.
const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "390x844", width: 390, height: 844 },
  { name: "360x740", width: 360, height: 740 },
];

const browser = await LAUNCHERS[engineName].launch();
let failures = 0;

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.waitForTimeout(400);

  const measured = await page.evaluate(() => {
    const hero = document.querySelector(".home-hero");
    // The first row of the job TABLE. Not `.board-apply`: that is the detail
    // pane, which sits beside the list on desktop and below the whole list on
    // a phone - measuring it reported the mobile board at 3046px when the
    // table was actually at 412. The instrument was wrong, not the page.
    const row =
      document.querySelector(".board-table tbody tr") ??
      document.querySelector(".board__list tbody tr") ??
      document.querySelector("tbody tr");
    const search = document.querySelector(".home-hero__search, form[role='search'], input[type='search']");
    const remote = Array.from(document.querySelectorAll("a, button")).find((el) =>
      /remote/i.test((el.textContent || "").trim()),
    );
    const box = (el) => (el ? el.getBoundingClientRect() : null);
    // One row peeking over the fold is not "the list". Count the rows a reader
    // can actually read without scrolling.
    const allRows = Array.from(
      document.querySelectorAll(".board-table tbody tr, .board__list tbody tr"),
    );
    const fullyVisible = allRows.filter((r) => {
      const b = r.getBoundingClientRect();
      return b.height > 8 && b.bottom <= window.innerHeight;
    }).length;
    return {
      fold: window.innerHeight,
      hero: box(hero) && { bottom: Math.round(box(hero).bottom) },
      row: box(row) && {
        top: Math.round(box(row).top),
        bottom: Math.round(box(row).bottom),
        cls: (typeof row.className === "string" ? row.className : "").slice(0, 40),
      },
      search: box(search) && { top: Math.round(box(search).top) },
      remote: remote ? { text: remote.textContent.trim().slice(0, 20), href: remote.getAttribute("href") } : null,
      rowsVisible: fullyVisible,
      rowsTotal: allRows.length,
    };
  });

  const fold = measured.fold;
  const rowTop = measured.row ? measured.row.top : null;
  const visible = rowTop == null ? 0 : Math.max(0, Math.min(measured.row.bottom, fold) - rowTop);
  // Two whole rows is the bar: one row clipped by the fold reads as a page
  // that starts with a fragment, which is what the reader complained about.
  const ok = rowTop != null && rowTop < fold && measured.rowsVisible >= 2;
  if (!ok) failures += 1;

  say(
    `${vp.name.padEnd(10)} fold=${fold}  hero ends ${measured.hero ? measured.hero.bottom : "?"}  ` +
      `first row top=${rowTop ?? "NOT FOUND"}  ` +
      `${measured.rowsVisible}/${measured.rowsTotal} rows readable without scrolling  ` +
      `${ok ? "ok" : "NOT ENOUGH"}`,
  );
  if (measured.remote) say(`           remote control: "${measured.remote.text}" -> ${measured.remote.href}`);
  await page.close();
}

await browser.close();
say("");
say(`[${engineName}] ${VIEWPORTS.length} viewports, ${failures} where the first job row is not visible on arrival.`);
process.exit(failures === 0 ? 0 : 1);
