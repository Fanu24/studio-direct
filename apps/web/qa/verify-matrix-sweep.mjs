// Verification sweep for items 2 (page-level overflow, whole matrix) and
// 5 (sub-24px tap targets, whole matrix). One pass over all 21 templates x
// 6 viewports x 3 engines instead of two, since both checks are cheap once
// the page is loaded.
import { runMatrix, overflowPx, smallTargets } from "./harness.mjs";

const rows = await runMatrix({
  dimension: "verify-matrix-sweep",
  check: async (page, { template, viewport, engine }) => {
    const overflow = await overflowPx(page);
    const small = await smallTargets(page, 24);
    return {
      checks: {
        overflowPx: overflow,
        hasOverflow: overflow > 0,
        smallTargetCount: small.length,
      },
      evidence: {
        smallTargetsSample: small.slice(0, 12),
      },
    };
  },
});

const overflowing = rows.filter((r) => r.checks.overflowPx > 0);
console.log(`Total rows: ${rows.length}`);
console.log(`Rows with page-level overflow: ${overflowing.length}`);
for (const r of overflowing) {
  console.log(`  OVERFLOW ${r.checks.overflowPx}px  ${r.engine} ${r.viewport} ${r.template} ${r.url}`);
}

const byTemplateEngine = {};
for (const r of rows) {
  const key = `${r.template}|${r.engine}`;
  byTemplateEngine[key] = byTemplateEngine[key] ?? [];
  byTemplateEngine[key].push(r.checks.smallTargetCount);
}
console.log("\nSmall-target counts (<24px) per template x engine, across viewports:");
for (const [key, counts] of Object.entries(byTemplateEngine)) {
  console.log(`  ${key}: ${counts.join(",")}`);
}

console.log("DONE");
