# Aurora QA — Motion and Performance dimension

Date: 2026-09-10. Server under test: `next start -p 3100` (production build),
`BETTER_AUTH_SECRET=qa-harness-local-secret`, already running, owned by the
coordinator — never rebuilt or restarted during this pass. Instrument:
`qa/harness.mjs` + `qa/templates.mjs`, self-tested clean on
chromium/firefox/webkit before use (`node qa/self-test.mjs`, all 9 checks
pass). Server was shared with the layout, interaction and accessibility
dimensions running concurrently, so absolute timings are contended; medians
and sample counts are stated per finding, and relative comparisons across
templates are the signal this report leans on, per the coordinator's own
instrument note.

Bespoke scripts written for this pass (all under `qa/`, none of them edits to
application source): `motion-scroll-check.mjs`, `motion-scroll-diag.mjs`,
`motion-reduced-check.mjs`, `motion-nojs-check.mjs`,
`motion-sheen-count-check.mjs`, `motion-theater-loop-check.mjs`,
`motion-viewtransition-check.mjs`, `motion-control-blocking-check.mjs`,
`motion-perf-check.mjs`, `motion-lcp-check.mjs`, `motion-cls-check.mjs`.

**Correction to the brief's own premise, established first because it
reframes every finding below:** `animation-timeline: view()` is supported by
**Chromium and WebKit** in this environment, not by Chromium alone —
confirmed directly with `CSS.supports('animation-timeline', 'view()')`:

| Engine | `view()` | `scroll()` | `document.startViewTransition` |
|---|---|---|---|
| Chromium 153 | true | true | true |
| Firefox 155 | **false** | **false** | true |
| WebKit 26.6 | **true** | true | true |

Only **Firefox** exercises the `@supports not (animation-timeline: view())`
fallback branch of `apps/web/app/styles/motion.css` (the IntersectionObserver
+ `RevealObserver.tsx` path). Chromium and WebKit both run the native
scroll-timeline branch. This is why the bugs below split the way they do:
Chromium and WebKit share one bug (native-timeline path), Firefox has two
different ones (JS-fallback path).

**Every finding below was reproduced by hand**, most of them several times
with different scroll/instrumentation strategies to rule out test artifacts —
see the "Rejected candidates" section for the ones that turned out to be the
harness's fault, not the app's.

---

## Summary

| Severity | Finding | Template(s) | Engine(s) |
|---|---|---|---|
| Critical | `.m-reveal` sections can be left permanently at `opacity: 0` after a normal scroll to the bottom — the IntersectionObserver fallback misses the intersection crossing on fast/native smooth scrolling, non-deterministically | home, company-tag (confirmed; likely any `data`/`stage` template) | Firefox only |
| High | `prefers-reduced-motion: reduce` is not honoured for any `.m-reveal`/`.m-count` element that hasn't yet scrolled into view — a CSS specificity bug forces `opacity: 0` even though the reduced-motion rule explicitly tries to force `opacity: 1` | home, job-detail, rankings, editorial-article (13/19, 2/5, 2/3, 5/6 elements respectively) | Firefox only |
| Medium | Two above-the-fold hero elements (search bar, tag chips) render at a fixed, wrong opacity (0.91 and 0.55) on every single page load and never update in response to any scroll, in either direction, with or without JavaScript | home | Chromium and WebKit |
| Low | `experimental.viewTransition: true` never actually fires a view transition, in any engine — the flag requires the `react-dom` "experimental" channel and this project pins stable React 19; navigation itself is unaffected | all (tested on home → jobs-catalog) | all three (inert everywhere) |
| Low | The stagger contract (`data-reveal-delay="1"`–`"12"`) is only implemented in CSS for delay levels 1–3; sections at delay 4–12 (9 of the home page's 12 sections) silently collapse to the base, undelayed range | home | all (CSS-level, engine-independent) |
| Low | Two of the six theater components (`DigestTheater`/th5, `NotOnLinkedinTheater`/th2) plus the `Marquee`-based `Testimonials` and `StudioTicker` components are dead code — never imported by any route, so `.m-marquee`/`.marquee` never renders in the shipped app and the reduced-motion "marquee must stop" contract has nothing to verify against | home (would-be) | n/a — unreachable |
| — | Everything else checked (m-sheen count, control availability during motion, CLS on `/login` and home, Turnstile height reservation, page-navigation correctness, theater loop construction) passed. See "Verified working." | multiple | multiple |

---

## Critical

### C1 — Firefox: `.m-reveal` sections can stay invisible forever after a real scroll to the bottom

- **Template / engine:** home and company-tag confirmed; the bug is in the
  shared observer, not template-specific. Firefox 155 only (the only engine
  here on the JS-fallback path — see the correction above).
- **How reproduced:** navigated to `/`, clicked into the page, pressed the
  `End` key once (a single native browser action — not a scripted `scrollTo`
  loop), waited 4s for the site's own `scroll-behavior: smooth` (set in
  `app/globals.css:128`, `html { scroll-behavior: smooth; }`) plus any
  IntersectionObserver callbacks to settle, then read computed `opacity` on
  every `.m-reveal`/`.m-count` element. Repeated **4 independent times**.
  Every run found between 1 and 3 sections stuck at `opacity: 0` with no
  `is-in` class — and **a different subset each time**:
  ```
  run 1: Job Position and Company... (nested inside JobBoard), "How people use Nodework" (delay 10)
  run 2: "How people use Nodework" (delay 10)
  run 3: "Discovery..." (delay 4), "Pricing..." (delay 8)
  run 4 (from the 21-template sweep): "Pricing..." (delay 8)
  ```
  A 21-template × 3-engine sweep (`motion-scroll-check.mjs`, 1 sample each,
  63 page loads) independently caught the same class of failure on `home`
  (1 stuck) and `company-tag` (1 stuck, the `jobs-company-table-wrap`
  section) on Firefox only.
- **Root cause:** `apps/web/app/_components/reveal-observer.tsx`. The
  `IntersectionObserver` is configured with a single threshold and a
  margin that *shrinks* the effective viewport:
  ```js
  { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  ```
  `html { scroll-behavior: smooth }` (`app/globals.css:128`) means any jump
  to the bottom (End key, a "back to top"-style control, a fast trackpad
  flick) is a multi-frame native scroll animation, not a single reflow.
  With a single 12% threshold and a shrunk margin, a section whose visible
  window is short relative to the per-frame scroll delta can have its
  intersection ratio cross 0% → 12%+ → 0% between two sampled frames without
  the observer ever reporting `isIntersecting: true` for it — so
  `entry.target.classList.add("is-in")` never runs, and the element is
  permanently stuck at the fallback branch's unrevealed state
  (`app/styles/motion.css:161-165`):
  ```css
  @media (scripting: enabled) {
    .m-reveal[data-reveal]:not(.is-in) { opacity: 0; transform: translateY(var(--reveal-d)); }
  }
  ```
  Non-determinism (different section each run) is exactly what a
  frame-sampling race looks like, and is itself evidence this isn't a
  one-off fluke.
- **Single point of intervention:** `apps/web/app/_components/reveal-observer.tsx`,
  the `IntersectionObserver` options object. Widen the margin in the
  direction of scroll travel (e.g. a large *positive* `rootMargin` such as
  `"0px 0px 200px 0px"` instead of a negative one) so the window during which
  any sampled frame can catch the crossing is large, and/or observe with an
  array of thresholds (`[0, 0.12]`) instead of one. This is the standard fix
  for "lazy reveal misses a fast scroll."

---

## High

### H1 — Firefox: `prefers-reduced-motion: reduce` does not resolve to visible for below-the-fold content

- **Template / engine:** sampled 8 templates × 3 engines with
  `reducedMotion: "reduce"` context emulation, no scroll
  (`motion-reduced-check.mjs`, 24 page loads). Chromium and WebKit: 0 bad
  elements everywhere. **Firefox: bad on every template that had
  below-the-fold `.m-reveal` content that hadn't been scrolled to:**
  home 13/19, job-detail 2/5, rankings 2/3, editorial-article 5/6.
- **Steps:** emulate `prefers-reduced-motion: reduce`, load the page, do
  **not** scroll, read computed `opacity` on every `.m-reveal`/`.m-count`.
- **Expected** (per the file's own header comment in
  `app/styles/motion.css`): *"The default state is ALWAYS the finished,
  visible page"* and *"Reduced motion. Not optional. Every opacity end-state
  resolves to visible."*
- **Actual:** every element below the fold renders at `opacity: 0`,
  `is-in` absent, exactly as if reduced motion were not set at all.
- **Root cause:** a CSS specificity collision in
  `apps/web/app/styles/motion.css`. Two rules compete for the same element,
  and specificity — not source order — decides the winner:
  - Line 162, inside `@supports not (animation-timeline: view())` →
    `@media (scripting: enabled)`:
    ```css
    .m-reveal[data-reveal]:not(.is-in) { opacity: 0; transform: translateY(var(--reveal-d)); }
    ```
    Specificity: one class + one attribute + one pseudo-class argument
    (`.is-in`) = **(0,3,0)**.
  - Line 369-374, inside `@media (prefers-reduced-motion: reduce)`:
    ```css
    .m-reveal,
    .m-count > * {
      animation: none;
      opacity: 1;
      transform: none;
    }
    ```
    Specificity: one class = **(0,1,0)**, **no `!important`**.

  `(0,3,0) > (0,1,0)`, so the fallback's `opacity: 0` wins *regardless of
  which rule appears later in the file* — the reduced-motion override at
  line 369 never actually overrides anything for an element that hasn't
  received `.is-in` yet. The identical bug exists for `.m-count > *` against
  the competing `.m-count[data-reveal]:not(.is-in) > *` rule at line 261
  (same specificity math, same fix).
- **Single point of intervention:** `apps/web/app/styles/motion.css`, the
  `@media (prefers-reduced-motion: reduce)` block (lines 369-374). Every
  other declaration in that same media block already uses `!important`
  (`animation-duration: 1ms !important`, etc.) — this rule is the one
  exception. Adding `!important` to `opacity` and `transform` here (or
  raising the selector's specificity to match/exceed `.m-reveal[data-reveal]:not(.is-in)`)
  fixes both the `.m-reveal` and `.m-count` cases at once, consistent with
  the file's own established pattern.

---

## Medium

### M1 — Chromium & WebKit: two home-hero elements render at a fixed, wrong opacity forever

- **Template / engine:** home only. Chromium and WebKit (the two engines
  that run the native `animation-timeline: view()` branch).
- **How reproduced:** this took several rounds to pin down precisely, and
  each round is worth stating because the conclusion depends on all of them:
  1. Fresh load, **no scroll at all**: `.home-hero__search` (delay 2) reads
     `opacity: 0.910663`; the `TagChips` wrapper (delay 3) reads
     `opacity: 0.553599`. Both carry `is-in` (RevealObserver added it
     immediately since they're already on screen at mount — irrelevant to
     Chromium/WebKit's native-timeline branch, but confirms JS ran).
  2. Waited 500ms with no scroll: identical values.
  3. `mouse.wheel(0, 300)` then `mouse.wheel(0, -300)` (net scroll 0):
     identical values — expected, since net displacement is 0.
  4. **The real test:** six genuinely distinct scroll positions
     (`scrollY = 0, 100, 200, 300, 400, 500`), each confirmed by reading
     `getBoundingClientRect().top` (which *did* move exactly with scroll:
     503 → 403 → 303 → 203 → 103 → 3). Opacity at every single position:
     `0.910663` and `0.553599`, to six decimal places, unchanged.
  5. Scrolled to the true document bottom (`scrollY = 13988`, confirmed
     `atBottom: true`) via a single `End` key press: identical values.
     `getBoundingClientRect()` confirmed the elements were **13,484px and
     13,388px above the viewport** at that point — off-screen, so this
     specific reading doesn't matter to a viewer.
  6. Pressed `Home` to return to the top: elements are back in the viewport
     (`top: 503px`/`599px` inside a 900px-tall viewport) and **still read
     the identical 0.91/0.55** — this is the reading that matters, because
     the element is now visibly on screen, semi-transparent, and stays that
     way.
  7. Repeated step 4-6 with `javaScriptEnabled: false`: identical values —
     rules out `RevealObserver`/React entirely; this is a pure CSS/engine
     interaction.
  8. The sibling `.lead` element (delay 1, same parent, same nesting depth)
     resolves correctly to `opacity: 1` at every position tested — isolating
     the defect to the delay-2 and delay-3 rules/elements specifically, not
     to `animation-timeline: view()` as a whole, nesting, or JS.
- **What this means:** the `animation-timeline: view()` computation for
  these two specific elements is evaluated once (apparently at first
  style/layout pass, while the timeline has not yet reached the animation's
  configured end point) and is never re-evaluated on any subsequent scroll —
  in the opposite direction from C1 above, this doesn't mean the content is
  invisible, but it does mean it is **permanently, visibly dimmed**
  (especially the tag-chip row at 55% opacity) on every single page load, in
  two of the three engines tested, and no amount of user scrolling ever
  fixes it.
- **Root cause (narrowed, not fully diagnosed — this is a genuine rendering-
  engine interaction, not something further code reading can fully explain):**
  isolated to `.m-reveal[data-reveal-delay="2"]` and `="3"` specifically
  (`apps/web/app/styles/motion.css` lines ~101-107,
  `animation-range: entry 12% cover 44%` / `entry 18% cover 50%`), applied to
  two short elements (a search form, an inline chip row) sitting inside a
  tall hero whose own wrapper (`.home-hero`) is *also* `.m-reveal` (base
  range). Delay 1 (same parent, wider `cover` requirement) does not exhibit
  the bug; delay 2/3 (narrower elements, later `cover` targets) do, on both
  engines that implement the feature.
- **Single point of intervention:** `apps/web/app/page.tsx` lines ~150-161
  (the home-hero markup) combined with
  `apps/web/app/styles/motion.css` lines 101-107. The pragmatic fix that
  doesn't require debugging two rendering engines: stop applying
  `data-reveal-delay="2"`/`"3"` to these two specific elements (drop the
  attribute, falling back to the base `.m-reveal` range that delay-1's
  sibling and the parent both resolve correctly with), since they're the
  only two elements in the whole app using those two delay levels on
  short/inline content nested this closely under another `.m-reveal`.

---

## Low

### L1 — `experimental.viewTransition` is inert in every engine, not just non-Chromium ones

- **Template / engine:** tested via nav-link click on home → jobs-catalog,
  all three engines, both with and without instrumentation (9 navigations
  total).
- **Evidence:** `document.startViewTransition` exists in all three engines
  (see the correction table at the top), but a monkey-patched wrapper around
  it (`window.__vtCalls++`) recorded **zero calls** during a real same-
  document `<Link>` navigation, in **every** engine, including Chromium.
  Navigation itself succeeds correctly regardless (see "Verified working").
- **Root cause:** `apps/web/next.config.ts` sets `experimental.viewTransition: true`
  with a comment saying this lets same-document `<Link>` navigation run
  through the View Transitions API. In Next 15.5.25, that wiring only exists
  in the bundled `react-dom-experimental` package
  (`grep -rl startViewTransition node_modules/next/dist` matches only
  `app-page-experimental.runtime.*` on the server side and the
  `react-dom-experimental` bundles on the client side — never plain
  `react-dom`). This project's `package.json` pins
  `"react": "^19.1.0"` / `"react-dom": "^19.1.0"` — the **stable** channel,
  confirmed installed at `react-dom@19.2.8`. The feature flag has no effect
  without the experimental React channel; the config comment overstates what
  currently happens.
- **Single point of intervention:** `apps/web/next.config.ts` line 53. Either
  remove the flag (the comment already says this is "the whole fix" if it
  ever destabilises anything) since it does nothing today, or move
  `react`/`react-dom` to the `experimental` dist-tag if the Chromium
  transition effect is actually wanted. Per the severity rubric this is Low,
  not Critical: navigation is unaffected in every engine (see below) — this
  is a missing flourish, not a broken flow.

### L2 — The stagger contract only covers 3 of the 12 delay levels actually used

- **Template:** home. Engine-independent (a CSS coverage gap, not a
  rendering bug).
- **Evidence:** `apps/web/app/page.tsx` applies
  `data-reveal-delay="1"` through `="12"` across its 12 top-level sections
  (lines 154-308). `apps/web/app/styles/motion.css` only defines
  `[data-reveal-delay="1"]`, `="2"`, `="3"` (both in the `@supports
  (animation-timeline: view())` branch, lines 166-176, and in the fallback
  branch's `transition-delay`, lines 190-196). Sections at delay 4-12 (9 of
  the 12 home sections) silently fall back to the base, undelayed
  `animation-range`/no `transition-delay` — they all reveal on the same
  schedule as an un-staggered element instead of a progressively later one.
- **Impact:** cosmetic only — every element still ends at `opacity: 1`
  (confirmed by C1/H1's own test data: none of the delay-4+ sections were
  found *stuck* for a CSS reason, only for the separate IntersectionObserver
  race in C1). This is a design intent gap, not a visibility bug.
- **Single point of intervention:** `apps/web/app/styles/motion.css`,
  extend the `[data-reveal-delay="N"]` rule set through `"12"` (or, simpler,
  cap the component-side attribute at 3 and let CSS `nth-child` stagger
  further sections, since 3 is apparently the intended maximum granularity).

### L3 — Two theaters and the marquee-based sections are dead code

- **Template:** would-be home.
- **Evidence:** `app/_components/theaters/digest-theater.tsx`
  (`DigestTheater`, keyframes `th5-*`) and
  `app/_components/theaters/not-on-linkedin-theater.tsx`
  (`NotOnLinkedinTheater`, keyframes `th2-*`) are exported but never
  imported by any `.tsx` file under `app/` (`grep -rn
  "DigestTheater\|NotOnLinkedinTheater" app --include=*.tsx` matches only
  their own definition files). Separately,
  `app/_components/home/testimonials.tsx` (`Testimonials`) and
  `app/_components/home/studio-ticker.tsx` (`StudioTicker`) — the only two
  components in the app that render `<Marquee>` — are likewise never
  imported anywhere; `HomeReviews` (the component actually wired into
  `page.tsx` under the "Reviews" section) is a different, non-marquee
  carousel. Confirmed against the live rendered HTML: `grep -o
  "marquee__track\|ticker__item\|voice__tag" home.html` returns zero
  matches.
- **Impact:** `th2`/`th5`'s dissolve/rebuild loop and the marquee's
  reduced-motion "must stop entirely" contract cannot be verified against
  the shipped app because neither ships. Not a defect in what's live, but
  worth flagging since it means 3 of the 6 theaters and the one marquee
  primitive in the design system are currently unreachable by any visitor.
- **Single point of intervention:** either wire `<StudioTicker>` /
  `<Testimonials>` / the two unused theaters into a page (if they were meant
  to ship with last night's redesign), or delete the dead files — currently
  they're neither.

---

## Performance

### Verified: the "no new database query" claim for the homepage

Read `apps/web/app/page.tsx` directly rather than inferring from timing
noise (see below for why timing alone isn't trustworthy here). The homepage
makes exactly the same three D1 round trips as after the `docs/qa/2026-09-09-frontend-qa-report.md`
H1 fix: `listJobs` + `countHiringCompanies` (parallelised via `Promise.all`)
and one batched `getJobsForListItems`. The ten new sections
(`HomeMegaLinks`, `HomeReviews`, `HomeCareerFaq`, `ProfileBanner`, four static
teaser blocks, the stats band, and the wedge/browse/search feature rows) are
all built from `listed`/`companyCount`/`jobDetails` — data already in scope
from those three calls — or from static copy. **No new query was added.**
This is confirmed by code reading, not by timing, because contention makes
timing alone unreliable this run (next paragraph).

### Measurement conditions

TTFB and LCP were measured with three other QA agents (layout, interaction,
accessibility) hammering the same `next start` process concurrently, which
the coordinator's own instrument notes flags as a source of noise (see
`qa/README.md` §5). Sample spread confirms it: `salary-comparison`'s TTFB
ranged from 1.87s to 4.14s across 5 back-to-back samples on the same engine.
**Absolute numbers below should be read as "the state of things under
concurrent load," not as a clean single-agent baseline** — the 2026-09-09
report's own numbers were taken sequentially, single-agent. Where a
conclusion needed to survive this confound, it's stated as a *relative*
comparison across templates measured in the same run, per the coordinator's
guidance.

TTFB: Chromium, N=5 samples/template, all 21 templates
(`qa/motion-perf-check.mjs`); Firefox/WebKit, N=5 samples, 5 templates
cross-checked (`home`, `salaries-index`, `rankings`, `jobs-catalog`,
`editorial-article`) to confirm TTFB doesn't meaningfully vary by engine
(it shouldn't — TTFB is server + network time). LCP: Chromium only, N=5
samples/template, all 21 templates (`qa/motion-lcp-check.mjs`;
Firefox/WebKit don't implement the LCP API, confirmed via
`PerformanceObserver.supportedEntryTypes`).

| Template | TTFB median (Chromium, n=5) | TTFB median (Firefox, n=5) | TTFB median (WebKit, n=5) | LCP median (Chromium, n=5) |
|---|---|---|---|---|
| home | 1076 ms | 987 ms | 1765 ms | 1084 ms |
| jobs-catalog | 718 ms | 475 ms | 1129 ms | 556 ms |
| job-detail | 576 ms | — | — | 948 ms |
| hidden-jobs | 2406 ms | — | — | 3872 ms |
| companies-index | 2693 ms | — | — | 3788 ms |
| company-detail | 1016 ms | — | — | 1024 ms |
| company-tag | 2637 ms | — | — | 2776 ms |
| rankings | 819 ms | 1057 ms | 1310 ms | 1372 ms |
| hub-landing | 2170 ms | — | — | 2600 ms |
| roles-cities-directory | 38 ms | — | — | 708 ms |
| salaries-index | 2014 ms | 2880 ms | 3293 ms | 3616 ms |
| salary-detail | 2494 ms | — | — | 4484 ms |
| salary-comparison | 2729 ms | — | — | 3152 ms |
| learn-hub | 6 ms | — | — | 384 ms |
| editorial-article | 78 ms | 83 ms | 280 ms | 144 ms |
| pricing | 228 ms | — | — | 136 ms |
| funnel-seller-page | 228 ms | — | — | 408 ms |
| auth | 112 ms | — | — | 856 ms |
| legal-long-form | 69 ms | — | — | 184 ms |
| account (anonymous → 307) | 576 ms | — | — | 568 ms |
| 404 | 8 ms | — | — | 740 ms |

**Baseline comparison (from `docs/qa/2026-09-09-frontend-qa-report.md`):**
home was 2.13s TTFB pre-fix, 0.77s median-of-5 post-fix (both single-agent,
sequential, uncontended). This run's contended home median (1.08s) sits
between those two numbers — consistent with "the fix is still in place and
nothing new regressed it," not with "the fix regressed," because:

1. Code reading (above) confirms the exact same query shape as the fixed
   version — no N+1 was reintroduced.
2. **Relative to the other 20 templates measured in this same contended
   run**, home is solidly mid-pack, not the outlier it was pre-fix.
   `companies-index` (2.69s), `salaries-index` (2.01s), `salary-detail`
   (2.49s), `salary-comparison` (2.73s), `hub-landing` (2.17s),
   `company-tag` (2.64s) and `hidden-jobs` (2.41s) are all *slower* than
   home under the same concurrent load — and none of those seven pages
   gained any sections last night. If contention were hitting home
   specifically because of its redesign, home would stand out from that
   group; it doesn't. This is the relative signal the coordinator's note
   asked me to trust over the absolute number.

**No template is flagged as a confirmed regression** — the aggregation-heavy
salary/company pages were already the slowest pages in the 2026-09-09
report and remain the slowest here, unchanged in rank, which is what "an
unrelated, pre-existing bottleneck under extra concurrent load" looks like,
not what "the redesign regressed this page" looks like. A clean, single-
agent re-measurement (once the other three dimensions are done with the
server) would be needed to put a confident absolute number next to the
9/09 report's 0.77s; this run cannot responsibly produce one.

---

## Layout shift

`qa/motion-cls-check.mjs`, Chromium only (the Layout Instability API is not
implemented by Firefox/WebKit — confirmed via
`PerformanceObserver.supportedEntryTypes`, same limitation as LCP). N=1
navigation per template, `layout-shift` entries collected via a
`PerformanceObserver` registered before navigation (`buffered: true`),
summed over 2.5s after load.

- **`/login` Turnstile slot:** `.auth-form__turnstile` measured
  `height: 65px` / computed `min-height: 65px` with `childCount: 0` (no
  `TURNSTILE_SITE_KEY` in this environment, so the widget itself never
  loads) — confirming the reserved-height CSS
  (`apps/web/app/styles/marketing.css:337-339`) is applied from first paint,
  not just claimed in a comment. Total CLS for the page: **0.000138** — a
  single unrelated 7px `nav-mega` shift (see below), nothing from the
  Turnstile area. **Confirmed as designed.**
- **Home page:** total CLS **0.0055** (well inside the "Good" <0.1
  threshold). One shift event at t=2.18s, four contributing sources:
  - `nav-mega` moved ~7px horizontally (x: 285.1 → 292.0, width 541.3 →
    536.7) — consistent with a **font swap** reflowing the nav label text,
    exactly the case the task asked to check for. Magnitude is negligible
    (contributes ~0.0002 of the 0.0055 total) — not worth a fix at this
    size, noted for completeness rather than as a finding.
  - The other three sources (`home-hero__search`, the TagChips wrapper,
    `home-sections`) moving are the **reveal animations' own `translateY`**
    registering as layout shift, which is expected: the Layout Instability
    API counts transform-driven movement from a non-input-triggered
    animation. This is why CLS isn't literally 0 on a page using entrance
    reveals — it's inherent to the pattern, not a defect, and the total is
    still an order of magnitude under the "Good" threshold.
  - No aurora-gradient-related shift was observed — `.surface--stage::before`
    animates via `transform` only (`aurora-drift` keyframe, opacity/scale
    unaffected by layout), which is why it doesn't appear as a CLS source.

---

## Verified working

- **m-sheen, one per page, confirmed at the DOM level, not just by
  string count.** `qa/motion-sheen-count-check.mjs` (Chromium, all 21
  templates): `home` and `learn-hub` each have exactly 1 `.m-sheen` element
  (`document.querySelectorAll(".m-sheen").length`); all other 19 templates
  have 0. **Caveat worth recording:** a naive `grep -o "m-sheen" | wc -l`
  against the raw HTML reports **2** for both `home` and `learn-hub`, not 1
  — the second occurrence is the element's `className` string duplicated
  inside the RSC flight-data payload Next.js streams for hydration
  (`self.__next_f.push([1,"...home-hero m-reveal m-sheen..."])`), not a
  second element. This is a sharper version of the repo's own `grep -c`
  vs. `grep -o` counting note (`qa/README.md` §6) — even `grep -o` needs a
  real DOM count as a check when a page ships Next's flight payload inline.
- **Motion never blocks a control.** Loaded `home` and `jobs-catalog`
  fresh (`waitUntil: "domcontentloaded"`, no extra settle) and immediately
  clicked/typed into the search input on all 3 engines: worked every time,
  and `elementFromPoint` at the input's center returned the input itself
  (not an overlay) in every case. `.m-sheen::after` is `pointer-events: none`
  by construction (`app/styles/motion.css`), and no other overlay was found
  sitting over a control at any tested viewport.
- **The no-JS reveal path genuinely works without JavaScript**, once
  measured correctly (see Rejected candidates below for the naive version
  that didn't). With `javaScriptEnabled: false` and a real scroll to the
  bottom, Chromium and WebKit resolved every `.m-reveal` on `home`,
  `job-detail`, `learn-hub`, and `editorial-article` to `opacity: 1`
  (0 stuck of 11/5/6 elements respectively). Firefox (no `view()` support,
  `scripting: none` with JS disabled) shows the default-visible fallback
  state everywhere, as designed. **No inline script sets a class on
  `<html>`** — checked `app/layout.tsx` directly; the historical hydration-
  mismatch bug the brief warned about is not present.
- **The theater loop is seamless by construction, and genuinely running,
  not frozen.** Read every keyframe used by the three theaters that
  actually ship (`th1-*`, `th3-*`, `th6-*` in `app/styles/theaters.css`) —
  each one's `0%`/`100%` values are declared identically (e.g. `th1-card`:
  both endpoints are `opacity: 1; transform: none`), so the wrap-around
  cannot produce a visible jump regardless of scroll/paint timing — the
  poster frame the loop returns to and the poster frame it starts from are
  the same declared values. Confirmed dynamically too
  (`qa/motion-theater-loop-check.mjs` + a follow-up corrected run for th6):
  sampling computed style at multiple points across an 11s/10s cycle showed
  real, continuous value changes (border color, opacity, `visibility`) in
  all three engines — not a stuck/frozen animation. Dissolve windows land at
  4-6% of each cycle, matching the "dissolve at 3-8%" contract.
  Offscreen-pause (`pv[data-offscreen="true"] .theater { animation-play-
  state: paused }`, `app/globals.css:1826-1827`) and poster-freeze
  (`pv[data-state="poster"] .theater { animation: none !important }`) were
  both confirmed present in the shipped CSS.
- **Navigation works correctly in every engine** — see Rejected candidates,
  which covers this in detail since it started as an apparent Critical.

---

## Rejected candidates

Documented with evidence because knowing what didn't hold up matters as much
as what did.

### R1 — "WebKit navigation is broken" (would have been Critical)

First pass at the page-transition check used a fixed post-click wait
(`page.waitForTimeout(700)`) and found WebKit still on `/` after clicking a
nav link to `/jobs`, while Chromium and Firefox had already navigated. Per
the coordinator's methodology note (client-side Next.js navigations measured
around 620ms on this server, well above the harness's 350ms `settle()`,
which was only proven for React state updates, not navigation), this was
re-diagnosed properly: waited on `page.waitForURL("**/jobs")` with a 10s
budget instead of a fixed sleep, and ran it twice — once with no
instrumentation at all, once with the `document.startViewTransition`
monkey-patch from the L1 check still attached. **Both navigated correctly
on all three engines**, in 488-790ms:

```
chromium UNINSTRUMENTED: navigated OK in 529 ms
chromium INSTRUMENTED:   navigated OK in 488 ms
firefox  UNINSTRUMENTED: navigated OK in 635 ms
firefox  INSTRUMENTED:   navigated OK in 546 ms
webkit   UNINSTRUMENTED: navigated OK in 790 ms
webkit   INSTRUMENTED:   navigated OK in 747 ms
```

The original "broken" reading was a fixed-timeout artifact under a
contended server, not a real defect — exactly the trap the interaction
dimension's methodology note described. **Navigation is not broken in any
engine.**

### R2 — "Most of the page is invisible with JS disabled" (would have been Critical, matching the brief's central failure mode almost exactly)

Naive first pass: `javaScriptEnabled: false`, load, wait 300ms, **no
scroll**. Found 15/19 elements stuck on `home`, 4/5 on `job-detail`, 11/11
(all of them) on `learn-hub`, 5/6 on `editorial-article`, in Chromium and
WebKit. This looked like exactly the failure mode the brief said must not
exist. Re-diagnosed: these are scroll-linked CSS animations
(`animation-timeline: view()`), and the test never scrolled — so of course
below-the-fold content was still in its pre-entry state, identically to how
a *JS-enabled* page looks before you scroll. Repeated with a real scroll
(`End` key) added, JS still disabled: **0 stuck of 11/5/6 elements** on both
Chromium and WebKit, on every template retested. The CSS-only path
genuinely works without JavaScript, as designed — the first pass just never
gave it a chance to.

### R3 — "The filter chip click doesn't work" (would have been a control-blocked-by-motion finding)

A chip click on `jobs-catalog`, tested immediately after
`domcontentloaded` with a 500ms wait, appeared to leave the URL unchanged
on all 3 engines. `elementFromPoint` at the chip's exact center confirmed
the chip itself was on top (no animated overlay intercepting the click).
Re-tested with real network/navigation-event logging: the navigation *did*
fire immediately on click, but the RSC round trip for the destination page
took longer than 500ms under the same contended-server conditions as the
performance section above (`RESPONSE 200 .../community-manager-jobs`
arrived and the frame navigated to it after ~1-3s). Waiting properly showed
the click always worked. Not a motion-blocking issue — a too-short wait
against a busy server.

### R4 — `.login__form .cf-turnstile:empty { display: none }` (would have looked like it fights the reserved-height fix)

`apps/web/app/styles/account.css:423-425` has a rule that would zero out the
Turnstile slot's height while empty, which looks like it directly
contradicts the `min-height: 65px` reservation in `marketing.css`. Checked
whether `.login__form` is ever applied to the actual `/login` page: it is
not (`grep -rn "login__form" app --include=*.tsx` returns nothing) — the
real login page uses `.auth-form`, which has no such `:empty` rule. Dead,
unreachable CSS; confirmed no effect on the live page's measured CLS
(see above, 0.000138 total).

---

## What could not be tested, and why

- **`/dashboard`, `/profile`, `/settings`, `/onboarding` at their actual
  authenticated render.** Attempted to replicate the same approach the
  interaction dimension used (mint a signed `better-auth.session_token`
  cookie by inserting a `session`/`users` row into the local D1 and signing
  it with `BETTER_AUTH_SECRET` via HMAC-SHA256, exactly how
  `better-auth`'s own `dist/plugins/test-utils/cookie-builder.mjs` does it
  — confirmed the exact algorithm by reading that file directly). The
  token-generation step was **blocked by this session's own permission
  classifier** as credential fabrication before any D1 write happened. This
  is a limit of this QA run's permission scope, not something the
  application did — flagged to the coordinator rather than worked around,
  and no artifact (storageState file, cookie value) from the interaction
  dimension's own session exists on disk to reuse instead (checked; D1's
  `session`/`users` tables are empty at time of writing). These four
  templates are reported in the TTFB/LCP table above only as the anonymous
  → 307 redirect (`account` row), and their authenticated-render numbers
  are not estimated or interpolated from any other template.
- **Millisecond-precise theater-loop-seam timing.** The loop-cleanliness
  conclusion above rests on (a) static proof that every shipped theater's
  keyframes declare identical `0%`/`100%` values, and (b) dynamic proof the
  animations are genuinely running, not frozen. It does not rest on
  catching the literal millisecond of wraparound with the Web Animations
  API (`element.getAnimations()[0].currentTime`), which would require
  knowing each animation's mount timestamp precisely; given (a) already
  makes a visible jump structurally impossible, this was judged not worth
  the additional instrumentation effort.
- **CLS on other templates.** Measured `/login` and `/` only (N=1 each);
  the task specifically named these two (Turnstile reservation, font swap
  + aurora paint), and time did not extend to a full 21-template CLS sweep.
- **TTFB/LCP under uncontended (single-agent) conditions.** As stated in
  the Performance section, all timing in this report was taken while three
  other QA agents shared the same server process. A clean re-measurement
  would need the server to itself for the duration of the run.
