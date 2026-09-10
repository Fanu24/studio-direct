/**
 * Minimal round-2 confirmation. The full matrix version exhausted this machine's
 * memory when it was accidentally run twice at once, so this checks only the
 * items that were still open, one engine at a time, closing each browser before
 * opening the next.
 *
 * Overflow is scrollWidth - clientWidth on documentElement: innerWidth reports
 * the visual viewport under mobile emulation and makes the subtraction zero.
 */
import { chromium, firefox, webkit } from "@playwright/test";

const BASE = "http://localhost:3100";
const out = [];

for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch();

  for (const w of [360, 390]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 740 } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "load", timeout: 60000 });
    const px = await page.evaluate(() => {
      const d = document.documentElement;
      return d.scrollWidth - d.clientWidth;
    });
    out.push({ check: "home overflow", engine: name, viewport: w, px });
    await ctx.close();
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/web3-salaries", { waitUntil: "load", timeout: 60000 });
    const small = await page.evaluate(() => {
      const hits = [];
      for (const el of document.querySelectorAll("a[href]")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.height >= 24) continue;
        hits.push({
          h: Math.round(r.height * 10) / 10,
          cls: (el.className || "").toString().slice(0, 40),
          parent: (el.parentElement?.className || "").toString().slice(0, 40),
        });
      }
      return hits;
    });
    out.push({
      check: "salary sub-24 links",
      engine: name,
      count: small.length,
      sample: small.slice(0, 4),
    });
    await ctx.close();
  }

  await browser.close();
}

for (const row of out) console.log(JSON.stringify(row));
