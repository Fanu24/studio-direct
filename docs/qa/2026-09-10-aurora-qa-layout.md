# Aurora QA — Layout dimension

Date: 2026-09-10. Server under test: `next start -p 3100` (production build),
already running, owned by the coordinator — never restarted, never rebuilt,
during this pass. Working directory: `apps/web`.

Instrument: `qa/harness.mjs` + `qa/templates.mjs`, self-tested clean on
chromium/firefox/webkit before use (`node qa/self-test.mjs`, all 9 checks
passed — `overflowPx()` proven against the 510px fixture on all three
engines, `settle()` proven against the async-DOM-update fixture on all three
engines). Full 378-row matrix run via `node qa/run.mjs layout` (21 templates
× 6 viewports × 3 engines), written to `qa/out/layout.json`. A second,
bespoke script — `qa/layout-targeted.mjs` (kept in `qa/`, imports
`runMatrix`-adjacent primitives from `./harness.mjs` and `./templates.mjs`)
— was written for the five app-specific checks the task called out by name
(rank-overlay collision, page-2 tint suppression, salary-chart fallback,
company-grid collapse, touch comfort-target sweep); its output is
`qa/out/layout-targeted.json`. Neither script edited any application source
file. A handful of disposable one-off `qa/probe-*.mjs` scripts used during
root-cause tracing were deleted after use; nothing they produced is load-bearing
that isn't also reproduced in the two kept scripts' JSON output or quoted
verbatim below.

**Navigation-timing note (per the interaction dimension's methodology
note):** every check in this dimension uses `page.goto()` for its own
navigation (full page load, `waitUntil: "networkidle"`), including the
page‑1/page‑2 tint comparison (`?page=2` is a direct `goto`, not a clicked
pagination link measured with `settle()`). No layout finding below depends on
`settle()`'s 350ms window bridging a client-side route change, so the
620ms-navigation gap that produced false failures in the interaction pass
does not apply here. Confirmed by re-reading every script before writing this
report — nothing needed re-verification.

**Every finding below was reproduced by hand** with a live Playwright probe
(not just read off the generic matrix numbers), a root cause read from the
actual source, and a single point of intervention. The generic
`qa/run.mjs layout` sweep is what *surfaced* candidates; nothing below is
reported on the strength of that sweep alone.

## Summary

| Severity | Finding | Template(s) | Viewport(s) |
|---|---|---|---|
| Critical | A long, unabbreviated location string blows out the mobile job-board row grid and crushes the adjacent job-title column to as little as 0px — the title becomes fully invisible or is sliced into single-character fragments | home, jobs-catalog, rankings (and every other page embedding `JobBoard`) | 360×740, 390×844, all 3 engines |
| Critical | `.stats-grid`'s `minmax(200px, 1fr)` forces a CSS Grid "blowout" through three ancestors, producing 25px of real page-level horizontal overflow | home | 360×740 only, all 3 engines |
| High | The desktop split-view board's location column (`width: 12%` of a *half-viewport* pane) ellipsis-truncates real location strings down to ~10–15% of their length — e.g. `New York City Metropolitan Area US` renders in a ~20–30px box | home, jobs-catalog, hidden-jobs, rankings, hub-landing, salaries-index, salary-detail, salary-comparison | 1024×768, 1440×900, 1920×1080, all 3 engines |
| High | Three unrelated CSS rules each produce interactive elements under the 24px hard tap-target minimum, site-wide, on every viewport including desktop: the wordmark logo link (~22px), every footer nav link (~22.5px), and every `TABLE_HEADING_STYLE` row-label link inside a directory/salary table (as low as ~14px) | all 21 templates (wordmark + footer); salaries-index, salary-detail, salary-comparison, roles-cities-directory, companies-index, rankings (top-growing) for the table-heading links | all 6 viewports, all 3 engines |
| Low | ~24–40px "comfort" band (above the 24px hard minimum, below the 44px touch-comfort target) is pervasive on touch viewports, dominated by one component: `.chip` (`min-height: 32px`, a deliberate, already-raised-once trade-off per its own code comment) | nearly every template | 390×844, 768×1024 (touch) |

Rejected candidates (investigated, not reproduced, evidence below): rank-number/job-title collision on the four named ranked pages; page-2 ranking tint leaking onto rows 1–3; salary seniority chart failing to fall back to a table below 480px; company-card grid failing to collapse 3→2→1; a suspected CSS cascade-order conflict in the company grid's column count; tables/code samples pushing the page instead of scrolling internally.

---

## Findings

### 1. [Critical] Long location text crushes/erases the job title on the mobile job-board card

- **Template / viewport / engine:** `home` (`/`) and the `rankings` template
  (`/highest-paid-developer-jobs`, one of its ~13 sibling ranked URLs) —
  reproduced on **all three engines** (chromium, firefox, webkit) via the
  automated matrix, then hand-verified with direct DOM measurement and a
  screenshot on chromium. 360×740 and 390×844.
- **Measured numbers:**
  - `home` @ 360×740, all 3 engines: `.board-row__title` for the job "VP,
    Digital Assets & Emerging Technology Investment Banking" reports
    `clientWidth: 23`, `scrollHeight: 152` vs `clientHeight: 38` (a 4×
    overflow ratio, vs. 2–3.5× for every other row on the same page) —
    `qa/out/layout.json`, row `{template:"home", engine:"chromium",
    viewport:"360x740"}`, `evidence.clippedText`.
  - Live re-measurement (not just the matrix) on `/highest-paid-developer-jobs`:
    at 360×740, rank 4's `.board-col-job` (the ancestor `<td>`) is
    **`67.66px`** wide, and `.board-row__title`'s own bounding rect is
    **`0px` wide** (`left === right === 117`) — the title is fully collapsed,
    confirmed by screenshot: the row shows the "TW" logo mark, the full
    location string, and salary, but literally no title text at all. At
    390×844 the same row's job column is `97.66px` (title box non-zero but
    the -webkit-line-clamp shows only single letters — "V" / "D" — split
    across the two clamp lines; adjacent rows 1–3 render mid-word breaks like
    "Portfo/Manag" and "Product/Manager,…").
  - Every other row on the same page at the same viewport has a job column
    of 148–220px and a normal, readable two-line-clamped title.
- **Root cause:** `apps/web/app/styles/board.css`, inside the
  `@media (max-width: 959px)` block:
  ```css
  .board-tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: "job posted" "job loc" "job pay" "tags tags";
    ...
  }
  ```
  The second column (shared by the `posted`, `loc`, and `pay` grid areas) is
  sized `auto`, i.e. to the **max-content width of the widest of those three
  cells**. `.board-loc__text` (`apps/web/app/styles/nodework.css`, line 385)
  carries its own `white-space: nowrap`, which is never overridden by the
  mobile media query — the media query only relaxes the ancestor
  `.board-col-loc` (`overflow: visible; white-space: normal;`, board.css
  lines 641–647), not the nested span that actually holds the text. A long,
  unabbreviated location string (the real web3.career data includes strings
  like `"New York City Metropolitan Area US"`, unmassaged) therefore forces
  its full pixel width onto the shared `auto` column, and the sibling
  `minmax(0, 1fr)` "job" column — which is *allowed* to shrink to 0 by its
  own `minmax(0, ...)` — absorbs all of the squeeze.
- **Single point of intervention:** `apps/web/app/styles/board.css`, the
  `@media (max-width: 959px)` block. Either (a) cap the second column
  (`grid-template-columns: minmax(0, 1fr) minmax(0, 42%)` or a fixed
  max-width) so it can no longer claim unlimited width, or (b) add the
  missing override for the nested text node —
  `.board-tr .board-loc__text { white-space: normal; overflow: visible;
  text-overflow: clip; }` next to the existing `.board-col-loc` override at
  lines 641–647 — so a long location string wraps instead of forcing an
  `auto` track to its full max-content width. Either fix is a few lines in
  one file; (a) is the more robust of the two since it also protects against
  a long `posted`/`pay` value in the future.
- **Severity justification:** this is not a cosmetic truncation — the job
  title, the single most important piece of information on the row, becomes
  either completely invisible or reduced to unreadable single-character
  fragments, on a real, currently-listed job, on the homepage and on a
  ranked listing page, at both required mobile viewports, on all three
  engines. It directly answers (negatively) the task's own question about
  ranked pages ("does a long title run underneath it? does the number crowd
  the title?") — the rank number itself does not collide (see rejected
  candidate 1 below), but the row's own layout can destroy the title anyway,
  which is a strictly worse outcome than what was being screened for.

### 2. [Critical] `.stats-grid`'s 200px column minimum causes a CSS Grid blowout — 25px of real page overflow

- **Template / viewport / engine:** `home` (`/`) only. 360×740. Reproduced
  identically on chromium, firefox, and webkit —
  `documentElement.scrollWidth - documentElement.clientWidth = 25` on all
  three (`qa/out/layout.json`; this is the *only* row out of 378 with
  `overflowPx > 2`). Confirmed 0 at every other viewport for this template
  (390×844 through 1920×1080), and 0 for all other 20 templates at every
  viewport/engine.
- **Measured numbers (hand traced with a live probe, ancestor-by-ancestor):**
  - `document.documentElement`: `clientWidth: 360`, `scrollWidth: 385`.
  - `main.home-main`: rect width `360px` (correct, `max-width: 1120px`
    doesn't bind here).
  - `.home-sections` (a CSS Grid container, direct child of `main`): rect
    width `328px` — correct, matches `main`'s content box after its 16px
    gutters.
  - `.home-stats` (`display: block`, a **grid item** of `.home-sections`):
    rect width **`369.3px`** — 41px *wider than its own grid track*.
  - Its child `.stats-grid` resolves `grid-template-columns` to a single
    computed track of `337.297px` (2 `.stat` children, each `337px` wide) —
    both numbers are ~369px minus the section's own box math, and both are
    essentially **the same regardless of whether the viewport is 360 or
    390px** (337.3px at 360, 337.97px at 390) — the tell that this box's
    width is being driven by its own content's minimum, not by the
    containing block.
- **Root cause:** `apps/web/app/styles/home.css`:
  ```css
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--gutter);
  }
  ```
  A CSS Grid (and flex) container's default `min-width` is `auto`, which
  resolves to the **automatic minimum size** of its content — for a grid
  container, that includes each track's own minimum (`200px` per track
  here). With `--gutter: 16px` and a 328px available content box at 360px
  viewport, two `200px` tracks plus one `16px` gap need `416px` — more than
  is available — so `.stats-grid`, and every ancestor up to `.home-stats`
  (the actual grid **item** placed in `.home-sections`), is pushed wider
  than its assigned track by its own unshrinkable content minimum, instead
  of being clipped or wrapped. This is the textbook CSS Grid "blowout": an
  explicit `width: 100%`/`max-width` on a descendant does not stop an
  ancestor's `min-width: auto` from winning.
- **Single point of intervention:** `apps/web/app/styles/home.css`, the
  `.stats-grid` rule (and/or `.home-stats`) — add `min-width: 0;` to break
  the automatic-minimum-size chain. (A `min-width: 0` on `.home-stats` alone
  is sufficient and is the smaller, more targeted change; adding it to
  `.stats-grid` as well is the more defensive fix since the same
  `minmax(200px, ...)` pattern could recur elsewhere.)
- **Severity justification:** measured, identical on all three engines,
  real horizontal page scroll at the smallest required viewport on the
  homepage — the one page every visitor is most likely to land on first.

### 3. [High] Desktop split-view board: the location column is too narrow for real data

- **Template / viewport / engine:** every template that embeds `JobBoard`
  in its default (non-mobile-stacked) layout — `home`, `jobs-catalog`,
  `hidden-jobs`, `rankings`, `hub-landing`, `salaries-index`,
  `salary-detail`, `salary-comparison`. 1024×768, 1440×900, 1920×1080.
  Reproduced on all three engines.
- **Measured numbers:** `qa/out/layout.json`, aggregated across all rows'
  `evidence.clippedText`, filtered to `className` containing
  `"board-loc__text"`: **423 occurrences** across the matrix, all at
  1024×768/1440×900/1920×1080 (zero at 360×740/390×844/768×1024 — see root
  cause below for why). Worst cases:
  - 1024×768: `"New York City Metropolitan Area US"` → `scrollWidth: 208`,
    `clientWidth: 20`.
  - 1440×900 / 1920×1080: `"California San Francisco United States"` →
    `scrollWidth: 220`, `clientWidth: 30`.
  In both cases under 15% of the string's own pixel width is visible before
  the ellipsis.
- **Root cause:** `apps/web/app/styles/board.css`, line 149:
  `.board-col-loc { width: 12%; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; }`. This 12% is computed against the **list pane**,
  which at these viewports is only **half** the total width
  (`.board { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }`,
  board.css line 40) because the board renders as a two-pane split view
  (list + detail) above the 959px breakpoint. 12% of a ~700–960px half-pane
  is only 84–115px, and after the pin icon (`.board-loc__pin`) and the row's
  own padding, the text span itself is left with the 20–30px measured above
  — nowhere near enough for a real "City, Region, Country" string. The
  ellipsis mechanism itself (`.board-loc__text`, `nodework.css` lines
  385–390) is correctly built (`min-width: 0` on the flex parent,
  `text-overflow: ellipsis` on the text span) — the defect is the available
  width, not the CSS mechanism.
- **Single point of intervention:** `apps/web/app/styles/board.css`, the
  base (non-media-query) `.board-col-loc` rule at line 149 — widen its share
  (e.g. to 16–18%) and/or add a `min-width` in px, taking the difference
  from `.board-col-job` (42%) or `.board-col-tags` (18%), whichever the
  design can spare.
- **Severity justification:** hits the primary, default desktop rendering
  of eight templates, on real (not edge-case) location data — most US
  metro-area strings in the source data exceed the available width. Not
  Critical because the information isn't destroyed for *other* rows on the
  page (only the ones with a long location string), and the row otherwise
  degrades gracefully (icon + partial text + native `title` attribute is not
  present, but the row is still clickable and the full location shows on the
  job's own detail page).

### 4. [High] Site-wide sub-24px tap targets from three separate, unrelated rules

- **Template / viewport / engine:** effectively all 21 templates, all 6
  viewports, all 3 engines — `smallTargetCount` (the generic `< 24px` check)
  is non-zero and roughly constant (102–132, ignoring the two outliers noted
  below) **regardless of viewport**, including 1920×1080 desktop, which is
  the tell that these are not responsive/reflow bugs but fixed-size rules.
  `qa/out/layout.json`, aggregated `checks.smallTargetCount` by template ×
  viewport.
- **Measured numbers / root causes (three independent rules, confirmed live
  with `getComputedStyle` + `getBoundingClientRect`, not just the matrix's
  truncated evidence slice):**
  1. **Wordmark logo link**, present in the header nav and the footer brand
     column on every page: `<a class="wordmark">` renders **22px tall**
     (header) / **22.4px tall** (footer, larger font-size). Root cause:
     `apps/web/app/styles/chrome.css` lines 47–60, `.wordmark { ...
     line-height: 1; ... }` combined with `.wordmark__mark { width: 22px;
     height: 22px; }` (lines 66–68) — no `min-height` anywhere in the chain,
     so the flex row's height is dictated entirely by its 22px icon /
     `line-height: 1` text. `apps/web/app/styles/footer.css` line 43 only
     overrides `font-size`, so it inherits the same lack of a floor.
     **Single point of intervention:** add `min-height: 44px;` (or at least
     `24px`) to `.wordmark` in `chrome.css` — this one rule fixes both the
     header and footer instance since footer.css never overrides
     `min-height`.
  2. **Footer nav links**, 27 per page, every page (site footer renders from
     `layout.tsx`): `.footer-column__links a` renders **~22.5px tall**
     (`fontSize: 14.08px`, computed `lineHeight: 22.528px`, no padding, no
     `min-height`). Root cause: `apps/web/app/styles/footer.css` lines
     85–91. **Single point of intervention:** add `min-height: 24px;
     display: flex; align-items: center;` (or equivalent padding) to
     `.footer-column__links a` in the same file.
  3. **Table row-label links** (`TABLE_HEADING_STYLE`, `apps/web/app/_components/table-heading.tsx`):
     used by `salary-tables.tsx` (salaries-index, salary-detail,
     salary-comparison), `web3-cities/page.tsx` (roles-cities-directory),
     `web3-companies/_directory.tsx` and `web3-companies/top-growing/page.tsx`
     (companies-index, rankings). `TABLE_HEADING_STYLE` sets
     `display: "inline"` and `font: "inherit"` on the `<h2>`/link wrapper so
     it "must not look like a heading" (by design, per the component's own
     comment) — but an **inline** element's `getBoundingClientRect()` is
     just its text line box, not the padded `<td>` around it
     (`.table td { padding: 12px 14px; }`), so the *actual clickable area*
     is only the glyph line height (~14–22px depending on font-size,
     independent of the 12px cell padding that visually surrounds it). Live
     probe on `/web3-salaries` at 1920×1080 found **170** such links on that
     one page alone (one per role row, across the page's several stacked
     tables). This is the single largest contributor to the site-wide
     small-target count by volume, though because it's driven by row count
     rather than being a fixed per-page number, it does not show up as a
     flat baseline the way findings 1–2 do (`salaries-index`: 498–651 vs. a
     ~102–132 baseline everywhere else). **Single point of intervention:**
     `apps/web/app/_components/table-heading.tsx` — the reset object itself
     has no room for a hit-area fix without breaking the "must not look like
     a heading" requirement it documents, so the more surgical fix is a new
     rule in `apps/web/app/globals.css` targeting `.table td a` (already
     styled at lines 1211–1214 for color/decoration) to add `display:
     inline-block; min-height: 24px; padding-block: 6px;` — this reclaims
     the cell's existing 12px padding as part of the link's hit area without
     touching the visual heading-reset contract.
- **Severity justification:** the wordmark and footer links are unavoidable,
  every-page, primary-navigation elements — "High" because a visitor will
  hit them on a completely normal path (leaving via the footer, or tapping
  the logo to go home) on every single page load, not an edge case. The
  table-heading links are the majority-by-volume defect and sit on six
  content-heavy templates' primary content interaction (clicking a role/
  company/city name to navigate).

### 5. [Low] Pervasive 24–43px "comfort" band on touch viewports

- Per the task's instruction to separate sub-44px from sub-24px: after
  excluding the hard `<24px` defects already covered by finding 4, a sweep
  of `smallTargets(page, 44)` on the two touch viewports (390×844,
  768×1024) across all 21 templates × 3 engines (`qa/layout-targeted.mjs`,
  `comfortTargets` section, 126 rows) found a large, fairly uniform "comfort"
  population — dominated by:
  - `.chip` (`apps/web/app/globals.css` line 828: `min-height: 32px`) — tag
    chips, category filters, region links. This is a **deliberate** choice
    already raised once above the hard 24px floor (see the class's own code
    comment in `board.css` — "Raising the chips to the 24px WCAG tap-target
    minimum widened them by 4px" — the shipped value, 32px, is in fact 8px
    above that floor, so this is intentional density-vs-comfort trade-off,
    not an oversight).
  - The mobile-menu hamburger button (`40×40px`) and the "Post a job" header
    CTA (`~38–40px` tall).
- **Not escalated to a defect** per the task's own instruction to flag
  sub-44px separately from sub-24px "rather than a defect." Reported here
  for completeness and because of its sheer volume (largest single number
  in this report, ~11,500 rows across the full sweep), but every instance
  found is ≥24px and the dominant contributor (`.chip`) is a documented,
  deliberate choice, not a bug.

---

## Rejected candidates (investigated, not reproduced — evidence below)

### R1. Rank-number/job-title collision on the four named ranked pages

**Not reproduced.** Checked `/highest-paid-developer-jobs`,
`/highest-paying-web3-jobs`, `/highest-paid-designers-jobs`,
`/highest-paid-non-tech-jobs` at 360×740 and 390×844 on all 3 engines (24
rows total, `qa/layout-targeted.mjs`, `rankOverlay` section). Zero
`collides: true` results and zero page-level overflow on any of the 24
rows. The rank number (`.board-row__rank`, absolutely positioned at
`left: 8px`) and the job title never overlap spatially — `.board-col-job`'s
`padding-left: 32px` reservation (board.css lines 341–344, and its mobile
re-assertion at lines 625–632) does what its own code comment says it does.
**However**, while checking this, the far more severe finding 1 above (title
crushed to 0px by a *different* mechanism — the sibling `posted`/`loc`/`pay`
column, not the rank overlay) was found on the same pages/viewports. The
"does a long title run underneath the number" question is answered "no" in
the literal sense asked, but the row can still lose its title entirely for
an unrelated reason.

### R2. Page-2 ranking tint leaking onto rows 1–3

**Not reproduced** in the form asked. Checked `/highest-paid-developer-jobs`
vs `/highest-paid-developer-jobs?page=2` at 360×740 and 1440×900, all 3
engines (12 rows, `qa/layout-targeted.mjs`, `tint` section). On every page-2
row, `document.querySelector(".board-table").classList.contains
("board-table--ranked-top")` is `false`, exactly as `job-board.tsx`'s own
doc comment says it should be (the class is only emitted when
`rankOffset === 0`). Rows 2 and 3 on page 2 are correctly untinted
(`background-color: rgba(0, 0, 0, 0)`).

One thing worth flagging to the coordinator even though it isn't the bug
that was asked about: page 2's **first** row *does* render with the same
pink tint (`rgba(255, 45, 135, 0.14)`) as the top-3 wash. Investigation
(reading `className`) shows this is `board-tr.is-active` — the
currently-selected job in the split-view pane, which defaults to the first
row of whichever page is loaded (no `job=` query param) — and
`.board-tr.is-active` (board.css) happens to use the same `var(--accent-soft)`
token as `.board-table--ranked-top .board-tr:nth-child(-n+3)`. This is a
coincidental shared-color reuse, not a resurfacing of the ranking logic
(confirmed: the `board-table--ranked-top` class is genuinely absent), but it
means a quick eyeball check of page 2 ("is row 1 pink? then the tint bug is
back") will produce a false alarm. Worth a design-token note, not a layout
defect.

### R3. Salary seniority chart failing to fall back to a table below 480px

**Not reproduced — verified working correctly** on both
`/web3-salaries/backend-developer` and `/web3-salaries/solana-vs-ethereum`,
at 360×740 and 390×844 (`.chart__viz` computed `display: none`,
`.chart__table` computed `display: block`, `pageOverflowPx: 0`), with the
control case at 768×1024 showing the reverse (`viz` block / `table` none),
on all 3 engines (18 rows, `qa/layout-targeted.mjs`, `chartFallback`
section). `apps/web/app/styles/salary.css` lines 284–292
(`@media (max-width: 480px)`) does exactly what its own comment says.

### R4. Company-card grid failing to collapse 3→2→1

**Not reproduced.** `/web3-companies`'s `.company-grid` resolved to the
correct column count at every required viewport, on all 3 engines (21 rows,
`qa/layout-targeted.mjs`, `companyGrid` section): 1 column at 360×740/390×844,
2 at 768×1024, 3 at 1024×768/1440×900/1920×1080.

A latent, related question was also checked and closed out: `.company-grid`
carries both the `grid--3` class (`apps/web/app/globals.css`, `--cols: 1` at
`max-width: 640px`) and its own `.company-grid` rule
(`apps/web/app/styles/board.css`, `--cols: 1` at `max-width: 560px`) — two
different stylesheets setting the same custom property at two different
breakpoints, an "asymmetric breakpoint" code smell that could, in principle,
make the grid's behavior between 561–640px depend on which stylesheet the
bundler happens to emit last (the same class of risk flagged in this
project's own notes about CSS token order). None of the six required
viewports falls in that 561–640px gap, so an extra probe viewport (600×900,
outside the required matrix, added specifically to stress-test this) was
run: it resolved to 2 columns, matching `board.css`'s rule, not
`globals.css`'s — i.e. `board.css` wins the cascade at the point where the
two rules actually disagree, and the grid renders correctly there too. Not
reported as a finding because behavior is correct at every width tested,
including the deliberately-added edge case; noted here only because it was
investigated on a specific, reasoned suspicion and the suspicion did not
pan out.

### R5. Tables/code samples pushing the page instead of scrolling internally

**Not reproduced.** Every `<table>` and the one `<pre>` code sample in the
app (`grep -rln "table-wrap\|<table\|<pre" app --include="*.tsx"`, 9 files)
sits inside a container with `overflow-x: auto`:
`.table-wrap` (globals.css), `.jd-table-wrap` (job-detail.css),
`.jobs-company-table-wrap`/`.jobs-table-wrap` (jobs.css),
`.marketing-table-wrap`/`.marketing-code` (marketing.css), or an inline
`style={{ overflowX: "auto" }}` (`web3-cities/page.tsx`). The full 378-row
`overflowPx` matrix confirms zero page-level overflow attributable to any of
these — the one overflow row found in the entire matrix (`home`, 360×740,
finding 2 above) is a `.stats-grid` blowout unrelated to any table or code
block.

---

## Reflow integrity

Checked via three independent signals rather than a single generic check:
(a) the full matrix's `overflowPx` at all 6 viewports for all 21 templates —
a template "pinned at a desktop width" on a narrow viewport would show up
here as overflow, and only the one already-reported `home`/`stats-grid` case
did; (b) the company-grid 3→2→1 collapse (R4) and the salary-chart
viz/table swap (R3), both hand-verified at every required viewport; (c) the
mobile board-table restructuring itself (table → stacked-card grid at
≤959px) is what finding 1 above is a *failure mode inside*, which is itself
proof the restructuring is happening (a template that failed to reflow at
all would not exhibit an `auto`-track grid blowout specific to the mobile
grid-template-areas layout — it would just render the unmodified desktop
table, overflowing predictably and uniformly instead of in this
data-dependent way). No template was found rendering its desktop layout
unchanged at 360/390/768.

## What could not be tested, and why

- **Real `/dashboard`, `/profile`, `/settings` rendering.** As documented in
  `qa/README.md` before this pass started, the harness has no seeded
  better-auth session, so the `account` template row only ever exercises the
  anonymous 307-redirect-to-`/login` path (confirmed: `gotoStatus: 200` for
  the final landed page in every `account` row, consistent with the
  documented redirect chain, not a 500). No layout claim in this report
  covers the authenticated dashboard/profile/settings UI itself.
- **The 360×740 viewport's touch emulation.** Per `harness.mjs`'s own
  comment, 360×740 is configured with `hasTouch: false` per a literal
  reading of the design spec sentence that only marks 390×844 and 768×1024
  as "(touch)". If that's a spec oversight rather than intentional, this
  report's 360×740 numbers (which behave as a non-touch, non-mobile browser
  context on Chromium specifically — no `isMobile` flag either) may not
  fully represent a real 360px-wide phone. This affects primarily the
  comfort-target sweep (finding 5), which was deliberately restricted to
  the two viewports the harness does mark `hasTouch: true`, and does not
  affect findings 1–4, which reproduce identically with or without touch
  emulation (they are pure CSS/box-model measurements).
- **`contrastPairs()` was not used by this dimension.** It's explicitly the
  accessibility dimension's instrument per the harness's own doc comment;
  layout's tap-target and overflow primitives don't overlap with it.
- **Exhaustive per-row cataloguing of the ~11,500 comfort-band targets**
  (finding 5) was not done — the volume is large enough that a full listing
  would be noise rather than signal; the dominant root cause (`.chip`) is
  named and its deliberateness is evidenced by its own code comment, which
  is the actionable content a "comfort, not defect" finding needs.
