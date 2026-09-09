# Aurora QA harness

The instrument for `docs/superpowers/plans/2026-09-09-aurora-redesign.md`
Task 8 / spec section 4. This directory is the tool four downstream QA
agents (Tasks 9-12, one per dimension: layout, interaction, accessibility,
motion-and-performance) use to walk the redesigned app. It does not contain
any findings about the app itself.

## 0. Files

| File | Purpose |
|---|---|
| `templates.mjs` | The distinct visual templates, one row each, with a real URL and the reasoning for why the count is 21, not 17 - read the header comment. |
| `harness.mjs` | Measurement primitives (`overflowPx`, `settle`, `clippedText`, `smallTargets`, `contrastPairs`, `focusables`) and `runMatrix()`, the walker that drives them across templates x viewports x engines and writes `qa/out/<dimension>.json`. |
| `run.mjs` | CLI wrapper: `node qa/run.mjs <layout\|interaction\|accessibility\|motion>`. Ships a working default check for each dimension built only from the primitives above - QA agents should extend or replace these, especially `interaction`, which needs real per-template flows, not a generic sweep. |
| `self-test.mjs` | Step 5 of the task: proves `overflowPx()` and `settle()` are not lying, against the fixtures below, on all three engines. Run this before trusting anything else in this directory. |
| `fixtures/overflow-fixture.html` | A page with one element 510px wider than a 390px viewport. `overflowPx()` must report ~510 against it, never 0. |
| `fixtures/settle-fixture.html` | A button whose `aria-expanded` flips on a 300ms timeout, mimicking React's async DOM update. Reading immediately after `.click()` must see the stale value; reading after `settle()` must see the new one. |
| `out/*.json` | Matrix output, one file per dimension, git-ignored-worthy but not currently ignored - ask the coordinator before committing large result files. |

## 1. Install (already done in this environment)

```bash
cd apps/web && pnpm add -D @playwright/test && pnpm exec playwright install chromium firefox webkit
```

All three engines installed cleanly in this environment:
`chromium-1243` (Chrome for Testing 153.0.8010.12), `firefox-1543`
(Firefox 155.0), `webkit-2359` (WebKit 26.6) - confirmed present under
`%LOCALAPPDATA%\ms-playwright` and exercised successfully by
`self-test.mjs` (below). If a QA agent runs this on a different machine and
any of the three downloads fails, **do not silently fall back to Chromium
only** - report which engine failed and why; a report that says "tested on
3 engines" while only Chromium actually ran is worse than one that admits
it only got one.

## 2. Serve a production build - never `next dev`

```bash
cd apps/web
pnpm exec next build
BETTER_AUTH_SECRET=qa-harness-local-secret pnpm exec next start -p 3100
```

Why not `next dev`: dev-server timings are not production timings (`/about`
measured 0.12s in dev against 0.008s in production - a 15x difference that
makes every dev number meaningless for the motion/performance dimension),
and a dev server left running for hours under concurrent edits genuinely
degrades. All four QA agents run against `next start -p 3100`, on a **clean,
freshly restarted process** - if an interaction looks broken, restart the
server and repeat the check before reporting it, per design spec 4.1.

**Why `BETTER_AUTH_SECRET` is required, and why it is set on the command
line, not in a file:** without it, `/dashboard`, `/profile`, `/settings`,
and `/onboarding` (the "account" and part of the "auth" templates) return
HTTP 500 for every visitor, not just unauthenticated ones - `next start`
does not read `.dev.vars` (that's a Wrangler/`next dev` mechanism, see
design spec 4.5's `SITE_URL` trap for the same class of gap), and better-auth
throws `BetterAuthError: You are using the default secret` the moment any
page touches the session before a secret is configured. This was verified
by hand: the same route 500s without the var and correctly 307-redirects an
anonymous request to `/login` with it set. The value above is a throwaway
local secret with no relationship to any real credential - do not reuse it
anywhere else, and do not commit it.

This repo's other secrets (`GOOGLE_CLIENT_ID`, `STRIPE_SECRET_KEY`, etc.)
are **not** required for the QA matrix - they gate specific server actions
(OAuth sign-in, checkout) that the matrix never triggers, and their absence
only logs a build-time warning, not a runtime 500.

**Known gap the coordinator should decide on:** even with the secret set,
the harness has no seeded session cookie, so `/dashboard`, `/profile`, and
`/settings` are only reachable as anonymous requests that immediately
307-redirect to `/login`. The harness records that redirect faithfully (it
is not a bug in the instrument), but no QA agent can audit the actual
dashboard/profile/settings *rendering* this way. Fabricating a valid
better-auth session by hand-writing the `session`/`account` D1 tables was
judged out of scope for "build the instrument" - it means reverse-engineering
better-auth's own token signing, which is app-internals territory. If the
account templates need real audit coverage, someone with a way to mint a
session (a seeded test user + a login flow driven by Playwright, or a
better-auth admin helper) needs to hand the harness a storage state file;
`runMatrix()`'s `browser.newContext()` call accepts a `storageState` path
with a one-line change once that exists.

## 3. Prove the instrument works before trusting it

```bash
cd apps/web
node qa/self-test.mjs
# or: pnpm run qa
```

This is step 5 of the task and is not optional. It runs both fixtures
above against all three engines (9 checks total) and exits non-zero if any
of them fails. Actual output from this environment:

```
[PASS] chromium: overflowPx() fixture (390px viewport, 900px element) - got 510px, expected ~510px (raw: innerWidth=900 clientWidth=390 scrollWidth=900, would-be-innerWidth-bug=true)
[PASS] chromium: settle() false-negative reproduction (read immediately after click) - got aria-expanded="false", expected "false" (the stale value) - proves the trap is real
[PASS] chromium: settle() correct read (after ~350ms) - got aria-expanded="true", expected "true"
[PASS] firefox: overflowPx() fixture (390px viewport, 900px element) - got 510px, expected ~510px (raw: innerWidth=390 clientWidth=390 scrollWidth=900, would-be-innerWidth-bug=false)
[PASS] firefox: settle() false-negative reproduction (read immediately after click) - got aria-expanded="false", expected "false" (the stale value) - proves the trap is real
[PASS] firefox: settle() correct read (after ~350ms) - got aria-expanded="true", expected "true"
[PASS] webkit: overflowPx() fixture (390px viewport, 900px element) - got 510px, expected ~510px (raw: innerWidth=390 clientWidth=390 scrollWidth=900, would-be-innerWidth-bug=false)
[PASS] webkit: settle() false-negative reproduction (read immediately after click) - got aria-expanded="false", expected "false" (the stale value) - proves the trap is real
[PASS] webkit: settle() correct read (after ~350ms) - got aria-expanded="true", expected "true"

self-test: all checks passed on chromium, firefox, and webkit.
```

Two things worth noting in that output:

- **Chromium alone** shows `would-be-innerWidth-bug=true` (`innerWidth=900`
  equals `scrollWidth=900`, matching the spec's own measured example
  exactly: "innerWidth 900, clientWidth 390, scrollWidth 900"). This is
  because Playwright's `isMobile` context option - which is what actually
  reproduces the visual-viewport-expands-to-content bug - is Chromium-only;
  `runMatrix()` only sets it for the `chromium` engine (see the comment in
  `harness.mjs`). Firefox and WebKit never exhibited the bug in the first
  place, so `overflowPx()` reading `clientWidth` isn't "fixing" anything on
  those two engines - it's Chromium under real mobile emulation where the
  bug is live and the fix matters.
- The fixture's first run **without** a `<meta name="viewport">` tag failed
  on Chromium: `clientWidth` came back `980`, not `390`, because Chromium's
  mobile emulation falls back to the legacy desktop-compat default layout
  viewport (980px) on pages with no viewport meta tag - the same thing real
  Android Chrome does on non-mobile-optimized sites. This is now documented
  inline in `fixtures/overflow-fixture.html`. It is a second, independent
  way to get a wrong `overflowPx()` reading that has nothing to do with the
  `innerWidth` trap the spec calls out - worth knowing about if a future
  fixture is added without a viewport meta tag. Every real app page already
  ships one via Next.js's default `viewport` export, so this only bites
  fixtures, not the actual QA runs.

## 4. Real template URLs

Full list with justification lives in `templates.mjs` - read its header
comment first. Summary:

- **21 distinct visual templates**, not the 17 named in spec section 4.1.
  Section 4.1 says "17"; section 4.1's own template-name enumeration (and
  this task's restated version of it) is 21 comma-separated names once
  "companies index + detail" is correctly read as two templates and "hubs"
  is expanded to its three named sub-templates. Each of the 21 rows in
  `templates.mjs` was verified against a distinct root wrapper
  (`surface--stage` vs `surface--data`, `board-main` vs not, `AccountShell`
  vs `ArticleLayout` vs bespoke) in the actual component tree, not guessed
  from route names - see the file for the specifics and for which routes
  that *look* like separate templates are actually redirect shims to one of
  the 21 (`/companies` -> `/web3-companies`, `/skills/[slug]` -> a hub
  landing or 404, `/hidden-jobs` -> `/remote-jobs`, `/top-growing-web3-companies`
  -> `/web3-companies/top-growing`, etc.).
- Every dynamic-route URL is a real row pulled from the local D1
  (`apps/web/.wrangler/state/v3/d1`), never a placeholder slug, and then
  independently confirmed with `curl` against the running production build
  (status 200, or the specific redirect noted in `templates.mjs`). The
  exact queries used:

  ```bash
  cd apps/web
  pnpm exec wrangler d1 execute gaming-jobs --local --command "select slug, external_id from jobs where listed=1 limit 5"
  pnpm exec wrangler d1 execute gaming-jobs --local --command "select name, name_norm from companies where listed=1 limit 5"
  pnpm exec wrangler d1 execute gaming-jobs --local --command "select dimension, slug from salary_rollups where dimension='role' limit 5"
  ```

  Company slugs are `slugTitle(name_norm)`, **not** `slugTitle(name)** -
  `name_norm` for "Riot Games" is stored as `"riot"`, so the real URL is
  `/web3-companies/riot`, not `/web3-companies/riot-games`. This was not
  obvious from the schema alone and was only confirmed by tracing
  `lib/companies/queries.ts` and then curling the result.
- No table needed to be marked empty/unreachable in this environment - jobs,
  companies, and `salary_rollups` all had rows.
- The combo landing is listed exactly as a browser address bar would show
  it: `/remote+solidity-jobs`. Playwright's `page.goto()` sends this
  literally over HTTP; the route itself receives the percent-encoded form
  (`remote%2Bsolidity-jobs`) and decodes it in `parseLandingSegment` /
  `landing-canonical.ts`. Verified 200, not a redirect (only the
  non-canonical facet order, e.g. `/solidity+remote-jobs`, 308s to this
  canonical spelling).

## 5. Running a dimension's matrix

```bash
cd apps/web
# server from step 2 must already be running on :3100
node qa/run.mjs layout
node qa/run.mjs interaction
node qa/run.mjs accessibility
node qa/run.mjs motion
```

Each writes `qa/out/<dimension>.json`, one row per
`{ template, register, url, engine, viewport, gotoStatus, checks, evidence }`,
21 templates x 6 viewports x 3 engines = 378 rows per dimension. A smoke run
of 4 templates x 2 viewports x 3 engines (24 rows, layout checks) took 42.6s
in this environment, so a full single-dimension matrix should land somewhere
in the 10-15 minute range depending on machine and network. Run dimensions
sequentially, not concurrently, against the same server process - two
matrices hammering `:3100` at once is exactly the kind of concurrent load
the design spec's dev-server-degradation warning (4.1) is about, and while
that warning was written about `next dev`, there's no reason to assume a
production Node server handles four simultaneous Playwright matrices any
better without evidence that it does.

A QA agent that wants a different check for its dimension than the default
in `run.mjs` should write its own small script importing
`{ runMatrix, ...primitives }` from `./harness.mjs` and `templates` from
`./templates.mjs` - `run.mjs`'s checks are a working starting point, not a
contract to stay inside.

To scope a run to fewer templates/viewports/engines while iterating (the
smoke-test pattern used to build this harness), call `runMatrix()` directly
with the `templates`, `viewports`, and/or `engines` overrides instead of
going through `run.mjs`:

```js
import { runMatrix, VIEWPORTS } from "./harness.mjs";
import templates from "./templates.mjs";

await runMatrix({
  dimension: "layout",
  templates: templates.filter((t) => t.id === "home"),
  viewports: [VIEWPORTS[0]],
  engines: ["chromium"],
  check: /* ... */,
});
```

## 6. Counting text occurrences correctly

`grep -c pattern file` counts matching **lines**, and Next.js's rendered
HTML is nearly one giant line per document, so `grep -c` will report `1` (or
`0`) no matter how many times something actually occurs. Always count
occurrences with:

```bash
grep -o 'pattern' file | wc -l
```

This matters anywhere a QA report needs to say how many times a string,
tag, or class appears in a page's rendered output (e.g. counting `<img`
tags, counting a repeated component's wrapper class, counting occurrences
of locked copy).

## 7. What could not be made to work

- **Auth-gated templates cannot be fully exercised anonymously.** See
  section 2 above - `/dashboard`, `/profile`, `/settings` currently only
  test as far as the anonymous 307-to-`/login` redirect without a seeded
  session. `/onboarding` (part of the `auth` template family) has the same
  gap.
- **The 360x740 viewport's touch/mobile flags are a literal reading of an
  ambiguous spec sentence**, not a verified intentional choice - see the
  comment above `VIEWPORTS` in `harness.mjs`. Worth a one-line confirmation
  from whoever owns the spec before the layout dimension leans on it.
- **`contrastPairs()` is an approximation**, not a WCAG-conformance tool -
  it does not composite semi-transparent backgrounds, background-images, or
  gradients into its effective-background walk. It is a reasonable first
  pass to point the accessibility QA agent at likely failures, not a
  replacement for axe-core-grade tooling or for looking at the page.
- Everything else in the task (three real engines installed, 21 real
  templates with real data, production build served on its own port,
  `overflowPx`/`settle` proven against fixtures on all three engines,
  `runMatrix()` smoke-tested end-to-end against the live app) worked as
  specified.
