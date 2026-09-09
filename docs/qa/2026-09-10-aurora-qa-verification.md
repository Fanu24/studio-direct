# Aurora QA — Fix verification pass

Date: 2026-09-10. Server under test: `next start -p 3100` (clean production
build, clean process, started after every fix below was applied) — never
rebuilt, never restarted, no git commands run, no application source edited
during this pass. Working directory: `apps/web`.

**Instrument, proven before use:** `node qa/self-test.mjs` — all 9 checks
passed on chromium, firefox, and webkit (`overflowPx()` against the 510px
fixture, `settle()`'s stale-read/correct-read pair against the async-DOM
fixture, all three engines). Confirmed engine versions present:
chromium-1243, firefox-1543, webkit-2359, matching `qa/README.md`.

**Methodology notes actually followed:** every navigation timing below either
uses `page.goto()` (full load), or, for the one client-side `<Link>` check
(item 9), `page.waitForURL()` + `page.waitForSelector()` on the real
destination condition — never a fixed `settle()`/sleep for a route change,
and `document.startViewTransition` was never touched. Every scroll-to-bottom
check waits on a real completion condition (scroll position stable, then
every `.m-reveal`/`.m-count` element's own opacity reaching ≥0.999, capped at
a bounded timeout) rather than a fixed sleep — an early version of the item 1
script used a flat 700ms post-scroll sleep and produced a false positive
(elements caught mid-transition at opacity 0.90–0.96 on the deep stagger
levels, which need up to 540ms delay + 620ms duration = ~1.16s to finish);
this is noted inline in the finding for transparency, not hidden.

New verification scripts (all in `qa/`, none edit application source):
`verify-matrix-sweep.mjs`, `verify-reveal-firefox.mjs`, `verify-home-overflow*.mjs`
(+ 4 bisection variants), `verify-location-crush*.mjs`, `verify-desktop-location*.mjs`,
`verify-reduced-motion.mjs`, `verify-hero-animate*.mjs`, `verify-deep-stagger.mjs`,
`verify-navigation.mjs`, `verify-skip-link*.mjs`, `verify-mobile-menu-trap.mjs`,
`verify-login-submit*.mjs`, `verify-delete-confirm-form.mjs` (+ its fixture
`qa/fixtures/delete-confirm-fixture.html`), `verify-tap-targets-fixed-rules.mjs`,
`verify-viewtimeline-support.mjs`, `verify-overflow-widths.mjs`. Raw matrix
output: `qa/out/verify-matrix-sweep.json` (378 rows).

## Summary

| # | Claimed fix | Verdict | Engines / viewports |
|---|---|---|---|
| 1 | Firefox `.m-reveal` stranding fixed by IO threshold-0 + rAF geometry sweep | **HELD** | Firefox ×35 runs / 7 templates, 0 stuck; chromium/webkit CSS path confirmed |
| 2 | Homepage 25px overflow at 360×740 fixed by `.home-stats`/`.stats-grid` `min-width:0` | **FAILED** | chromium, firefox, webkit, 360×740 (390×844 clean) |
| 3 | Long-location job title crush fixed by mobile grid `minmax(0,1fr) minmax(0,42%)` | **HELD** | 3 engines × 360/390, home + rankings |
| 4 | Desktop split-view location column widened 12%→17%, job 42%→37% | **HELD** | 3 engines × 1024/1440/1920 |
| 5 | Sub-24px tap targets fixed on 3 named rules (`.wordmark`, `.footer-column__links a`, `.table td a`) | **PARTIAL** | Full 378-row matrix |
| 6 | `prefers-reduced-motion: reduce` `!important` fix resolves visible on Firefox | **HELD** | 3 engines × 7 templates, on load + after scroll |
| 7 | Home hero elements now use `.m-reveal--now`, settle at opacity 1, still animate | **HELD** | 3 engines |
| 8 | Stagger delay levels 4–12 now resolve (both scroll-driven and fallback) | **HELD** | 3 engines |
| 9 | `experimental.viewTransition` removed; navigation unaffected | **HELD** | 3 engines |
| 10a | Skip link `#content` `tabIndex={-1}` moves focus on Enter | **HELD** (chromium/firefox); **platform quirk, not app bug** (webkit) | 3 engines |
| 10b | Mobile menu focus trap cycles focus, never escapes to overlay-covered content | **HELD** (chromium, firefox); **FAILED** (webkit) | 390×844, 3 engines, 35 Tab presses |
| 10c | `resetTurnstileWidget` try/catch — no more silent failure | **HELD** | chromium, both natural and forced widget-never-mounted |
| 10d | Delete account requires typing DELETE, checked server-side | **HELD** | anonymous POST (401) + source read + isolated fixture for client validation |

---

## 1. [was Critical] Firefox `.m-reveal` stranding — HELD

**Claim:** rewritten `RevealObserver` (IntersectionObserver threshold 0, no
negative rootMargin, backed by a rAF-coalesced geometry sweep on scroll/
resize/pageshow) stops sections being stranded at opacity 0 after a normal
scroll to the bottom.

**What I measured:** 5 runs × 7 long templates (`home`, `job-detail`,
`learn-hub`, `rankings`, `editorial-article`, `salaries-index`,
`company-detail`) = **35 independent Firefox runs**, each a fresh browser
context, real `End`-key press (respects `scroll-behavior: smooth`), waited
on scroll-position-stable then on every `.m-reveal`/`.m-count` element's own
opacity reaching ≥0.999 (bounded 4s). Result: **0 stuck elements in all 35
runs.** One confirming run per template on chromium and webkit: 0 stuck, and
`CSS.supports("animation-timeline: view()")` is `true` on both (confirmed
`false` on Firefox), so the two paths were genuinely exercised on the
engines the task specifies.

**False-positive caught and corrected during this check, reported for
transparency:** the first pass used a flat 700ms wait after scroll-settle
and found 7 "stuck" elements on `home`, reproducibly, every run —
`opacity` values 0.89–0.96, all with `is-in` already `true`. Investigation
(`qa/verify-reveal-longwait.mjs`) showed these converge to exactly 1.0 by
~1.5s: the deepest stagger levels (6–12) carry a 540ms `transition-delay`
plus a 620ms duration in the no-`view()` fallback (up to 1.16s total), so a
700ms sleep taken right at scroll-settle catches them mid-transition. This
is the CSS system working as designed, not a stranding bug. Fixed the test
to wait on the real completion condition; the corrected script found 0 stuck
in all 35 runs, and I do not report this as a defect. It is a good
illustration of the task's own warning that a fixed timeout after a
scroll/nav produces false failures.

**Verdict: HELD**, with high confidence (35 runs, 0 failures, both driving
mechanisms independently confirmed active on the right engines).

---

## 2. [was Critical] Homepage horizontal overflow at 360×740 — **FAILED**

**Claim:** `.home-stats`/`.stats-grid` got `min-width: 0` and the stats
track minimum became `minmax(min(200px, 100%), 1fr)`, eliminating the 25px
overflow.

**What I measured:**

- `overflowPx()` on home, 360×740 and 390×844, all 3 engines
  (`verify-home-overflow.mjs`):

  | Engine | 360×740 | 390×844 |
  |---|---|---|
  | chromium | **25px** | 0px |
  | firefox | **25px** | 0px |
  | webkit | **25px** | 0px |

- Full-matrix sweep (`verify-matrix-sweep.mjs`, 378 rows = 21 templates × 6
  viewports × 3 engines): **exactly 3 rows overflow, all `home`/360×740, one
  per engine, all 25px.** No other template/viewport/engine combination
  overflows anywhere in the app. So the sweep both confirms the specific
  regression named in the task is unresolved, and confirms nothing else
  regressed.

- The `.home-stats`/`.stats-grid` fix **is present and does work in
  isolation** — verified via `verify-home-overflow-bisect2.mjs`: with every
  other home section hidden, `.home-stats` alone renders at exactly 328px
  (the full available width at 360px, no overflow). The fix is real, it
  just isn't the only source of the symptom it was meant to eliminate.

**Root cause (traced with `verify-home-overflow-bisect*.mjs`, four rounds of
bisection down the DOM):** a **different sibling section**, `.home-reviews`
("How people use Nodework" — the testimonial carousel), reproduces the exact
same 25px overflow, alone, at 360px, with everything else on the page
hidden. Both `.home-stats` and `.home-reviews` are direct grid-item children
of `.home-sections` (`display: grid`, no explicit `grid-template-columns`,
i.e. one implicit auto-sized column shared by every section). `.home-stats`
was given `min-width: 0` to stop its own content's intrinsic width from
flowing into that shared track; `.home-reviews` was not. Its carousel
(`.home-reviews__carousel > .home-reviews__track` — a `display: flex` row,
default `nowrap`, holding 3 `.home-reviews__slide` items each
`flex: 0 0 100%`) has no `min-width: 0` anywhere in its ancestor chain up to
`.home-reviews`, so its own auto-width resolution comes out ~41px wider than
the 328px actually available at 360px — verified directly:
`.home-reviews__carousel` computes to exactly 369.3px in isolation; forcing
either "keep only 1 of 3 slides" or "set the track's `display` to `block`"
drops it straight to 328px (`verify-home-overflow-bisect4.mjs`). This is the
identical mechanism (grid item missing `min-width: 0`) as the bug this item
claims to have fixed — it was fixed on one sibling and not on the other.

**Blast radius:** confirmed with a width sweep (`verify-overflow-widths.mjs`)
that this is not a 360px-only edge case: overflow is 64px at 320px, 45px at
340px, 30px at 355px, 25px at 360px, 11px at 375px (a very common real
phone width — iPhone SE/8/6/7), clearing only at ~385–390px.

**Single point of intervention:** `apps/web/app/styles/board.css`, the
`.home-reviews__carousel` rule (or `.home-reviews` itself, or
`.home-reviews__track`) — add `min-width: 0`, mirroring the exact pattern
already applied to `.home-stats`/`.stats-grid` in `app/styles/home.css`.

**Verdict: FAILED.** The named CSS change landed and works for the element
it targets, but the user-facing symptom — real horizontal page scroll on the
homepage on a common phone width, on all three engines — is completely
unresolved, via a sibling section with the same class of bug. Severity
unchanged from the original report: **Critical** (the page scrolls
sideways; this is exactly the "content unusable" bar).

---

## 3. [was Critical] Long-location mobile job title crush — HELD

**Claim:** `board.css`'s mobile grid `minmax(0, 1fr) auto` → `minmax(0, 1fr)
minmax(0, 42%)` stops a long location string from erasing the title.

**Target job (real, currently listed, confirmed via local D1 and a live
`curl`):** "VP, Digital Assets & Emerging Technology Investment Banking" at
location **"New York City Metropolitan Area US"** — the exact repro string
named in the task. It is the #1 row in the app's own default job-listing
order (`ORDER BY featured, highlight DESC, posted_at DESC`), so it appears
on the home page, `/jobs`, and every ranking page (`/top-web3-jobs`
confirmed) without pagination.

**What I measured** (`verify-location-crush.mjs` + a detail pass), home and
`/top-web3-jobs`, 360×740 and 390×844, all 3 engines: the row is found on
every combination, and the title is never crushed. Full detail (chromium,
360×740, home): title box **112.2 × 38px** (2-line `-webkit-line-clamp: 2`,
15.2px font, 19px line-height × 2 = 38px — a real, readable two-line title,
not a sliver), location text **"New York City Metropolitan Area US"**
renders in a 119×20px box with `text-overflow: ellipsis` (visibly legible —
confirmed with a cropped screenshot in the desktop check below, item 4, same
mechanism). Across all 12 combinations (2 pages × 2 viewports × 3 engines)
the title box width ranged 160–178px including the rank badge — never 0,
never single characters.

**Verdict: HELD.**

---

## 4. [was High] Desktop split-view location column — HELD

**Claim:** `table-layout: fixed` binds the `thead th` widths; job 42%→37%,
location 12%→17%.

**What I measured** (`verify-desktop-location.mjs`, `/jobs`, same target
row, all 3 engines, 1024/1440/1920 — 1440 and 1920 are identical since
`.board-main` caps at `max-width: 1440px`):

| Engine | Width | Job `th` | Loc `th` | Title box | Loc box | Loc text |
|---|---|---|---|---|---|---|
| chromium | 1024 | 176px | 81px | 102×? | 51px | "New York City Met…" (ellipsis) |
| chromium | 1440/1920 | 257px | 118px | 183px | 88px | ellipsis |
| firefox | 1024 | 176px | 81px | 102px | 47px | ellipsis |
| firefox | 1440/1920 | 257px | 118px | 183px | 84px | ellipsis |
| webkit | 1024 | 176px | 81px | 102px | 47px | ellipsis |
| webkit | 1440/1920 | 263px | 121px | 189px | 87px | ellipsis |

The location column is now 81–121px depending on viewport (vs. the reported
20–30px pre-fix), and a screenshot crop at 1024px shows a legible "New Y…"
rather than an unreadable sliver. This 35-character string is unusually long
even for real data, so ellipsis truncation is still expected and correct —
the fix's own comment targets "a real location string" like `City, Region,
Country`, not guaranteeing zero truncation for every possible string length.
The job title column did **not** become the new casualty: 102–189px,
comfortably holding the clamped 2-line title observed in item 3.

**Verdict: HELD.**

---

## 5. [was High] Sub-24px tap targets — PARTIAL

**Claim:** `.wordmark` (min-height 44px), `.footer-column__links a`
(inline-flex, min-height 24px), `.table td a` (inline-block, min-height
24px, 6px block padding) fix the three named rules.

**Direct verification of the three rules** (`verify-tap-targets-fixed-rules.mjs`,
`/web3-salaries`, chromium, 1440×900) — all pass:

| Element | Rendered size |
|---|---|
| `.wordmark` | 126×**44**px |
| `.footer-column__links a` | 120×**24**px |
| `.table td a` | 75×**36**px |

**Full-matrix sweep** (`verify-matrix-sweep.mjs`, `smallTargets(page, 24)`
across all 378 rows) shows small-target counts are low and flat across
viewports/engines for nearly every template (e.g. `home`: 7 everywhere;
`account`/`auth`/`legal-long-form`/`404`: 5 everywhere) — consistent with
the three site-wide rules (wordmark on every page, footer links on every
page, table links wherever a `.table` appears) being genuinely fixed.

**But `/web3-salaries` (the exact page named in the original report) still
shows real sub-24px interactive elements** — 27 at 360/390, 32 at
768/1024/1440/1920, chromium (firefox/webkit near-identical). Inspecting the
sample: these are **not** `.table td a` links (those are confirmed fixed
above) — they are `.salary-chart__label a` links inside the page's bar-chart
visualization (a completely different, `<div>`-based component, e.g. "Scala
Developer" 97.8×**16**px, "Solana Developer" 105.9×**16**px), plus
"Intern"/"Junior"/"Senior"/"Lead" seniority chips at **14px** height on
`salary-detail`/`salary-comparison`, plus assorted pre-existing small links
(top-nav "Jobs" trigger, 28.4×16px; a 1×1px visually-hidden search submit
button that is not a real visible tap target and is likely a harness false
positive, not a defect). None of these three element types is one of the
three rules this task named, and none is `.table td a` — they were never in
scope of the described fix, and remain broken on exactly the page the
original QA agent flagged.

**Verdict: PARTIAL.** The three named CSS rules are verified fixed, both by
direct measurement and by their absence from the sweep's small-target
samples site-wide. The *page-level* symptom named in the task
("`/web3-salaries` had 498–651") is greatly reduced but not resolved — real,
visible sub-24px links remain on that exact page, from a different component
(`.salary-chart__label a`) that was outside the three rules' scope.
Severity: **Low** relative to the original High (the count dropped by
>90%, and what remains is a distinct, narrower-scope defect, not a
regression of this fix) — but worth a follow-up ticket against
`app/styles/board.css`'s `.salary-chart__label`/seniority-chip rules if a
24px floor is meant to be a site-wide invariant rather than a
per-rule patch.

---

## 6. [was High] `prefers-reduced-motion: reduce` on Firefox — HELD

**Claim:** the reduce block's `.m-reveal`/`.m-count > *` rules now carry
`!important`, beating `.m-reveal[data-reveal]:not(.is-in)`'s higher
specificity.

**What I measured** (`verify-reduced-motion.mjs`): 7 templates (`home`,
`job-detail`, `pricing`, `editorial-article`, `funnel-seller-page`,
`rankings`, `company-detail`) × 3 engines = 21 rows, each checked **twice**:
immediately on load, and again after a real scroll-to-bottom (waited on the
completion condition, not a fixed sleep). `window.matchMedia(...).matches`
confirmed `true` in every row. **0 elements below opacity 0.999 in all 42
checks** (on-load + after-scroll × 21). Marquee tracks: 0 running animations
in every row (`animationName !== "none"` count was 0 everywhere).

**Verdict: HELD.**

---

## 7. [was Medium] Home hero fixed-opacity elements — HELD

**Claim:** `.m-reveal--now` plays on load with `animation-timeline: auto`
instead of a view timeline, fixing two elements stuck at 0.91/0.55.

**What I measured** (`verify-hero-animate.mjs`): sampled all 4 home-hero
`.m-reveal--now` elements' `getComputedStyle(...).opacity` at 80 animation
frames via an in-page `requestAnimationFrame` loop (no IPC round-trip lag),
starting immediately after `domcontentloaded`, on all 3 engines:

| Engine | Min opacity seen (proves it animates) | Final opacity (all 4) |
|---|---|---|
| chromium | 0, 0, 0, 0.42 | 1, 1, 1, 1 |
| firefox | 0, 0, 0.34, 0.74 | 1, 1, 1, ~1 (0.9957–0.9999 at frame 80) |
| webkit | 0.76, 0.84, 0.84, 0.84 | 1, 1, 1, 1 |

Followed up on Firefox's near-1 values with an extra 1.5s settle
(`verify-hero-animate-firefox-final.mjs`): all 4 elements read exactly
`opacity: 1` with `is-in` set. Every element visibly animates (dips well
below 1 before settling) rather than snapping straight to 1.

**Verdict: HELD.**

---

## 8. [was Low] Stagger delay levels 4–12 — HELD

**Claim:** levels 4–12 now resolve in both the scroll-driven
(`animation-range`) and fallback (`transition-delay`) branches.

**What I measured** (`verify-deep-stagger.mjs`): home page, all 3 engines,
scrolled to bottom (real completion-condition wait), read every
`[data-reveal-delay="1"]`…`[data-reveal-delay="12"]` element's opacity:
chromium and webkit read exactly `1` for all 12 levels; Firefox reads
0.999075–1 for levels 6–12 (sub-pixel transition remnants, not a stranding —
consistent with item 1's finding that these need up to ~1.16s to fully
settle; all resolved well past that here).

**Verdict: HELD.**

---

## 9. [was Low] `experimental.viewTransition` removal — HELD

**Claim:** removed because it needs React's experimental channel and was
inert; navigation itself is what matters, and is unaffected.

**What I measured** (`verify-navigation.mjs`): two real client-side `<Link>`
flows (`/` → click "Jobs" → `/jobs`; `/jobs` → click "Web3 salaries" →
`/web3-salaries`) on all 3 engines, waited on `page.waitForURL()` +
`page.waitForSelector()` on the destination's own content — never
`settle()`, never a fixed timeout, `document.startViewTransition` never
touched. All 6 flows succeeded; elapsed times ranged 517ms–2217ms
(consistent with the task's own note that a real client nav measures
~620ms, not `settle()`'s 350ms — the second flow's longer times reflect a
mega-menu hover interaction, not a broken nav).

**Verdict: HELD.**

---

## 10. Four additional fixes

### 10a. Skip link `#content` `tabIndex={-1}` — HELD (chromium, firefox); platform quirk on webkit

**What I measured** (`verify-skip-link.mjs`): one real `Tab` then a real
`Enter` keypress (not `.click()`). Chromium and Firefox: `Tab` lands on
`.skip`, `Enter` moves `document.activeElement` to `#content` (a `div`,
`tabIndex -1`) — exactly the fix's intent. **WebKit: the first `Tab` never
reaches the skip link at all** — it lands on an `<input>` further down the
page. This reproduces real desktop Safari's actual default behavior (Safari
excludes plain links from Tab order unless "Full Keyboard Access" is
enabled system-wide) — confirmed independently in item 10b below, and it is
site-wide/engine-default behavior, not something `SiteChrome` controls.
Follow-up (`verify-skip-link-webkit.mjs`): when the skip link **is**
focused (`.focus()`, simulating a full-keyboard-access or assistive-tech
user reaching it by whatever means WebKit routes that through), a real
`Enter` press moves focus into `#content` identically to the other two
engines. So the fix itself is engine-agnostic and correct; only the means
of *reaching* the link via bare `Tab` differs on WebKit, and that is a
platform default affecting every link on every site, not an app defect.

**Verdict: HELD** on all three engines for what the fix actually changes
(Enter-on-skip-link → focus moves into content); the WebKit `Tab`-reachability
gap is a pre-existing platform behavior out of this fix's scope.

### 10b. Mobile menu focus cycling — HELD (chromium, firefox); **FAILED (webkit)**

**What I measured** (`verify-mobile-menu-trap.mjs`, 390×844, menu opened via
its button, toggle explicitly focused, then 35 real `Tab` presses): on
chromium and firefox, focus never left the toggle + the sheet's own 52
focusable elements in 35 presses — the wraparound trap holds. **On WebKit,
the very first `Tab` press after the toggle escapes straight to an
`<input>` outside the panel**, then continues cycling through page content
that sits behind the open overlay (a "chips-more" input, `pv__control`
buttons, a `home-reviews__radio`, six FAQ `<summary>` elements, `<body>`) —
looping back through `.menu-button` periodically but never staying inside
the sheet.

**Root cause:** the trap's `stops` array (`mobile-menu.tsx`) is built from
`a[href], button, input, select, textarea, [tabindex]`, and the boundary
check only fires when `document.activeElement === first/last` from that
array — i.e. it relies on the browser's *native* Tab traversal actually
visiting every one of those elements in order. But WebKit's default Tab
order **excludes plain links** (confirmed independently in item 10a — this
is real Safari's default, not a test artifact), and the mobile sheet's
content is almost entirely `<Link>`s (hub links, chip links). So on WebKit,
native Tab from the toggle skips over the entire sheet (none of its links
are natively focusable via Tab) and lands on the next real form control in
DOM order **after** the sheet closes in markup — which is back out in the
page underneath. The boundary condition (`active === last`) never fires
because `last` (a link) is never reached by WebKit's native traversal in the
first place.

**Single point of intervention:** `apps/web/app/_components/mobile-menu.tsx`,
the `Tab` branch of `onKeyDown`. It needs to stop depending on native Tab
traversal reaching every entry in `stops` and instead manage focus
explicitly whenever the menu is open: `event.preventDefault()` on every Tab
(not only at the boundary), find the current index via
`stops.indexOf(document.activeElement)` (falling back to `-1` → treat as
"before first"), and call `.focus()` on `stops[(index ± 1 + stops.length) %
stops.length]` directly. That removes the dependency on WebKit's
link-Tab-order default entirely.

**Verdict: FAILED on WebKit.** A real Safari user (default settings, no
"Full Keyboard Access") tabbing through the open mobile menu escapes into
page content sitting behind the visual overlay after a single additional
Tab press — exactly the defect this fix describes itself as closing, just
not closed on this engine. Severity: **High** (a real defect on a normal
keyboard-navigation path, matching the task's own severity rubric), scoped
to WebKit only.

### 10c. `resetTurnstileWidget` try/catch — HELD

**What I measured:** two submissions of the real `/login` form
(`verify-login-submit.mjs`, `verify-login-submit-blocked.mjs`), chromium.
First, ordinary submission (Turnstile script loaded successfully in this
environment): a visible `.notice.notice--danger` rendered
("Could not send a magic link…"), not silence. Second, **forced repro of
the actual pre-fix condition** — `page.route()` aborted every request to
`challenges.cloudflare.com`, so `window.turnstile` stayed `undefined` (the
widget genuinely never mounted, confirmed): submission still produced the
same visible `.notice--danger`, not silence. Also unit-checked the
try/catch pattern directly in-page against a `reset()` that throws (Turnstile's
real behavior for an unmounted widget): the wrapped call does not propagate
the throw.

**Verdict: HELD.**

### 10d. Delete-account confirmation, server + client — HELD

**Server-side evidence used:** an anonymous `POST /api/account/delete`
(no session cookie), tried three ways — no body, wrong `confirm` value, and
the **correct** `confirm=DELETE` — all three return **`401
{"code":"unauthorized"}`**. Per the route source
(`app/api/account/delete/route.ts`), the handler checks
`createAuth(env).api.getSession(...)` and returns 401 **before** it ever
inspects the `confirm` field or calls `deleteAccount()`, so this 401 is
consistent with (and does not contradict) the claim: a valid session plus
the wrong phrase would reach the `confirmationPhrase(...) !== "DELETE"`
check and get `400 {"code":"confirmation_required"}`, still before
`deleteAccount()` runs. I did not attempt to fabricate a session, per the
task's explicit instruction — the 401 plus this source read is the
server-side evidence.

**Client-side evidence used:** rather than loading `/settings` (which
403/307-redirects anonymously and cannot be exercised without a session),
I isolated the exact form markup from `app/settings/page.tsx` into
`qa/fixtures/delete-confirm-fixture.html` (same `action`, `method`, and
input `required`/`pattern="DELETE"`) and drove real browser constraint
validation against it (`verify-delete-confirm-form.mjs`): empty, `"delete"`
(lowercase), and `"DELET"` (partial) all report `checkValidity() === false`
and a click on submit does not navigate; `"DELETE"` reports `true`. This is
real Chromium constraint-validation behavior against the production
markup, not a claim read off the source alone.

**Verdict: HELD**, evidence: anonymous-401 + source read (server) and an
isolated-fixture constraint-validation test (client).

---

## What could not be verified, and why

- **Item 10b (mobile menu trap) and 10a (skip link) were only driven with a
  physical keyboard (Playwright's `Tab`/`Enter`), not a screen reader.** The
  WebKit Tab-order gap in 10a is a known platform default that a screen
  reader's own virtual cursor navigates around (VoiceOver does not rely on
  Tab); I did not have a way to drive VoiceOver from this harness, so
  10a's WebKit finding is scoped to bare-keyboard users specifically, not a
  claim about assistive-tech users generally.
- **Item 5's `.salary-chart__label` and seniority-chip findings** are
  reported from one engine/viewport spot-check (chromium, several
  viewports) backed by the full matrix's aggregate counts; I did not
  individually re-verify every one of those elements pixel-by-pixel on
  firefox/webkit, though the matrix sweep's per-engine counts for
  `salaries-index`/`salary-detail`/`salary-comparison` are within 1–2 of
  each other across all three engines, so I have no reason to think they
  differ in kind.
- **The full 401-only account-deletion server test does not exercise the
  authenticated 400 path directly** (per the task's own instruction not to
  fabricate a session) — that half rests on reading
  `app/api/account/delete/route.ts`, not a live request. The code order
  (auth check → confirmation check → delete) is unambiguous, but this is
  source review, not a live HTTP proof, for the 400 case specifically.
