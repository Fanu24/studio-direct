import { chromium } from "@playwright/test";
const BASE = "http://localhost:3100";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(BASE + "/web3-salaries", { waitUntil: "networkidle", timeout: 30000 });
const info = await page.evaluate(() => {
  const wordmark = document.querySelector(".wordmark");
  const footerLink = document.querySelector(".footer-column__links a");
  const tableLink = document.querySelector(".table td a");
  const rect = (el) => el ? (() => { const r = el.getBoundingClientRect(); return { width: Math.round(r.width), height: Math.round(r.height), text: (el.textContent||'').trim().slice(0,40) }; })() : null;
  return { wordmark: rect(wordmark), footerLink: rect(footerLink), tableLink: rect(tableLink) };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
