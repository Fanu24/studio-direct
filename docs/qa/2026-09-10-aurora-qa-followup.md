# Aurora redesign — closing the Medium and Low findings

10 September 2026. Branch `redesign/aurora`, on top of `1fb5892`.

The consolidated report left four Medium and seven Low findings open, none
blocking. This pass closed the ones that are real and, for the two that are
not, measured why rather than repeating the claim. Same instrument as before:
a production build served by `next start -p 3100`, three real engines
(Chromium 153, Firefox 155, WebKit 26.6).

## Outcome

| | Before | After |
|---|---|---|
| Sub-24px tap targets, across the traced page set, per engine | **763** | **54**, all exempt (see below) |
| `<th>` without `scope` | 16 | 0 |
| Charts declaring their own links presentational | 3 per page | 0 |
| Dead components / unreachable CSS rules | 6 files, ~300 CSS lines | 0 |

522 web tests pass (782 across the workspace), typecheck is clean, the
production build completes at 122 pages, and the two Criticals closed in the
previous pass were re-measured and are still closed.

## 1. The tap-target residue was far larger than reported

The report described this as "nine links under 24px on the salary pages". It
was 763 across the eight pages traced, and only a minority of them were on a
salary page.

The reason it kept being mis-attributed is worth recording: `smallTargets()`
in `harness.mjs` returns a tag, its text and its size, and no identity. Two
consecutive rounds guessed at which rule was responsible and both guessed
wrong. `qa/verify-tap-target-residue.mjs` reports the CSS ancestor path for
each offender and groups by selector, which turned a guess into a list.

What it found, and what was done:

| Selector | Was | Why it was missed |
|---|---|---|
| `.salary-table td a` | 208 links at 20px on `/web3-cities` alone | The Round 1 fix was written as `.table td a`. The directory tables carry `.salary-table` and never `.table`, so the rule simply did not match. The single largest group, and no round had named it. |
| `.crumbs a` | 16px, on every salary and detail page | Never in any round's scope. |
| `.site-footer__meta a` (Terms, Privacy, Legal) | 15px, on every page | Round 2 saw these and recorded them as "not individually traced to a selector". |
| `.footer-column h2 a` (the "Regions" column heading) | 14px, on every page | Its sibling `.footer-column__links a` was raised in Round 1; the heading above them is also a link and was not. |
| `.board-apply__company a` | 16px, on the board and salary pages | Named in the report, never fixed. |
| `.jobs-company-table__name`, `.salary-chart__label a`, `.table td a` | at or above 24px tall, **20.1px wide** | Every rule so far set a height floor only. A two-character label ("R3", "HR") passes on height and fails on width. A target can fail the floor on one axis. |

All six now carry a floor on both axes. Re-measured across 8 pages x 3
viewports x 3 engines: **763 to 54**, and the composition is identical on
Chromium, Firefox and WebKit.

## 2. The 54 that remain are exempt, and both exemptions were measured

**36 of them are links inside a sentence** — the "Built by Nodework" line in
the footer, and the prose links in the salary callout panels. WCAG 2.5.8
exempts a target "in a sentence or [whose] size is otherwise constrained by
the line-height of non-target text". Giving these a 24px box would break the
line rhythm of the paragraph they sit in to satisfy a rule that does not apply
to them. Left alone deliberately.

**18 of them are `.company-card__link`, where the measurement was wrong, not
the markup.** The link carries a full-bleed `::after`, so the real target is
the whole card. `qa/verify-card-overlay-hit-area.mjs` asks the browser what is
actually under the pointer at each card's centre and both bottom corners:
**18 cards across 3 engines, all 18 resolve to the card link, over a 373x257
hit area** rather than the 21px text box the sweep sees. Not a defect.

That probe needed two corrections before it could be believed, both of the
same family as the false criticals in the original report:

- `elementFromPoint` only answers inside the viewport. Cards below the fold
  returned null, which reads exactly like an overlay that does not cover its
  card.
- The site sets `scroll-behavior: smooth`, so `scrollIntoViewIfNeeded()`
  returns while the scroll is still animating. The bottom row of cards
  "failed" on all three engines for that reason alone.

## 3. Three charts per page were hiding their own links

`SalaryBarChart` wrapped its rows in `role="img"`. That declares the whole
subtree presentational — and the subtree holds the row links that are the main
way into each role's salary page. The report noted it as an invalid content
model that no engine mishandled; an engine that *did* honour it would have
removed 21 links per page from the accessibility tree.

The container is now `role="group"`, which names the region without erasing
what is inside it. `qa/verify-salary-chart-role.mjs` checks both halves on all
three engines: each chart still exposes its accessible name, and **13, 1 and 7
links respectively appear in the accessibility tree — every link in the DOM.**

## 4. `scope` on every column header

16 `<th>` elements had none: both salary tables, the seniority table inside
the charts, and the city directory. The report named only the salary ones;
`/web3-cities` had the same gap and is fixed with them.

## 5. Dead code, and the one that was not dead

Six component files were unreachable — `unlock-theater`, `digest-theater`,
`not-on-linkedin-theater`, `marquee`, `studio-ticker` and `testimonials` (the
last three a closed island: the two consumers were the only importers of
`Marquee`, and nothing imported them). Deleted, with the CSS that existed only
for them: theaters 2, 4 and 5 in `theaters.css` and their thirteen keyframes.

**One near-miss worth recording.** The theater numbering does not follow the
homepage order. `OneBoardTheater` — which is live and on the homepage — is
`th6`, and the dead `NotOnLinkedinTheater` is `th2`. Cutting "the last three
theaters" removed a live one. It was caught by `motion-theater-loop-check.mjs`
reporting `animationName: "none"`, restored, and the correct three were cut
instead. Map a component to its class prefix before deleting its stylesheet;
the numbering is not the order.

**That check could not have caught it on its own, either.** Its th6 probe
sampled `.th6 .t-chip`, an element the theater never animates — it reported
`animationName: "none"` whether the theater worked or not. It now probes
`.th6__chip-hidden` and `.th6__card--plain`, the two elements th6 actually
drives, and shows the plain card's opacity moving 1 to 0.15 across the loop on
all three engines. A probe that reports the same value in the working and the
broken case is not a check.

`.m-marquee` stays in `motion.css`. It is a documented primitive of the motion
vocabulary rather than component code; the `.marquee__track` selectors that
rode alongside it belonged to the deleted component and went with it.

## 6. Regression checks, after the changes

Everything below ran against the final build, not the one the fixes were
written against.

| Check | Result |
|---|---|
| `verify-overflow-sweep-round2.mjs`, 3 engines | 126/126 rows each, **0 page-level overflow** — Critical 3 still closed |
| `verify-reveal-firefox.mjs` | 3 fresh Firefox runs x 7 templates, **0 stranded** — Critical 2 still closed |
| `motion-theater-loop-check.mjs` | th1, th3, th6 all animating on 3 engines |
| `verify-reduced-motion.mjs` | 7 templates x 3 engines, 0 elements left invisible under reduce |
| `pnpm typecheck` | clean |
| `pnpm test` | 782 pass (522 in `apps/web`) |
| `pnpm exec next build` | 122 pages |

## Still not tested, unchanged from the consolidated report

`/dashboard`, `/profile`, `/settings` and `/onboarding` for motion and
performance, and real magic-link delivery and Google OAuth. Nothing in this
pass touched them.
