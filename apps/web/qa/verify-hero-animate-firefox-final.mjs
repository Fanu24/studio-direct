import { firefox } from "@playwright/test";
const BASE = "http://localhost:3100";
const browser = await firefox.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1500);
const finals = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll(".home-hero.m-reveal--now, .home-hero .m-reveal--now"));
  return els.map((el) => ({ cls: el.className.slice(0,50), opacity: getComputedStyle(el).opacity }));
});
console.log(JSON.stringify(finals, null, 2));
await browser.close();
