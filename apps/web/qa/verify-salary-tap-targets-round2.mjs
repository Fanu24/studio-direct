// Round 2, item 2: re-measure small-target count on /web3-salaries,
// /web3-non-tech-salaries and a salary detail page, at all six viewports on
// all three engines, after .salary-chart__label a got display:inline-block,
// min-height:24px, 4px block padding. Also specifically measure seniority
// chips (Intern/Junior/Senior/Lead) mentioned in the prior round as 14px.
import { chromium, firefox, webkit } from "@playwright/test";
import { smallTargets } from "./harness.mjs";

const BASE = "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };
const PAGES = ["/web3-salaries", "/web3-non-tech-salaries", "/web3-salaries/scala-developer"];
const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: "390x844", width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  { name: "768x1024", width: 768, height: 1024, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  { name: "1024x768", width: 1024, height: 768, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: "1440x900", width: 1440, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: "1920x1080", width: 1920, height: 1080, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
];

const results = [];

for (const engineName of ["chromium", "firefox", "webkit"]) {
  const browser = await LAUNCHERS[engineName].launch();
  for (const pagePath of PAGES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.deviceScaleFactor,
        hasTouch: vp.hasTouch,
        ...(engineName === "chromium" ? { isMobile: vp.isMobile } : {}),
      });
      const page = await context.newPage();
      await page.goto(BASE + pagePath, { waitUntil: "networkidle", timeout: 30000 });

      const small = await smallTargets(page, 24);

      // Specifically probe .salary-chart__label a and seniority chips.
      const specific = await page.evaluate(() => {
        function rect(el) {
          const r = el.getBoundingClientRect();
          return { width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10 };
        }
        const chartLabels = Array.from(document.querySelectorAll(".salary-chart__label a")).map((el) => ({
          text: (el.textContent || "").trim().slice(0, 30),
          ...rect(el),
        }));
        // seniority chips: look for elements whose text matches known seniority words
        const seniorityWords = ["Intern", "Junior", "Mid", "Senior", "Lead", "Staff", "Principal"];
        const chipCandidates = Array.from(document.querySelectorAll("[class*='chip'], [class*='seniority'], [class*='pill'], [class*='badge']"))
          .filter((el) => seniorityWords.some((w) => (el.textContent || "").trim() === w))
          .map((el) => ({ cls: el.className, text: (el.textContent || "").trim(), ...rect(el) }));
        return { chartLabels, chipCandidates };
      });

      results.push({
        engine: engineName,
        page: pagePath,
        viewport: vp.name,
        smallCount: small.length,
        smallSample: small.slice(0, 8),
        chartLabelSample: specific.chartLabels.slice(0, 4),
        chipCandidates: specific.chipCandidates,
      });

      await context.close();
    }
  }
  await browser.close();
}

for (const r of results) {
  console.log(
    `[${r.engine}] ${r.page} ${r.viewport}: small=${r.smallCount} chips=${JSON.stringify(r.chipCandidates)} chartLabelSample=${JSON.stringify(r.chartLabelSample)}`,
  );
}
console.log("DONE");
