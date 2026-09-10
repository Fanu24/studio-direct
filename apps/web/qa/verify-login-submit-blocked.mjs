// Item 10c, stronger repro: block the Turnstile script entirely so the
// widget never mounts (window.turnstile stays undefined) - the exact
// condition the fix's own comment describes ("reachable in production any
// time the script is blocked or slow to initialise"). Confirm a visible
// outcome still renders instead of silence.
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3100";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.route("**challenges.cloudflare.com/**", (route) => route.abort());
await page.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 30000 });

const turnstileGlobalPresent = await page.evaluate(() => typeof window.turnstile !== "undefined");
console.log("turnstile global present (should be false/undefined - script blocked):", turnstileGlobalPresent);

await page.fill('input[name="email"]', "qa-verify@example.com");
await page.click('button[type="submit"]');

const outcome = await page
  .waitForSelector(".notice", { timeout: 10000 })
  .then(async (el) => ({
    appeared: true,
    className: await el.getAttribute("class"),
    text: (await el.textContent())?.trim().slice(0, 200),
  }))
  .catch(() => ({ appeared: false }));

console.log(JSON.stringify(outcome, null, 2));

// Also directly unit-check resetTurnstileWidget's try/catch in isolation,
// simulating a turnstile.reset() that throws (Turnstile's real behavior
// when no widget was ever rendered).
const noThrow = await page.evaluate(() => {
  // Re-implements the exported function's contract inline since it's not
  // exposed on window; this checks the *pattern* is unit-testable and safe.
  function resetTurnstileWidget(turnstile) {
    try {
      turnstile?.reset?.();
    } catch {
      /* swallow */
    }
  }
  try {
    resetTurnstileWidget({
      reset() {
        throw new Error("No widget rendered");
      },
    });
    return true;
  } catch {
    return false;
  }
});
console.log("resetTurnstileWidget swallows a throwing reset():", noThrow);

await browser.close();
console.log("DONE");
