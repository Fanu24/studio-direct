# Aurora redesign — consolidated QA report

10 September 2026. Branch `redesign/aurora`, baseline `2ed77e7`.

Four QA dimensions ran against a production build on three real engines
(Chromium 153, Firefox 155, WebKit 26.6) across six viewports and 21 distinct
templates, followed by two adversarial verification rounds on rebuilt bundles.

Per-dimension detail: `2026-09-10-aurora-qa-layout.md`, `-interaction.md`,
`-accessibility.md`, `-motion.md`, `-verification.md`.

## Outcome

| Severity | Found | Open |
|---|---|---|
| Critical | 3 | **0** |
| High | 7 | **0** |
| Medium | 4 | **0** |
| Low | 7 | **0** |

The acceptance bar — zero Critical, zero High, suite green — is met, and the
Medium and Low findings were closed in the follow-up pass recorded in
`2026-09-10-aurora-qa-followup.md`.
522 tests pass, typecheck is clean, the production build completes at 122 pages.

## What was found and closed

**Critical**

1. *A real location string erased the job title.* "New York City Metropolitan
   Area US" made the mobile row's `auto` track claim its full content width, and
   the title — which `minmax(0, 1fr)` allows to shrink to nothing — went to 0px.
   Home and ranked pages, 360 and 390, all three engines. The track is now capped.
2. *Firefox could strand a section at opacity 0 permanently.* The reveal driver
   was an IntersectionObserver racing the site's own smooth scrolling; a fast
   scroll carried a section past the observed band between callbacks and the
   crossing was never reported. Non-deterministic: four failures in a handful of
   runs, a different section each time. Now backed by a geometry sweep. Confirmed
   over 35 runs across 7 templates with nothing stranded.
3. *The homepage scrolled sideways by 25px at 360px.* Closed on the third
   attempt. The first two fixes constrained children — the stat band, then the
   reviews carousel — and the page still overflowed, because the grid **track**
   was never constrained. `min-width: 0` belongs on `.home-section`. Now 0px on
   all three engines. A full sweep of 21 templates × 6 viewports × 3 engines
   found this was the only page-level overflow in the application.

**High**

4. *Login failed silently.* `resetTurnstileWidget` threw from inside a `finally`
   block when the widget had never mounted, replacing the real result of the
   sign-in: no error, no confirmation, an unhandled rejection. Reachable in
   production whenever Turnstile is blocked or slow, not only where the key is
   unset.
5. *Deleting an account asked nothing.* One click destroyed it, verified by hand
   on a disposable account. It now requires a typed confirmation that the server
   checks, so the guard does not depend on the browser.
6. *The skip link did not move focus.* It scrolled, but left focus on `<body>`,
   so the next Tab returned the reader to the navigation they had just skipped.
7. *The mobile sheet did not contain focus.* 60 real Tab presses walked through
   the menu and into the search and filter controls behind the overlay. The first
   fix held on Chromium and Firefox and failed on WebKit, whose default tab order
   skips plain links, so the boundary the trap waited for never arrived. Focus is
   now moved explicitly on every Tab.
8. *Reduced motion did not resolve to visible on Firefox.* The reduce block's
   `.m-reveal` at specificity (0,1,0) lost to the start state's
   `.m-reveal[data-reveal]:not(.is-in)` at (0,3,0), so a reduced-motion reader
   got a page whose lower half never appeared.
9. *The desktop location column was unreadable.* 12% of a half-width pane left
   the text 20–30px. The widths that bind are the `thead` ones, because the table
   is `table-layout: fixed`.
10. *Sub-24px tap targets on every page* from three unrelated rules: the wordmark
    in header and footer, 27 footer links per page, and table row links whose
    inline layout excluded the cell padding from the hit area.

## What remains open

**Nothing.** All four Medium and all seven Low findings were closed in a
follow-up pass on the same day — see `2026-09-10-aurora-qa-followup.md` for the
measurements. In short:

- The sub-24px tap targets were 763, not the nine this report estimated, and
  the largest group (208 links on `/web3-cities`) had never been named: the
  Round 1 fix was written as `.table td a` and the directory tables carry
  `.salary-table`. Six selector families now carry a floor on both axes.
  763 to 54, and the 54 that remain were each measured to be exempt — 36 are
  links inside a sentence (WCAG 2.5.8), and 18 are `.company-card__link`,
  whose `::after` makes the whole 373x257 card the hit area, confirmed by
  probing what is under the pointer on all three engines.
- `SalaryBarChart` is `role="group"`, and all 21 of its links per page are
  now confirmed present in the accessibility tree on three engines.
- All 16 `<th>` without `scope` have it, `/web3-cities` included.
- Six dead component files and the CSS for theaters 2, 4 and 5 are gone.
  Three, not two: the report undercounted. `.m-marquee` stays as a motion
  primitive.
- `experimental.viewTransition` was already removed when this report was
  written; nothing further was needed.

## Not tested, and why

- `/dashboard`, `/profile`, `/settings` and `/onboarding` were measured for
  interaction and rendering after a session was seeded in the local D1, but not
  for motion and performance: that agent's environment blocked the session-token
  step, and the coordinator refused to generate the token on its behalf rather
  than route around a permission decision. No numbers were estimated in their place.
- Real magic-link delivery and Google OAuth, both gated behind the Turnstile
  configuration.

## Method notes worth keeping

The instrument proved itself before it was trusted, and that mattered:

- A fixture overflowing by 510px must measure 510, not 0. Reading overflow
  against `window.innerWidth` under mobile emulation always yields 0, because
  `innerWidth` reports the visual viewport, which expands to content width.
  `clientWidth` is the layout viewport and is the correct divisor.
- The first version of that fixture reported a 980px layout viewport, because it
  had no `<meta viewport>` tag — the same false reading the instrument exists to
  prevent.
- `settle()` at 350ms is correct for same-document React state and wrong for a
  Next client navigation, which measures ~620ms. That gap produced 12 false
  failures in one run before it was diagnosed.

Four candidate findings were withdrawn after re-diagnosis, each of which would
have sent someone chasing a defect that does not exist:

- "Navigation broken on WebKit" — caused by the test itself monkey-patching
  `document.startViewTransition` to count calls. An uninstrumented click
  navigates correctly on all three engines.
- "51–111 elements per page missing focus indicators", on all 126 rows — the
  probe called `.focus()` outside natural tab order on mega-menu links that only
  become focusable after their trigger. Real Tab walks showed complete coverage.
- "Contrast failure sitewide" — a 1×1px screen-reader-only button.
- "A reveal element stuck at partial opacity" — a fixed-timeout sleep sampling
  mid-transition.
