# Aurora QA — Interaction dimension

Date: 2026-09-10. Server under test: `next start -p 3100` (production build),
`BETTER_AUTH_SECRET=qa-harness-local-secret`, already running, owned by the
coordinator — not restarted during this pass. Instrument: `qa/harness.mjs` +
`qa/templates.mjs`, self-tested clean on chromium/firefox/webkit before use
(`node qa/self-test.mjs`, all 9 checks pass). Bespoke flow scripts written for
this pass: `qa/interaction-flows.mjs` (44 checks, chromium primary, mobile
menu and unlock gate cross-checked on firefox/webkit) and
`qa/unlock-cross-engine.mjs` (firefox/webkit confirmation of the unlock gate).

**Every finding below was reproduced by hand** — either through the Playwright
scripts in `qa/`, or through direct `curl`/D1 queries — with a root cause read
from the actual source and a single point of intervention. Nothing here comes
from the generic `qa/run.mjs` `interaction` sweep.

## Summary

| Severity | Finding | Template |
|---|---|---|
| High | Login magic-link form fails completely silently (no error, no success, no announcement) whenever the Turnstile widget's cleanup call throws — 100% reproducible in this environment because `TURNSTILE_SITE_KEY` is unset here | auth (`/login`) |
| High | "Delete my account" is a single, unconfirmed click — no modal, no `confirm()`, no second step — and irreversibly deletes profile, CV and unlock history | account (`/settings`) |
| — | Everything else exercised (filter bar, search, pagination incl. rank continuation, mobile menu, mega menu, unlock gate, mobile apply bar, FAQ accordions, home carousel, apply-form validation, account-page rendering) worked correctly on every engine and viewport tested. See "Verified working" below. | multiple |

No Critical findings (no dead control, no data leak) survived hand
verification. No Medium/Low findings are reported — nothing surfaced during
this pass was worth logging below that bar without inflating the report with
cosmetic noise not actually observed.

---

## Findings

### 1. [High] Login form: a rejected Turnstile reset silently swallows the real submit result

- **Template / viewport / engine:** auth (`/login`), 1440×900, chromium (code
  path is engine-independent — it is a JS control-flow bug, not a rendering
  one).
- **Steps:**
  1. Go to `/login`.
  2. Fill a syntactically valid email (`qa-tester@example.com`).
  3. Click the submit button.
- **Expected:** either a "Check your email" success notice
  (`.notice--accent[role="status"]`) or an error notice
  (`.notice--danger[role="alert"]`) appears.
- **Actual:** neither appears. The page does not change at all. The only
  visible evidence is two uncaught console errors:
  ```
  [Cloudflare Turnstile] Invalid input for parameter "sitekey", got "".
  [Cloudflare Turnstile] Nothing to reset found for provided container.
  ```
  and a real network round trip that DID happen and DID fail server-side
  (`POST /api/auth/sign-in/magic-link` → 400
  `{"error":"Turnstile token is required"}`) — the user is never told any of
  this.
- **Root cause:** `app/login/login-form.tsx`.
  - `resetTurnstileWidget()` (lines 10–16) calls `turnstile?.reset?.()` with
    no `try/catch`.
  - `submitLoginMagicLink()` (lines 18–43) calls `resetTurnstileWidget()`
    unconditionally from a `finally` block wrapped around the real
    `authClient.signIn.magicLink(...)` call.
  - Per JS semantics, a throw inside a `finally` block **replaces** whatever
    the `try` block was about to return or throw. When the Turnstile widget
    never mounted (as in this environment — see below) or has already been
    torn down, `turnstile.reset()` itself throws
    `TurnstileError: Nothing to reset found for provided container`, which
    means `submitLoginMagicLink()` rejects instead of resolving to
    `{ data, error }`.
  - `LoginForm.onSubmit` (line 66, destructure at line 75) awaits
    `submitLoginMagicLink(...)` with no `try/catch` of its own, so the
    rejection becomes an unhandled promise rejection. `setError` and
    `setMessage` (the only two places that update the UI) are never reached.
- **Why this is reproducible 100% of the time in this environment, and why it
  is a real bug beyond that:** `app/login/page.tsx` line 30 reads
  `process.env.TURNSTILE_SITE_KEY ?? ""`, and that env var is unset on this
  QA server (same class of gap as the documented `BETTER_AUTH_SECRET`/
  `SITE_URL` variables, but not currently called out in `qa/README.md`) — so
  the Turnstile widget fails to initialize on every page load, and every
  submit attempt hits the `reset()`-throws-on-a-nonexistent-widget path. With
  a real site key configured, the same crash is still reachable any time
  `turnstile.reset()` is called on a widget that failed to render or that a
  user submitted before it finished mounting (Turnstile's script loads
  `afterInteractive` and renders asynchronously) — e.g. an ad blocker or
  corporate network blocking `challenges.cloudflare.com`, or a fast
  keyboard-driven submit. In all of those cases the symptom is identical: the
  submit button does nothing, with no error surfaced to the user.
- **Single point of intervention:** wrap the body of `resetTurnstileWidget()`
  (app/login/login-form.tsx line 15) in a `try { turnstile?.reset?.(); }
  catch {}` — a best-effort cleanup call must never be allowed to override the
  real result of the submit it is cleaning up after. (A defensive
  `try/catch` around the `await submitLoginMagicLink(...)` call in `onSubmit`,
  line 75, would also mask it, but fixing the `finally` is the one change
  that protects every current and future caller of `resetTurnstileWidget`.)
- **Also recorded separately, not as part of this finding:** `docs/qa` /
  `qa/README.md` should add `TURNSTILE_SITE_KEY` to the list of env vars that
  change runtime behavior on this server — it is not merely cosmetic like
  `GOOGLE_CLIENT_ID`/`STRIPE_SECRET_KEY` (the README's own wording for "not
  required"), it breaks the login form's error handling outright. See "What
  could not be tested" below.

### 2. [High] "Delete my account" has no confirmation step

- **Template / viewport / engine:** account (`/settings`), 1440×900,
  chromium.
- **Steps:** signed in (see session-seeding method below), go to `/settings`,
  click "Delete my account" once.
- **Expected:** a destructive, irreversible action (the page's own copy says
  "Deleting your account removes your profile, CV and unlock history. This
  cannot be undone.") gets some confirmation step before it fires — a native
  `confirm()`, a modal, a second click, a typed confirmation phrase.
- **Actual:** one click submits the form immediately. Verified end-to-end: no
  `dialog` event fired, the page navigated straight to `/` with no
  interstitial, and an immediate `GET /api/auth/get-session` afterward
  returned `null` — the account, session, and (per `deleteAccount`'s own
  contract) profile/CV/unlock history were already gone.
- **Root cause:** `app/settings/page.tsx` lines 99–103:
  ```tsx
  <form action="/api/account/delete" method="post">
    <button className="button button--danger" type="submit">
      Delete my account
    </button>
  </form>
  ```
  No `onSubmit` handler, no modal, no second step. `app/api/account/delete/
  route.ts` performs the deletion unconditionally for any authenticated POST
  — there is no confirmation token or second round trip required anywhere in
  the chain.
- **Single point of intervention:** add a confirmation gate in
  `app/settings/page.tsx` around this form (the simplest fix: a small client
  component wrapping the button that calls `window.confirm(...)` in
  `onSubmit` and calls `event.preventDefault()` when declined; a proper modal
  is the better long-term fix but the single-file, single-component change is
  the button's own wrapper).
- Note: this was verified on a disposable session seeded for this pass
  (`user:qa-tester@example.com`, deleted by this very test) — no real user
  data was at risk.

---

## Verified working (reproduced by hand, no defect)

All of the following were driven with real Playwright mouse/keyboard events
(not just DOM state pokes), reading state only after the URL/DOM had actually
settled — see "Methodology note" below for why that mattered.

- **`/jobs` filter bar** (`app/jobs/page.tsx`, `SENIORITY_OPTIONS`/source/
  hidden chips): clicking "Senior" sets `?seniority=senior`, marks the chip
  `chip--active`, updates the match count (1,042 → 226), and adds a removable
  chip to the active-filters ribbon; "Clear filters" returns to a bare
  `/jobs`. Source chip ("Direct from career pages") sets/clears
  `?source=career_page` and toggles off on a second click. "Not on LinkedIn"
  chip sets `?hidden=1`, drops the count to 5, and every one of those 5 rows
  actually carries the `badge--honest` exclusivity badge. Repeated at 390px
  with `.tap()` — same result.
- **Search**: `<form action="/jobs" method="get">`, `input[name="q"]`, typing
  "solidity" + Enter lands on `/jobs?q=solidity` with 20 result rows.
- **Pagination**: `/jobs` page 2 loads genuinely different rows and marks
  "Page 2 of 53". Ranked pagination (`/highest-paid-developer-jobs`, 200
  jobs, `pageSize` 20) — page 1's first rank is 1, page 2's first rank is 21,
  confirming `rankOffset = (page - 1) * pageSize` in
  `app/_components/job-board.tsx` is correct across the page boundary (the
  exact trap the brief called out did **not** reproduce).
- **Mobile menu** (`app/_components/mobile-menu.tsx`), all three engines at
  390×844: click toggles `aria-expanded` false→true and shows `#mobile-menu`;
  `Escape` closes it and returns focus to the toggle button; keyboard-only
  (Tab to the button, `Enter`) opens it identically to a mouse click.
- **Mega menu** (`app/_components/nav-mega.tsx`), 1440×900: it is
  deliberately CSS-only (`:hover`/`:focus-within`, no JS, no
  `aria-expanded`) — focusing the trigger via keyboard reveals the panel and
  its links become genuinely focusable/visible; the trigger itself is a real
  `<a href>` and navigates on click.
- **Unlock gate — the highest-value check in this pass**
  (`app/[slug]/[id]/job-detail-view.tsx`, `app/jobs/[slug]/unlock-form.tsx`,
  `app/api/unlock/route.ts`), confirmed on **chromium, firefox, and webkit**:
  - `senior-gameplay-engineer-riot-games` (`exclusivity=hidden_from_linkedin`,
    real `apply_url=https://example.invalid/apply/riot-gameplay` in D1) shows
    the unlock gate to an anonymous visitor and renders **no** "Apply now"
    link anywhere.
  - The raw served HTML (fetched directly, not judged from the rendered DOM)
    never contains `example.invalid/apply/riot-gameplay` — not in an
    attribute, not in the JSON-LD `ApplyAction` (whose `target` correctly
    points at the site's own `/apply` route, not the studio's URL), not in
    the RSC hydration payload. Confirmed with `grep -o ... | wc -l` per
    `qa/README.md` §6 (naive `grep -c` would have reported a false `0`/`1`
    either way on this single-line document).
  - Clicking "Unlock application link" as an anonymous visitor posts to
    `/api/unlock` and gets **401**, with no `example.invalid` anywhere in the
    response body, on all three engines.
  - `tools-programmer-unreal-editor-epic-games` (`exclusivity=unknown`, not
    gated) shows the normal on-site "Apply now" flow and zero gate markup.
  - Mobile fixed apply bar (`.jd-apply-fixed`) at 390px shows "Unlock link"
    on the gated job and "Apply now" on the open one.
- **FAQ accordions**: `/jobs` itself only ever renders a single, always-open
  `<details>` (`app/jobs/page.tsx` passes `items={[]}` to `BoardFaq` — the
  generic catalog has no landing-specific FAQ content; confirmed by reading
  `app/[slug]/page.tsx`'s use of `landingFaq()`, which has no equivalent for
  the plain catalog). This is content scope, not a defect — see "Rejected
  candidates" below for how this first looked like a broken accordion. The
  home page's 6-entry accordion (`app/_components/home-mega.tsx`) opens on
  both mouse click and keyboard `Enter` on a focused `<summary>`.
- **Home page reviews carousel** (`app/_components/home-mega.tsx`
  `HomeReviews`, CSS-only radio-group pattern): clicking the "Next" label
  changes the track's `transform`; focusing the underlying (visually hidden
  but still tab-reachable — `opacity:0`, not `display:none`) radio input and
  pressing `ArrowRight` moves to the next slide exactly like a native radio
  group, confirming the carousel is keyboard-operable even though the
  "Previous"/"Next" `<label>` elements themselves are not native tab stops.
- **Forms**: apply form (`app/_components/job-apply-form.tsx`) has
  `required` name/email and `type="email"`, so browser-native validation
  blocks a garbage submit; bypassing that validation
  (`form.setAttribute("novalidate")`, matching what a script-disabled or
  hostile client could do) and submitting an invalid email round-trips
  through `/api/apply` → 303 → `?error=1`, which renders
  "Check your name and email, then submit again." inside a
  `role="alert"` element — the error state does render and is announced.
  Login form's `email` input does carry `required` (confirmed via
  `getAttribute`, not just visual inspection) — see Finding 1 for what
  happens once that gate is passed.
- **Account pages** (`/dashboard`, `/profile`, `/settings`, `/onboarding`) —
  see "Session seeding" below. All four rendered at HTTP 200 with the seeded
  session: `Your dashboard`, `Your profile`, `Settings`, `Finish your
  profile`, all through the shared `AccountShell`/`auth-onboard` wrappers as
  `templates.mjs` predicted. `/settings`'s talent-pool checkbox form and
  `/profile`'s experience/skills/CV-upload forms all carry proper
  `required`/`type` constraints on their inputs.

---

## Session seeding for the account pages (succeeded)

`qa/README.md` §2 and `templates.mjs`'s `account` row both flag `/dashboard`,
`/profile`, `/settings`, `/onboarding` as untestable beyond the anonymous
307-to-`/login` redirect, and call fabricating a session "out of scope...
app-internals territory." This pass closed that gap:

1. `better-auth@1.7.2` ships its own test helper for exactly this
   (`node_modules/better-auth/dist/plugins/test-utils/cookie-builder.mjs`):
   the session cookie value is `${token}.${base64(HMAC-SHA256(secret,
   token))}` (`node_modules/better-auth/dist/crypto/index.mjs`,
   `makeSignature`), where `secret` is the running server's
   `BETTER_AUTH_SECRET` (`qa-harness-local-secret`, per the documented start
   command).
2. Inserted one row into `users` and one into `session` directly in
   `.wrangler/state/v3/d1` (tenant `tenant:gaming`, matching the schema in
   `lib/auth/index.ts`'s `snakeCaseFields`), computed the HMAC in Node with
   the known secret, and set the resulting value as a cookie via Playwright's
   `context.addCookies`.
3. The cookie **name** actually served by this process is
   `__Secure-better-auth.session_token`, not the unprefixed
   `better-auth.session_token` — because `next start` runs with
   `NODE_ENV=production`, and `createAuth()` in `lib/auth/index.ts` never
   sets `BETTER_AUTH_URL`/`SITE_URL` on this server nor an explicit
   `advanced.useSecureCookies`, better-auth's `createCookieGetter`
   (`node_modules/better-auth/dist/cookies/index.mjs`) falls back to
   `isProduction` to decide the `__Secure-` prefix, and gets `true`. This is
   **not** flagged as a defect here: `http://localhost` is a browser-defined
   "potentially trustworthy origin," so a real browser accepts and sends a
   `Secure`-flagged cookie over this exact `http://localhost:3100` address
   without issue — verified indirectly (the seeded cookie worked once its
   real name was used). It would only matter if this server were ever reached
   over plain HTTP through a real hostname instead of `localhost`, which is
   outside what this pass can observe. Worth a one-line note in
   `qa/README.md` for whoever next needs to seed a session, since the wrong
   cookie name is the single most likely way to reproduce this and quietly
   conclude "seeding doesn't work."
4. With the cookie set, `GET /api/auth/get-session` returns the real session
   and user, and all four account routes render instead of redirecting.
5. Cleanup: rather than leaving orphaned rows, the seeded account was removed
   through the app's own delete flow (see Finding 2), which was itself the
   thing being tested — `get-session` confirmed `null` immediately after.

**What is still not covered**: the actual magic-link *send* and *click*
path (Turnstile blocks it — see Finding 1) and Google OAuth sign-in were not
exercised this way; the seeded cookie only proves the session-consumption
side (account pages honoring an existing session), not session issuance.

---

## Rejected candidates (with evidence)

1. **"Every filter chip and pager link is dead" (would-be Critical).** The
   first full run of `qa/interaction-flows.mjs` reported 12 failures across
   the seniority/source/hidden chips, catalog pagination, and the mega-menu
   trigger — all showing the URL unchanged after a `.click()`. Reproduced in
   isolation with a minimal script
   (`await chip.click(); await page.waitForTimeout(...)`) and timed it:
   the URL only updated **~620ms** after the click on this machine. Next.js
   App Router client-side navigations (a `next/link` chip, not a full page
   load) don't fire a new top-level `load` event, so
   `page.waitForLoadState("networkidle")` right after the click can return
   before the RSC fetch + re-render actually lands — and `harness.mjs`'s
   `settle()` (350ms, proven correct for same-document `aria-expanded`
   updates in the self-test) is not long enough for an actual navigation.
   Switching to polling `page.url()` until it changes (see
   `clickAndWaitForNav` in `qa/interaction-flows.mjs`) made all 12 pass. This
   was a test-harness artifact, not a product defect — logged here per the
   task's own instruction to report rejections with evidence, and as a
   caution for the other three dimension agents if any of them time
   navigations similarly.
2. **"The /jobs FAQ accordion is broken — clicking a second entry times
   out" (would-be Medium/High).** `.faq-accordion details.faq-item.nth(1)`
   never resolved on `/jobs`. Confirmed by hand: `app/jobs/page.tsx` calls
   `<BoardFaq featured={featured} items={[]} />` — the catalog page has
   exactly one, always-open `<details>` by design (no landing-specific FAQ
   content exists for the generic catalog; `app/[slug]/page.tsx` uses a
   separate `landingFaq()` generator that has no equivalent here). Not a
   defect — moved the accordion-interaction check to the home page, which
   does have a real 6-entry accordion, and it worked correctly (see
   "Verified working").
3. **"`/api/apply`'s `next` redirect target is ignored — always falls back
   to `/jobs`" (would-be High: broken redirect-after-apply).** `curl -X POST
   .../api/apply --data-urlencode "next=/jobs/.../apply" ...` from this
   machine's Git Bash consistently redirected to `/jobs?error=1` regardless
   of the `next` value, for both simple (`/foo-test-path`) and real paths.
   Reproduced with `-v` and found `Content-Length: 50` for what should have
   been a 22-byte body — Git Bash's automatic POSIX-path-to-Windows-path
   argument mangling was rewriting the leading `/...` value before curl ever
   saw it (a well-known MSYS/Git-Bash gotcha for any bare `/`-prefixed
   argument). Setting `MSYS_NO_PATHCONV=1` made the same command redirect
   correctly to `/only-next-field5?error=1`. `lib/jobs/apply.ts`'s
   `safeNextPath()` and the route's redirect logic are correct; this was
   entirely a shell artifact from testing with `curl` directly instead of
   through a browser. Confirmed the real form (which never goes through a
   shell) round-trips correctly in "Verified working" above.
4. **"The generic apply form (`/jobs/:slug/apply`) is a gate bypass for
   exclusive jobs" (would-be Critical: gate bypass).** The gated job's inline
   "Apply now" CTA is fully replaced by the unlock gate in
   `app/[slug]/[id]/job-detail-view.tsx`, but the underlying
   `/jobs/:slug/apply` route (`app/jobs/[slug]/apply/page.tsx`) never checks
   `exclusivity` and renders the same on-site application form regardless.
   Investigated by reading `JobApplyForm`/`app/api/apply/route.ts`: this
   route is Nodework's own "apply on Nodework" application-collection form —
   it never exposes, links to, or needs the studio's external `apply_url` for
   *any* job, gated or not (that URL only ever reaches the client through
   `/api/unlock`'s JSON response after the full auth+quota gate, per Finding
   handling in `app/jobs/[slug]/unlock-form.tsx`). Visiting this route
   directly on a gated job lets a user submit an application to Nodework's
   internal system, which is a different, always-available feature, not the
   quota-limited "reveal the studio's own link" feature — no external URL is
   leaked and no quota is bypassed. Not a defect.

---

## Methodology note

`overflowPx()`/`settle()` are proven correct by `qa/self-test.mjs` for
same-document React state changes (the exact trap the brief describes:
reading `aria-expanded` in the same turn as `.click()`). This pass surfaced a
**related but distinct** trap for anything that changes the URL via
client-side routing (a `next/link` chip, pager, or mega-menu trigger): the
350ms `settle()` window is not reliably long enough for the RSC
fetch-and-render round trip (measured ~620ms on this machine for a single
filter chip). `qa/interaction-flows.mjs`'s `clickAndWaitForNav()` helper polls
`page.url()` until it actually changes (bounded at 6s) before doing anything
else, rather than assuming a fixed delay. Recommend the layout and
accessibility agents check whether any of their checks click a `next/link`
and read state on a fixed timer, for the same reason.

## What could not be tested, and why

- **The magic-link send/verify path and Google OAuth sign-in** — blocked by
  Finding 1 (`TURNSTILE_SITE_KEY` unset in this environment) and by having no
  way to receive a real magic-link email or complete a Google OAuth
  consent screen from this harness. Account-page *rendering* was still
  fully exercised via a seeded session (see above) — only session
  *issuance* through the UI is untested.
- **Whether the `__Secure-` session cookie would survive being served over a
  real (non-`localhost`) HTTP address** — not reachable from this harness,
  which only ever talks to `http://localhost:3100`; noted above as a
  one-line addition worth making to `qa/README.md` rather than a finding.
- **A second, independent confirmation of the two High findings on Firefox
  and WebKit** — both are JS-logic/markup bugs with no engine-specific
  rendering component (confirmed by reading the code paths involved:
  Promise/`finally` semantics and a plain HTML `<form>` POST are standard
  across engines), so this was judged a reasonable place to spend chromium
  time rather than repeat three times, unlike the unlock gate (Finding-worthy
  candidates get hand-verification; a network/DOM-timing artifact like
  Findings 1–2 does not gain confidence from a second engine the way a
  rendering check would). Flagged here rather than silently skipped.
- **A clean-process retest of anything in this report** — the coordinator's
  documented policy is one restart-and-retest round at the end across all
  four dimensions; nothing here looked like a stale-server artifact (no
  control that "should" work but silently doesn't for no discoverable
  reason), so nothing was held pending that retest.
