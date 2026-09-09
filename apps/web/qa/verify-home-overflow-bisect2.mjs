import { chromium } from "@playwright/test";
const BASE = "http://localhost:3100";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
const page = await context.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });

const results = await page.evaluate(() => {
  const sections = Array.from(document.querySelectorAll(".home-sections > .home-section"));
  const prevDisplay = sections.map((s) => s.style.display);
  const out = [];
  for (let idx = 0; idx < sections.length; idx++) {
    sections.forEach((s, i) => {
      s.style.display = i === idx ? "" : "none";
    });
    const el = sections[idx];
    const rect = el.getBoundingClientRect();
    const clientWidth = document.documentElement.clientWidth;
    out.push({
      index: idx,
      className: el.className,
      text: (el.querySelector("h2, h3")?.textContent || "").trim().slice(0, 40),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      width: Math.round(rect.width),
      exceedsViewport: rect.right - clientWidth,
    });
  }
  sections.forEach((s, i) => {
    s.style.display = prevDisplay[i];
  });
  return out;
});
console.log(JSON.stringify(results, null, 2));
await browser.close();
