import { chromium } from "@playwright/test";
import { overflowPx } from "./harness.mjs";
const BASE = "http://localhost:3100";
const browser = await chromium.launch();
for (const width of [320, 340, 355, 360, 375, 390, 400, 410]) {
  const context = await browser.newContext({ viewport: { width, height: 800 } });
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
  const overflow = await overflowPx(page);
  console.log(width, "->", overflow);
  await context.close();
}
await browser.close();
