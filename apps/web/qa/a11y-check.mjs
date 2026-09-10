#!/usr/bin/env node
// apps/web/qa/a11y-check.mjs
//
// Accessibility-dimension matrix for the Aurora QA pass (Task 11 in
// docs/superpowers/plans/2026-09-09-aurora-redesign.md). Extends
// harness.mjs's primitives with checks run.mjs's generic `accessibility`
// wiring does not attempt: landmark/heading structure, image alt coverage,
// form-control labelling, aria-current/aria-expanded inventories, table
// header structure, and skip-link mechanics. Every number here is a
// candidate for the written report, not a finding on its own - findings are
// only written up after manual confirmation (design spec 4.3).
//
// Usage:
//   node qa/a11y-check.mjs                 # full 21 x {390x844,1440x900} x 3 engines
//   node qa/a11y-check.mjs --all-viewports  # widen to all 6 viewports

import { runMatrix, VIEWPORTS, contrastPairs, focusables } from "./harness.mjs";
import templates from "./templates.mjs";

const PRIMARY_VIEWPORTS = VIEWPORTS.filter((v) => v.name === "390x844" || v.name === "1440x900");
const viewports = process.argv.includes("--all-viewports") ? VIEWPORTS : PRIMARY_VIEWPORTS;

async function check(page) {
  const [contrast, focus] = await Promise.all([contrastPairs(page), focusables(page)]);

  const structure = await page.evaluate(() => {
    function textOf(el) {
      return (el.textContent || "").trim().slice(0, 80);
    }

    // --- Landmarks -----------------------------------------------------
    const mains = Array.from(document.querySelectorAll("main"));
    const navs = Array.from(document.querySelectorAll("nav"));
    const footers = Array.from(document.querySelectorAll("footer"));
    const navLabels = navs.map((n) => n.getAttribute("aria-label") || n.getAttribute("aria-labelledby") || null);
    const navLabelDupes = navLabels.filter((l, i) => l && navLabels.indexOf(l) !== i);

    // --- Headings --------------------------------------------------------
    const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) => ({
      level: Number(h.tagName[1]),
      text: textOf(h),
      visible: h.getClientRects().length > 0,
    }));
    const h1s = headings.filter((h) => h.level === 1);
    let skippedLevels = [];
    let prevLevel = 0;
    for (const h of headings) {
      if (prevLevel > 0 && h.level > prevLevel + 1) {
        skippedLevels.push({ from: prevLevel, to: h.level, text: h.text });
      }
      prevLevel = h.level;
    }

    // --- Skip link ---------------------------------------------------------
    const allAnchors = Array.from(document.querySelectorAll("a[href]"));
    const firstFocusable = document.querySelector(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const skipCandidates = allAnchors.filter((a) => {
      const href = a.getAttribute("href") || "";
      return href.startsWith("#") && /skip/i.test(a.textContent || "");
    });
    const skipLink = skipCandidates[0] || null;
    const skipTargetId = skipLink ? skipLink.getAttribute("href").slice(1) : null;
    const skipTargetExists = skipTargetId ? !!document.getElementById(skipTargetId) : false;
    const skipIsFirstFocusable = skipLink && firstFocusable === skipLink;

    // --- Images --------------------------------------------------------
    const imgs = Array.from(document.querySelectorAll("img"));
    const imgsMissingAlt = imgs.filter((i) => !i.hasAttribute("alt"));
    const decorativeImgs = imgs.filter((i) => i.getAttribute("alt") === "" || i.getAttribute("aria-hidden") === "true");
    const meaningfulImgs = imgs.filter((i) => i.hasAttribute("alt") && i.getAttribute("alt") !== "");
    // SVG icons used as meaningful content should carry a role/aria-label or a <title>;
    // ones marked aria-hidden are assumed decorative.
    const svgs = Array.from(document.querySelectorAll("svg"));
    const svgsNoAAndNoHidden = svgs.filter(
      (s) => s.getAttribute("aria-hidden") !== "true" && !s.getAttribute("aria-label") && !s.getAttribute("role"),
    );

    // --- Form controls ---------------------------------------------------
    const controls = Array.from(document.querySelectorAll("input:not([type=hidden]),select,textarea"));
    const unlabelled = controls
      .filter((c) => {
        const id = c.getAttribute("id");
        const hasFor = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
        const wrappedByLabel = c.closest("label");
        const ariaLabel = c.getAttribute("aria-label");
        const ariaLabelledby = c.getAttribute("aria-labelledby") && document.getElementById(c.getAttribute("aria-labelledby"));
        return !hasFor && !wrappedByLabel && !ariaLabel && !ariaLabelledby;
      })
      .map((c) => ({ tag: c.tagName.toLowerCase(), name: c.getAttribute("name"), type: c.getAttribute("type") }));

    // --- Live regions / error messages -----------------------------------
    const liveRegions = Array.from(document.querySelectorAll('[role="alert"],[role="status"],[aria-live]')).map(
      (el) => ({ role: el.getAttribute("role"), ariaLive: el.getAttribute("aria-live"), text: textOf(el) }),
    );

    // --- aria-expanded / aria-current inventories -------------------------
    const expandable = Array.from(document.querySelectorAll("[aria-expanded]")).map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: textOf(el) || el.getAttribute("aria-label"),
      ariaExpanded: el.getAttribute("aria-expanded"),
      ariaControls: el.getAttribute("aria-controls"),
      controlsTargetExists: el.getAttribute("aria-controls")
        ? !!document.getElementById(el.getAttribute("aria-controls"))
        : null,
    }));
    const current = Array.from(document.querySelectorAll("[aria-current]")).map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: textOf(el),
      value: el.getAttribute("aria-current"),
    }));

    // --- Tables ------------------------------------------------------------
    const tables = Array.from(document.querySelectorAll("table")).map((t) => {
      const ths = Array.from(t.querySelectorAll("th"));
      const hasCaption = !!t.querySelector("caption");
      const rows = t.querySelectorAll("tbody tr").length;
      const scopedTh = ths.filter((th) => th.hasAttribute("scope")).length;
      return {
        rows,
        thCount: ths.length,
        scopedThCount: scopedTh,
        hasCaption,
        className: t.className,
      };
    });

    // --- role="img" containers with focusable descendants (ARIA content-model check) ---
    const imgRoleWithInteractiveDescendants = Array.from(document.querySelectorAll('[role="img"]'))
      .map((el) => ({
        className: el.className,
        interactiveDescendants: el.querySelectorAll('a[href], button, input, select, textarea, [tabindex]').length,
      }))
      .filter((r) => r.interactiveDescendants > 0);

    return {
      mainCount: mains.length,
      navCount: navs.length,
      navLabels,
      navLabelDupes,
      footerCount: footers.length,
      h1Count: h1s.length,
      h1Text: h1s.map((h) => h.text),
      headingOutline: headings.map((h) => `h${h.level}:${h.text}`),
      skippedLevels,
      hasSkipLink: !!skipLink,
      skipLinkText: skipLink ? textOf(skipLink) : null,
      skipTargetExists,
      skipIsFirstFocusable: !!skipIsFirstFocusable,
      imgCount: imgs.length,
      imgsMissingAltCount: imgsMissingAlt.length,
      imgsMissingAlt: imgsMissingAlt.map((i) => ({ src: (i.getAttribute("src") || "").slice(0, 80) })),
      decorativeImgCount: decorativeImgs.length,
      meaningfulImgCount: meaningfulImgs.length,
      svgsNoAccessibleTreatmentCount: svgsNoAAndNoHidden.length,
      svgsNoAccessibleTreatment: svgsNoAAndNoHidden.slice(0, 10).map((s) => (s.outerHTML || "").slice(0, 100)),
      unlabelledControlCount: unlabelled.length,
      unlabelledControls: unlabelled,
      liveRegions,
      expandableCount: expandable.length,
      expandable,
      ariaCurrent: current,
      tables,
      imgRoleWithInteractiveDescendants,
    };
  });

  return {
    checks: {
      contrastFailureCount: contrast.length,
      focusableCount: focus.length,
      focusablesWithoutIndicatorCount: focus.filter((f) => !f.hasVisibleFocusIndicator).length,
      mainCount: structure.mainCount,
      navCount: structure.navCount,
      footerCount: structure.footerCount,
      h1Count: structure.h1Count,
      skippedHeadingLevelCount: structure.skippedLevels.length,
      hasSkipLink: structure.hasSkipLink,
      skipTargetExists: structure.skipTargetExists,
      skipIsFirstFocusable: structure.skipIsFirstFocusable,
      imgsMissingAltCount: structure.imgsMissingAltCount,
      svgsNoAccessibleTreatmentCount: structure.svgsNoAccessibleTreatmentCount,
      unlabelledControlCount: structure.unlabelledControlCount,
      imgRoleWithInteractiveDescendantsCount: structure.imgRoleWithInteractiveDescendants.length,
    },
    evidence: {
      contrastFailures: contrast.slice(0, 30),
      focusablesMissingIndicator: focus.filter((f) => !f.hasVisibleFocusIndicator).slice(0, 30),
      navLabels: structure.navLabels,
      navLabelDupes: structure.navLabelDupes,
      h1Text: structure.h1Text,
      headingOutline: structure.headingOutline,
      skippedLevels: structure.skippedLevels,
      skipLinkText: structure.skipLinkText,
      imgsMissingAlt: structure.imgsMissingAlt,
      svgsNoAccessibleTreatment: structure.svgsNoAccessibleTreatment,
      unlabelledControls: structure.unlabelledControls,
      liveRegions: structure.liveRegions,
      expandable: structure.expandable,
      ariaCurrent: structure.ariaCurrent,
      tables: structure.tables,
      imgRoleWithInteractiveDescendants: structure.imgRoleWithInteractiveDescendants,
    },
  };
}

async function main() {
  const rows = await runMatrix({ dimension: "accessibility", check, templates, viewports });
  console.log(
    `Wrote ${rows.length} rows to apps/web/qa/out/accessibility.json (${templates.length} templates x ${viewports.length} viewports x 3 engines)`,
  );
}

main();
