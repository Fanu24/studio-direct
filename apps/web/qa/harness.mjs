// apps/web/qa/harness.mjs
//
// Measurement primitives + the matrix runner for the Aurora QA harness.
// This file is the instrument, not the audit - see qa/README.md for how
// it is proven not to lie (qa/fixtures/*, qa/self-test.mjs) before any of
// the four QA agents trust it.
//
// Everything here runs against a PRODUCTION build
// (`next build && next start -p 3100`), never `next dev` - see the design
// spec section 4.1 and qa/README.md for why (dev timings are meaningless,
// and a long-running dev server degrades under concurrent edits).

import { chromium, firefox, webkit } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const OUT_DIR = path.join(__dirname, "out");
export const BASE_URL = process.env.QA_BASE_URL ?? "http://localhost:3100";

/**
 * The 6 required viewports, verbatim from design spec 4.1:
 *   "360×740, 390×844 (touch, dsf 3), 768×1024 (touch), 1024×768, 1440×900,
 *   1920×1080."
 *
 * Only 390x844 and 768x1024 are annotated "(touch)" in that sentence - 360x740
 * is NOT, even though it is a phone-sized viewport. That reads like it could
 * be a spec oversight (a phone width with no touch emulation is unusual), but
 * this harness follows the literal spec rather than silently "fixing" it, per
 * the same measurement-discipline the spec itself demands elsewhere (no
 * inventing values). Flagged here and in the QA report for the coordinator to
 * confirm or correct.
 *
 * deviceScaleFactor is only specified for 390x844 (3). The others are left at
 * Playwright's default (1) rather than guessed.
 */
export const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: "390x844", width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  { name: "768x1024", width: 768, height: 1024, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  { name: "1024x768", width: 1024, height: 768, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: "1440x900", width: 1440, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: "1920x1080", width: 1920, height: 1080, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
];

/** Real engines only - Chromium, Firefox, WebKit. No "chromium x3" fallback. */
export const ENGINES = ["chromium", "firefox", "webkit"];

const LAUNCHERS = { chromium, firefox, webkit };

/**
 * documentElement.scrollWidth - documentElement.clientWidth.
 *
 * NEVER measure against window.innerWidth. Under device emulation with
 * `mobile: true`, innerWidth reports the *visual* viewport, which expands to
 * content width whenever the page overflows, so it always equals scrollWidth
 * and the subtraction is identically zero - a harness that did this would
 * report 0 overflow on every overflowing page. clientWidth is the layout
 * viewport and is the correct divisor. Proven against a known-510px-overflow
 * fixture in qa/self-test.mjs.
 */
export async function overflowPx(page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth - d.clientWidth;
  });
}

/**
 * React updates the DOM asynchronously. Reading state (aria-expanded, class
 * toggles, etc.) in the same JS turn as a `.click()` always sees the stale
 * value and reports a working control as dead. Await this after every
 * interaction before reading DOM state back.
 */
export async function settle(page) {
  await page.waitForTimeout(350);
}

/**
 * Text that is visually truncated by its own overflow/text-overflow rules -
 * NOT elements that merely sit inside an intentional horizontal-scroll
 * container (a carousel track, an overflow-x region). Per design spec 4.2:
 * "An element sitting past the right edge is normal when an ancestor clips
 * or scrolls it [...] Per-element overflow is only attributed when the page
 * itself overflows" - that rule is about attributing PAGE-level overflow to
 * one element (see overflowPx), not about this check, which only flags an
 * element truncating ITS OWN content (scrollWidth/scrollHeight bigger than
 * its own clientWidth/clientHeight while overflow is hidden/clip and either
 * white-space:nowrap or -webkit-line-clamp is set) - a real "the label got
 * cut off" defect, not a normal scroll region.
 */
export async function clippedText(page) {
  return page.evaluate(() => {
    const results = [];
    const all = document.body.querySelectorAll("*");
    for (const el of all) {
      const hasOwnText = Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && n.textContent && n.textContent.trim().length > 0,
      );
      if (!hasOwnText) continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const overflowX = style.overflowX;
      const overflowY = style.overflowY;
      const clampLines = style.webkitLineClamp;
      const nowrap = style.whiteSpace === "nowrap";
      const isClampable =
        (clampLines && clampLines !== "none") ||
        (nowrap && (overflowX === "hidden" || overflowX === "clip"));
      const isBlockClipped =
        !nowrap && (overflowY === "hidden" || overflowY === "clip") && el.scrollHeight - el.clientHeight > 2;
      if (!isClampable && !isBlockClipped) continue;
      const truncatedHorizontally = nowrap && el.scrollWidth - el.clientWidth > 2;
      const truncatedVertically = isBlockClipped || (clampLines && clampLines !== "none" && el.scrollHeight - el.clientHeight > 2);
      if (!truncatedHorizontally && !truncatedVertically) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      results.push({
        tag: el.tagName.toLowerCase(),
        className: typeof el.className === "string" ? el.className.slice(0, 80) : "",
        text: (el.textContent || "").trim().slice(0, 80),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        mode: truncatedHorizontally ? "horizontal" : "vertical",
      });
    }
    return results;
  });
}

/**
 * Interactive elements smaller than minPx in either dimension - the 24px tap
 * target minimum. Hidden/zero-size elements (display:none, visibility:hidden,
 * 0x0 boxes) are excluded since they are not tappable targets at all, not
 * undersized ones.
 */
export async function smallTargets(page, minPx = 24) {
  return page.evaluate((min) => {
    const selector =
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [tabindex]:not([tabindex="-1"])';
    const els = Array.from(document.querySelectorAll(selector));
    const results = [];
    for (const el of els) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (parseFloat(style.opacity) === 0) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (rect.width < min || rect.height < min) {
        results.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 60),
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
        });
      }
    }
    return results;
  }, minPx);
}

/**
 * Approximate WCAG 2.x contrast check between each text-bearing element's
 * computed color and the first non-transparent background-color found
 * walking up its ancestor chain. This is a scaffolding-grade approximation
 * (it does not composite semi-transparent backgrounds, gradients, or
 * background-images) - good enough to flag obvious failures for the
 * accessibility QA agent to verify by hand, per the "every finding is
 * reproduced by hand" rule in design spec 4.3. Do not treat a clean report
 * from this function alone as proof of AA compliance.
 */
export async function contrastPairs(page) {
  return page.evaluate(() => {
    function parseColor(str) {
      const m = /rgba?\(([^)]+)\)/.exec(str || "");
      if (!m) return null;
      const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
      if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    }
    function relLum({ r, g, b }) {
      const chan = [r, g, b].map((c) => {
        const cs = c / 255;
        return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
    }
    function effectiveBg(el) {
      let node = el;
      while (node) {
        const parsed = parseColor(getComputedStyle(node).backgroundColor);
        if (parsed && parsed.a > 0.98) return parsed;
        node = node.parentElement;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    }
    const results = [];
    const all = document.body.querySelectorAll("*");
    for (const el of all) {
      const hasOwnText = Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && n.textContent && n.textContent.trim().length > 0,
      );
      if (!hasOwnText) continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const fg = parseColor(style.color);
      if (!fg) continue;
      const bg = effectiveBg(el);
      const l1 = relLum(fg) + 0.05;
      const l2 = relLum(bg) + 0.05;
      const ratio = l1 > l2 ? l1 / l2 : l2 / l1;
      const fontSizePx = parseFloat(style.fontSize);
      const bold = parseInt(style.fontWeight, 10) >= 700;
      const isLargeText = fontSizePx >= 24 || (fontSizePx >= 18.66 && bold);
      const threshold = isLargeText ? 3 : 4.5;
      if (ratio < threshold) {
        results.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || "").trim().slice(0, 60),
          ratio: Math.round(ratio * 100) / 100,
          threshold,
          fg: style.color,
          bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
          fontSizePx,
          bold,
        });
      }
    }
    return results;
  });
}

/**
 * Every focusable element, in DOM/tab order, with whether focusing it
 * actually changes its outline/box-shadow (a real visible focus indicator,
 * not just an aria attribute). Cheap CSS-only proxy for `:focus-visible`
 * styling - it focuses each element via JS and diffs computed style before
 * and after, since Playwright's page.evaluate cannot read the `:focus-visible`
 * pseudo-class match directly.
 */
export async function focusables(page) {
  return page.evaluate(() => {
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [role="button"], [tabindex]:not([tabindex="-1"])';
    const els = Array.from(document.querySelectorAll(selector)).filter((el) => {
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    });
    function snapshot(el) {
      const s = getComputedStyle(el);
      return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, boxShadow: s.boxShadow };
    }
    const results = [];
    let order = 0;
    for (const el of els) {
      const before = snapshot(el);
      el.focus({ preventScroll: true });
      const focused = document.activeElement === el;
      const after = snapshot(el);
      const changed =
        before.outlineStyle !== after.outlineStyle ||
        before.outlineWidth !== after.outlineWidth ||
        before.boxShadow !== after.boxShadow;
      const hasOutline = after.outlineStyle !== "none" && parseFloat(after.outlineWidth) > 0;
      const hasBoxShadow = after.boxShadow !== "none";
      results.push({
        order: order++,
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 60),
        tabIndex: el.tabIndex,
        focused,
        hasVisibleFocusIndicator: focused && changed && (hasOutline || hasBoxShadow),
      });
      if (document.activeElement === el) el.blur();
    }
    return results;
  });
}

/**
 * Launches `engine`, opens one context per (template x viewport), navigates
 * to BASE_URL + template.url, runs `check(page, ctx)`, records one row, and
 * writes apps/web/qa/out/<dimension>.json when the whole matrix is done.
 *
 * `check` receives `(page, { template, viewport, engine, gotoStatus })` and
 * must return `{ checks, evidence }` (both plain JSON-serialisable objects).
 * A thrown error from `check` is caught and recorded as
 * `{ checks: { error: true }, evidence: { message } }` for that one row
 * rather than aborting the whole matrix - one broken template must not blank
 * out the other 20 x 6 x 3 rows.
 *
 * @param {{
 *   dimension: string,
 *   check: (page: import('@playwright/test').Page, ctx: { template: object, viewport: object, engine: string, gotoStatus: number | null }) => Promise<{ checks: object, evidence: object }>,
 *   templates?: object[],
 *   viewports?: object[],
 *   engines?: string[],
 *   baseUrl?: string,
 * }} opts
 */
export async function runMatrix({
  dimension,
  check,
  templates,
  viewports = VIEWPORTS,
  engines = ENGINES,
  baseUrl = BASE_URL,
}) {
  if (!dimension) throw new Error("runMatrix: dimension is required");
  if (typeof check !== "function") throw new Error("runMatrix: check(page, ctx) is required");
  if (!templates) {
    ({ templates } = await import("./templates.mjs"));
  }

  const rows = [];

  for (const engineName of engines) {
    const launcher = LAUNCHERS[engineName];
    if (!launcher) throw new Error(`runMatrix: unknown engine "${engineName}"`);
    const browser = await launcher.launch();
    try {
      for (const viewport of viewports) {
        for (const template of templates) {
          const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            deviceScaleFactor: viewport.deviceScaleFactor,
            hasTouch: viewport.hasTouch,
            // isMobile is Chromium-only in Playwright; Firefox/WebKit reject
            // or silently ignore it depending on version, so it is only set
            // where it is meaningful.
            ...(engineName === "chromium" ? { isMobile: viewport.isMobile } : {}),
          });
          const page = await context.newPage();
          const url = baseUrl.replace(/\/$/, "") + template.url;
          let gotoStatus = null;
          let row;
          try {
            const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
            gotoStatus = response ? response.status() : null;
            const result = await check(page, { template, viewport, engine: engineName, gotoStatus });
            row = {
              template: template.id,
              register: template.register,
              url: template.url,
              engine: engineName,
              viewport: viewport.name,
              gotoStatus,
              checks: result.checks ?? {},
              evidence: result.evidence ?? {},
            };
          } catch (err) {
            row = {
              template: template.id,
              register: template.register,
              url: template.url,
              engine: engineName,
              viewport: viewport.name,
              gotoStatus,
              checks: { error: true },
              evidence: { message: err instanceof Error ? err.message : String(err) },
            };
          } finally {
            await context.close();
          }
          rows.push(row);
        }
      }
    } finally {
      await browser.close();
    }
  }

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${dimension}.json`);
  await writeFile(outPath, JSON.stringify(rows, null, 2), "utf8");

  return rows;
}
