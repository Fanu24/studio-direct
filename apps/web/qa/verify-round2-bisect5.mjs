import { chromium } from "@playwright/test";
const BASE = "http://localhost:3100";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
const page = await context.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });

const info = await page.evaluate(() => {
  const reviews = document.querySelector(".home-reviews");
  function minContentOf(el) {
    if (!el) return null;
    const orig = el.style.width;
    el.style.width = "min-content";
    void document.documentElement.offsetWidth;
    const w = Math.round(el.getBoundingClientRect().width);
    el.style.width = orig;
    return w;
  }
  const h2 = reviews.querySelector("h2");
  const note = reviews.querySelector(".home-reviews__note");
  const carousel = reviews.querySelector(".home-reviews__carousel");
  const track = reviews.querySelector(".home-reviews__track");
  const slides = Array.from(reviews.querySelectorAll(".home-reviews__slide"));
  const controls = reviews.querySelector(".home-reviews__controls");

  // remove carousel from flow entirely and measure .home-reviews min-content
  const carouselDisplay = carousel.style.display;
  carousel.style.display = "none";
  void document.documentElement.offsetWidth;
  const reviewsMinContentWithoutCarousel = minContentOf(reviews);
  carousel.style.display = carouselDisplay;

  return {
    h2MinContent: minContentOf(h2),
    noteMinContent: minContentOf(note),
    carouselMinContent: minContentOf(carousel),
    trackMinContent: minContentOf(track),
    slideMinContents: slides.map(s => minContentOf(s)),
    controlsMinContent: controls ? minContentOf(controls) : null,
    reviewsMinContentWithoutCarousel,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
