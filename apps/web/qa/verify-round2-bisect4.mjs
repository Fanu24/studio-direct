import { chromium } from "@playwright/test";
const BASE = "http://localhost:3100";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
const page = await context.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });

const info = await page.evaluate(() => {
  const reviews = document.querySelector(".home-reviews");
  const carousel = document.querySelector(".home-reviews__carousel");
  const track = document.querySelector(".home-reviews__track");
  const rect = (el) => { const r = el.getBoundingClientRect(); return { width: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right) }; };
  const cs = (el, prop) => getComputedStyle(el)[prop];

  const clone = {};
  // Measure min-content width of .home-reviews itself
  const origWidth = reviews.style.width;
  reviews.style.width = "min-content";
  void document.documentElement.offsetWidth;
  const minContentWidth = Math.round(reviews.getBoundingClientRect().width);
  reviews.style.width = origWidth;

  return {
    reviews: { ...rect(reviews), minWidthCss: cs(reviews, "minWidth"), width: cs(reviews,"width"), minContentWidth },
    carousel: { ...rect(carousel), minWidthCss: cs(carousel, "minWidth"), maxWidthCss: cs(carousel, "maxWidth"), overflowCss: cs(carousel,"overflow") },
    track: { ...rect(track), display: cs(track, "display") },
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
