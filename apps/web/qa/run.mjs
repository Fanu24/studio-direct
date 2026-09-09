#!/usr/bin/env node
// apps/web/qa/run.mjs
//
// CLI entry point over runMatrix(). Each of the four QA agents (layout,
// interaction, accessibility, motion) runs this with its dimension name to
// produce apps/web/qa/out/<dimension>.json against a production build
// already listening on :3100 (see qa/README.md for the exact serve
// commands - this script does not start the server itself, and does not
// stop one that is already running).
//
// Usage:
//   node qa/run.mjs layout
//   node qa/run.mjs accessibility
//   QA_BASE_URL=http://localhost:3100 node qa/run.mjs interaction
//
// The check function for each dimension below is intentionally a thin
// composition of the primitives in harness.mjs - measuring, not judging.
// This is the instrument's default wiring, proven to run end-to-end against
// the live app (see qa/README.md "Smoke-testing run.mjs"). Interpreting the
// raw numbers - is 3px of overflow a defect? is this control supposed to be
// a carousel track that legitimately clips? - is the QA agent's job for
// Tasks 9-12, and no finding is reported without being reproduced by hand
// (design spec 4.3). Agents are expected to extend or replace the check
// function for their own dimension (especially `interaction`, which needs
// real per-template filter/accordion/carousel/pagination flows, not just a
// generic aria-expanded sweep) rather than treat this file as final.

import {
  runMatrix,
  overflowPx,
  clippedText,
  smallTargets,
  contrastPairs,
  focusables,
  settle,
} from "./harness.mjs";

const DIMENSION = process.argv[2];

const CHECKS = {
  async layout(page) {
    const [overflow, clipped, small] = await Promise.all([
      overflowPx(page),
      clippedText(page),
      smallTargets(page, 24),
    ]);
    return {
      checks: {
        overflowPx: overflow,
        clippedTextCount: clipped.length,
        smallTargetCount: small.length,
      },
      evidence: {
        clippedText: clipped.slice(0, 20),
        smallTargets: small.slice(0, 20),
      },
    };
  },

  // Generic toggle scan: every element carrying aria-expanded is clicked
  // once and its state re-read after settle(). This default only proves the
  // click -> settle -> read pattern works end to end across the matrix; it
  // is not a substitute for exercising each template's real filters,
  // accordions, carousels, pagination, and forms with real mouse events, as
  // design spec 4.2 requires.
  async interaction(page) {
    const handles = await page.$$("[aria-expanded]");
    const before = [];
    for (const h of handles) before.push(await h.getAttribute("aria-expanded"));

    const toggles = [];
    for (let i = 0; i < handles.length; i++) {
      const beforeState = before[i] ?? null;
      try {
        await handles[i].click({ timeout: 2000 });
        await settle(page);
        const afterState = await handles[i].getAttribute("aria-expanded");
        toggles.push({ index: i, before: beforeState, after: afterState, changed: beforeState !== afterState });
      } catch (err) {
        toggles.push({ index: i, before: beforeState, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return {
      checks: {
        toggleControlCount: toggles.length,
        deadControlCount: toggles.filter((t) => t.changed === false && !t.error).length,
      },
      evidence: { toggles },
    };
  },

  async accessibility(page) {
    const [contrast, focus] = await Promise.all([contrastPairs(page), focusables(page)]);
    const landmarks = await page.evaluate(() => ({
      hasMain: !!document.querySelector("main"),
      hasH1: !!document.querySelector("h1"),
      skipLink: !!document.querySelector('a[href^="#"]'),
      imagesWithoutAlt: Array.from(document.querySelectorAll("img")).filter((img) => !img.hasAttribute("alt")).length,
    }));
    return {
      checks: {
        contrastFailureCount: contrast.length,
        focusableCount: focus.length,
        focusablesWithoutIndicator: focus.filter((f) => !f.hasVisibleFocusIndicator).length,
        ...landmarks,
      },
      evidence: {
        contrastFailures: contrast.slice(0, 20),
        focusablesMissingIndicator: focus.filter((f) => !f.hasVisibleFocusIndicator).slice(0, 20),
      },
    };
  },

  async motion(page) {
    // page is already loaded once by runMatrix; re-navigate under
    // prefers-reduced-motion so the server-rendered + client-hydrated state
    // both reflect the media query, not just a CSS media match applied
    // after the fact.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload({ waitUntil: "networkidle" });
    const animatedUnderReducedMotion = await page.evaluate(() => {
      let count = 0;
      for (const el of document.querySelectorAll("*")) {
        const style = getComputedStyle(el);
        const animDuration = parseFloat(style.animationDuration || "0");
        const transitionDuration = parseFloat(style.transitionDuration || "0");
        if (animDuration > 0.05 || transitionDuration > 0.5) count++;
      }
      return count;
    });
    return {
      checks: { animatedElementsUnderReducedMotion: animatedUnderReducedMotion },
      evidence: {},
    };
  },
};

async function main() {
  if (!DIMENSION || !CHECKS[DIMENSION]) {
    console.error(`Usage: node qa/run.mjs <${Object.keys(CHECKS).join("|")}>`);
    process.exit(1);
  }
  const rows = await runMatrix({ dimension: DIMENSION, check: CHECKS[DIMENSION] });
  console.log(`Wrote ${rows.length} rows to apps/web/qa/out/${DIMENSION}.json`);
}

main();
