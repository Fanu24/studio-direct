// QA scratch diagnostic (not a fix): inspect why 4 .m-reveal elements on
// /web3-salaries stay at opacity 0 after scrolling to the bottom, reported by
// verify-reveal-firefox.mjs on all three engines.
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3100";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(BASE + "/web3-salaries", { waitUntil: "networkidle", timeout: 30000 });
await page.click("body");
await page.keyboard.press("End");
await page.waitForTimeout(2000);

const data = await page.evaluate(() => {
  const sels = [
    "div.panel.panel--tight.panel--accent.m-reveal",
    "div.panel.panel--tight.panel--cool.m-reveal",
    "div.board.m-reveal",
    "section.container.jobs-more.m-reveal",
  ];
  return sels.map((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { sel, found: false };
    const s = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const docHeight = document.documentElement.scrollHeight;
    const scrollY = window.scrollY;
    return {
      sel,
      found: true,
      opacity: s.opacity,
      animationName: s.animationName,
      animationTimeline: s.animationTimeline,
      animationPlayState: s.animationPlayState,
      display: s.display,
      visibility: s.visibility,
      contentVisibility: s.contentVisibility,
      absoluteTop: rect.top + scrollY,
      rectTop: rect.top,
      rectHeight: rect.height,
      docScrollHeight: docHeight,
      currentScrollY: scrollY,
      isIn: el.classList.contains("is-in"),
      dataReveal: el.getAttribute("data-reveal"),
      dataRevealDelay: el.getAttribute("data-reveal-delay"),
      parentOverflow: el.parentElement ? getComputedStyle(el.parentElement).overflow : null,
    };
  });
});

console.log(JSON.stringify(data, null, 2));
await context.close();
await browser.close();
