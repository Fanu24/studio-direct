# Parity run state — 2026-09-09

Live working document for the "make it 1:1 with web3.career" run. Read this first if a
session is resumed cold.

## The instruction

The user asked for the site to be **1:1 with https://web3.career**, then went to sleep and
asked for a team of subagents to do the structural work plus a QA pass that verifies the
result, resuming whenever credits allow.

Scope as executed: **structural parity** — page types, page anatomy (section order and
purpose), URL taxonomy, navigation and footer information architecture, interaction
affordances. Not copied: their editorial prose, FAQ answers, testimonials, marketing
paragraphs, logo and brand assets. Those are written in our own words in the equivalent
slot, which keeps the work clear of their copyright while still landing the structure the
user asked for.

## Baseline at the start of the run

- Working tree: 78 modified, 1 deleted, 91 untracked entries — the whole Nodework /
  web3.career parity slice, **uncommitted**.
- `pnpm -r test` → 632 tests green (shared 128, db 8, web 392, crawler 88 + 12 + 4).
- `pnpm -r typecheck` → clean.
- Backups taken before the agents ran, in the session scratchpad
  (`C:\Users\dotat\AppData\Local\Temp\claude\C--Users-dotat-Desktop-Saas-JOBS\5b3eba47-35c1-411f-b3cb-acc46ad2a81f\scratchpad`):
  `backup-tracked.patch` (git diff of tracked files) and `backup-worktree.tgz`
  (all sources incl. untracked, excluding node_modules/.next/.wrangler/tmp).
- `tmp/` added to `.gitignore` — it holds ~12 MB of scraped reference sitemaps that must
  never be committed.

## Gaps measured before dispatch (homepage link-graph diff)

Of the 64 URLs the reference links from its homepage that our homepage did not link,
50 already served 200 on ours. The real failures:

| URL | ours | disposition |
| --- | --- | --- |
| `/web3-companies` | 308 → `/companies` | canonical direction must invert |
| `/web3-companies/{slug}` | 404 | we serve `/companies/{slug}` |
| `/web3-companies/top-growing` | 404 | we serve `/top-growing-web3-companies` |
| `/highest-paid-developer-jobs` | 308 | reference links this spelling |
| `/most-popular-designers-jobs` | 308 | reference links this spelling |
| `/post-web3-job/bundle` | 404 | presentation page only, no checkout |
| `/discord`, `/podcast/*`, `/metana`, `/i/*`, `/laser-eyes` | 404 | out of scope |
| `/users/sign_in`, `/users/sign_up` | 404 | ours is `/login` |

Homepage section-level gaps: no customer-reviews carousel; two sections we have that the
reference does not ("How Nodework works", "Related pages"); FAQ shape differs; every
section's internal link inventory is thinner than the reference's.

## Agent assignments (file ownership is disjoint by design)

| agent | owns |
| --- | --- |
| HOME | `app/page.tsx`, `_components/home-mega`, `job-board`, `job-row`, `board-chrome`, `catalog-jobs`, `tag-chips`, `styles/board.css`, `styles/marketing.css` |
| CHROME | `app/layout.tsx`, `_components/site-chrome`, `nav-*`, `mobile-menu`, `footer-data`, `styles/footer.css` |
| COMPANIES | `app/web3-companies/**`, `app/companies/**`, `app/top-growing-web3-companies/**`, `_components/ranking-board` |
| LANDINGS | `app/[slug]/page.tsx` (not `[id]/`), `app/highest-paid-*`, `most-popular-*`, `entry-*`, `top-web3-*`, `shared/landings.ts`, `shared/taxonomy.ts`, `lib/jobs/landing-meta.ts` |
| JOBDETAIL | `app/[slug]/[id]/**`, `app/jobs/**`, `job-apply-form`, `job-card`, `lib/jobs/{apply,jsonld,meta}.ts`, `app/api/apply/**`, `styles/jobs.css` |
| CONTENT | `app/web3-salaries/**`, `web3-non-tech-salaries/**`, `web3-cities/**`, `learn-web3/**`, `what-is-web3/**`, `faq/**`, `hire/**`, `crypto-events/**`, `ads/**`, `web3-jobs-api/**`, `post-web3-job/**`, `salary-*`, `resource-grid`, `article-layout`, `styles/{salary,learn}.css`, `shared/salary.ts` |

Nobody owns, and nobody may edit: `lib/jobs/queries.ts`, `shared/src/index.ts`,
`shared/src/jobs.ts`, `app/globals.css`, `app/styles/nodework.css`, `packages/db/**`.

## QA tooling (session scratchpad)

- `PARITY-BRIEF.md` — the shared brief every agent read
- `outline.py <in.html> <out.txt>` — headings/landmarks/visible-text outline
- `links.py <in.html> <out.txt> <base>` — internal link inventory
- `parity_check.py paths.txt report.md [--refresh]` — the repeatable structural check:
  per path, both status codes, section and `h2` counts on each side, and the reference
  links our page does not link. Reference responses are cached under `cache/`; pass
  `--refresh` to re-fetch. Add a path to `paths.txt` to widen coverage.

Screenshots need an **absolute Windows path** for `--screenshot=`, otherwise Chrome fails
with "Accesso negato".

## How to resume

1. `cd "C:/Users/dotat/Desktop/Saas JOBS"` and confirm `pnpm -r test` and
   `pnpm -r typecheck` are still at or above the baseline above.
2. Start the dev server if it is down: `cd apps/web && pnpm exec next dev -p 3001`.
   Never run `next build` while it is up — the build overwrites `.next` and the dev
   server then serves pages with no CSS at all.
3. Rerun `python parity_check.py paths.txt parity-latest.md` and work the remaining rows.
4. The work is still uncommitted. Committing it has not been authorised yet — ask.

## Agent results

### CHROME — done

Nav: five dropdowns matching the reference's grouping and per-menu inventory, in our URL
taxonomy. Footer: rebuilt to the reference's three-column IA (hubs / Regions / Other) plus
a copyright bar, identical on every page.

Two consequences to watch:

- **The ~200-link footer browse farm is gone.** That is what makes the footer 1:1 — the
  reference has no footer link farm either, it puts that inventory in page bodies. The
  links still render on the homepage through `home-mega.tsx`, but no longer site-wide. The
  landing and board templates must therefore carry a body-level related-pages band, or the
  internal-link surface that the programmatic-SEO slice depends on shrinks. **Verify in QA.**
- `site-chrome.test.tsx` was walking only `props.children`, so the whole navbar was
  invisible to it and every nav assertion was silently passing against footer links
  instead. Fixed. This is trap 4 in the brief biting a test that looked green.

Open item for the CONTENT agent: `app/web3-non-tech-salaries/[slug]` gates on
`board-chrome`'s narrower `NON_TECH_SALARY_ROLES`, so five taxonomy roles (junior, lead,
project-manager, senior, social-media) 404 there.

Note for whoever owns `home-mega.tsx`: `FOOTER_GROUPS` is now a homepage-only browse
taxonomy; its comment still claims it keeps the mega menu and the footer in sync.

Verified: 722 tests green workspace-wide, typecheck clean, `--accent` unchanged after the
new stylesheet import (trap 2 checked deliberately).

### JOBDETAIL — done

The job page was opening with a 20-row board of *other* jobs above an aside holding the
actual job. It is now a standalone job page in the reference's order: hiring-line `h1`,
compensation/location/posted block, description, inline Apply, sidebar card, tag row,
role-salary panel, "More {Role} jobs" table, "Other roles at {Company}", a hire block, and
the tail link inventory. Link-kind diff on a full page: theirs 109 links, ours 94.

**Two decisions escalated to the user — do not resolve these unilaterally.**

1. **The brief's apply rule contradicts this codebase, and the agent was right to stop.**
   The spec (§5) says the HTML Apply must use `apply_url` unchanged with `rel="follow"` as
   a terms-of-service commitment to the upstream API. But in the real imported data the
   stored `apply_url` is **not the employer's site** — it is a `https://web3.career/r/…`
   redirector. Emitting those dofollow would hand link equity and traffic to the site we
   are mirroring, and the reference itself marks its own equivalent link
   `rel="nofollow noopener"`. Meanwhile the implemented product gates the apply URL behind
   the 5-unlocks-per-week quota (`lib/profile/gate.ts`), which contradicts spec §3's "no
   weekly unlock quota". So the spec disagrees with itself *and* with the code. Nothing was
   changed: the on-site apply flow and the gate stayed, and tests now pin that the upstream
   redirect URL never leaks into our HTML. **The user must choose**: honour the API's ToS
   clause with a dofollow outbound link (which retires the unlock quota, the product's core
   mechanic), or keep the gated on-site flow (which may breach the API terms we import
   under). This is a legal/product call, not an engineering one.
2. **Salary data is empty.** All 1042 imported listings have NULL `salary_min`/`salary_max`;
   only 3 rows have `salary_text`. So every salary panel, every Salary column and the whole
   `/web3-salaries/*` tree render empty against real data, however correct the page code is.
   The reference's salary pages are a large part of its surface, so **there is no salary
   parity until the importer populates those columns.** Owner: `apps/crawler` — unassigned
   in this run.

Also flagged: `app/_components/home/comparison.tsx` says candidates "apply on the studio
site" while `app/hire/[skill]/page.tsx` says "Candidates apply on this site". One is wrong
whichever apply model wins.

Deliberately not mirrored: their "receive similar jobs" email form (we have no alerts
product, a dead form is worse than none), their recommended-candidate cards (we have no
candidate database and the talent pool is opt-in/off), their interstitial ad card.

Verified: 722 tests green, typecheck clean, and `grep -c 'web3\.career'` = 0 on every job
route's emitted HTML.

### HOME, LANDINGS, COMPANIES, CONTENT — done

- **HOME**: remote sections grown to the reference's inventory (19 / 11 links), all remote
  hrefs now emitted through `landingPath` so the homepage stops linking 17 chips at URLs
  that canonicalise elsewhere, the missing reviews carousel added (CSS-only, no client
  bundle; cards openly labelled as illustrative, no invented person's name), FAQ reshaped
  from 18 entries to the reference's 6, and both extra sections removed. Reference links we
  do not link: 87 → 62, the rest out of scope.
- **LANDINGS**: checked the reference first and found our two canonical spellings were
  backwards — they serve `/highest-paid-developer-jobs` and `/most-popular-designers-jobs`
  at 200, we redirected exactly those. Swapped. Both combo orders now resolve with one
  canonical. Added the per-landing stats block and made "related pages" contextual.
- **COMPANIES**: `/web3-companies`, `/web3-companies/top-growing`, `/web3-companies/tag/*`
  and `/web3-companies/{slug}` are the canonical routes; the old paths now redirect to them.
- **CONTENT**: `/post-web3-job/bundle` built as a presentation page with no checkout and a
  test that stops one being added quietly; `/hire` inventory now a superset of theirs; the
  salary index links 166 URLs, all 200.

## Four data bugs in the importer, found and fixed by the orchestrator

The agents kept reporting "the code is right but the data is empty". It was: the importer
was reading field names the API does not send. One probe of the live API settled it.

1. **The API refuses us without a browser User-Agent.** Same URL and token: 403 Cloudflare
   "Error 1010" with no UA, 200 with one. `fetchWeb3CareerJobs` sent none.
2. **Salary was never imported.** The mapper read `raw.salary`, a field the payload does not
   contain. The API sends `salary_min_value` / `salary_max_value` / `salary_currency` /
   `salary_unit`. Result: 0 of 1042 jobs had a salary, so every salary page, every Salary
   column and the whole rollup tree were empty. Now 200 jobs carry bounds. Only yearly USD
   is stored — nothing is currency-converted or annualised, so every stored bound is
   comparable. The payload's `estimated_*` fields are the upstream provider's own guesses
   and are deliberately **not** imported.
3. **Remote was misread.** The mapper read `raw.remote`; the API sends `is_remote`. Remote
   jobs went from 88 to 205.
4. **`posted_at` held two formats.** The API's RFC 1123 `date` was stored verbatim while a
   few rows were ISO, and SQLite compares them as text, so every "Fri, ..." sorted above
   every "2026-...". That silently broke date ordering, the 30-day windows and the company
   growth leaderboard — "posted in the last 30 days" counted 1035 of 1035 jobs; it is now
   278. All 1042 rows are ISO.

Also fixed: `job_locations` held country rows only and skipped remote jobs, so every city
landing showed zero jobs. The API sends `city` and `country` already slugified; both are now
imported. 77 cities, 1606 rows — Berlin went from 0 jobs to 46.

`salary_rollups` was empty because nothing ever built it locally. `apps/crawler/scripts/
rollups-local.mjs` now runs the worker's own `rebuildSalaryRollups` behind a small adapter
that presents node:sqlite as the slice of D1 it uses — the real logic rather than a SQL
reimplementation that would drift. 167 rollups across role, country, city, company,
seniority and region. That pipeline had never been executed end-to-end before.

## A production bug: every UPDATE and DELETE on `jobs` failed

Re-running the local import died on the first row with the bare message "SQL logic error".
Bisecting the statement showed the cause is not the import at all:

`jobs_fts` is a plain FTS5 table that owns its content. The `jobs_fts_au` and `jobs_fts_ad`
triggers removed the stale index row with FTS5's special `'delete'` command, which only
exists for external-content and contentless tables. Against a plain table SQLite raises
SQLITE_ERROR. So **any** UPDATE or DELETE on `jobs` failed: the crawler's re-ingest
`DO UPDATE` path and close-stale's `listed = 0` included. It only bites on the second pass
over a listing, which is why a fresh import always looked healthy.

`0001_init.sql` was corrected in place by commit `bbe3672`, but a migration that has already
run is never re-run, so every database migrated before that commit still carries the broken
pair — both local D1s did, and production may. Added
`packages/db/migrations/0007_fix_jobs_fts_triggers.sql`, which drops and recreates them
idempotently.

`packages/db/src/migrations-apply.test.ts` is new: it applies the whole migration set to an
in-memory database and then actually updates, closes, deletes and re-upserts a job. The
existing suite only asserted on the *text* of the migration files, which could never catch a
statement that is syntactically valid but illegal against the objects it touches. One test
deliberately reinstalls the broken trigger, proves the failure, applies 0007 and proves the
repair — otherwise the suite would pass with or without the migration.

**Operator action required:** apply migration 0007 to the production D1 before the next
crawl, and re-run the importer so salary, remote and posted_at are backfilled there too.

## QA wave

Measured with `parity_check.py` over 45 URL pairs once the data was fixed and the server had
settled. Status-code parity is essentially done: the only true remaining 404 is
`/web3-salaries/solidity` (ours is named `solidity-developer`), and `/jobs` is a route we
have deliberately and the reference does not.

The dominant remaining gap is the document outline, and it is one difference repeated
everywhere: **the reference makes each list row's title a heading and we do not.** On
`/solidity-jobs` they emit 18 `h2` to our 6; on `/web3-cities` 252 to our 4; on
`/web3-companies` 100 to our 3. Link counts are already comparable on those same pages, so
the rows and links exist — they are simply not headings. Three QA agents are closing this
(job-list rows, directory tables, taxonomy + stale internal links).

## A fifth data bug: the importer carried a stale copy of the tag taxonomy

QA-ROWS reported that `/security-jobs`, `/engineer-jobs` and `/dev+entry-level-jobs` render
zero rows — markup was fine, the boards were simply empty. Cause: `bootstrap-local.mjs` had
its own hardcoded `JOB_TAGS` Set of ~41 tags, while `packages/shared` lists 404. Every tag
outside the stale copy was dropped at import, so those landings resolved 200 and listed
nothing. The API sends 211 distinct tags; we were storing 41.

The duplication was the bug, so the copy is gone: the script now imports `JOB_TAGS` from
`@gaming/shared` (run it with `node --experimental-strip-types`).

That exposed a second, quieter defect. Tags were capped at 8 per job, and with a larger
allowed set the cap started truncating: `/solidity-jobs` briefly *fell* from 126 jobs to 71.
Jobs carry a median of 6 taxonomy tags and 15 at the 99th percentile, so a cap of 8 was
truncating 218 of 1035 rows all along. Raised to 20, which touches 3 rows.

Result: 41 → 205 distinct tags, 1.6k → 6.6k job/tag links, `engineer` 0 → 384 jobs,
`security` 0 → 26, `solidity` 126 → 130. Rollups 167 → 179.

**Run order for a local rebuild** (both scripts need `--experimental-strip-types`):

```
node --experimental-strip-types apps/crawler/scripts/bootstrap-local.mjs
node --experimental-strip-types apps/crawler/scripts/rollups-local.mjs
```

### QA-ROWS and QA-TABLES — done

The outline gap is closed. Job listing titles are headings again (`h2` title / `h3` company
per row, with a `rowTitleAs` prop for boards that sit under their own section heading), and
directory rows carry headings on cities, companies, salaries and learn.

Measured across the 45 URL pairs: **THIN went from 26 pages to zero.** Examples, reference
vs ours: `/solidity-jobs` 18 vs 6 → 26; `/web3-cities` 252 vs 4 → 207; `/web3-companies` 100
vs 3 → 103; `/web3-salaries` 106 vs 22 → 179. Exactly one `h1` per page, no skipped levels,
and screenshots confirm the visual design is unchanged — this was markup only.

Worth knowing what the reference actually does, since QA checked rather than assumed: it
wraps *most* table cells in a heading, `h2` or `h3` more or less arbitrarily — on
`/web3-companies` the rank *number* is the `h2` and the company name the `h3`. QA mirrored
the flat outline but not the noise: numeric cells stay plain text and a bare rank number is
never a heading.

`site-chrome.test.tsx` and `job-board.test.tsx` both had assertions that were silently
passing against the wrong elements before this (trap 4). Fixed.

### Orchestrator follow-ups from the QA reports

- **Salary bands that looked broken are correct.** Only 4 of 1035 rows exceed $900k: a
  Portfolio Manager at $250k–$1M, a Chief Legal Officer whose own title states $1M–$5M, one
  $50k–$999k listing, and a JPY row that the currency filter had already rejected. The defect
  was presentation: `formatSalaryRange` rendered $5,000,000 as "$5000k", which reads like a
  units bug and invites someone to "fix" correct data. It now renders millions as `$5M` /
  `$1.5M`. That function had ~48 call sites and **no test at all**; it has one now.
- `sitemap.ts` needed no change — an earlier agent had already moved it to the canonical
  ranking spellings, and its test asserts that no redirect source is ever listed.

### QA-LINKS — done

Corrected the premise it was given: `web3.career/web3-salaries/solidity` is a **301** to
`/solidity-developer`, not a 200, and their `/quantitative-developer` then 302s to their own
404. So it added `SALARY_ROLE_ALIASES` + `canonicalSalaryRole` rather than a second role —
adding the short slug to `SALARY_ROLES` would have created a second 200 URL and a second
internal link for the same page across the sitemap, footer and comparison tables. The short
URL now serves 200 with `rel=canonical` at the long one, with no page-file change.

Redirect sweep over **799 unique internal links**: 797 × 200, one 308 (since fixed) and one
307 (`/onboarding`, an auth gate for an anonymous crawler). An internal link to a redirect is
a real defect for a programmatic-SEO surface, and there are none left.

Honest caveat it flagged rather than glossed: `isPublicRevalidatedPath` is covered by unit
test only, because `next dev` overrides Cache-Control to `no-store` on every route — it
confirmed the override rather than assuming the header was right.

### Orchestrator, closing the last gaps

- `/web3-non-tech-salaries/{country|region|city}` — 38 URLs the reference links, all 404 on
  ours. The hub carries two dimensions and the guard allowed only roles; `SalaryRolePage`
  already rendered every geo kind. Guard widened, tech roles still excluded deliberately.
  The route had no test at all; it has 6 now.
- Last `/companies` link (`board-chrome.tsx`) pointed at the canonical route.
- `/web3-companies/tag/{executive,front-end,javascript,solidity}` 404: **not a defect.** Those
  four are linked from nowhere. The directory links 34 chips, all 200, and a category exists
  only where some company leads with that tag — the intended quality gate.

## Final state

```
pnpm -r test        776 tests passed, 0 failed   (baseline 632)
pnpm -r typecheck   clean
parity_check.py     45 paths, 44 clean
```

The one remaining flag is `/jobs`: the **reference** 404s it and we serve 200. That is our
catalog route from spec §7, a deliberate addition, not a parity gap.

Everything is still uncommitted. Committing has not been authorised — ask first.

### Open decisions for the user

1. **The apply model** (see the JOBDETAIL section): spec §5's dofollow `apply_url` versus the
   implemented unlock gate. The spec contradicts itself and the stored `apply_url` is an
   upstream redirector, not the employer. Legal/product call.
2. **Production data**: apply migration 0007 and re-run the importer, or production keeps
   broken FTS triggers, no salaries, wrong remote flags and mixed-format dates.
3. Residual content-volume gaps that are not structural: `/learn-web3` (their hub inlines a
   resource list, ours links out to `/learn-web3/all`) and country coverage on salary detail
   pages, which is bounded by how many countries we have rollups for.

## Device QA round — 24 pages x 3 devices

Ran with `device_qa.py` (scratchpad): Chrome over the DevTools Protocol with real device
emulation — mobile 390x844 with touch, tablet 768x1024, desktop 1440x900 — measuring rather
than eyeballing. Six cheap agents covered home/catalog, job detail, companies, salaries,
geo/rankings and content/auth, each comparing against the web3.career equivalent.

### Verified healthy

- **No page-level horizontal overflow on any page, on any device.** Wide tables scroll
  inside their own container instead of dragging the page sideways.
- **Tap targets under 24px: 8 on ours, 8 on the reference.** Parity, not our defect.
- No upstream `web3.career` URL leaks into job-page HTML.
- Accordions, the CSS carousel, search forms, pagination and the mobile menu all work.

### One real defect, fixed here

**HTML double-escaping.** The API returns plain-text fields already escaped
("Digital Assets &amp; Tokenization"); stored raw, React escaped them a second time and the
reader saw a literal `&amp;`. 44 job titles and 4 company names; the reference shows none.
Fixed with `decodeHtmlText` in `packages/shared/src/web3-api.ts`, mirrored in
`bootstrap-local.mjs`, applied to title/company/location only — `description` is real HTML
and must not be decoded. Verified after re-import: `/` 5 → 0, `/hire` 15 → 0,
`/top-web3-jobs` 5 → 0.

### Four "critical" findings that were not real

Every one was a measurement or environment artifact, and three came from tooling or
instructions written by the orchestrator. They are recorded because the failure mode will
recur, not to pad the list.

1. **"The mobile menu is dead."** Reported by every agent, and confirmed five independent
   ways (real click, delayed read, calling the React handler directly, MutationObserver,
   the `hidden` attribute). All five ran against a `next dev` process that had been live for
   hours while six agents edited the app. After a clean restart the menu works perfectly —
   `aria-expanded` flips, the panel opens to 2955px with 49 links, a second click closes it.
   No code change. **A stale HMR state can make a healthy control look dead, and repeating
   the measurement on the same bad process cannot detect it.**
2. **"The mobile layout is broken."** Came from a `--window-size=390` screenshot, which
   crops rather than reflows. Real emulation shows overflow 0.
3. **"Berlin regressed to 2 job rows."** From a `grep -c` in the agent's own instructions —
   it counts matching lines, and Next.js HTML is one long line. The page renders 20 rows and
   its meta description says 46, matching the database.
4. **"3 dead links on /post-web3-job/bundle"** and **"screenshot 0-width = responsive
   failure"**: both gone on a clean server; the second is a capture artifact seen across
   different devices and pages.

Also disproved: the `$1M-$5M` salary band is real data (one listing states it in its title).

### Tooling fixes made as a result

- The overflow probe only attributes per-element overflow when the page itself overflows,
  and skips elements clipped or transformed by an ancestor.
- The interaction probe is async and waits ~350ms after a click before reading state,
  because React updates the DOM asynchronously.

**Final state: 777 tests green, typecheck clean, and a clean sweep across eight page types —
overflow 0, escaped 0, menu working, no dead links.**
