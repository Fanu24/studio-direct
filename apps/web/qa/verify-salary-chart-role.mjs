// apps/web/qa/verify-salary-chart-role.mjs
//
// The bar chart's container carried `role="img"`, which declares its whole
// subtree presentational - and the subtree holds the row links that are the
// primary way into each role's own salary page. The report logged it as an
// invalid content model that no engine mishandled, which is exactly the kind
// of claim worth checking rather than repeating: an engine that DID honour it
// would hide those links from assistive technology entirely.
//
// The container is now role="group". This checks both halves of that change:
// the chart still exposes its accessible name, and the links inside it are
// reachable in the accessibility tree.
//
// `page.accessibility` is Chromium-only and gone from current Playwright;
// ariaSnapshot() is the cross-engine replacement and returns the tree as YAML.
//
// Usage: node qa/verify-salary-chart-role.mjs

import { chromium, firefox, webkit } from "@playwright/test";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };
const PAGE = "/web3-non-tech-salaries";
const NEWLINE = String.fromCharCode(10);

let failed = 0;

for (const engineName of Object.keys(LAUNCHERS)) {
  const browser = await LAUNCHERS[engineName].launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + PAGE, { waitUntil: "load" });

  // The page carries three of these charts, so every one gets checked - a
  // single-element probe would have proved nothing about the other two.
  const charts = page.locator(".salary-chart");
  const count = await charts.count();
  console.log(`[${engineName}] ${count} charts on ${PAGE}`);

  for (let index = 0; index < count; index += 1) {
    const chart = charts.nth(index);
    const dom = await chart.evaluate((el) => ({
      role: el.getAttribute("role"),
      label: el.getAttribute("aria-label"),
      linkCount: el.querySelectorAll("a[href]").length,
    }));

    const snapshot = await chart.ariaSnapshot();
    const lines = snapshot.split(NEWLINE);
    const linksInTree = lines.filter((line) => line.trim().startsWith("- link"));
    const rootLine = (lines[0] ?? "").trim();

    // A chart whose rows are not links on this page has nothing to expose;
    // only the ones that do carry links can prove the subtree is reachable.
    const nameOk = rootLine.includes(dom.label);
    const linksOk = dom.linkCount === 0 || linksInTree.length > 0;
    if (!nameOk || !linksOk) failed += 1;

    console.log(
      `   role=${dom.role} aria-label="${dom.label}" | a11y root: ${rootLine} | ` +
        `${dom.linkCount} links in the DOM, ${linksInTree.length} in the a11y tree ` +
        `${nameOk && linksOk ? "OK" : "FAIL"}`,
    );
  }

  await browser.close();
}

console.log(
  failed === 0
    ? "All engines: the chart is named and the links inside it are exposed."
    : `${failed} engine(s) failed.`,
);
process.exit(failed === 0 ? 0 : 1);
