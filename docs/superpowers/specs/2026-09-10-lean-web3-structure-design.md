# Lean Web3 structure and readable typography

10 September 2026. Follows the aurora redesign
(`2026-09-09-aurora-redesign-design.md`) and its QA
(`docs/qa/2026-09-10-aurora-qa-report.md`).

## Why

The site is live and the user's verdict is "più o meno ci siamo" with three
faults:

1. It still talks about games. 77 occurrences of gaming/studio language remain
   in user-facing code.
2. The structure is too discursive. web3.career is the reference: jobs first,
   few frills, not a long page.
3. Pages are hard to read - headings sit against the text above them, worst on
   the salary pages.

A fourth item was asked as a check: does the database hold what account
creation and descriptions need.

**This reverses a decision.** On 2026-09-09 the user was asked directly whether
a full redesign should preserve structural parity with web3.career and chose
"redesign libero ovunque"; parity stopped being the acceptance bar. It is now
partly back - as a *reference for density and length*, not as a page-by-page
parity target. The Playwright acceptance bar from the aurora spec still stands.

Scope chosen by the user: **homepage plus navigation hierarchy**. The interior
pages keep the `.surface--data` register they already have - that register is
already dense and tabular, and it is not the problem.

## 1. Typography: the readability defect

### What was measured

`qa/verify-heading-rhythm.mjs`, added for this work, reports for every heading
on all 21 templates the real rendered gap above and below - the collapsed
margin between adjacent boxes, not the declared CSS - and flags any heading
whose gap above is under 1.5x the gap below. Against the current production
build, Chromium, 1280x900:

**36 of 59 judged headings sit closer to the text above than below.** The worst
are exactly the pages the user named:

| Gap above | Gap below | Where |
|---|---|---|
| 0px | 16px | `salaries-index` - "Salary by seniority", "Salary by region", "Salary by country", "By non-tech" |
| 0px | 16px | `salary-detail` - "Backend Developer salary by seniority" |
| 0px | 16px | `salary-comparison` - "Salary by location", "Conclusion" |
| 4px | 6px | `board-apply__meta` job titles, on seven templates |

Only 59 headings are judged because the instrument deliberately skips any
heading that opens its container - a card or panel title legitimately has no
space above it.

### Root cause

```css
h1, h2, h3, h4 { margin: 0 0 0.5em; }   /* margin-top: 0 */
p              { margin: 0 0 1em; }
```

Headings carry no top margin at all, so the space above a heading is whatever
the preceding element happens to leave behind. After a paragraph that is 1em -
already less than the 0.5em below it once the heading's own line-height is
counted. After a chart, a table or a plain `<div>`, which carry no bottom
margin, it is **zero**. The salary pages alternate charts and headings, which is
why they are the worst.

`h2 { line-height: 1.05 }` compounds it: that is a display measure applied to
section headings in running prose.

### The change

- Give headings an asymmetric block margin - roughly `1.4em` above against
  `0.5em` below - so a heading is visibly bound to the section it opens.
- Reset `margin-top` to zero for a heading that is the first child of its
  container, so cards, panels and table cells are unaffected. This is the part
  that makes the change safe to apply at the base rule.
- Relax `h2` line-height from 1.05 toward ~1.15 for the non-display case, while
  page-header display headings keep their tight measure.

Rejected alternative: introduce a `.prose` container with its own vertical
rhythm. Cleaner in the abstract, but it has to be applied page by page, while
the base rule fixes all 122 pages at one point.

### Acceptance

`verify-heading-rhythm.mjs` reports **zero** headings whose gap above is under
1.5x the gap below, on all three engines. The instrument is committed, so the
claim is re-checkable rather than a matter of opinion.

## 2. Structure: lean, jobs-first

The homepage is 13 sections in 315 lines. web3.career is in essence three:
header, the job table with its filters and pagination, and a compact SEO block.

### The change

Homepage reduced to four blocks:

1. Search and filter bar
2. The job table
3. Pagination
4. A compact links/SEO block

Removed: the three animated theaters, `comparison.tsx`, the reviews carousel,
and the narrative career FAQ.

**Header and footer are left alone**, which corrects this spec's first draft.
"Trim them to what serves finding a job" was an assumption, and checking it
against the reference showed the opposite. The nav carries five mega-menus -
Jobs, Salaries, Internships, Learn Web3, TOP Web3 Jobs - which is web3.career's
own nav, built during the parity work. The footer is 13 columns and 52 links,
which is the same wall of SEO links web3.career runs. Trimming either would
move *away* from the reference the user asked for. The divergence was the
homepage body alone.

This also removes most of the gaming language on its own - 20 of the 77
occurrences are inside the theaters and 12 in `comparison.tsx`. The rest, in job
detail, company pages, settings, login, onboarding and the 404, are rewritten
individually.

Interior pages are **not** restructured. They keep `.surface--data`.

### Acceptance

- No occurrence of gaming/studio/games language in user-facing code, excluding
  the `gaming-jobs` / `gaming-web` / `@gaming/*` infrastructure identifiers,
  which are names of real deployed resources and are not user-visible.
- The existing suite stays green; templates whose components are deleted have
  their tests removed with them, not weakened.
- The aurora bar holds: zero page-level horizontal overflow and no sub-24px
  tap targets beyond the two documented exemptions, on three engines.

## 3. Database

Checked, as asked.

**Accounts are complete.** `users`, `session`, `account`, `verification` for
better-auth; `profiles` carries display name, headline, location, timezone,
target role, seniority, remote preference, salary range, work authorisation and
a completeness score; plus `profile_skills`, `experience_entries`,
`subscriptions`, `unlocks`, `job_applications` and `consent_events`. Nothing is
missing for creating and filling an account.

**Company descriptions are missing.** `companies` holds only `name`,
`name_norm`, `domain`, `career_url`, `ats_type`, `ats_slug`, `logo_url`,
`listed`. There is no text column, so a company page has no body to render.
Jobs are fine - they carry `description_html`.

The column is added, and the company page renders it **only when it is
populated**. Nothing generates it. The web3.career API does not supply company
descriptions, and inventing them would be the same class of fabricated content
the project has refused throughout - see the honesty rules in the frontend
design decisions. An empty description means the page shows the company's name,
logo, domain and its live jobs, which is the useful content anyway.

## Out of scope

- Restructuring interior pages beyond the typography fix.
- Populating company descriptions.
- Re-running structural parity checks against web3.career. The reference is
  density and length, not page-by-page equivalence; the parity checker stays
  history.
- The D1 index work and the deploy pipeline, both already done.

## Testing

- `qa/verify-heading-rhythm.mjs` for the typography claim, before and after.
- The existing Playwright checks - overflow sweep, tap-target tracer, reduced
  motion, reveal - re-run after the homepage is rebuilt, because deleting
  sections changes layout.
- The tree-walk page tests: components deleted, tests deleted with them.
- `pnpm typecheck` and `pnpm test` green; production build completes.
