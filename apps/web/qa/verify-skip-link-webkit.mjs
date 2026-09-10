import { webkit } from "@playwright/test";
const BASE = "http://localhost:3100";
const browser = await webkit.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
// WebKit's default Tab order (matching real Safari) excludes plain <a> links
// unless "Full Keyboard Access" is on. Focus the skip link directly (as a
// screen-reader / full-keyboard-access user would reach it) then press a
// REAL Enter key - this still tests the fix (the href="#content" + tabIndex
// handoff), just not via Tab, which WebKit does not route through links here.
await page.evaluate(() => document.querySelector(".skip").focus());
const focusedIsSkip = await page.evaluate(() => document.activeElement?.className === "skip");
await page.keyboard.press("Enter");
await page.waitForTimeout(150);
const afterEnter = await page.evaluate(() => ({
  id: document.activeElement?.id,
  tag: document.activeElement?.tagName.toLowerCase(),
}));
console.log("focusedIsSkip:", focusedIsSkip, "afterEnter:", JSON.stringify(afterEnter));
await browser.close();
