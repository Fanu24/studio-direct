// Diagnostic: does the "stuck at partial opacity" result from test1 survive a
// realistic single smooth scroll-to-bottom (End key, respecting the site's
// `html { scroll-behavior: smooth }`), or was it an artifact of test1's
// scrollTo() being re-issued every 40ms (fighting its own smooth-scroll)?
import { chromium, firefox, webkit } from "@playwright/test";

const BASE = "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };

async function run(engineName) {
  const browser = await LAUNCHERS[engineName].launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
  await page.click("body");
  await page.keyboard.press("End");
  await page.waitForTimeout(4000); // let smooth-scroll + IO callbacks settle
  const atBottom = await page.evaluate(() => {
    const d = document.documentElement;
    return Math.abs(d.scrollTop + d.clientHeight - d.scrollHeight) < 5;
  });
  const bad = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll(".m-reveal, .m-count"));
    const out = [];
    for (const el of els) {
      const s = getComputedStyle(el);
      const op = parseFloat(s.opacity);
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (op < 0.98) {
        out.push({
          className: typeof el.className === "string" ? el.className.slice(0, 80) : "",
          text: (el.textContent || "").trim().slice(0, 50),
          opacity: op,
          isIn: el.classList.contains("is-in"),
        });
      }
    }
    return out;
  });
  console.log(`[${engineName}] atBottom=${atBottom} stuck=${bad.length} ${JSON.stringify(bad)}`);
  await context.close();
  await browser.close();
}

for (const e of ["chromium", "firefox", "webkit"]) {
  await run(e);
}
console.log("DONE");
