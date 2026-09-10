// Round 2, item 1 (class-of-defect sweep), made robust against the crash
// that killed the combined 3-engine matrix sweep (a Firefox renderer crash
// took the whole Node process down mid-run with zero rows written). Run
// ONE engine per process (engine name passed as argv[2]), write results
// incrementally to stdout as each row completes (not just at the end), and
// catch per-page errors so one bad page does not lose the rest of the run.
import { chromium, firefox, webkit } from "@playwright/test";
import { overflowPx } from "./harness.mjs";
import { templates } from "./templates.mjs";

const BASE = "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };
const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: "390x844", width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  { name: "768x1024", width: 768, height: 1024, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  { name: "1024x768", width: 1024, height: 768, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: "1440x900", width: 1440, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: "1920x1080", width: 1920, height: 1080, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
];

const engineName = process.argv[2];
if (!LAUNCHERS[engineName]) {
  console.error("usage: node verify-overflow-sweep-round2.mjs <chromium|firefox|webkit>");
  process.exit(2);
}

const browser = await LAUNCHERS[engineName].launch();
let completed = 0;
let overflowCount = 0;
for (const viewport of VIEWPORTS) {
  for (const template of templates) {
    let context;
    try {
      context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.deviceScaleFactor,
        hasTouch: viewport.hasTouch,
        ...(engineName === "chromium" ? { isMobile: viewport.isMobile } : {}),
      });
      const page = await context.newPage();
      const url = BASE + template.url;
      await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
      const overflow = await overflowPx(page);
      completed++;
      if (overflow > 0) {
        overflowCount++;
        console.log(`ROW OVERFLOW ${engineName} ${viewport.name} ${template.id} ${template.url} ${overflow}px`);
      } else {
        console.log(`row ok ${engineName} ${viewport.name} ${template.id} 0px`);
      }
    } catch (err) {
      console.log(`ROW ERROR ${engineName} ${viewport.name} ${template.id} ${template.url} ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`);
    } finally {
      if (context) await context.close().catch(() => {});
    }
  }
}
await browser.close();
console.log(`SUMMARY ${engineName} completed=${completed}/${VIEWPORTS.length * templates.length} overflowRows=${overflowCount}`);
console.log("DONE");
