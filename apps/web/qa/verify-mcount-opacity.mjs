// QA scratch script: measure computed opacity of the two homepage .m-count
// elements (live jobs, hiring companies) after page load, on all three
// engines. These use `animation-timeline: view()` with
// `animation-range: entry 0% entry 80%`, and motion.css's own comment records
// that a view()-timeline element already inside the first viewport parks at
// partial progress. `.m-count` has no `--now` escape hatch (unlike
// `.m-reveal`), so if it is not scrolled through, it may render below full
// opacity. This script does NOT scroll - it measures immediately after load,
// which is the real-world case for a hero element.
import { chromium, firefox, webkit } from "@playwright/test";

const BASE = "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };
const engines = ["chromium", "firefox", "webkit"];

const results = [];

for (const engineName of engines) {
  const browser = await LAUNCHERS[engineName].launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
  // Settle: no scroll, no interaction - this is the state a real visitor
  // sees on landing, before ever touching the page.
  await page.waitForTimeout(500);

  const data = await page.evaluate(() => {
    // The animation (count-up, animation-timeline: view()) is declared on
    // `.m-count > *` (the inner <span> carrying the digits), not on
    // `.m-count` itself - motion.css line ~290. Measure the child.
    const wrappers = Array.from(document.querySelectorAll(".m-count"));
    return wrappers.map((wrapper, i) => {
      const child = wrapper.firstElementChild;
      const ws = getComputedStyle(wrapper);
      const cs = child ? getComputedStyle(child) : null;
      const rect = wrapper.getBoundingClientRect();
      return {
        index: i,
        text: wrapper.textContent?.trim(),
        wrapperOpacity: ws.opacity,
        childOpacity: cs ? cs.opacity : null,
        childAnimationName: cs ? cs.animationName : null,
        childAnimationTimeline: cs ? cs.animationTimeline : null,
        childTransform: cs ? cs.transform : null,
        top: rect.top,
        bottom: rect.bottom,
        viewportHeight: window.innerHeight,
      };
    });
  });

  results.push({ engine: engineName, elements: data });
  console.log(`[${engineName}] ${JSON.stringify(data)}`);

  await context.close();
  await browser.close();
}

console.log("SUMMARY " + JSON.stringify(results));
console.log("DONE");
