# Nodework — job catalog + programmatic SEO

Date: 2026-09-08
Status: approved for implementation (plan B)
Product: **Nodework** (replaces Studio Direct on the same Cloudflare/D1 stack)
Tenant slug: `nodework` (existing `tenants.id` may remain `tenant:gaming`)

This spec is the source of truth for the first slice. It replaces Studio Direct public product claims where they conflict.

## 1. Goal

Ship a web3 job board whose public surface is a **catalog of jobs** plus a **programmatic SEO factory** (tag, geo, remote×tag, salary×role, salary×country, companies, sitemap). Inventory bootstraps from the web3.career API, then a first-party ATS crawler can replace it without rewriting pages.

Visual system: Nodework prototype (`nodework/sito/index.html`) — Bricolage Grotesque / Figtree / JetBrains Mono, green ledger tokens, light default with dark `prefers-color-scheme`.

## 2. Non-goals (this slice)

- Employer post-a-job checkout, bundles, Stripe charges
- Public talent directory, Learn, laser-eyes, AI cover letter, job alerts
- Nodework public jobs API
- Candidate unlock quota, “Not on LinkedIn” as a product claim
- Publishing 500+ thin location pages without a quality gate

Auth, profile, CV, and Stripe tables may remain in D1. They are not on the public conversion path.

## 3. Users and money

### Candidate (this slice)

- Browse and read every listed job without an account
- Apply via a visible `apply_url` (`rel="follow"`, URL not rewritten)
- No weekly unlock quota

### Operator

- Store `WEB3_CAREER_API_TOKEN` as a Worker secret
- Cron every 6 hours imports listings and rebuilds salary rollups

### Later slices

- Employers pay to post (sticky/highlight columns exist now, unused)

## 4. Architecture

Two Workers, one D1.

| Piece | Role |
| --- | --- |
| `apps/web` | Next.js / OpenNext. SSR home, job, landings, salaries, companies, sitemap index |
| `apps/crawler` | Cron enqueues `web3_api` sweep messages; consumer fetches API, upserts, rollups |
| D1 | Jobs, tags, geo, benefits, salary_rollups |
| Secret | `WEB3_CAREER_API_TOKEN` |

```
Web3Career API → crawler consumer → normalize/upsert → D1
D1 → Next.js pages + sitemap index
```

`JobSource` contract: `Web3CareerApiSource` now; `AtsCareerSource` later. Pages never call the third-party API.

## 5. API bootstrap rules

- `GET https://web3.career/api/v1?token=&tag=&remote=&country=&limit=100`
- Max 100 rows, no cursor: sweep dictionary tags, `remote=true`, and top countries
- On 401/403: do not unlist jobs; record `crawl_runs.ok = 0`
- On 429: retry with delay; stop the rest of that message’s work
- **ToS:** HTML Apply uses `apply_url` unchanged with `rel="follow"` (never `nofollow`, never extra query params)
- Token never in client bundles or git
- Canonical key for API jobs: `web3_career:{external_id}`
- Jobs not seen for 21 days: `listed = 0` (row kept for salary history)

## 6. Data model

Keep `tenants`, auth, profiles. Extend `jobs`. Add junction + rollup tables.

**jobs (added):** `salary_min`, `salary_max` (integer USD), `source` (`web3_career_api` \| `career_page` \| `ats` \| `manual`), `external_id`, `featured_until`, `highlight`.

**jobs (kept, unused on public UI):** `exclusivity`, `seen_on_indeed`.

**jobs (behavior change):** public catalog is all `listed = 1` (onsite included). Remote is a filter, not a hard catalog rule.

**tags / job_tags, locations / job_locations, benefits / job_benefits**

**salary_rollups:** `dimension` (`role` \| `country` \| `seniority` \| `region`), `slug`, `avg`, `min`, `max`, `job_count_30d`, `computed_at`. Jobs without both salary bounds are excluded from rollups.

**Quality gate:** a programmatic landing is indexable only if it has **≥ 5** listed jobs. Paginated `?page=` is `noindex`, canonical page 1.

**Dedup (API):** external id. **Dedup (ATS later):** apply URL, else company+title within 45 days.

## 7. URL taxonomy

| Pattern | Example |
| --- | --- |
| Job | `/{title-slug}-{company-slug}/{externalId}` |
| Job alias | `/jobs/{slug}` (redirect or render same record) |
| Tag | `/{tag}-jobs` |
| Remote | `/remote-jobs`, `/remote-{tag}-jobs` |
| Geo | `/web3-jobs-{city\|country\|region}` |
| Benefit | `/{benefit}-jobs` |
| Intern / entry | `/intern-jobs`, `/entry-level-jobs` |
| Companies | `/companies`, `/companies/{slug}` |
| Salaries | `/web3-salaries`, `/web3-salaries/{role\|country}` |
| Catalog | `/jobs` (filters as query; facet combos not in sitemap) |

Sitemap index: `/sitemap.xml` → `sitemap-jobs.xml`, `sitemap-tags.xml`, `sitemap-geo.xml`, `sitemap-salaries.xml`, `sitemap-companies.xml`. Only quality-gated URLs. Static: `/`, `/jobs`, `/companies`, `/web3-salaries`.

## 8. Public pages

Each landing: H1 with current month where useful, job count, filtered list, unique stats (count, salary range from rollups), 5–10 related internal links, FAQ templated with those stats.

Job detail: full description, tags, location, salary, **Apply** (`apply_url`, follow). JSON-LD `JobPosting.url` = Nodework page.

Home: Nodework-style search, tag chips, job rows (sticky/highlight classes when fields are set).

## 9. Error handling

- Missing tenant slug `nodework`: fail closed (500 for operator, empty public lists only if tenant missing after lookup)
- Job without salary: list it; skip rollup
- Job without tags: infer from title against the tag dictionary; else skip tag junctions
- Thin landing: render with `robots: noindex` and omit from sitemap

## 10. Testing

- Parse API fixture → canonical key, immutable apply URL, tags, salary bounds
- Landing segment parser (tag / remote-tag / geo / benefit / intern)
- Quality gate excludes count 1, includes count 5
- Rollup average ignores null salaries
- Sitemap origin helper still rejects placeholder origins
- JSON-LD job URL uses the public Nodework path; HTML apply is the raw `apply_url`

## 11. Out of scope follow-ups

Post a job + Stripe, talent, Learn, first-party ATS crawl as primary inventory, public Nodework API.
