import { chromium } from "@playwright/test";
const BASE = "http://localhost:3100";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
const page = await context.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });

const info = await page.evaluate(() => {
  const sectionsHost = document.querySelector(".home-sections");
  const kids = sectionsHost ? Array.from(sectionsHost.children) : [];
  const results = kids.map((el, i) => {
    const r = el.getBoundingClientRect();
    return { i, cls: el.className.slice(0,60), width: Math.round(r.width) };
  });
  return { hostWidth: sectionsHost ? Math.round(sectionsHost.getBoundingClientRect().width) : null, kidsCount: kids.length, results };
});
console.log(JSON.stringify(info, null, 2));

// Now bisect by hiding each child and re-measuring document.scrollWidth
const bisect = await page.evaluate(() => {
  const d = document.documentElement;
  const sectionsHost = document.querySelector(".home-sections");
  const kids = Array.from(sectionsHost.children);
  const out = [];
  for (const k of kids) {
    const prevDisplay = k.style.display;
    k.style.display = "none";
    // force reflow
    void d.offsetWidth;
    out.push({ cls: k.className.slice(0,60), scrollWidthWithoutThis: d.scrollWidth });
    k.style.display = prevDisplay;
  }
  void d.offsetWidth;
  return { baselineScrollWidth: d.scrollWidth, out };
});
console.log(JSON.stringify(bisect, null, 2));
await browser.close();
