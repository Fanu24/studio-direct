// Item 7: home hero .m-reveal--now elements must settle at opacity 1 on all
// three engines AND actually animate (not just appear at 1 statically). We
// sample opacity via an in-page rAF loop (no Playwright IPC round-trip lag)
// starting immediately after navigation, so we can catch the animation
// mid-flight before it completes.
import { chromium, firefox, webkit } from "@playwright/test";

const BASE = "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };

async function sample(page) {
  return page.evaluate(() => {
    return new Promise((resolve) => {
      const els = Array.from(document.querySelectorAll(".home-hero.m-reveal--now, .home-hero .m-reveal--now"));
      const series = els.map(() => []);
      let frames = 0;
      function tick() {
        els.forEach((el, i) => series[i].push(parseFloat(getComputedStyle(el).opacity)));
        frames++;
        if (frames < 80) {
          requestAnimationFrame(tick);
        } else {
          resolve({
            count: els.length,
            classes: els.map((el) => el.className.slice(0, 60)),
            series,
          });
        }
      }
      requestAnimationFrame(tick);
    });
  });
}

const results = [];
for (const engineName of ["chromium", "firefox", "webkit"]) {
  const browser = await LAUNCHERS[engineName].launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  const data = await sample(page);
  const finals = data.series.map((s) => s[s.length - 1]);
  const mins = data.series.map((s) => Math.min(...s));
  const animated = mins.map((m, i) => m < 0.98);
  results.push({ engine: engineName, count: data.count, classes: data.classes, finals, mins, animated });
  console.log(
    `[${engineName}] count=${data.count} finals=${JSON.stringify(finals)} mins=${JSON.stringify(mins.map((m) => Math.round(m * 100) / 100))} animated=${JSON.stringify(animated)}`,
  );
  await context.close();
  await browser.close();
}
console.log("DONE");
