// Round 2, item 3: extend verify-mobile-menu-trap.mjs to also cover
// Shift+Tab (reverse cycling), Escape-closes-and-returns-focus, and that a
// focused link inside the sheet can actually be activated by keyboard
// (Enter) - a trap that captures focus but prevents using it is a worse
// defect than the one it replaced, per the task.
import { chromium, firefox, webkit } from "@playwright/test";

const BASE = "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };

async function openMenu(page) {
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
  await page.click(".menu-button");
  await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelector(".menu-button").focus());
}

async function pressAndSample(page, key, times) {
  const path = [];
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key);
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const panel = document.getElementById("mobile-menu");
      const insidePanel = panel ? panel.contains(el) : false;
      const isToggle = el.classList?.contains("menu-button");
      return {
        tag: el.tagName.toLowerCase(),
        cls: typeof el.className === "string" ? el.className.slice(0, 50) : "",
        insidePanelOrToggle: insidePanel || isToggle,
      };
    });
    path.push(info);
  }
  return path;
}

async function run(engineName) {
  const browser = await LAUNCHERS[engineName].launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    ...(engineName === "chromium" ? { isMobile: true } : {}),
  });
  const page = await context.newPage();

  // 1. Shift+Tab x35
  await openMenu(page);
  const shiftPath = await pressAndSample(page, "Shift+Tab", 35);
  const shiftEscaped = shiftPath.some((p) => p && !p.insidePanelOrToggle);

  // 2. Escape closes sheet and returns focus to toggle
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  const afterEscape = await page.evaluate(() => ({
    hidden: document.getElementById("mobile-menu")?.hidden,
    activeIsToggle: document.activeElement?.classList?.contains("menu-button") ?? false,
  }));

  // 3. Keyboard activation: open again, Tab to first real link inside sheet,
  // press Enter, confirm navigation actually happens (URL changes or content
  // updates) - not just that focus can land there.
  await openMenu(page);
  await page.keyboard.press("Tab"); // toggle -> first stop inside sheet
  const firstStop = await page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el?.tagName.toLowerCase(), href: el?.getAttribute?.("href"), text: el?.textContent?.trim().slice(0, 40) };
  });
  let activationResult = null;
  if (firstStop.href) {
    const before = page.url();
    await page.keyboard.press("Enter");
    try {
      await page.waitForURL((url) => url.toString() !== before, { timeout: 5000 });
      activationResult = { navigated: true, from: before, to: page.url() };
    } catch {
      activationResult = { navigated: false, from: before, to: page.url() };
    }
  } else {
    activationResult = { navigated: null, note: "first stop had no href", firstStop };
  }

  await context.close();
  await browser.close();
  return {
    engine: engineName,
    shiftEscaped,
    shiftPath: shiftEscaped ? shiftPath : undefined,
    afterEscape,
    firstStop,
    activationResult,
  };
}

for (const engine of ["chromium", "firefox", "webkit"]) {
  const r = await run(engine);
  console.log(`[${r.engine}] shiftTabEscaped=${r.shiftEscaped} afterEscape=${JSON.stringify(r.afterEscape)} firstStop=${JSON.stringify(r.firstStop)} activation=${JSON.stringify(r.activationResult)}`);
  if (r.shiftEscaped) console.log("  SHIFT-TAB ESCAPE PATH:", JSON.stringify(r.shiftPath, null, 2));
}
console.log("DONE");
