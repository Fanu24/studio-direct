import { chromium } from "@playwright/test";
const BASE = "http://localhost:3100";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
const page = await context.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });

const info = await page.evaluate(() => {
  const sectionsHost = document.querySelector(".home-sections");
  const kids = Array.from(sectionsHost.children);
  const target = kids[9];
  return {
    outerHTMLStart: target.outerHTML.slice(0, 400),
    id: target.id,
    dataAttrs: Array.from(target.attributes).map(a => `${a.name}=${a.value}`),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
