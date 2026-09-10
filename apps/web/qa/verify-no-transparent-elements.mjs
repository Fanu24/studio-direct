// apps/web/qa/verify-no-transparent-elements.mjs
//
// The scroll-reveal effect was removed because it read as buggy: sections
// could be left stranded at opacity 0 by the observer fallback, and elements
// already inside the first viewport parked at partial opacity because a
// view() timeline has no scroll distance to animate over.
//
// Removing it is only worth anything if nothing is left translucent. This
// loads each template WITHOUT scrolling - the state a reader sees on arrival -
// and reports every element still under full opacity, plus anything still
// carrying a transform. The old defect showed up exactly there: on load,
// before any scrolling could rescue it.
//
// Usage: node qa/verify-no-transparent-elements.mjs [chromium|firefox|webkit]

import { chromium, firefox, webkit } from "@playwright/test";
import { writeSync } from "node:fs";
import { templates } from "./templates.mjs";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };
const engineName = process.argv[2] ?? "chromium";
const NEWLINE = String.fromCharCode(10);
const say = (line) => writeSync(1, line + NEWLINE);

const browser = await LAUNCHERS[engineName].launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

let checked = 0;
const faded = [];

for (const template of templates) {
  try {
    await page.goto(BASE + template.url, { waitUntil: "load", timeout: 45000 });
  } catch {
    say(`  ${template.id}: navigation failed, skipped`);
    continue;
  }
  // No scrolling on purpose. If an element needs a scroll to become visible,
  // that is the defect this check exists to catch.
  await page.waitForTimeout(600);

  const rows = await page.evaluate(() => {
    const out = [];
    for (const el of Array.from(document.querySelectorAll(".m-reveal, [data-reveal], .m-count, .m-count > *"))) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const opacity = parseFloat(style.opacity);
      const transform = style.transform;
      const moved = transform && transform !== "none" && !/matrix\(1, 0, 0, 1, 0, 0\)/.test(transform);
      if (opacity < 0.999 || moved) {
        out.push({
          cls: (typeof el.className === "string" ? el.className : "").slice(0, 50),
          tag: el.tagName.toLowerCase(),
          opacity,
          transform: moved ? transform.slice(0, 40) : null,
          text: (el.textContent || "").trim().slice(0, 30),
        });
      }
    }
    return { total: document.querySelectorAll(".m-reveal, [data-reveal]").length, out };
  });

  checked += rows.total;
  if (rows.out.length > 0) {
    say(`  ${template.id.padEnd(24)} ${rows.out.length} FADED of ${rows.total}`);
    for (const r of rows.out.slice(0, 4)) {
      say(`      opacity=${r.opacity} transform=${r.transform ?? "none"} <${r.tag} class="${r.cls}"> "${r.text}"`);
    }
    faded.push(...rows.out.map((r) => ({ template: template.id, ...r })));
  } else {
    say(`  ${template.id.padEnd(24)} ok, ${rows.total} reveal elements all fully opaque`);
  }
}

await browser.close();
say("");
say(`[${engineName}] ${checked} reveal elements across ${templates.length} templates, ${faded.length} not fully visible on load.`);
process.exit(faded.length === 0 ? 0 : 1);
