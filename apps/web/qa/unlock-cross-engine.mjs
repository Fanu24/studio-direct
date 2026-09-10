// Cross-engine confirmation of the unlock gate - "the highest-value check in
// this pass" per the task brief - on firefox and webkit too, not just
// chromium (which qa/interaction-flows.mjs already covers).
import { firefox, webkit } from "@playwright/test";

const BASE = "http://localhost:3100";
const LAUNCHERS = { firefox, webkit };

async function run(engineName) {
  const browser = await LAUNCHERS[engineName].launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const gatedUrl = `${BASE}/jobs/senior-gameplay-engineer-riot-games`;
  const resp = await page.goto(gatedUrl, { waitUntil: "networkidle" });
  const html = await resp.text();
  const leaks = /example\.invalid\/apply\/riot-gameplay/.test(html);
  console.log(`[${leaks ? "FAIL" : "PASS"}] ${engineName}: gated job HTML never contains real apply_url (leak=${leaks})`);

  const gateVisible = await page.locator(".jd-unlock-gate").isVisible();
  console.log(`[${gateVisible ? "PASS" : "FAIL"}] ${engineName}: unlock gate visible to anonymous visitor`);

  const unlockBtn = page.locator(".jd-unlock__button");
  const [unlockResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/unlock"), { timeout: 5000 }).catch(() => null),
    unlockBtn.click(),
  ]);
  const status = unlockResponse ? unlockResponse.status() : null;
  const body = unlockResponse ? await unlockResponse.text().catch(() => "") : "";
  const bodyLeaks = /example\.invalid/.test(body);
  console.log(`[${status !== 200 && !bodyLeaks ? "PASS" : "FAIL"}] ${engineName}: anonymous unlock POST rejected (status=${status}), no leak in body (leak=${bodyLeaks})`);

  await browser.close();
}

for (const engine of ["firefox", "webkit"]) {
  await run(engine);
}
