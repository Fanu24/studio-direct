// Item 8: home sections with data-reveal-delay 4-12 must actually reveal.
// Chromium/WebKit use the CSS view()-timeline path (animation-range shared
// across 6-12); Firefox uses RevealObserver + the transition fallback with
// explicit per-level transition-delay up to 540ms. Scroll to bottom on all
// three and confirm every level 4-12 section is at opacity 1.
import { chromium, firefox, webkit } from "@playwright/test";

const BASE = "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };

async function scrollToBottomAndSettle(page) {
  await page.click("body");
  await page.keyboard.press("End");
  await page
    .waitForFunction(() => {
      const d = document.documentElement;
      return Math.abs(d.scrollTop + d.clientHeight - d.scrollHeight) < 5;
    }, { timeout: 8000 })
    .catch(() => {});
  await page
    .waitForFunction(() => {
      const els = Array.from(document.querySelectorAll("[data-reveal-delay]"));
      return els.every((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return true;
        return parseFloat(getComputedStyle(el).opacity) >= 0.999;
      });
    }, { timeout: 5000 })
    .catch(() => {});
}

const results = [];
for (const engineName of ["chromium", "firefox", "webkit"]) {
  const browser = await LAUNCHERS[engineName].launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
  await scrollToBottomAndSettle(page);
  const data = await page.evaluate(() => {
    const out = [];
    for (let level = 1; level <= 12; level++) {
      const el = document.querySelector(`[data-reveal-delay="${level}"]`);
      if (!el) {
        out.push({ level, found: false });
        continue;
      }
      const s = getComputedStyle(el);
      out.push({ level, found: true, opacity: parseFloat(s.opacity), isIn: el.classList.contains("is-in") });
    }
    return out;
  });
  results.push({ engine: engineName, data });
  console.log(`[${engineName}]`, data.map((d) => `${d.level}:${d.found ? d.opacity : "MISSING"}`).join(" "));
  await context.close();
  await browser.close();
}
console.log("DONE");
