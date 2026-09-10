import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto("http://localhost:3100/web3-salaries", { waitUntil: "networkidle", timeout: 30000 });
const info = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll("a")).filter(a => a.textContent.trim() === "Intern");
  return links.map(a => {
    const r = a.getBoundingClientRect();
    const cs = getComputedStyle(a);
    let chain = [];
    let cur = a;
    for (let i=0;i<7 && cur; i++) { chain.push(`${cur.tagName.toLowerCase()}[class="${cur.className}"]`); cur = cur.parentElement; }
    return {
      rect: { width: Math.round(r.width*10)/10, height: Math.round(r.height*10)/10 },
      display: cs.display, minHeight: cs.minHeight, visibility: cs.visibility,
      chain,
    };
  });
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
