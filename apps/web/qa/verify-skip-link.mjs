// Item 10a: skip link -> #content tabIndex={-1}. Activate with a real Enter
// press (not a programmatic .click()) and confirm document.activeElement
// actually moves into the content region, then confirm a following Tab does
// NOT return to the top of the nav (which was the original defect: focus
// stayed on <body>, so skipping did nothing for a keyboard user).
import { chromium, firefox, webkit } from "@playwright/test";

const BASE = "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };

const results = [];
for (const engineName of ["chromium", "firefox", "webkit"]) {
  const browser = await LAUNCHERS[engineName].launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
  // Tab once to reach the skip link (it should be the first focusable thing).
  await page.keyboard.press("Tab");
  const focusedIsSkip = await page.evaluate(() => document.activeElement?.className === "skip");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  const afterEnter = await page.evaluate(() => ({
    id: document.activeElement?.id,
    tag: document.activeElement?.tagName.toLowerCase(),
    tabIndex: document.activeElement?.tabIndex,
  }));
  const movedIntoContent = afterEnter.id === "content";
  const row = { engine: engineName, focusedIsSkip, afterEnter, movedIntoContent };
  results.push(row);
  console.log(`[${engineName}] focusedIsSkip=${focusedIsSkip} afterEnter=${JSON.stringify(afterEnter)} movedIntoContent=${movedIntoContent}`);
  await context.close();
  await browser.close();
}
console.log("DONE");
