import { chromium } from "@playwright/test";
const BASE = "http://localhost:3100";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
const page = await context.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });

const before = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// Hypothesis A: add min-width:0 to the generic .home-section rule (grid item of .home-sections)
const afterA = await page.evaluate(() => {
  const style = document.createElement("style");
  style.textContent = ".home-section { min-width: 0; }";
  document.head.appendChild(style);
  void document.documentElement.offsetWidth;
  const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  style.remove();
  return overflow;
});

// Hypothesis B: add min-width:0 to .home-reviews only (grid item of .container)
const afterB = await page.evaluate(() => {
  const style = document.createElement("style");
  style.textContent = ".home-reviews { min-width: 0; }";
  document.head.appendChild(style);
  void document.documentElement.offsetWidth;
  const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  style.remove();
  return overflow;
});

// Hypothesis C: both
const afterC = await page.evaluate(() => {
  const style = document.createElement("style");
  style.textContent = ".home-section, .home-reviews { min-width: 0; }";
  document.head.appendChild(style);
  void document.documentElement.offsetWidth;
  const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  style.remove();
  return overflow;
});

console.log({ before, afterA_sectionFix: afterA, afterB_reviewsFix: afterB, afterC_both: afterC });
await browser.close();
