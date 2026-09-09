// Item 10b: mobile menu focus trap. Open it at 390px and Tab at least 30
// times; focus must never reach a control behind the overlay (i.e. never
// leave the toggle + the sheet's own focusable elements).
import { chromium, firefox, webkit } from "@playwright/test";

const BASE = "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };

async function run(engineName) {
  const browser = await LAUNCHERS[engineName].launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    ...(engineName === "chromium" ? { isMobile: true } : {}),
  });
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });

  // Open the menu via its button.
  await page.click(".menu-button");
  await page.waitForTimeout(150);
  const isOpen = await page.evaluate(() => document.getElementById("mobile-menu")?.hidden === false);

  // Focus the toggle explicitly, then compute the legit "inside" set (toggle
  // + everything focusable inside the sheet), matching the component's own
  // definition, for an independent check against what we observe.
  const legitSet = await page.evaluate(() => {
    const toggle = document.querySelector(".menu-button");
    const panel = document.getElementById("mobile-menu");
    const stops = [
      toggle,
      ...panel.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((n) => n && n.offsetParent !== null);
    return stops.map((n) => n.outerHTML.slice(0, 60));
  });

  await page.evaluate(() => document.querySelector(".menu-button").focus());

  const path = [];
  for (let i = 0; i < 35; i++) {
    await page.keyboard.press("Tab");
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
  const escaped = path.some((p) => p && !p.insidePanelOrToggle);
  await context.close();
  await browser.close();
  return { engine: engineName, isOpen, legitCount: legitSet.length, escaped, path };
}

for (const engine of ["chromium", "firefox", "webkit"]) {
  const r = await run(engine);
  console.log(
    `[${r.engine}] menuOpen=${r.isOpen} legitStops=${r.legitCount} escapedOverlay=${r.escaped}`,
  );
  if (r.escaped) {
    console.log("  ESCAPE PATH:", JSON.stringify(r.path, null, 2));
  }
}
console.log("DONE");
