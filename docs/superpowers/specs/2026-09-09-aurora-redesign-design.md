# Aurora redesign — design spec

Date: 2026-09-09
Branch: `redesign/aurora`
Baseline commit: `2ed77e7`

## Goal

A complete visual redesign of `apps/web`, in a modern web3 register, with motion
that is genuinely fluid, and a UI that stays legible on every device. Structural
parity with web3.career is **no longer** the acceptance bar: pages may be
restructured freely.

The acceptance bar is now: every one of the 17 distinct templates renders
correctly and beautifully across 3 browser engines and 6 viewports, with zero
Critical and zero High defects, and the existing test suite green.

## What this is not

- Not a product change. No new features, no new routes, no copy that implies
  capabilities the product does not have.
- Not a rewrite of data access, auth, billing, or the crawler.
- Not a framework migration. No Tailwind, no component library, no motion library.

---

## 1. The design system

### 1.1 One layer of tokens

`app/globals.css` is the **only** file allowed to declare `:root`. Every other
stylesheet consumes tokens and declares nothing. All stylesheets are imported
from `app/layout.tsx` and nowhere else.

This rule exists because CSS custom-property order is decided by the bundler,
not by the import list in `layout.tsx`. A component-level `import "../styles/footer.css"`
once reordered the emitted chunks and silently reverted the whole palette. Two
files currently violate the rule and must be fixed as part of phase 0:
`app/styles/footer.css` and `app/styles/salary.css` are imported at component
level. Move both imports into `layout.tsx` and strip any `:root` block from them.

Verification for this rule: after a production build,
`curl <layout css url> | grep -bo -- "--accent: *#[0-9a-f]*"` must return exactly
one byte offset.

### 1.2 Palette

Base is a near-black with a blue-violet cast, not pure black. Aurora fields must
read as light, and light needs something to sit on.

```
--bg:            #06070C   /* page ground */
--bg-deep:       #04050A   /* recessed wells, code blocks */
--bg-elev:       #0C0E16   /* cards, panels */
--bg-hover:      #141826
--line:          #1E2233   /* hairline */
--line-soft:     #161A28
--line-strong:   #2B3147

--text:          #FFFFFF
--dim:           #C7CBD9   /* body on dark */
--muted:         #8A90A6   /* metadata, captions */

--accent:        #FF2D87   /* primary, retained brand */
--accent-strong: #FF5AA3
--accent-ink:    #FFFFFF
--accent-soft:   rgb(255 45 135 / 0.14)
--accent-line:   rgb(255 45 135 / 0.42)

--cool:          #35E0F5   /* secondary: aurora fields, data highlights */
--cool-soft:     rgb(53 224 245 / 0.12)
--cool-line:     rgb(53 224 245 / 0.38)

--violet:        #7C5CFF   /* third aurora stop only, never a UI colour */

--ok:            #35E0F5
--warn:          #FFB454
--danger:        #FF6B6A

/* layout tokens, carried over from the current system */
--radius-pill: 999px;
--radius:      12px;
--radius-lg:   20px;
--nav-h:       64px;
--gutter:      24px;
--container:   1200px;
--content:     1120px;
--flow:        1.1rem;   /* .stack rhythm */
--reveal-d:    24px;     /* .m-reveal travel, overridden to 8px in the data register */
```

`--violet` exists only inside gradient definitions. It must never be used for
text, borders, or interactive states.

Contrast floor: body text and metadata must clear 4.5:1 against the surface they
sit on, in both registers. `--muted` on `--bg-elev` is the tightest pair in the
system and must be measured, not assumed.

### 1.3 Aurora fields

Aurora is three very diffuse radial gradients on the page ground, not a blur
effect and not a per-card treatment. Defined once in `globals.css`, attached to
`body` in the stage register only.

```
--aurora:
  radial-gradient(1200px 700px at 82% -12%, rgb(255 45 135 / 0.16), transparent 60%),
  radial-gradient(1000px 620px at -8% 18%,  rgb(124 92 255 / 0.14), transparent 58%),
  radial-gradient(900px 900px at 50% 108%,  rgb(53 224 245 / 0.10), transparent 55%);
```

No `backdrop-filter` anywhere in the system. It is the single most expensive
paint operation available and this app already has a measured performance
problem. Depth comes from light, layered surfaces, and hairlines.

The existing film-grain overlay is kept (it hides gradient banding) but reduced
to `opacity: 0.03`.

### 1.4 Typography

Keep the three fonts already loaded — they are good choices and changing them
costs new font downloads for no gain:

- `--font-display` Bricolage Grotesque — headings in the stage register
- `--font-sans` Figtree — body, UI, headings in the data register
- `--font-mono` JetBrains Mono — all numbers, metadata, badges, table figures

What changes is the scale and the treatment.

```
--step--1: clamp(0.82rem, 0.80rem + 0.10vw, 0.88rem);
--step-0:  clamp(0.98rem, 0.95rem + 0.15vw, 1.06rem);
--step-1:  clamp(1.20rem, 1.12rem + 0.38vw, 1.42rem);
--step-2:  clamp(1.52rem, 1.36rem + 0.78vw, 2.05rem);
--step-3:  clamp(1.95rem, 1.62rem + 1.62vw, 3.05rem);
--step-4:  clamp(2.50rem, 1.85rem + 3.20vw, 4.60rem);
--step-5:  clamp(3.10rem, 1.90rem + 5.90vw, 7.20rem);
```

Rules:
- Display sizes (`--step-4`, `--step-5`) carry `letter-spacing: -0.035em` and
  `line-height: 0.95`. They appear only in the stage register.
- Every element that renders digits gets `font-variant-numeric: tabular-nums`.
  Salary tables, rankings, counters, dates.
- Measure caps at `68ch` for prose, `52ch` for lead paragraphs.

### 1.5 The two registers

One system, two registers, switched by an attribute on `<body>` set from the
layout. Not two design systems.

`data-surface="stage"` — home, pricing, hire, post-a-job, learn, about, faq,
what-is-web3, login, onboarding, legal.

`data-surface="data"` — jobs catalog, job detail, hidden-jobs, companies,
rankings, hubs, salaries, account, 404.

What the attribute switches:

| | stage | data |
|---|---|---|
| body background | `--aurora` over `--bg` | flat `--bg`, no aurora |
| heading font | `--font-display` | `--font-sans`, 600 |
| section rhythm | `--section: clamp(88px, 10vw, 152px)` | `--section: clamp(48px, 5vw, 72px)` |
| card surface | `--bg-elev` + accent-tinted glow on hover | `--bg-elev` + hairline, no glow |
| motion duration | `--dur-long` | `--dur-short` |
| reveal distance | 24px | 8px |

Everything else — colour tokens, type scale, mono treatment, focus rings,
button primitives — is identical in both registers. A component must not need to
know which register it is in.

### 1.6 Primitives

Declared in `globals.css`, used everywhere, never re-declared in an area
stylesheet:

- `.container` — max-width `--container`, gutter `--gutter`
- `.stack > * + *` — vertical rhythm via `--flow`
- `.panel` — `--bg-elev`, 1px `--line`, `--radius-lg`
- `.hairline` — 1px `--line` divider that fades at both ends
- `.button`, `.button--primary`, `.button--ghost`, `.button--quiet`
- `.chip`, `.chip--active`
- `.badge`, `.badge--honest` (the not-on-LinkedIn badge)
- `.field`, `.field__label`, `.field__input`, `.field__error`
- `.table`, `.table__num` (tabular-nums, right aligned)

**Specificity rule, learned the hard way:** the base is `.button` alone, never
`button.button`. A compound selector outranks every `.button--*` modifier and
silently makes all secondary buttons the primary colour. Modifiers must sit at
the same specificity as the base.

### 1.7 Motion

A single new file, `app/styles/motion.css`, imported from `layout.tsx` directly
after `globals.css`. It declares only motion primitives. No area stylesheet
declares `@keyframes`; the 34 keyframes currently spread across the area files
are consolidated here or deleted.

```
--dur-instant: 90ms;
--dur-short:   180ms;
--dur-mid:     320ms;
--dur-long:    620ms;
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
--ease-spring: linear(0, 0.006, 0.025, 0.101, 0.539, 0.826, 0.960, 1.021, 1.019, 1.004, 1);
```

Primitives, each a class:

1. `.m-reveal` — opacity and translateY on scroll entry.
2. `.m-parallax` — slow background drift on scroll.
3. `.m-marquee` — continuous horizontal loop, pauses on hover and on focus-within.
4. `.m-count` — number roll-up on entry.
5. `.m-lift` — hover elevation on cards.
6. `.m-sheen` — a single accent sweep across a surface on entry, stage only.

**Scroll-driven, with a real fallback.** `.m-reveal` and `.m-parallax` are
implemented with `animation-timeline: view()`, which needs no JavaScript at all.
Chromium supports it; WebKit and Firefox do not, at time of writing.

```css
@supports (animation-timeline: view()) {
  .m-reveal {
    animation: reveal linear both;
    animation-timeline: view();
    animation-range: entry 0% cover 32%;
  }
}

@supports not (animation-timeline: view()) {
  /* Default is the finished state: no JS, no support, still readable. */
  .m-reveal {
    opacity: 1;
    transform: none;
    transition:
      opacity var(--dur-long) var(--ease-out),
      transform var(--dur-long) var(--ease-out);
  }
  /* Only a browser that will actually run the observer gets the start state. */
  @media (scripting: enabled) {
    .m-reveal[data-reveal]:not(.is-in) {
      opacity: 0;
      transform: translateY(var(--reveal-d));
    }
  }
}
```

The failure mode that must not happen is a browser where the start state applies
and the animation never runs, leaving sections permanently invisible. Hence the
two guards above: the start state is reachable only when the scroll timeline is
absent *and* scripting is enabled *and* the element opted in with `data-reveal`.
Every other combination renders the finished page.

The `@media (scripting: enabled)` gate is required. An earlier attempt used an
inline script that added a class to `<html>` instead, which caused a React
hydration mismatch and had to be removed. Do not reintroduce that pattern.

`RevealObserver` (`app/_components/reveal-observer.tsx`) is retained unchanged as
the non-Chromium path. It is already correct: it adds `is-in`, it degrades when
`IntersectionObserver` is absent, and it is gated so no-JS renders everything.

**Page transitions** use the View Transitions API, progressive by nature:
browsers without it simply navigate. Cross-document transitions via
`@view-transition { navigation: auto }`, with named transition groups only on
the site chrome (header, footer) so content cross-fades and the chrome stays put.

**Reduced motion** is not a nicety and not optional:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
  .m-marquee { animation: none; }
}
```

Opacity end-states must still resolve to visible. A reduced-motion user sees the
finished page, never a blank one.

**No motion on interaction-blocking paths.** Filters, search, pagination and
form submission must never wait on an animation to become usable.

---

## 2. The 17 templates, in 6 lanes

Each lane owns a disjoint set of files. No agent edits a file owned by another
lane. Shared files (`globals.css`, `motion.css`, `layout.tsx`, `site-chrome.tsx`)
are written in phase 0 and are **read-only** for every lane.

| Lane | Templates | Owned files |
|---|---|---|
| 1 · Stage | home | `app/page.tsx`, `app/_components/home/**`, `app/_components/home-mega.tsx`, `app/_components/theaters/**`, `app/_components/marquee.tsx`, `app/styles/home.css`, `app/styles/theaters.css` |
| 2 · Board | `/jobs` catalog, job detail, hidden-jobs | `app/jobs/**`, `app/[slug]/[id]/**`, `app/hidden-jobs/**`, `app/_components/job-*.tsx`, `app/_components/catalog-jobs.tsx`, `app/styles/jobs.css`, `app/styles/job-detail.css` |
| 3 · Directory | companies index + detail, rankings, hubs | `app/companies/**`, `app/web3-companies/**`, `app/[hub]/**`, `app/[slug]/page.tsx`, `app/skills/**`, `app/roles/**`, `app/web3-cities/**`, `app/top-*/**`, `app/most-popular-*/**`, `app/highest-*/**`, `app/entry-*/**`, `app/_components/ranking-board.tsx`, `app/_components/rankings-chips.tsx`, `app/_components/hub-links.tsx`, `app/_components/tag-chips.tsx`, `app/styles/board.css`, `app/styles/nodework.css` |
| 4 · Data | salaries index, detail, non-tech, comparison, learn, crypto-events | `app/web3-salaries/**`, `app/web3-non-tech-salaries/**`, `app/learn-web3/**`, `app/what-is-web3/**`, `app/crypto-events/**`, `app/_components/salary-*.tsx`, `app/_components/resource-grid.tsx`, `app/_components/article-layout.tsx`, `app/styles/salary.css`, `app/styles/learn.css` |
| 5 · Funnel | pricing, hire, post-a-job, ads, api, login, onboarding, legal, about, faq | `app/pricing/**`, `app/hire/**`, `app/post-web3-job/**`, `app/ads/**`, `app/web3-jobs-api/**`, `app/login/**`, `app/onboarding/**`, `app/terms/**`, `app/privacy/**`, `app/legal/**`, `app/about/**`, `app/faq/**`, `app/_components/pricing-plans.tsx`, `app/styles/pricing.css`, `app/styles/marketing.css` |
| 6 · Account | dashboard, profile, settings, 404 | `app/dashboard/**`, `app/profile/**`, `app/settings/**`, `app/not-found.tsx`, `app/_components/account-shell.tsx`, `app/styles/account.css` |

---

## 3. Execution

**Phase 0 — the system.** One agent, model Fable 5.1. Writes `globals.css`
tokens and primitives, `motion.css`, the register attribute in `layout.tsx`, the
redesigned `site-chrome.tsx` (header, nav, mobile menu, footer), and fixes the
two component-level stylesheet imports. Nothing else starts until this lands.
This phase sets the aesthetic ceiling for everything after it, so it is not the
place to economise.

**Phase 1 — the six lanes, in parallel.** Model Haiku 4.5. Each lane consumes
the phase 0 system and redesigns its templates. Lanes may not add tokens, may not
add keyframes, may not add dependencies.

**Phase 2 — QA.** Four agents, model Sonnet 5, one per dimension, described in
section 4.

**Phase 3 — fixes.** One agent per lane that has confirmed findings, model
Haiku 4.5, then phase 2 reruns on the same harness.

Approximately 12 to 14 agents in total.

---

## 4. QA

### 4.1 Harness

Playwright as a devDependency of `apps/web`, with real Chromium, WebKit and
Firefox builds. All QA runs against a **production build** on its own port, never
against `next dev`.

Two reasons, both learned by being wrong before. Dev-server timings are not
production timings — `/about` measured 0.12s in dev and 0.008s in production, a
15x difference that makes every dev number meaningless. And a dev server left
running for hours under concurrent edits genuinely degrades: after six agents
edited the app one night the mobile menu stopped responding, five independent
checks agreed it was broken, and it worked perfectly after a restart with no code
change. Before any interaction is reported broken, the server is restarted and
the check is repeated on a clean process.

Matrix: 17 templates × 6 viewports × 3 engines.
Viewports: 360×740, 390×844 (touch, dsf 3), 768×1024 (touch), 1024×768,
1440×900, 1920×1080.

### 4.2 The four dimensions

**Layout.** Horizontal overflow, clipped text, tap targets under 24px, reflow
integrity, contrast.

Overflow is measured as `documentElement.scrollWidth - documentElement.clientWidth`.
Never against `window.innerWidth`: under `Emulation.setDeviceMetricsOverride`
with `mobile: true`, `innerWidth` reports the *visual* viewport, which expands to
the content width whenever the page overflows, so it always equals `scrollWidth`
and the subtraction is identically zero. Measured on a fixture overflowing by
510px: innerWidth 900, clientWidth 390, scrollWidth 900. `clientWidth` is the
layout viewport and is the correct divisor.

A screenshot at a narrow window size **crops**; it does not reflow. Judgements
about mobile layout come from a real device-metrics override, never from a
narrow screenshot.

An element sitting past the right edge is normal when an ancestor clips or
scrolls it — a carousel track, an overflow-x container. Per-element overflow is
only attributed when the page itself overflows.

**Interaction.** Every filter, accordion, carousel, menu toggle, pagination
control and form is clicked with real mouse events, and its state is read back
**after awaiting a turn of the event loop (~350ms)**. React updates the DOM
asynchronously; reading `aria-expanded` in the same JS turn as the `.click()`
always sees the old value and reports a working control as dead.

**Accessibility.** Contrast in both registers, keyboard focus visible on every
interactive element, tab order, landmarks, alt text, ARIA correctness, skip link.

**Motion and performance.** `prefers-reduced-motion` honoured; scroll-driven
degradation on WebKit and Firefox verified as *static and readable*, never as
*invisible*; page transitions degrade to plain navigation; LCP and TTFB per
template compared against the 2026-09-09 baseline in `docs/qa/`.

### 4.3 Acceptance

Zero Critical, zero High.

**No finding enters a report without having been reproduced by hand.** This rule
is not ceremony: of 13 visual candidates raised by the last review, 12 were
rejected with evidence, and three "critical" findings in another session turned
out to be artefacts of a stale dev server or of the measurement itself. A
finding needs a root cause identified in the code and a single point of
intervention, or it is not a finding.

Text-counting note: `grep -c` counts matching *lines*, and Next.js HTML is one
long line, so it undercounts wildly. Count occurrences with `grep -o pattern | wc -l`.

### 4.4 Regression gates

- `pnpm -r test` green. 104 test files.
- `pnpm -r typecheck` clean.
- `pnpm --filter @gaming/web build` succeeds.

**The tree-walk trap.** Page tests walk the returned React element tree and
recurse only into `props.children`. A tested string moved into a child component
disappears from that tree and the test fails although nothing is broken. When a
redesign moves tested content into a subcomponent, either call the component as a
plain function so its output lands in the tree — `{JobCard({ job })}` — or update
the test deliberately and say so in the lane's report. Silently deleting an
assertion is not allowed.

**Locked copy.** Import, never retype: `HOMEPAGE_CLAIM`,
`LINKEDIN_EXCLUSIVITY_TOOLTIP`, `PRICING_COPY`, the login strings, the hidden
page H1, and everything in `lib/legal/copy.ts`.

**Honesty rules that survive the redesign.** No invented KPIs. No "Trusted by".
Testimonials, if present at all, are labelled as example voices. No UI implying
studios receive a profile when someone applies — applying happens on the studio's
own site, and the talent pool is opt-in and off by default.

### 4.5 Env trap

`next dev` does not see `SITE_URL`; it lives in wrangler vars and is never copied
into `process.env`. Public routes must degrade to a relative path rather than
throw. Route params also arrive percent-encoded — `/remote+solidity-jobs` reaches
the route as `remote%2Bsolidity-jobs` — so anything touching route parsing keeps
its `decodeURIComponent` in a try/catch.

---

## 5. Deliverables

- Redesigned `apps/web`, on `redesign/aurora`, one commit per phase.
- `app/styles/motion.css`, new.
- `docs/qa/2026-09-09-aurora-qa-report.md` — findings, evidence, rejected candidates.
- A short summary of what changed, what was found, and what was left undone.
