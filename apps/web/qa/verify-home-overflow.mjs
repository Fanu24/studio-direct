// Item 2 headline claim: home page overflow at 360x740 and 390x844 on all
// three engines, using the harness's proven overflowPx().
import { chromium, firefox, webkit } from "@playwright/test";
import { overflowPx } from "./harness.mjs";

const BASE = "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };
const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: "390x844", width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
];

for (const engineName of ["chromium", "firefox", "webkit"]) {
  const browser = await LAUNCHERS[engineName].launch();
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
      hasTouch: vp.hasTouch,
      ...(engineName === "chromium" ? { isMobile: vp.isMobile } : {}),
    });
    const page = await context.newPage();
    await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
    const overflow = await overflowPx(page);
    console.log(`[${engineName}] ${vp.name}: home overflowPx = ${overflow}`);
    await context.close();
  }
  await browser.close();
}
console.log("DONE");
