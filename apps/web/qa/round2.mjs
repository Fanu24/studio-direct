/**
 * Round 2 verification, run by the coordinator.
 *
 * Three items that the first verification round found still open:
 *   1. Homepage horizontal overflow at 360 and 390, plus a sweep of every
 *      template for the same automatic-minimum class of bug.
 *   2. Sub-24px tap targets on the salary pages.
 *   3. The mobile menu focus trap, which failed on WebKit because that engine's
 *      default tab order skips plain links, so the boundary the trap waited for
 *      never arrived.
 *
 * Measures, never assumes: overflow is read as scrollWidth - clientWidth against
 * documentElement, because innerWidth reports the visual viewport under mobile
 * emulation and makes the subtraction identically zero.
 */
import { chromium, firefox, webkit } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3100";
const ENGINES = { chromium, firefox, webkit };

const templates = JSON.parse(
  readFileSync(new URL("./out/template-urls.json", import.meta.url), "utf8"),
);

const VIEWPORTS = [
  { w: 360, h: 740, mobile: true },
  { w: 390, h: 844, mobile: true },
  { w: 768, h: 1024, mobile: true },
  { w: 1024, h: 768, mobile: false },
  { w: 1440, h: 900, mobile: false },
  { w: 1920, h: 1080, mobile: false },
];

const overflowOf = (page) =>
  page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth - d.clientWidth;
  });

/** Which element's automatic minimum is pushing the page open, if any. */
const blameOverflow = (page) =>
  page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const guilty = [];
    for (const el of document.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.right <= limit + 1) continue;
      // An element past the edge is normal when an ancestor clips or scrolls it.
      let clipped = false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p);
        if (/(hidden|auto|scroll|clip)/.test(o.overflowX)) {
          clipped = true;
          break;
        }
      }
      if (clipped) continue;
      guilty.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || "").toString().slice(0, 80),
        right: Math.round(r.right),
        minWidth: getComputedStyle(el).minWidth,
      });
    }
    return guilty.slice(0, 5);
  });

const smallTargets = (page, min) =>
  page.evaluate((floor) => {
    const hits = [];
    for (const el of document.querySelectorAll("a[href], button:not([disabled])")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height >= floor && r.width >= floor) continue;
      hits.push({
        cls: (el.className || "").toString().slice(0, 60),
        h: Math.round(r.height * 10) / 10,
        w: Math.round(r.width * 10) / 10,
      });
    }
    return hits;
  }, min);

const results = { overflow: [], targets: [], trap: [] };

for (const [name, engine] of Object.entries(ENGINES)) {
  const browser = await engine.launch();

  // --- 1. overflow across every template and viewport -----------------------
  for (const t of templates) {
    for (const v of VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: v.w, height: v.h },
        isMobile: v.mobile && name === "chromium",
        hasTouch: v.mobile,
        deviceScaleFactor: v.mobile ? 3 : 1,
      });
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + t.url, { waitUntil: "load", timeout: 45000 });
        const px = await overflowOf(page);
        if (px > 0) {
          results.overflow.push({
            engine: name,
            template: t.id,
            url: t.url,
            viewport: `${v.w}x${v.h}`,
            px,
            blame: await blameOverflow(page),
          });
        }
      } catch (error) {
        results.overflow.push({
          engine: name,
          template: t.id,
          url: t.url,
          viewport: `${v.w}x${v.h}`,
          error: String(error).slice(0, 140),
        });
      }
      await ctx.close();
    }
  }

  // --- 2. tap targets on the salary pages ----------------------------------
  for (const url of ["/web3-salaries", "/web3-non-tech-salaries"]) {
    for (const v of VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: v.w, height: v.h },
        hasTouch: v.mobile,
      });
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + url, { waitUntil: "load", timeout: 45000 });
        const hits = await smallTargets(page, 24);
        results.targets.push({
          engine: name,
          url,
          viewport: `${v.w}x${v.h}`,
          count: hits.length,
          sample: hits.slice(0, 6),
        });
      } catch (error) {
        results.targets.push({ engine: name, url, error: String(error).slice(0, 140) });
      }
      await ctx.close();
    }
  }

  // --- 3. the focus trap ----------------------------------------------------
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + "/", { waitUntil: "load", timeout: 45000 });
      await page.click(".menu-button");
      await page.waitForTimeout(400);

      const walk = async (key, presses) => {
        const seen = [];
        for (let i = 0; i < presses; i += 1) {
          await page.keyboard.press(key);
          await page.waitForTimeout(40);
          seen.push(
            await page.evaluate(() => {
              const a = document.activeElement;
              if (!a) return "none";
              const inSheet = !!a.closest("#mobile-menu");
              const isToggle = a.classList.contains("menu-button");
              return `${inSheet || isToggle ? "IN" : "ESCAPED"}:${a.tagName.toLowerCase()}.${(a.className || "").toString().slice(0, 30)}`;
            }),
          );
        }
        return seen;
      };

      const forward = await walk("Tab", 35);
      const backward = await walk("Shift+Tab", 35);

      // Escape closes and returns focus to the toggle.
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      const afterEscape = await page.evaluate(() => ({
        open: document.querySelector("#mobile-menu")?.hasAttribute("hidden") === false,
        onToggle: document.activeElement?.classList.contains("menu-button") ?? false,
      }));

      // A trap that captures focus but prevents using it is worse than the bug.
      await page.click(".menu-button");
      await page.waitForTimeout(400);
      await page.keyboard.press("Tab");
      await page.waitForTimeout(80);
      await page.keyboard.press("Tab");
      await page.waitForTimeout(80);
      const target = await page.evaluate(() => {
        const a = document.activeElement;
        return a && a.tagName === "A" ? a.getAttribute("href") : null;
      });
      let activated = null;
      if (target) {
        await page.keyboard.press("Enter");
        await page
          .waitForURL((u) => u.pathname !== "/", { timeout: 8000 })
          .then(() => (activated = page.url()))
          .catch(() => (activated = "NO NAVIGATION"));
      }

      results.trap.push({
        engine: name,
        escapedForward: forward.filter((s) => s.startsWith("ESCAPED")).length,
        escapedBackward: backward.filter((s) => s.startsWith("ESCAPED")).length,
        forwardSample: forward.slice(0, 6),
        afterEscape,
        keyboardTarget: target,
        activated,
      });
    } catch (error) {
      results.trap.push({ engine: name, error: String(error).slice(0, 200) });
    }
    await ctx.close();
  }

  await browser.close();
  console.log(`${name} done`);
}

writeFileSync(
  new URL("./out/round2.json", import.meta.url),
  JSON.stringify(results, null, 2),
);

console.log("\n=== OVERFLOW (only non-zero rows) ===");
console.log(results.overflow.length === 0 ? "none, all templates, all viewports, all engines" : JSON.stringify(results.overflow, null, 2));
console.log("\n=== SALARY TAP TARGETS ===");
for (const r of results.targets) {
  console.log(`${r.engine} ${r.url} ${r.viewport}: ${r.count}`, r.count ? JSON.stringify(r.sample) : "");
}
console.log("\n=== FOCUS TRAP ===");
console.log(JSON.stringify(results.trap, null, 2));
