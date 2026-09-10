// Item 10d, client-side half: the delete-confirm input carries required +
// pattern="DELETE" in app/settings/page.tsx. Exercised here against an
// isolated fixture with the identical markup (see fixtures/delete-confirm-
// fixture.html) since /settings requires an authenticated session this task
// says not to fabricate. This tests real browser constraint-validation
// behavior, not just that the attributes are present in source.
import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureUrl = "file://" + path.join(__dirname, "fixtures", "delete-confirm-fixture.html").replace(/\\/g, "/");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(fixtureUrl);

async function check(value) {
  await page.fill("#delete-confirm", value);
  const state = await page.evaluate(() => window.checkState());
  return state;
}

console.log("empty:", JSON.stringify(await check("")));
console.log('lowercase "delete":', JSON.stringify(await check("delete")));
console.log('partial "DELET":', JSON.stringify(await check("DELET")));
console.log('correct "DELETE":', JSON.stringify(await check("DELETE")));

// Confirm clicking submit with an invalid value does NOT navigate away.
await page.fill("#delete-confirm", "nope");
const urlBefore = page.url();
await page.click('button[type="submit"]');
await page.waitForTimeout(300);
const urlAfterInvalid = page.url();
console.log("navigated with invalid value:", urlBefore !== urlAfterInvalid);

await browser.close();
console.log("DONE");
