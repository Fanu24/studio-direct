// Item 10c: resetTurnstileWidget() try/catch. Submit the login form and
// confirm a visible outcome renders (a .notice--danger error OR a
// .notice--accent confirmation), never silence. This environment's outbound
// network to challenges.cloudflare.com is the real-world case the fix
// targets ("any time the script is blocked or slow to initialise").
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3100";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 30000 });

const turnstileScriptPresent = await page.evaluate(() => typeof window.turnstile !== "undefined");
console.log("turnstile global present:", turnstileScriptPresent);

await page.fill('input[name="email"]', "qa-verify@example.com");
await page.click('button[type="submit"]');

// Wait on the real condition: a visible outcome notice, bounded timeout.
const outcome = await page
  .waitForSelector(".notice", { timeout: 10000 })
  .then(async (el) => ({
    appeared: true,
    className: await el.getAttribute("class"),
    text: (await el.textContent())?.trim().slice(0, 200),
  }))
  .catch(() => ({ appeared: false }));

console.log(JSON.stringify(outcome, null, 2));
await browser.close();
console.log("DONE");
