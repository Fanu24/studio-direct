// QA scratch script (motion dimension) — not part of the harness contract.
// Central question: after scrolling to the bottom, is any .m-reveal element left
// invisible (opacity 0) or translated off position, on chromium/firefox/webkit,
// with JS enabled? Runs across all 21 templates.
import { chromium, firefox, webkit } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import templates from "./templates.mjs";

const BASE = "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };
const engines = ["chromium", "firefox", "webkit"];
const results = [];

for (const engineName of engines) {
  const browser = await LAUNCHERS[engineName].launch();
  for (const t of templates) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    let row = { engine: engineName, template: t.id, url: t.url };
    try {
      const resp = await page.goto(BASE + t.url, { waitUntil: "networkidle", timeout: 30000 });
      row.status = resp ? resp.status() : null;
      await page.evaluate(async () => {
        const step = () => new Promise((r) => requestAnimationFrame(r));
        let last = -1;
        for (let i = 0; i < 60; i++) {
          window.scrollTo(0, document.body.scrollHeight);
          await step();
          await new Promise((r) => setTimeout(r, 40));
          if (window.scrollY === last) break;
          last = window.scrollY;
        }
      });
      await page.waitForTimeout(600);
      const bad = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll(".m-reveal, .m-count"));
        const out = [];
        for (const el of els) {
          const s = getComputedStyle(el);
          const op = parseFloat(s.opacity);
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          const transform = s.transform;
          let translated = false;
          if (transform && transform !== "none" && /matrix/.test(transform)) {
            const m = transform.match(/matrix\(([^)]+)\)/);
            if (m) {
              const parts = m[1].split(",").map(Number);
              const ty = parts[5];
              translated = Math.abs(ty) > 4;
            }
          }
          if (op < 0.98 || translated) {
            out.push({
              tag: el.tagName.toLowerCase(),
              className: typeof el.className === "string" ? el.className.slice(0, 80) : "",
              text: (el.textContent || "").trim().slice(0, 60),
              opacity: op,
              transform,
              translated,
            });
          }
        }
        return out;
      });
      row.totalRevealEls = await page.evaluate(() => document.querySelectorAll(".m-reveal, .m-count").length);
      row.stuckCount = bad.length;
      row.stuck = bad.slice(0, 10);
    } catch (err) {
      row.error = String(err && err.message ? err.message : err);
    } finally {
      await context.close();
    }
    results.push(row);
    console.log(`[${engineName}] ${t.id}: total=${row.totalRevealEls ?? "?"} stuck=${row.stuckCount ?? "ERR"}`);
  }
  await browser.close();
}

await writeFile(
  "C:\\Users\\dotat\\AppData\\Local\\Temp\\claude\\C--Users-dotat-Desktop-Saas-JOBS\\38b76097-e9bb-4f59-84c9-360866c2e361\\scratchpad\\test1-results.json",
  JSON.stringify(results, null, 2),
);
console.log("DONE");
