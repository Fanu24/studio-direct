import { chromium } from "@playwright/test";
const BASE = "http://localhost:3100";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
const page = await context.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
const info = await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll(".board-tr"));
  for (const row of rows) {
    const text = row.textContent || "";
    if (!text.includes("New York City Metropolitan Area")) continue;
    const titleEl = row.querySelector(".board-row__title");
    const locEl = row.querySelector(".board-loc__text");
    const titleRect = titleEl.getBoundingClientRect();
    const locRect = locEl ? locEl.getBoundingClientRect() : null;
    const titleStyle = getComputedStyle(titleEl);
    return {
      fullTitleText: titleEl.textContent,
      titleRect: { width: titleRect.width, height: titleRect.height },
      titleOverflow: titleStyle.overflow,
      titleWebkitLineClamp: titleStyle.webkitLineClamp,
      titleDisplay: titleStyle.display,
      titleFontSize: titleStyle.fontSize,
      titleLineHeight: titleStyle.lineHeight,
      locText: locEl ? locEl.textContent : null,
      locRect: locRect ? { width: locRect.width, height: locRect.height } : null,
      locOverflow: locEl ? getComputedStyle(locEl).textOverflow : null,
    };
  }
  return null;
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
