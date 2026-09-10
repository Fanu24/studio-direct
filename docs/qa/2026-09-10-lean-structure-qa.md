# QA: lean structure and typography pass — 2026-09-10

## BLOCKING: apply migration 0009 to the remote D1 before this deploys

`getCompanyBySlug` (`apps/web/lib/jobs/queries.ts`) now selects the `description`
column, and `/web3-companies/[slug]` (`apps/web/app/web3-companies/[slug]/page.tsx`)
has `revalidate = 300` with no `generateStaticParams`, so every company detail page
renders on demand against the **production** D1, not the build-time local one.
`.github/workflows/deploy.yml` only ever runs `wrangler d1 migrations apply
gaming-jobs --local`. If this branch deploys before migration 0009 has been applied
to the remote database, every company detail page returns 500 in production.

Before deploying, run:

```
wrangler d1 execute gaming-jobs --remote --file packages/db/migrations/0009_company_description.sql
```

Then confirm it landed:

```
SELECT name FROM pragma_table_info('companies') WHERE name = 'description'
```

**CI will not catch a missing migration.** The deploy workflow's post-deploy smoke
check probes `/`, `/jobs`, and `/web3-companies` — the directory route, which never
selects `description` — plus (as of this fix wave) `/web3-companies/riot`, a detail
page, specifically so this class of failure can no longer pass unnoticed. Before
this fix, a green CI run was consistent with every company detail page being down.

Task 6 verification, scope limited to steps 1-3 of the brief (build, sweep,
write this record). Not pushed, no production database touched, live site
not probed — see "Not tested" at the end.

Build: `cd apps/web && rm -rf .next && pnpm exec next build`, served with
`BETTER_AUTH_SECRET=qa-harness-local-secret pnpm exec next start -p 3100`.
All sweeps below ran against that build.

## Build

`Generating static pages (122/122)` — same route count as the pre-task-6
baseline. No route was removed. Build completed with no errors, only the
expected local-dev warnings (missing OAuth/Stripe/Turnstile secrets).

## A local-environment defect found and fixed (not a product bug)

The local D1 database (`apps/web/.wrangler/state/v3/d1`) had **not** had
migration `0009_company_description.sql` applied, even though task 5's code
already selects the `description` column. Every `/web3-companies/[slug]`
page 500'd locally:

```
⨯ Error: D1_ERROR: no such column: description at offset 48: SQLITE_ERROR
```

This is dangerous precisely because it is quiet: the generic Next.js error
page that renders in its place has almost no markup (1 heading, no overflow,
few links), so the first pass of every sweep script "passed" the
`company-detail` template — it was measuring a broken error page, not the
real one. `verify-heading-rhythm.mjs` chromium originally reported
`company-detail: 0 cramped of 1 headings`; the real page has 7.

Fixed locally (not production, per scope):

```
$ pnpm exec wrangler d1 execute gaming-jobs --local --command "SELECT name FROM pragma_table_info('companies') WHERE name = 'description'"
[]   # column absent
$ pnpm exec wrangler d1 execute gaming-jobs --local --file ../../packages/db/migrations/0009_company_description.sql
$ pnpm exec wrangler d1 execute gaming-jobs --local --command "SELECT name FROM pragma_table_info('companies') WHERE name = 'description'"
[{"name":"description"}]   # landed
```

`curl -I http://localhost:3100/web3-companies/riot` went from 500 to 200
without restarting the server. Every sweep below was then **re-run** so the
numbers reflect the real `company-detail` template, not the error page. The
numbers in this record are all post-fix. Production's database is untouched
— this was purely local dev-environment setup, the same category of step as
seeding the database or starting the server, not "altering a live database."

## Heading rhythm — before and after

**Before (task 1's own baseline, chromium, recorded in
`.superpowers/sdd/2026-09-10-lean-web3-structure/task-1-report.md`):**

```
59 headings judged, 36 sit closer to the text above than below.
```

**After (this run, all three engines, against the corrected local DB):**

| engine | headings judged | cramped |
|---|---|---|
| chromium | 56 | 0 |
| firefox | 55 | 0 |
| webkit | 55 | 0 |

All three: `0 sit closer to the text above than below.` Gate met: zero
headings with less than 1.5x gap above vs. below, on all three engines.

The judged count dropped from 59 (task 1's baseline) to 55-56: task 3 cut
the homepage from 13 sections to 4, removing headings (FAQ, reviews,
profile banner, wedge/Browse/Search theaters) along with their sections —
expected, not a regression.

The 404 template's judged-heading-count varies by engine (chromium: 4,
firefox/webkit: 0) — this is a pre-existing cross-engine measurement quirk
documented in task-1-report.md, unrelated to any task-6 change, and it
never affects the cramped count (0 either way).

## Overflow sweep — `verify-overflow-sweep-round2.mjs`, 126 rows per engine

| engine | completed | overflowRows |
|---|---|---|
| chromium | 126/126 | 0 |
| firefox | 126/126 | 0 |
| webkit | 126/126 | 0 |

Gate met: zero page-level horizontal overflow on all three engines, all six
viewports (360-1920px), all 21 templates including the corrected
`company-detail`.

(This sweep was run twice: once before the local-DB fix — also
`overflowRows=0` on all three engines, but with `company-detail` measuring
the error page — and once after, with identical clean results, now against
the real page. Only the post-fix numbers are reported above as authoritative.
`verify-overflow-sweep-round2.mjs` only writes to stdout — it has no
`writeFile` — so neither run's numbers are re-checkable from the repo; they
are transcribed here from the terminal output at the time.)

## Tap-target residue — `verify-tap-target-residue.mjs`, three engines together

```
=== 162 sub-24px targets, grouped by selector ===
 108  p > a
  54  p.company-card__name > a.company-card__link
```

Gate met: only the two documented exemptions appear — inline links inside a
sentence, and the company-card name link (whose `::after` covers the whole
card). No other selector present. Identical result before and after the
local-DB fix (this script's page list does not include a company detail
page).

## Reduced motion — `verify-reduced-motion.mjs`

7 sampled templates (home, job-detail, company-detail, rankings,
editorial-article, pricing, funnel-seller-page) x 3 engines = 21 rows, all
identical:

```
mq=true onLoadBad=0 afterScrollBad=0 runningMarquees=0
```

Gate met: no element left invisible under `prefers-reduced-motion: reduce`,
on load or after a real scroll, and the marquee stops. Zero bad elements
everywhere, including `company-detail` after the DB fix.

## Firefox reveal stranding — `verify-reveal-firefox.mjs`

5 independent Firefox runs x 7 long templates, plus one confirming run each
on chromium/webkit (viewTimeline=true confirmed on both):

| template | firefox (5 runs) | chromium | webkit |
|---|---|---|---|
| home | stuck=0 (all 5) | stuck=0 | stuck=0 |
| job-detail | stuck=0 (all 5) | stuck=0 | stuck=0 |
| learn-hub | stuck=0 (all 5) | stuck=0 | stuck=0 |
| rankings | stuck=0 (all 5) | stuck=0 | stuck=0 |
| editorial-article | stuck=0 (all 5) | stuck=0 | stuck=0 |
| salaries-index | **stuck=4 (all 5)** | **stuck=4** | **stuck=4** |
| company-detail | stuck=0 (all 5, post-fix; total=1) | stuck=0 | stuck=0 |

### The `salaries-index` (`/web3-salaries`) "stuck=4" is a harness false
positive, not a product defect — investigated, not fixed

The 4 elements reported stuck (`.panel--accent.m-reveal`,
`.panel--cool.m-reveal`, `.board.m-reveal`, `.container.jobs-more.m-reveal`)
were reproducibly at `opacity: 0` in every run, on every engine, including
chromium and webkit where the CSS `view()` timeline path is confirmed active
(`animationName: "reveal"`, `animationTimeline: "view()"`,
`animationPlayState: "running"`).

Diagnosis (`qa/verify-salaries-stuck-diag.mjs`, kept for reference): the
script's `scrollToBottomRealistic()` helper does `page.click("body")` then
`page.keyboard.press("End")`. On `/web3-salaries`, clicking "body" lands
focus on the page's search `<input>` (`document.activeElement.tagName` ===
`"INPUT"` after the click) rather than the document — Playwright's click
target for a very tall `<body>` resolves to whatever is visible at the top
of the viewport, which on this page is the search bar. With focus on a text
input, `End` moves the text caret, not the page. Confirmed directly:
`window.scrollY` stayed `0` after click+End, and the helper's own
`waitForFunction` scroll-settle check silently times out and is swallowed
(`.catch(() => {})`), so the script proceeds to measure a page that was
never scrolled.

Calling `page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))`
directly (bypassing the click+End mechanic) scrolls correctly
(`scrollY` reaches 13137 of a 14037px-tall document) and all four elements
resolve to `opacity: 1` — the CSS reveal mechanism itself works correctly on
this template; only the test harness's click target is wrong for this
specific page's layout.

Per this task's scope (build, sweep, write the record — not fix scripts or
product code), `verify-reveal-firefox.mjs` was **not modified**. This is a
real gap in that instrument worth fixing (click a coordinate outside any
input, or use `page.mouse.wheel`/`keyboard.press` on a guaranteed non-input
element) but it is reported here, not patched.

## `.m-count` opacity check — the one thing checked by eye/script, not a
listed instrument

Task brief for the homepage move of the two stat numbers
(live jobs, hiring companies) into the hero warned that `.m-count` has no
`--now` escape hatch, unlike `.m-reveal--now`, and that `motion.css`'s own
comment records a view()-timeline element already in the first viewport
parking at partial opacity (0.91 / 0.55, measured on two other hero
elements, in the comment's own words).

Wrote `qa/verify-mcount-opacity.mjs` (no existing script covered this) and
measured the two `.m-count` elements on the homepage, immediately after
load, no scroll, on all three engines. The animation is declared on
`.m-count > *` (the inner `<span>` per `motion.css`'s own usage comment),
not on `.m-count` itself, so both the wrapper and the actual animated child
were measured:

| engine | element | childOpacity | animationName | animationTimeline |
|---|---|---|---|---|
| chromium | live jobs (1,042) | 1 | count-up | view() |
| chromium | hiring companies (315) | 1 | count-up | view() |
| firefox | live jobs (1,042) | 1 | none | (fallback) |
| firefox | hiring companies (315) | 1 | none | (fallback) |
| webkit | live jobs (1,042) | 1 | count-up | view() |
| webkit | hiring companies (315) | 1 | count-up | view() |

**No defect.** Opacity is 1 on both elements, on all three engines. Chromium
and webkit run the real `view()`-timeline path (`animationName: count-up`)
and still land at full opacity; Firefox falls through the
`@supports not (animation-timeline: view())` branch, which sets `opacity: 1`
unconditionally. The concern raised in the brief did not materialize for
these two elements — geometrically, the hero's stat numbers sit far enough
into `entry 0% entry 80%`'s range at scroll=0 that progress resolves to 1
rather than a fraction, unlike whatever produced the 0.91/0.55 measurement
recorded for the (different) elements in the `motion.css` comment. Per
instruction, this is reported, not further chased.

## `motion-theater-loop-check.mjs`

Task 3 deleted the three theater components (`CareerPagesTheater`,
`SearchTheater`, `OneBoardTheater`) and their CSS. Grepped the whole `app`
directory (excluding `qa/`) for every selector this script's `PROBES` list
referenced (`th1__`, `th2__`, `th3__`, `th4__`, `th5__`, `th6__`,
`CareerPagesTheater`, `SearchTheater`, `OneBoardTheater`): zero matches.
Every probe in the file targets a theater that no longer exists — none can
be updated to point at a survivor, because there is no survivor.

**Deleted the file** (`git rm apps/web/qa/motion-theater-loop-check.mjs`),
per the brief's own instruction ("if every probe is gone, delete the file").

## What surprised me

1. A local database that silently drifted from the code it was serving —
   task 5 shipped a query change without a corresponding local migration
   apply, and the resulting error page was well-formed enough to pass every
   structural check (no overflow, few headings, all in rhythm) without
   anyone noticing it wasn't the real page. This is exactly the failure mode
   this whole task exists to catch.
2. `verify-reveal-firefox.mjs`'s own scroll mechanism has a real,
   reproducible blind spot — it silently fails to scroll `/web3-salaries`
   because the click lands on a search input, and swallows the resulting
   timeout. Every one of 21 runs (5 firefox + 1 chromium + 1 webkit, times
   the affected template) reported the same 4 false positives.
3. The `.m-count` concern from the brief, plausible on paper given
   `motion.css`'s own bug history, did not reproduce for the actual hero
   elements — worth recording precisely because "measure it, don't guess"
   cuts both ways.

## Not tested, and why

- **Production migration not applied, not confirmed.** Explicitly the
  user's decision (live database) — out of scope for this task by
  instruction.
- **Not pushed to `origin/main`.** Explicitly out of scope by instruction;
  nothing in this branch has been shared or deployed.
- **Live worker site not probed.** Explicitly out of scope; also avoids
  billed D1 reads on the production account, per the brief's own warning.
- **`verify-reveal-firefox.mjs`'s click-target bug on `/web3-salaries` not
  fixed.** Diagnosed and reported above; task 6's scope is build, sweep,
  record — not patching test instruments or product code. Left as a known
  gap for whoever picks it up next.
- **The rest of `qa/*.mjs`** (a11y-check, motion-lcp-check, motion-cls-check,
  motion-perf-check, motion-nojs-check, motion-scroll-check/diag,
  motion-sheen-count-check, motion-viewtransition-check,
  interaction-flows.mjs, the numbered round2-bisect scripts, and others) —
  not run. The task-6 brief's Step 2 lists an exact command sequence; this
  record covers precisely that sequence, plus the separately-called-out
  `.m-count` check and the `motion-theater-loop-check.mjs` disposition. No
  other instrument was in scope, and none was run "for good measure" — a
  number not asked for is still a number that needs defending later.
- **Real mobile Safari / real Android Chrome.** Only Playwright's three
  bundled engines were used, consistent with every other QA pass in this
  project's history.
