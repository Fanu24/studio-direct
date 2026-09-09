# Aurora redesign — Accessibility QA

Dimension: **accessibility** (Task 11 of the four-agent QA pass, spec section 4.3).
Instrument: `apps/web/qa/harness.mjs` + `apps/web/qa/templates.mjs`, proven with
`node qa/self-test.mjs` (9/9 checks pass on chromium, firefox, webkit) before any
measurement was trusted. Server: `next start -p 3100`, already running, never
restarted or rebuilt during this pass.

**Matrix run:** `apps/web/qa/a11y-check.mjs` (written for this task, extends
`harness.mjs`'s `contrastPairs()`/`focusables()` with landmark, heading, image,
form-label, `aria-expanded`/`aria-current`, and table-structure checks) — 21
templates × {390×844, 1440×900} × {chromium, firefox, webkit} = **126 rows**,
0 errored, written to `apps/web/qa/out/accessibility.json`. No template needed
widening to the other four viewports: nothing in the automated pass or the
manual follow-up looked viewport-dependent enough to justify it, except the
salary-chart breakpoint and the mobile-menu breakpoint, both of which were
checked directly against their own CSS trigger widths (480px, 900px) rather
than the six fixed viewports.

Every finding below was reproduced by hand — real `page.keyboard.press("Tab")`
sequences, `locator.ariaSnapshot()` reads, and real screenshot pixel sampling
— not taken on the strength of the automated candidates alone, per spec 4.3.

## Summary by severity

| Severity | Count | Findings |
|---|---|---|
| Critical | 0 | — |
| High | 2 | #1 skip link doesn't move focus, #2 mobile menu doesn't shield/trap focus |
| Medium | 3 | #3 unscoped `<th>` on salary tables, #4 `role="img"` wraps interactive links, #6 apply-form error not field-associated |
| Low | 1 | #5 job-listing table has no caption/accessible name |

No contrast failure survived hand verification anywhere in the matrix — see
rejected candidate A. The dominant automated signal in the raw data
(`focusablesWithoutIndicatorCount`, 126/126 rows) is also fully rejected — see
F — and is flagged separately below because of its size and because it would
badly mislead anyone who read `qa/out/accessibility.json` at face value.

## Findings

### 1. [High] Skip link does not move keyboard focus into the page

**Template:** all (chrome is shared via `SiteChrome`); reproduced on `home`, 1440×900, chromium.

The skip link (`apps/web/app/_components/site-chrome.tsx:54`, `<a className="skip" href="#content">Skip to content</a>`) is correctly the very first Tab stop on every page (confirmed automatically: `skipIsFirstFocusable: true` on all 126 rows) and is visibly focused (`outline: solid 2px`). But its target, `apps/web/app/_components/site-chrome.tsx:73` (`<div id="content">{children}</div>`), has no `tabindex="-1"`. Activating the link (Enter) does not move `document.activeElement` anywhere inside the page — it lands on `<body>`. Reproduced twice by hand:

```
First tab stop: {"tag":"a","className":"skip","text":"Skip to content", outline:"solid 2px"}
After activating skip link, activeElement: {"tag":"body", "id":""}
```

This is the well-known browser behaviour for a fragment link whose target isn't programmatically focusable: the browser scrolls to it but resets focus to `<body>` rather than the target. The mechanism exists and is discoverable, but does not do its job — a keyboard-only or screen-reader user who activates it is thrown back to the top of the tab order exactly as if they'd never used it, defeating the point of a bypass link (hence High, not Critical: the content is not unreachable, just the shortcut is broken).

**Root cause:** `apps/web/app/_components/site-chrome.tsx:73`.
**Single point of intervention:** add `tabIndex={-1}` to the `<div id="content">` (or move `id="content"` + `tabIndex={-1}` onto each page's own `<main>` root).

### 2. [High] Mobile nav sheet does not trap or shield keyboard focus

**Template:** every template below the 900px nav breakpoint; reproduced on `home`, 390×844, chromium.

Opening the mobile menu (`.menu-button`, `aria-expanded` flips to `true`, confirmed) and then pressing Tab 60 times in sequence stays inside `#mobile-menu` for the first ~51 stops (all hub links, chips, and the account buttons rendered inside the sheet) — then **continues past the menu** into the underlying homepage's own search input, its visually-hidden search submit button, the "Remote" toggle, and tag-filter chips:

```
50: a.button …"Create a profile"       (mobile-menu__account, still inside the sheet)
51: a.button …"Login"                  (mobile-menu__account, still inside the sheet)
52: input. ""                          (BoardSearch's search input — page content BEHIND the sheet)
53: button.visually-hidden "Search"
54: a.remote-toggle "Remote"
55: input#show-more-tags.chips-more ""
56-60: a.chip "Community Manager" / "Customer Support" / "Design" / "Entry Level" / "Intern"
Final focus after 60 tabs while menu open: {"isInsideMenu":false,"isInsidePageContent":true}
```

`.mobile-menu` is `position: fixed; inset: var(--nav-h) 0 0 0; background: var(--bg)` (`apps/web/app/styles/chrome.css:288-328`) — a full-viewport opaque overlay. Once focus lands on the homepage's search input at stop 52, the visible focus ring is real (the input is a genuine `:focus-visible` target) but is rendered **underneath the opaque sheet**, so a sighted keyboard user loses all visual track of where focus is. Escape correctly closes the sheet and returns focus to the toggle (`{"tag":"button","className":"menu-button","isToggle":true}`) — that half of the interaction is fine.

**Root cause:** `apps/web/app/_components/mobile-menu.tsx` manages `open` state and an Escape handler but never traps Tab within `#mobile-menu`, and never marks the rest of the page `inert` while `open`.
**Single point of intervention:** in `mobile-menu.tsx`'s existing `open` effect (where it already sets `document.documentElement.style.overflow` and installs the Escape listener), either add a Tab-key focus trap scoped to the `#mobile-menu` node, or toggle `inert` on the header's other children and on `document.getElementById("content")` for the duration `open` is true.

### 3. [Medium] Generic salary-table headers ship with no `scope`

**Templates:** `salaries-index`, `salary-detail`, `salary-comparison` (confirmed across all engines/viewports in the matrix).

The `board-table` family (job listings) and the `salary-table--ranked` family (companies index, top-growing) both set `scope="col"` on every `<th>` — confirmed 5/5 and 7/7 scoped across every measured instance. The generic `.table` / `.table--compact` primitive used on the salary pages does not — confirmed **0/4** scoped on every one of the 15 table instances measured across the three salary templates (e.g. `{"rows":45,"thCount":4,"scopedThCount":0,"className":"table"}`).

**Root cause:** `apps/web/app/_components/salary-tables.tsx:74-77` and `:145-148` (`<th>{labelHeader}</th>`, `<th>Average</th>`, `<th>Min Yearly Salary</th>`, `<th>Max Yearly Salary</th>`, twice), plus `apps/web/app/_components/salary-chart.tsx:309-311` (`<th>Level</th>`, `<th>{...}</th>`, `<th>{compare.label}</th>`) — the seniority chart's own table fallback for &lt;480px.
**Single point of intervention:** add `scope="col"` to all seven `<th>` across those two files.

### 4. [Medium] `role="img"` wraps interactive links in `SalaryBarChart`

**Templates:** `salaries-index` (3 chart instances measured), `salary-detail` (1), `salary-comparison` (1).

`SalaryBarChart`'s outer container (`apps/web/app/_components/salary-chart.tsx:76`, `<div aria-label={chartLabel} className="salary-chart" role="img">`) correctly labels the whole chart, but it also wraps a real `<Link>` per row (`.salary-chart__label a`, e.g. "Solana Developer" → `/web3-salaries/solana-developer`). Per the ARIA `img` role's content model, an image role should not contain interactive descendants, and assistive tech is licensed to flatten or hide them.

Verified by hand rather than taken on the ARIA spec's word alone: `locator('.salary-chart[role="img"]').ariaSnapshot()` on `/web3-salaries/solana-vs-ethereum` (chromium) shows the nested links are **still exposed with proper `link` roles**:

```
- img "Solana vs Ethereum vs Solidity salary":
  - link "Solana Developer": { /url: /web3-salaries/solana-developer }
  - text: $241k
  - link "Ethereum Developer": …
  - link "Solidity Developer": …
```

and a direct `.focus()` on the nested link succeeds (`activeElement tag: a`). So no breakage was reproduced in the three engines this harness covers — but the pattern is still spec-invalid, and its handling is AT-implementation-dependent (the flattening this content model warns about is a VoiceOver/JAWS-class behaviour this harness cannot exercise, not something Chromium/Firefox/WebKit's own accessibility-tree computation is guaranteed to represent). Kept as Medium rather than rejected because the risk is real and untested, not because it was reproduced.

Note the sibling `SalarySeniorityChart` does **not** have this problem: its `role="img"` is scoped to the `<svg>` alone (`apps/web/app/_components/salary-chart.tsx:243-249`), and the equivalent links live in a separate, non-`role="img"` sibling (`.salary-line__labels`) — this is the pattern `SalaryBarChart` should be brought in line with.

**Root cause:** `apps/web/app/_components/salary-chart.tsx:76`.
**Single point of intervention:** move `role="img"`/`aria-label` off the wrapper that contains the links — e.g. give only the `<svg>` (already present per row) the `role="img"` treatment, and let the outer list carry an ordinary `aria-label` (not `role="img"`) or none at all, mirroring `SalarySeniorityChart`.

### 5. [Low] Job-listing table has no caption or accessible name of its own

**Templates:** `home`, `jobs-catalog`, `job-detail`, `hidden-jobs`, `rankings`, `hub-landing`, `salaries-index`, `salary-detail`, `salary-comparison` — every `board-table` instance (0/9 templates have a `<caption>`).

The table is wrapped in `<section aria-label="Job listings" className="board__list">` (`apps/web/app/_components/job-board.tsx:138-139`), which gives it a name via landmark/region navigation, but a screen reader's direct table-navigation command (NVDA/JAWS "next table", VoiceOver rotor "Tables") announces the table itself — "table, 5 columns, 20 rows" — without inheriting the section's label, since that association isn't automatic for a `<table>` nested inside a labelled `<section>`.

**Root cause:** `apps/web/app/_components/job-board.tsx:139` (`<table className={...board-table...}>`).
**Single point of intervention:** add `<caption className="visually-hidden">Job listings</caption>` as the table's first child, or `aria-label="Job listings"` directly on the `<table>`.

### 6. [Medium] Apply-form error is announced but not associated with its field

**Template:** `job-detail` (the apply form only renders once a job is unlocked; verified by source, not by triggering a live validation error, per the network/session limits noted below).

`apps/web/app/_components/job-apply-form.tsx:29` (`<p className="notice notice--danger apply-form__err" role="alert">Check your name and email, then submit again.</p>`) is correctly an assertive live region — it will be announced once, immediately, satisfying the letter of "an error is signalled to AT." But neither `name` (`#apply-name`) nor `email` (`#apply-email`) gets `aria-invalid="true"` or `aria-describedby` pointing at the error text when the submission actually fails, so a screen-reader user tabbing back into the form afterward gets no per-field signal of what's wrong — only the one-time announcement, which they may have missed or which may have already scrolled out of the live-region history.

**Root cause:** `apps/web/app/_components/job-apply-form.tsx` — the `error` prop only toggles the `<p role="alert">`, never touches the two `<input>` elements at lines 37-56.
**Single point of intervention:** when `error` is true, add `aria-invalid="true"` and `aria-describedby="apply-form-error"` (matching an `id` added to the alert `<p>`) to the `name` and `email` inputs.

## Rejected candidates (with evidence)

**A. Contrast — the only automated candidate in the whole 126-row matrix.** `contrastPairs()` flagged exactly one element, identically, on 8 templates (`home`, `jobs-catalog`, `hidden-jobs`, `rankings`, `hub-landing`, `salaries-index`, `salary-detail`, `salary-comparison`) — **WebKit only**: `{"tag":"button","text":"Search","ratio":1.82,"fg":"rgb(255,255,255)","bg":"rgb(192,192,192)"}`. This is `BoardSearch`'s screen-reader-only submit button (`apps/web/app/_components/board-chrome.tsx:113`, `<button className="visually-hidden" type="submit">Search</button>`). `.visually-hidden` (`apps/web/app/globals.css:212-222`) clips it to 1×1px off-screen (`clip: rect(0 0 0 0)`) in every engine — it is never visible to any sighted user, in WebKit or otherwise, so "contrast" doesn't apply to it; a screen reader reads its text content regardless of colour. The WebKit-only appearance and the exact `rgb(192,192,192)` reading is WebKit's user-agent default button-face colour leaking through `getComputedStyle` on a near-zero-size node that never receives author styling worth measuring. **Rejected — no real contrast defect exists anywhere in this matrix.**

**B. Text over the aurora field.** Checked both analytically and empirically, since `contrastPairs()` cannot composite the fixed-position radial-gradient pseudo-element (`.surface--stage::before`, `apps/web/app/globals.css:409-418`) at all. Analytically: even a deliberately pessimistic triple-peak-overlap of all three gradient stops (never actually possible given their declared centres are spread across separate corners) composites to ≈rgb(60,42,80) against `--bg` (#06070c) — 12.8:1 for white text. Empirically: real screenshot pixel-sampling on the live homepage hero (1440×900, chromium) measured rgb(10,10,19) under the `<h1>` ("Web3 Jobs", 19.70:1) and rgb(8,9,13) under the `.lead` paragraph (12.29:1); direct samples near the declared gradient centres topped out at rgb(31,11,24). The aurora's peak alpha values (0.16 / 0.14 / 0.10) are simply too low to meaningfully lighten near-black `--bg`. **Rejected.** Separately: `.text-aurora` (gradient-clipped text, `apps/web/app/globals.css:370-376`) is declared but `grep -rn "text-aurora" app --include="*.tsx"` returns zero matches — it is not applied anywhere in the current component tree, so there is no gradient-fill text to check at all.

**C. Ranked-row accent wash.** Note first: `/top-web3-jobs` — the URL `templates.mjs` uses as the "rankings" template's representative — is **not** actually a ranked page (`ranked` defaults to `false`; it renders the recency feed). The pages that actually set `ranked: true` are `/highest-paid-designers-jobs`, `/highest-paid-non-tech-jobs`, and their "highest-paid"/"most-popular" siblings. Verified against a real one, `/highest-paid-designers-jobs`, by pixel-sampling the actual rendered row (four independent samples agree within ±3): wash background rgb(38,17,32). Against it: job title (white, 32.8px) **17.74:1**; company name (`--muted`, 12.8px) **5.58:1**; rank figure (`--accent`, bold 11.5px) **5.10:1**. All pass. **Rejected.**

**D. `--muted` / `.badge--honest` text on the same wash-family background.** Not independently re-sampled, but colorimetrically identical to C's measured background (`--accent-soft` composited over the same near-black page ground) — white badge text at 17+:1 there is not at risk. **Rejected by extrapolation from C**, flagged as such rather than presented as independently measured.

**E. Rank-number overlay reading order.** `apps/web/app/_components/job-board.tsx:176-180` renders `board-row__rank` (with a `visually-hidden` "Rank " prefix) as a plain text node immediately *before* the job `<Link>`, not nested inside it. `locator.ariaSnapshot()` on a real ranked row confirms this produces exactly the expected order and no accessible-name pollution: `cell "Rank 1 Brand Marketing Designer MLabs": text "Rank 1"; link "Brand Marketing Designer MLabs"`. Matches visual reading order, no extra navigation step. **Rejected.**

**F. Focus-visible coverage — `focusablesWithoutIndicatorCount`, flagged on 126/126 rows (51-111 elements per page).** This is the single largest signal in the raw matrix, and it is entirely a harness artifact, not a site defect. Every flagged instance sampled across the matrix has `"focused": false` — zero instances anywhere of `"focused": true` with no visible indicator. `harness.mjs`'s `focusables()` calls `el.focus()` on each matching element standalone, out of natural Tab order; most of the flagged elements live inside the desktop mega-menu's `.nav-mega__panel` (`apps/web/app/_components/nav-mega.tsx`), which is collapsed/zero-box until `:hover`/`:focus-within` on its parent `.nav-mega__item` reveals it (`nav-mega.tsx`'s own comment: "the panel opens on hover or focus-within... Tab into a trigger opens its panel, Tab on through it"). An element with no rendered box cannot receive focus via `.focus()` in any browser — this is universal, not a testing quirk. Verified with **real** sequential keyboard Tab navigation instead: 15 real Tabs on the homepage (1440×900, chromium) walked through the skip link, the wordmark, the "Jobs" trigger, and 12 of its now-revealed panel links in order, and **every single stop showed `outline: solid 2px`** — the site's `:focus-visible` CSS (e.g. `.chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }`, `apps/web/app/globals.css:885-888`) is confirmed working exactly as designed. **Rejected wholesale.** Called out at this length because `qa/out/accessibility.json` would badly mislead anyone — including another QA agent — who read this field at face value; `qa/harness.mjs` itself was left unmodified (shared file, three other agents running against it concurrently) but should be fixed to Tab-sequence through real ancestors before probing hover/focus-within-revealed descendants.

**G. Duplicate/ambiguous landmark labels.** `navLabelDupes` came back empty on all 126 rows. Separately: `apps/web/app/_components/nav-links.tsx`'s `NavLinks` component (`<nav aria-label="Primary">`) is dead code — `grep -rln "NavLinks" app --include="*.tsx"` matches only its own declaration file. The live header nav is `NavMega`, which also uses `aria-label="Primary"`, but since `NavLinks` never renders, there is no real duplicate landmark on any page. **Rejected.**

**H. Footer landmark count.** Raw SSR HTML has 4 `<footer>` tags on the homepage: the real site footer plus 3 testimonial-attribution `<footer>{review.who}</footer>` blocks inside `<blockquote>` (`apps/web/app/_components/home-mega.tsx:285`) — a naive tag count reads as 4 conflicting `contentinfo` landmarks. Verified with `locator("body").ariaSnapshot()`: only **one** `contentinfo` landmark is actually computed, because the three testimonial `<footer>` elements sit inside a `<section>` ancestor, and per the HTML-AAM exclusion (a `<footer>` descendant of `article`/`aside`/`main`/`nav`/`section` does not get the `contentinfo` role), they're correctly demoted to generic elements. **Rejected** — a clean example of why raw-tag-count tooling needs a computed-role check before being trusted.

**I. Images/logos without alt text.** `imgsMissingAltCount: 0` on all 126 rows. Spot-checked in code: `<img alt="" className="board-row__logo" .../>` sits inside `<span aria-hidden="true">` (`apps/web/app/_components/job-board.tsx:188-195`) — correctly decorative, since the company name is already present as adjacent text. **Rejected.**

**J. Form controls without labels.** `unlabelledControlCount: 0` on all 126 rows. Spot-checked `job-apply-form.tsx`, `login-form.tsx`, `unlock-form.tsx`, and `BoardSearch` — every control uses `<label htmlFor>` or a wrapping `<label>` with `.visually-hidden` text (e.g. the search input's label span, `apps/web/app/_components/board-chrome.tsx:103-104`). **Rejected**, with the caveat in finding #6 (labelled correctly, but the error state isn't field-associated).

**K. Colour-only state signalling.** Checked five separate instances: active filter chips (`.chip--active`, `apps/web/app/globals.css:855-877`) pair the colour/border change with a `::before` dot marker present only when active (a shape cue, not colour alone); the ranked-row wash always co-occurs with the rank digit itself, which conveys ranking independent of colour; the "Not on LinkedIn" badge (`badge--honest`) is literal text, never colour alone; the selected job row (`board-tr.is-active`) pairs its tint with both an inset left bar and `aria-current="true"` on the link; and every success/error/quota notice (`job-apply-form.tsx`, `login-form.tsx`, `unlock-form.tsx`) leads with explicit text ("Error.", "Sent.") in addition to its border/background tint. **Rejected across the board.**

**L. Skipped heading levels.** `skippedHeadingLevelCount: 0` on all 126 rows; heading outlines were sampled across every template. **Rejected.**

**M. Unlock gate focus visibility.** `.jd-unlock__button` (job-detail-view.tsx, real job `/jobs/senior-gameplay-engineer-riot-games`) is present and focusable, and shows a visible indicator when focused directly: `{"outline":"solid 2px","boxShadow":true,"focused":true}`. **Rejected** as a candidate — the button itself is fine (see "what could not be tested" for the parts of the unlock flow this couldn't exercise).

## What could not be tested, and why

- **`/dashboard`, `/profile`, `/settings`, `/onboarding` render only as far as the anonymous 307→`/login` redirect.** This harness has no seeded better-auth session (documented limitation in `qa/README.md` section 2/7 — fabricating one means reverse-engineering better-auth's own token signing, judged out of scope for the harness). `AccountShell` (`apps/web/app/_components/account-shell.tsx`) was source-reviewed instead: one `<main>`, one `<h1>`, a uniquely-labelled `<nav aria-label="Account pages">` with `aria-current="page"` on the active tab — this looks correct on paper but was **not** exercised live, so treat it as unverified rather than passing.
- **The Turnstile widget on `/login` never actually loaded** — `challenges.cloudflare.com` is unreachable from this sandboxed harness environment. Confirmed the CSS height reservation (`apps/web/app/styles/marketing.css:338-340`, `.auth-form__turnstile { min-height: 65px }`) held steady at exactly 65px across a 3-second wait with `bodyChildCount: 0` throughout (the widget iframe never injected), and `document.activeElement` never moved from its pre-load state — but since the widget never rendered, this cannot confirm or deny whether the real Cloudflare iframe injection steals focus when it does load in production. Needs re-testing with real network access to Cloudflare.
- **The apply-form's field-level error state (finding #6) was confirmed by source only**, not by driving a real failed submission through `/api/apply` — the `error` prop is set by the server action's redirect state, which needs a real invalid POST to trigger live.
- **The unlock flow beyond the button itself** (quota state, the completeness-nudge panel, the actual `/api/unlock` POST) was source-reviewed (correct `role="alert"`/`role="status"` usage, `aria-busy` on the pending button) but not driven live — doing so needs a seeded session and unlock-quota state this harness doesn't have.
- **Full 6-viewport sweep was not run for accessibility** — the primary pair (390×844, 1440×900) plus targeted checks at the salary-chart's actual 480px breakpoint (via CSS inspection: `apps/web/app/styles/salary.css:284-292` cleanly toggles `.chart__viz`/`.chart__table` with `display:none`/`display:block`, so the two forms are never both in the accessibility tree at once — no double-announcement risk) and the mobile-menu's actual 900px breakpoint covered everything that looked viewport-dependent. No finding in this report needs the other four viewports (360×740, 768×1024, 1024×768, 1920×1080) to reproduce.
- **Real assistive-technology testing (NVDA, JAWS, VoiceOver) was not available in this environment.** Every "reproduced by hand" claim above means real keyboard input and Chromium/Firefox/WebKit's own computed accessibility tree (`locator.ariaSnapshot()`), which is a strong proxy but not a substitute for a real screen reader — flagged explicitly wherever that gap matters (finding #4, the Turnstile note above).
