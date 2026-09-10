import { chromium } from "@playwright/test";
import { smallTargets } from "./harness.mjs";

const BASE = "http://localhost:3100";
const PAGES = ["/web3-salaries", "/web3-non-tech-salaries", "/web3-salaries/scala-developer"];
const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "1440x900", width: 1440, height: 900 },
];

const browser = await chromium.launch();
for (const pagePath of PAGES) {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    await page.goto(BASE + pagePath, { waitUntil: "networkidle", timeout: 30000 });
    const small = await smallTargets(page, 24);
    console.log(`\n=== ${pagePath} ${vp.name} (n=${small.length}) ===`);
    for (const s of small) console.log(`  ${s.tag} "${s.text}" ${s.width}x${s.height}`);

    // Also dump every seniority-word-bearing element regardless of class, to
    // make sure no chip variant is missed by class-name guessing.
    const seniority = await page.evaluate(() => {
      const words = ["Intern", "Junior", "Mid", "Mid-level", "Senior", "Lead", "Staff", "Principal"];
      const all = Array.from(document.querySelectorAll("body *")).filter((el) => {
        const t = (el.textContent || "").trim();
        return words.includes(t) && el.children.length === 0;
      });
      return all.map((el) => {
        const r = el.getBoundingClientRect();
        return { tag: el.tagName.toLowerCase(), cls: el.className, text: el.textContent.trim(), width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10 };
      });
    });
    console.log(`  --- seniority-text elements (${seniority.length}) ---`);
    for (const s of seniority) console.log(`  ${s.tag}.${s.cls} "${s.text}" ${s.width}x${s.height}`);

    await context.close();
  }
}
await browser.close();
console.log("\nDONE");
