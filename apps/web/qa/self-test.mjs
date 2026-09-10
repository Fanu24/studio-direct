// apps/web/qa/self-test.mjs
//
// Step 5 of Task 8: prove the instrument is not lying before any QA agent
// trusts it.
//
//   1. overflowPx() against a fixture with an element 510px wider than a
//      390px viewport must report ~510, not 0. 0 means it is secretly
//      measuring window.innerWidth (which, under mobile emulation, expands
//      to match scrollWidth and always reports 0 overflow - see the long
//      comment on overflowPx in harness.mjs).
//   2. settle() against a fixture whose aria-expanded flips on a 300ms
//      timeout must demonstrate BOTH failure modes: reading immediately
//      after .click() sees the STALE value, and reading after settle()
//      sees the NEW value. A harness that cannot reproduce the false
//      negative cannot be trusted to avoid it.
//
// Runs against all three installed engines (chromium, firefox, webkit) -
// this doubles as a smoke test that the browser installs from step 1
// actually work, not just that the binaries are present on disk.
//
// Usage: node qa/self-test.mjs
// Exits non-zero on any failure.

import { chromium, firefox, webkit } from "@playwright/test";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { overflowPx, settle } from "./harness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OVERFLOW_FIXTURE = pathToFileURL(path.join(__dirname, "fixtures", "overflow-fixture.html")).href;
const SETTLE_FIXTURE = pathToFileURL(path.join(__dirname, "fixtures", "settle-fixture.html")).href;

const ENGINES = { chromium, firefox, webkit };

const EXPECTED_OVERFLOW = 510;
const OVERFLOW_TOLERANCE = 5; // scrollbar rendering can shift this by a few px between engines

let failures = 0;

function report(label, ok, detail) {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${label}${detail ? " - " + detail : ""}`);
  if (!ok) failures++;
}

async function testOverflow(engineName, browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: engineName === "chromium" ? true : undefined,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(OVERFLOW_FIXTURE, { waitUntil: "load" });

  // Also capture innerWidth alongside clientWidth/scrollWidth so the failure
  // mode the spec warns about is visible in the output, not just asserted.
  const raw = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  const measured = await overflowPx(page);

  const innerWidthWouldLie = raw.innerWidth - raw.scrollWidth === 0 && raw.scrollWidth !== raw.clientWidth;
  report(
    `${engineName}: overflowPx() fixture (390px viewport, 900px element)`,
    Math.abs(measured - EXPECTED_OVERFLOW) <= OVERFLOW_TOLERANCE,
    `got ${measured}px, expected ~${EXPECTED_OVERFLOW}px (raw: innerWidth=${raw.innerWidth} clientWidth=${raw.clientWidth} scrollWidth=${raw.scrollWidth}, would-be-innerWidth-bug=${innerWidthWouldLie})`,
  );

  await context.close();
}

async function testSettle(engineName, browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(SETTLE_FIXTURE, { waitUntil: "load" });

  await page.click("#toggle");
  const immediate = await page.getAttribute("#toggle", "aria-expanded");
  report(
    `${engineName}: settle() false-negative reproduction (read immediately after click)`,
    immediate === "false",
    `got aria-expanded="${immediate}", expected "false" (the stale value) - proves the trap is real`,
  );

  await settle(page);
  const afterSettle = await page.getAttribute("#toggle", "aria-expanded");
  report(
    `${engineName}: settle() correct read (after ~350ms)`,
    afterSettle === "true",
    `got aria-expanded="${afterSettle}", expected "true"`,
  );

  await context.close();
}

async function main() {
  for (const [engineName, launcher] of Object.entries(ENGINES)) {
    let browser;
    try {
      browser = await launcher.launch();
    } catch (err) {
      report(`${engineName}: browser launch`, false, err instanceof Error ? err.message : String(err));
      continue;
    }
    try {
      await testOverflow(engineName, browser);
      await testSettle(engineName, browser);
    } finally {
      await browser.close();
    }
  }

  console.log("");
  if (failures > 0) {
    console.error(`self-test: ${failures} check(s) failed. The instrument is not trustworthy yet - fix before running any QA matrix.`);
    process.exit(1);
  } else {
    console.log("self-test: all checks passed on chromium, firefox, and webkit.");
  }
}

main();
