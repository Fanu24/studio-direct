import { chromium } from "@playwright/test";
const BASE = "http://localhost:3100";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
const page = await context.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });

const info = await page.evaluate(() => {
  const d = document.documentElement;
  const results = [];
  // Walk all elements in body, find any whose right edge exceeds viewport width
  const vw = d.clientWidth;
  const all = document.body.querySelectorAll("*");
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.width > vw + 1) {
      results.push({
        tag: el.tagName,
        cls: typeof el.className === "string" ? el.className.slice(0,80) : "",
        right: Math.round(r.right),
        width: Math.round(r.width),
        left: Math.round(r.left),
      });
    }
  }
  return { vw, scrollWidth: d.scrollWidth, clientWidth: d.clientWidth, offenders: results.slice(0, 40) };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
