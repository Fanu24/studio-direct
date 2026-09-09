// Item 9: experimental.viewTransition was removed from next.config (inert
// anyway - needs React's experimental channel). Confirm plain client-side
// <Link> navigation still works on all three engines. Per the methodology
// note: settle()'s ~350ms is wrong for a Next client nav (measured ~620ms),
// and monkey-patching document.startViewTransition breaks WebKit navigation.
// So: click a real link, wait on the real condition (URL changed AND the
// destination page's own marker element is present), never a fixed timeout,
// and never touch startViewTransition.
import { chromium, firefox, webkit } from "@playwright/test";

const BASE = "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };

// A few real same-origin client navigations exercised via visible <Link>s.
const FLOWS = [
  { from: "/", clickText: "Jobs", expectUrlPart: "/jobs", expectSelector: ".board" },
  { from: "/jobs", clickText: "Web3 salaries", expectUrlPart: "/web3-salaries", expectSelector: "h1" },
];

const results = [];
for (const engineName of ["chromium", "firefox", "webkit"]) {
  const browser = await LAUNCHERS[engineName].launch();
  for (const flow of FLOWS) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    let row = { engine: engineName, ...flow };
    try {
      await page.goto(BASE + flow.from, { waitUntil: "networkidle", timeout: 30000 });
      const before = page.url();
      const link = page.locator(`a:has-text("${flow.clickText}")`).first();
      const start = Date.now();
      await link.click();
      // Wait on the REAL condition: URL updated AND destination content present.
      await page.waitForURL((url) => url.pathname.includes(flow.expectUrlPart), { timeout: 10000 });
      await page.waitForSelector(flow.expectSelector, { timeout: 10000 });
      const elapsedMs = Date.now() - start;
      const after = page.url();
      row.ok = true;
      row.before = before;
      row.after = after;
      row.elapsedMs = elapsedMs;
    } catch (err) {
      row.ok = false;
      row.error = String(err && err.message ? err.message : err);
    } finally {
      await context.close();
    }
    results.push(row);
    console.log(
      `[${engineName}] ${flow.from} -> click "${flow.clickText}": ok=${row.ok} after=${row.after ?? "?"} elapsedMs=${row.elapsedMs ?? "?"}`,
    );
  }
  await browser.close();
}
console.log("DONE");
