// apps/web/qa/verify-tap-target-residue.mjs
//
// The consolidated report (docs/qa/2026-09-10-aurora-qa-report.md) left the
// sub-24px tap targets open as a Medium with the composition unresolved:
// "nine links under 24px on the salary pages, in a third component again
// (board-apply__company and unclassed inline links)". Round 2's own note
// admitted the footer residue was "not individually traced to a selector".
//
// smallTargets() in harness.mjs reports tag/text/size but no identity, which
// is exactly why the residue kept getting re-attributed to the wrong rule
// twice. This script reports the CSS ancestor path for every offending
// element so a fix can be aimed at a selector instead of guessed.
//
// Usage: node qa/verify-tap-target-residue.mjs [engine...]

import { chromium, firefox, webkit } from "@playwright/test";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };
const engines = process.argv.slice(2).filter((a) => a in LAUNCHERS);
const ENGINES = engines.length > 0 ? engines : ["chromium"];

const PAGES = [
  "/",
  "/web3-salaries",
  "/web3-non-tech-salaries",
  "/web3-salaries/scala-developer",
  "/web3-salaries/solana-vs-ethereum",
  "/jobs",
  "/web3-companies",
  "/web3-cities",
];

// Only the widths that matter for the open finding: the line chart is swapped
// for the table fallback below 480px, and the footer renders at every width.
const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  { name: "768x1024", width: 768, height: 1024, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  { name: "1440x900", width: 1440, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
];

async function residue(page, min) {
  return page.evaluate((minPx) => {
    const selector =
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [tabindex]:not([tabindex="-1"])';
    function pathOf(el) {
      const parts = [];
      let node = el;
      for (let depth = 0; node && depth < 4; depth += 1) {
        const cls = Array.from(node.classList).join(".");
        parts.unshift(node.tagName.toLowerCase() + (cls ? `.${cls}` : ""));
        node = node.parentElement;
      }
      return parts.join(" > ");
    }
    const out = [];
    for (const el of Array.from(document.querySelectorAll(selector))) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (parseFloat(style.opacity) === 0) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      // A 1x1 visually-hidden control is not a visible tap target; the sweep
      // flagged one every run and it was a harness artefact, not a defect.
      if (rect.width <= 1 && rect.height <= 1) continue;
      if (rect.width < minPx || rect.height < minPx) {
        out.push({
          path: pathOf(el),
          text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40),
          w: Math.round(rect.width * 10) / 10,
          h: Math.round(rect.height * 10) / 10,
          display: style.display,
        });
      }
    }
    return out;
  }, min);
}

const byPath = new Map();
let total = 0;

for (const engineName of ENGINES) {
  const browser = await LAUNCHERS[engineName].launch();
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
      deviceScaleFactor: vp.deviceScaleFactor,
    });
    const page = await context.newPage();
    for (const url of PAGES) {
      await page.goto(BASE + url, { waitUntil: "load" });
      const rows = await residue(page, 24);
      total += rows.length;
      if (rows.length > 0) {
        console.log(`\n[${engineName}] ${vp.name} ${url}: ${rows.length} under 24px`);
        for (const r of rows) {
          console.log(`   ${r.w}x${r.h} (${r.display})  ${r.path}   "${r.text}"`);
          const key = r.path.split(" > ").slice(-2).join(" > ");
          byPath.set(key, (byPath.get(key) ?? 0) + 1);
        }
      }
    }
    await context.close();
  }
  await browser.close();
}

console.log(`\n=== ${total} sub-24px targets, grouped by selector ===`);
for (const [key, count] of [...byPath.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`${String(count).padStart(4)}  ${key}`);
}
