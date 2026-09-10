// Item 6: prefers-reduced-motion: reduce must resolve to visible on all three
// engines, including Firefox where the reduce block's .m-reveal specificity
// used to lose to .m-reveal[data-reveal]:not(.is-in). Checks both on-load AND
// after a real scroll-to-bottom (using the completion condition, not a fixed
// sleep), and confirms the marquee is stopped (no running animation).
import { chromium, firefox, webkit } from "@playwright/test";
import templates from "./templates.mjs";

const BASE = "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };
const sample = templates.filter((t) =>
  ["home", "job-detail", "pricing", "editorial-article", "funnel-seller-page", "rankings", "company-detail"].includes(
    t.id,
  ),
);

async function scrollToBottom(page) {
  await page.click("body").catch(() => {});
  await page.keyboard.press("End").catch(() => {});
  await page
    .waitForFunction(
      () => {
        const d = document.documentElement;
        return Math.abs(d.scrollTop + d.clientHeight - d.scrollHeight) < 5;
      },
      { timeout: 6000 },
    )
    .catch(() => {});
  await page.waitForTimeout(300);
}

async function measure(page) {
  return page.evaluate(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = Array.from(document.querySelectorAll(".m-reveal, .m-count > *"));
    const bad = [];
    for (const el of els) {
      const s = getComputedStyle(el);
      const op = parseFloat(s.opacity);
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (op < 0.999) {
        bad.push({ cls: typeof el.className === "string" ? el.className.slice(0, 70) : "", opacity: op });
      }
    }
    const marquees = Array.from(document.querySelectorAll(".m-marquee > *, .marquee__track"));
    const marqueeStates = marquees.map((m) => {
      const s = getComputedStyle(m);
      return { animationName: s.animationName, animationDuration: s.animationDuration };
    });
    const runningMarquees = marqueeStates.filter((m) => m.animationName !== "none" && m.animationDuration !== "0s");
    return { mq, totalReveal: els.length, badCount: bad.length, bad: bad.slice(0, 10), marqueeCount: marquees.length, runningMarquees };
  });
}

const results = [];
for (const engineName of ["chromium", "firefox", "webkit"]) {
  const browser = await LAUNCHERS[engineName].launch();
  for (const t of sample) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    let row = { engine: engineName, template: t.id };
    try {
      await page.goto(BASE + t.url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(200);
      const onLoad = await measure(page);
      await scrollToBottom(page);
      const afterScroll = await measure(page);
      row.onLoad = onLoad;
      row.afterScroll = afterScroll;
    } catch (err) {
      row.error = String(err && err.message ? err.message : err);
    } finally {
      await context.close();
    }
    results.push(row);
    console.log(
      `[${engineName}] ${t.id}: mq=${row.onLoad?.mq} onLoadBad=${row.onLoad?.badCount} afterScrollBad=${row.afterScroll?.badCount} runningMarquees=${row.afterScroll?.runningMarquees?.length}`,
    );
  }
  await browser.close();
}
console.log("DONE");
