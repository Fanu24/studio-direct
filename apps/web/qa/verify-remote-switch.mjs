// apps/web/qa/verify-remote-switch.mjs
//
// The remote control is drawn as a switch. It used to be a one-way link:
// `/remote-jobs` pointed at `/remote-jobs`, with no on state in markup or CSS,
// so on a page that was already filtered it still looked off and clicking it
// did nothing. This walks the real thing: click it, land somewhere different,
// see it set, click again, come back.
//
// One trap, met while writing this: Next navigates client-side, so the
// document never reloads and `waitForLoadState("load")` returns immediately -
// leaving you reading the DOM of the page you just left. The first version of
// this check reported five failures against markup that was already correct.
// Wait on the URL, not on a load event.
//
// Usage: node qa/verify-remote-switch.mjs [chromium|firefox|webkit]

import { chromium, firefox, webkit } from "@playwright/test";
import { writeSync } from "node:fs";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const LAUNCHERS = { chromium, firefox, webkit };
const engineName = process.argv[2] ?? "chromium";
const NEWLINE = String.fromCharCode(10);
const say = (line) => writeSync(1, line + NEWLINE);

const browser = await LAUNCHERS[engineName].launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let failures = 0;
const fail = (m) => { failures += 1; say("  FAIL " + m); };

const read = () =>
  page.evaluate(() => {
    const t = document.querySelector(".remote-toggle");
    if (!t) return null;
    const track = t.querySelector(".remote-toggle__track");
    return {
      href: t.getAttribute("href"),
      pressed: t.getAttribute("aria-pressed"),
      role: t.getAttribute("role"),
      on: t.className.includes("remote-toggle--on"),
      // The knob position is the only thing a sighted reader actually sees.
      knob: track ? getComputedStyle(track).boxShadow : null,
    };
  });

await page.goto(BASE + "/", { waitUntil: "load" });
const off = await read();
if (!off) fail("no remote switch on the homepage");
else {
  say(`  home: pressed=${off.pressed} on=${off.on} -> ${off.href}`);
  if (off.pressed !== "false") fail(`aria-pressed is ${off.pressed}, expected "false"`);
  if (off.role !== "switch") fail(`role is ${off.role}, expected "switch"`);
  if (off.on) fail("shows the on state on an unfiltered page");
}

await page.click(".remote-toggle");
await page.waitForURL(/remote-jobs/, { timeout: 15000 });
const on = await read();
say(`  after click: url=${new URL(page.url()).pathname} pressed=${on?.pressed} on=${on?.on} -> ${on?.href}`);
if (new URL(page.url()).pathname !== "/remote-jobs") fail("clicking it did not reach /remote-jobs");
if (on?.pressed !== "true") fail(`aria-pressed is ${on?.pressed} on a remote page, expected "true"`);
if (!on?.on) fail("the switch does not look set on a remote page");
if (on?.href === "/remote-jobs") fail("it still points at itself - it cannot be turned off");
if (on?.knob && off?.knob && on.knob === off.knob) fail("the knob did not move");

await page.click(".remote-toggle");
await page.waitForURL((url) => !/remote-jobs/.test(url.pathname), { timeout: 15000 });
const back = new URL(page.url()).pathname;
say(`  after second click: url=${back}`);
if (back === "/remote-jobs") fail("clicking it again left the reader on the remote page");

await browser.close();
say("");
say(`[${engineName}] ${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
