// apps/web/qa/verify-card-overlay-hit-area.mjs
//
// The tap-target residue tracer keeps reporting `a.company-card__link` at
// ~21px tall on /web3-companies. The claim is that this is a measurement
// artefact rather than a defect: the link carries a full-bleed `::after` that
// covers the whole card, so the real hit area is the 373x257 card, not the
// text box of the name. A claim like that has to be measured - the QA record
// already carries four findings withdrawn for exactly this reason.
//
// This asks the browser what is actually under the pointer at the card's
// centre and both bottom corners, which is the only thing that settles it.
//
// Two traps, both met while writing this:
//
//   1. `elementFromPoint` only answers for coordinates inside the viewport.
//      Probing a card below the fold returns null and reads exactly like an
//      overlay that does not cover its card.
//   2. The site sets `scroll-behavior: smooth`, so `scrollIntoViewIfNeeded()`
//      returns while the scroll is still animating and the card is still off
//      screen. The bottom row of cards "failed" on all three engines for this
//      reason alone. The probe turns smooth scrolling off before it measures -
//      the same class of race that stranded the Firefox reveal driver.
//
// Usage: node qa/verify-card-overlay-hit-area.mjs

import { chromium, firefox, webkit } from "@playwright/test";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };

let checked = 0;
let failed = 0;

for (const engineName of Object.keys(LAUNCHERS)) {
  const browser = await LAUNCHERS[engineName].launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/web3-companies`, { waitUntil: "load" });
  await page.addStyleTag({ content: "html, body, * { scroll-behavior: auto !important; }" });

  const count = await page.locator("a.company-card__link").count();
  console.log(`\n=== ${engineName}: ${count} company cards ===`);

  for (let index = 0; index < count; index += 1) {
    const link = page.locator("a.company-card__link").nth(index);
    await link.evaluate((el) => {
      (el.closest(".company-card") ?? el).scrollIntoView({ block: "center", behavior: "instant" });
    });
    await page.waitForTimeout(200);

    const row = await link.evaluate((el) => {
      const card = el.closest(".company-card") ?? el.parentElement;
      const linkRect = el.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const probes = [
        ["centre", cardRect.left + cardRect.width / 2, cardRect.top + cardRect.height / 2],
        ["bottom-left", cardRect.left + 6, cardRect.bottom - 6],
        ["bottom-right", cardRect.right - 6, cardRect.bottom - 6],
      ];
      const misses = [];
      for (const [name, x, y] of probes) {
        if (y < 0 || y > window.innerHeight) {
          misses.push(`${name}: outside the viewport, not probed`);
          continue;
        }
        const hit = document.elementFromPoint(x, y);
        const anchor = hit?.closest?.("a");
        if (anchor !== el) {
          misses.push(`${name}: ${anchor ? `another link (.${anchor.className})` : "no link"}`);
        }
      }
      return {
        text: el.textContent.trim().slice(0, 30),
        linkBox: `${Math.round(linkRect.width)}x${Math.round(linkRect.height)}`,
        cardBox: `${Math.round(cardRect.width)}x${Math.round(cardRect.height)}`,
        misses,
      };
    });

    checked += 1;
    if (row.misses.length > 0) {
      failed += 1;
      console.log(`  FAIL "${row.text}"  <a> ${row.linkBox}  card ${row.cardBox}`);
      for (const m of row.misses) console.log(`        ${m}`);
    } else {
      console.log(`  ok   "${row.text}"  <a> ${row.linkBox} -> whole card ${row.cardBox} is the target`);
    }
  }

  await browser.close();
}

console.log(`\n${checked} cards probed across 3 engines, ${failed} where the card is not the hit area.`);
process.exit(failed === 0 ? 0 : 1);
