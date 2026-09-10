// QA scratch script (motion dimension). Real DOM .m-sheen element count per
// template (chromium — SSR markup is identical across engines so one engine
// suffices for a DOM-element count; the raw-grep count is inflated by the
// duplicated RSC flight-data payload Next.js streams for hydration).
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import templates from "./templates.mjs";

const BASE = "http://localhost:3100";
const results = [];
const browser = await chromium.launch();
for (const t of templates) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  let row = { template: t.id, url: t.url };
  try {
    const resp = await page.goto(BASE + t.url, { waitUntil: "networkidle", timeout: 30000 });
    row.status = resp ? resp.status() : null;
    row.sheenDomCount = await page.evaluate(() => document.querySelectorAll(".m-sheen").length);
  } catch (err) {
    row.error = String(err && err.message ? err.message : err);
  } finally {
    await context.close();
  }
  results.push(row);
  console.log(`${t.id}: status=${row.status} sheenDomCount=${row.sheenDomCount}`);
}
await browser.close();

await writeFile(
  "C:\\Users\\dotat\\AppData\\Local\\Temp\\claude\\C--Users-dotat-Desktop-Saas-JOBS\\38b76097-e9bb-4f59-84c9-360866c2e361\\scratchpad\\test4-sheen-results.json",
  JSON.stringify(results, null, 2),
);
console.log("DONE");
