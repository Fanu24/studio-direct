import { chromium } from "@playwright/test";
const BASE = "http://localhost:3100";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
const page = await context.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });

const info = await page.evaluate(() => {
  const slide = document.querySelector(".home-reviews__slide");
  return { html: slide.outerHTML };
});
console.log(info.html);

const info2 = await page.evaluate(() => {
  function minContentOf(el) {
    if (!el) return null;
    const orig = el.style.width;
    el.style.width = "min-content";
    void document.documentElement.offsetWidth;
    const w = Math.round(el.getBoundingClientRect().width);
    el.style.width = orig;
    return w;
  }
  const slide = document.querySelector(".home-reviews__slide");
  const bq = slide.querySelector("blockquote");
  const p = slide.querySelector("blockquote p");
  const footer = slide.querySelector("footer");
  return {
    bqMinContent: minContentOf(bq),
    pMinContent: minContentOf(p),
    footerMinContent: minContentOf(footer),
    pText: p ? p.textContent : null,
    footerText: footer ? footer.textContent : null,
    pWhiteSpace: p ? getComputedStyle(p).whiteSpace : null,
  };
});
console.log(JSON.stringify(info2, null, 2));
await browser.close();
