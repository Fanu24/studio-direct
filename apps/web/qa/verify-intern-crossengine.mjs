import { chromium, firefox, webkit } from "@playwright/test";
const LAUNCHERS = { chromium, firefox, webkit };
for (const name of ["chromium", "firefox", "webkit"]) {
  const browser = await LAUNCHERS[name].launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("http://localhost:3100/web3-salaries", { waitUntil: "networkidle", timeout: 30000 });
  const info = await page.evaluate(() => {
    const el = document.querySelector(".salary-line__label a");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { width: Math.round(r.width*10)/10, height: Math.round(r.height*10)/10, display: cs.display, minHeight: cs.minHeight };
  });
  console.log(`[${name}] .salary-line__label a:`, JSON.stringify(info));
  await context.close();
  await browser.close();
}
