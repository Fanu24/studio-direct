// apps/web/qa/verify-heading-rhythm.mjs
//
// "gli h2 attaccati al testo" - reported across the whole site, not just the
// salary pages. The QA harness never measured this: it checked overflow,
// clipping, tap targets and motion, all of which a page can pass while being
// unreadable.
//
// A heading belongs to the text BELOW it. When the gap above a heading is not
// clearly larger than the gap below, the eye groups it with the paragraph it
// follows instead of the section it opens. That is a measurable relationship,
// so this measures it rather than describing it.
//
// For every heading on every template it reports the real rendered gap above
// and below - the collapsed margin between adjacent boxes, not the declared
// CSS - and flags any heading whose gap above is not at least `RATIO` times
// the gap below.
//
// Usage: node qa/verify-heading-rhythm.mjs [chromium|firefox|webkit]

import { chromium, firefox, webkit } from "@playwright/test";
import { writeSync } from "node:fs";
import { templates } from "./templates.mjs";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };
const engineName = process.argv[2] ?? "chromium";

// Console output to a redirected file is buffered on Windows and appears only
// at exit, which reads exactly like a hang on a run this long.
const NEWLINE = String.fromCharCode(10);
const say = (line) => writeSync(1, line + NEWLINE);

// A heading should sit at least this many times further from what precedes it
// than from what follows. 1.5 is deliberately lenient - the point is to find
// headings that are closer to the text above, not to enforce a scale.
const RATIO = 1.5;

async function headingRhythm(page) {
  return page.evaluate(() => {
    const out = [];
    for (const heading of Array.from(document.querySelectorAll("h1, h2, h3, h4"))) {
      const style = getComputedStyle(heading);
      if (style.display === "none" || style.visibility === "hidden") continue;

      const rect = heading.getBoundingClientRect();
      if (rect.height === 0) continue;

      // Measure the real gap to the neighbouring boxes rather than reading the
      // declared margins: margins collapse, and the collapsed result is what
      // the reader actually sees.
      const previous = heading.previousElementSibling;
      const next = heading.nextElementSibling;
      const isFirst = previous == null;

      let above = null;
      if (previous) {
        const previousRect = previous.getBoundingClientRect();
        if (previousRect.height > 0) above = Math.round(rect.top - previousRect.bottom);
      }
      let below = null;
      if (next) {
        const nextRect = next.getBoundingClientRect();
        if (nextRect.height > 0) below = Math.round(nextRect.top - rect.bottom);
      }

      out.push({
        tag: heading.tagName.toLowerCase(),
        text: heading.textContent.trim().slice(0, 42),
        above,
        below,
        isFirst,
        fontSize: Math.round(parseFloat(style.fontSize)),
        lineHeight: style.lineHeight,
        // A heading that opens a card or a panel legitimately has no space
        // above it; only headings that follow real content are judged.
        parent: heading.parentElement
          ? heading.parentElement.tagName.toLowerCase() +
            (heading.parentElement.className && typeof heading.parentElement.className === "string"
              ? "." + heading.parentElement.className.split(/\s+/).filter(Boolean).slice(0, 2).join(".")
              : "")
          : "",
      });
    }
    return out;
  });
}

const browser = await LAUNCHERS[engineName].launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

let headingsChecked = 0;
const cramped = [];
const byTemplate = new Map();

for (const template of templates) {
  try {
    await page.goto(BASE + template.url, { waitUntil: "load", timeout: 45000 });
  } catch {
    say(`  ${template.id}: navigation failed, skipped`);
    continue;
  }

  const rows = await headingRhythm(page);
  let bad = 0;
  for (const row of rows) {
    // Only headings with real content on both sides can be judged.
    if (row.isFirst || row.above == null || row.below == null) continue;
    headingsChecked += 1;
    if (row.above < row.below * RATIO) {
      bad += 1;
      cramped.push({ template: template.id, ...row });
    }
  }
  byTemplate.set(template.id, { total: rows.length, bad });
  say(`  ${template.id.padEnd(24)} ${String(bad).padStart(3)} cramped of ${rows.length} headings`);
}

await browser.close();

say("");
say(`${headingsChecked} headings judged, ${cramped.length} sit closer to the text above than below.`);

const worst = [...cramped].sort((a, b) => a.above - b.above).slice(0, 15);
if (worst.length > 0) {
  say("");
  say("worst offenders (gap above / gap below):");
  for (const row of worst) {
    say(
      `  ${String(row.above).padStart(3)}px / ${String(row.below).padStart(3)}px  ` +
        `${row.tag} ${row.fontSize}px lh=${row.lineHeight}  [${row.template}] ` +
        `in ${row.parent}  "${row.text}"`,
    );
  }
}
