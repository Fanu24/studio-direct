# Studio Direct (placeholder) — v1 design spec

Date: 2026-09-02
Status: draft for user review
Product code: `gaming` (first tenant of a multi-brand job-board network)

This spec is the source of truth for v1. It replaces informal plan notes where they conflict.

## 1. Goal

Ship one English-language gaming job site, remote-worldwide, in 8–10 weeks, solo, on Cloudflare.

Candidates can read every listing for free (SEO). Applying costs an unlock. Career-page roles that are not found on LinkedIn show a **Not on LinkedIn** badge. That badge is the product claim.

Later tenants (crypto, iGaming, Dubai, Malta) reuse this engine. They are not in v1.

## 2. Non-goals (v1)

- Employer or recruiter portal, paid CV search, InMail
- AI resume/cover letter, auto-apply, LinkedIn profile import
- Second live domain / multi-brand UI
- iGaming, Telegram, talent profiles indexed by Google
- Playbook for bypassing LinkedIn/Indeed bot defenses, logins, or account farms
- Parsing CVs with AI

## 3. Users and money

### 3.1 Candidate

- Browses jobs without an account
- Signs up with Google or email to apply
- Soft gate: display name, target role, remote/hybrid preference — then first unlock
- Free: **5 unlocks per UTC week** (Monday 00:00 UTC → next Monday)
- Paid: **€9 / month** or **€59 / year**, Stripe EUR, unlimited unlocks + daily “hidden today” email
- Unlock = reveal preferred apply URL for that job and record a click-out. Revisiting the same job in the same UTC ISO week does not consume another unlock
- Apply never happens on our domain: redirect to studio career page if we have it, else LinkedIn or Indeed listing

### 3.2 Talent pool (data only)

- Separate checkbox, default **off**: “Show my profile to verified studios and recruiters”
- Apply does not require opt-in
- Recruiter product is v2 and may only query `talent_pool_opt_in = 1` plus a completeness threshold
- Settings: export JSON, delete account (D1 rows + R2 CV)

### 3.3 Operator (you)

- Seed companies, crawl health, exclusivity precision
- No sales portal in v1; featured listings can be a Stripe Payment Link later without building a dashboard

## 4. Architecture

Two Workers, one D1, one account.

| Piece | Role |
| --- | --- |
| `web` | OpenNext (Next.js) on Workers. SSR job + hub pages. Auth, billing, profile |
| `crawler` | Queue consumers + Cron. JobSource adapters. Writes D1 |
| D1 | SQLite, created with `--jurisdiction eu` |
| R2 | CV PDFs, optional HTML snapshots, seed files |
| KV | Sessions if not in D1, per-host crawl lock, rate limits |
| Queues | `crawl-career`, `crawl-linkedin`, `crawl-indeed` (three queues so one source dying does not stall others) |
| Email Service | Magic links, quota emails, hidden digest. Workers Paid + domain onboarded |
| Turnstile | Email signup/login |
| Stripe | Checkout + webhook on `web` |
| Browser Rendering | Only when ATS JSON and JSON-LD both fail for that company |

Workers Paid from day one.

### 4.1 Crawl unit of work

Cron every 6 hours:

1. Enqueue one message per company with a known career URL (`crawl-career`)
2. Enqueue one message per LinkedIn search query in the gaming remote dictionary (`crawl-linkedin`)
3. Same for Indeed (`crawl-indeed`)

A consumer handles **one message**: fetch, normalize, upsert, exit. No “scan 3,000 studios in one invocation.”

Per-host lock in KV (e.g. 2s min interval). On HTTP 429/403: backoff, don’t mark exclusivity from a failed LinkedIn run.

User-Agent: identifiable product name + contact email. Public pages only. No stored third-party credentials.

### 4.2 JobSource contract

```
type Source = "career_page" | "linkedin" | "indeed"

type JobDraft = {
  source: Source
  sourceUrl: string
  companyName: string
  title: string
  location: string | null
  remote: "remote" | "hybrid" | "onsite" | "unknown"
  descriptionHtml: string
  applyUrl: string
  postedAt: string | null  // ISO
  rawJson: string
}

interface JobSource {
  fetch(message: QueueMessage): Promise<JobDraft[]>
}

type QueueMessage =
  | { kind: "career"; companyId: string }
  | { kind: "linkedin"; query: string }
  | { kind: "indeed"; query: string }
```

Career consumer loads the company from D1. Do not put URLs on the queue. Wrangler: `wrangler.jsonc` only. Web routes: `apps/web/app/`.

After fetch: normalize company, remote heuristic, staffing reject, upsert job, insert sighting, recompute exclusivity.

### 4.3 Dedup

Canonical key, in order:

1. Normalized apply URL (strip tracking query params)
2. Else `normalize(companyName) + slug(title)` if posted within 45 days

Same role from three sources = **one** `jobs` row, many `job_sightings`.

Preferred apply URL: career_page sighting if present, else the most recently seen board URL.

### 4.4 Remote heuristic (keep)

Classify `remote` if any of:

- Title or location contains remote / work from home / anywhere / distributed
- ATS location metadata is remote
- JD matches remote-first phrases and does not require a named office 5 days/week

`hybrid` if hybrid / X days in office.

`onsite` jobs are stored with `listed = 0` (not shown). We still keep the row for matching “seen on LinkedIn.”

### 4.5 Staffing reject (keep)

Drop drafts if company name or description matches staffing/agency patterns (recruitment, staffing, “contract roles available,” known RPO domains). Career-page companies in the seed are allowlisted and skip this unless the listing itself is clearly an agency posting on a studio board.

### 4.6 Exclusivity (the badge)

Recompute when sightings change.

- `hidden_from_linkedin` only if:
  1. There is a `career_page` sighting, and
  2. There is **no** LinkedIn sighting matching this canonical job, and
  3. The last successful `crawl-linkedin` run finished within 24 hours (`linkedin_index_fresh = 1`)
- Else if LinkedIn sighting exists: `on_boards`
- Else: `unknown` — **do not show the badge** (lying is worse than silence)

LinkedIn match: `normalize(company)` equal **and** title token Jaccard ≥ 0.55 **and** `posted_at` within 45 days. Indeed match is stored as `seen_on_indeed` for a secondary chip, not required for the main badge.

If LinkedIn crawl is down, all badges hide until it recovers.

## 5. Career pages (RareRoles path)

Target v1: **1,500–3,000** gaming publishers and studios with a career URL. First milestone: **500** seed + **300+** live remote/hybrid jobs from career pages before turning on Stripe.

Resolution order per company:

1. Known ATS slug (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Teamtailor, Recruitee)
2. Public ATS board JSON/API
3. JSON-LD `JobPosting` on the career URL
4. Generic HTML job list → detail URLs (shared templates, not 3,000 parsers)
5. Browser Rendering only after 1–4 fail twice

Do not scrape Hitmarker to build the seed.

Close a job when: ATS says closed, career URL 404, or no source has seen it for 3 consecutive successful crawls of that source.

## 6. LinkedIn and Indeed

Purpose: coverage of board-only roles **and** the comparison set for the badge.

Query set: gaming role dictionary × remote/hybrid modifiers. Not a full-site dump.

Implementation constraint: public listing HTTP only, rate-limited Queue consumers. If a source becomes unreachable, degrade to `unknown` exclusivity. Career crawl continues.

Legal: scraping LinkedIn and Indeed violates their ToS. Terms of Service on our site must say listings come from third parties and may be incomplete. Get legal review before public launch. This spec does not document evasion of their protections.

## 7. Data model (D1)

SQLite. JSON stored as TEXT. Every list filter has an index.

```
tenants(id, slug, name, domain)
companies(id, tenant_id, name, name_norm, domain, career_url, ats_type, ats_slug, listed, created_at)
jobs(
  id, tenant_id, company_id, canonical_key,
  title, title_norm, slug, location, remote,
  description_html, apply_url, salary_text,
  exclusivity, seen_on_indeed,
  posted_at, listed, created_at, updated_at
)
job_sightings(id, job_id, source, source_url, seen_at)
jobs_fts(title, description, company_name)  -- FTS5
users(id, tenant_id, email, created_at)  -- Better Auth tables as required
profiles(
  user_id, display_name, headline, location, timezone,
  target_role, seniority, remote_pref, salary_min, salary_max,
  work_auth_text, completeness, talent_pool_opt_in,
  talent_pool_opt_in_at, talent_pool_opt_out_at, cv_r2_key
)
experience_entries(id, user_id, company, title, start_date, end_date, description)
profile_skills(user_id, skill)
unlocks(id, user_id, job_id, week_id, created_at)
subscriptions(user_id, stripe_customer_id, stripe_status, period_end)
consent_events(id, user_id, kind, value, created_at)
crawl_runs(id, source, started_at, finished_at, ok, stats_json)
```

`week_id` = `YYYY-Www` in UTC (ISO week).

Completeness (0–100): 20 name+role, 20 location/remote pref, 20 ≥1 experience, 20 ≥3 skills, 20 CV uploaded.

Profiles are **not** public URLs in v1.

## 8. Auth and profile

- Better Auth on D1: Google OAuth + email magic link (Email Service) + optional password
- Turnstile on email forms
- Onboarding before first unlock: `display_name`, `target_role`, `remote_pref`
- `/profile`: experience rows, skills (same dictionary as SEO tags), PDF CV → R2 (`cv/{user_id}/{uuid}.pdf`), max 5 MB, `application/pdf` only
- Nudge after unlock if completeness < 80
- Delete: wipe profile, experience, skills, unlocks, consent, R2 object, auth user

## 9. Web surface and SEO

UI language: **English**. Remote filter default: remote + hybrid (worldwide). Timezone is not a v1 filter.

Routes:

- `/` — claim + latest hidden + search
- `/jobs` — filters: remote, hidden, source, role, company, seniority, q (FTS5)
- `/jobs/[slug]` — full JD, JSON-LD `JobPosting`, badge if `hidden_from_linkedin`
- `/hidden-jobs` — exclusivity landing
- `/remote-[role]-jobs` — programmatic hubs from a fixed role dictionary
- `/companies/[slug]`
- `/skills/[slug]`
- `/login` `/onboarding` `/profile` `/settings` `/pricing`
- `/terms` `/privacy`
- `/sitemap.xml`

Role dictionary (hubs): gameplay-programmer, engine-programmer, graphics-programmer, tools-programmer, technical-artist, technical-designer, game-designer, narrative-designer, producer, qa, live-ops, community, audio, ui-ux, unity, unreal, godot, multiplayer.

Internal links: hub ↔ job ↔ company.

Cache: CDN cache public job/hub HTML; never cache personalized apply state.

Google for Jobs: `JobPosting` with `url` = our job page, application URL = preferred apply (studio). Do not put unlock walls in the HTML of the description.

## 10. Error handling

| Event | Behavior |
| --- | --- |
| ATS 404 / empty board | Company `listed` stays; jobs from that source close after 3 misses |
| LinkedIn/Indeed 403/429 | Consumer retries with Queue delay; `crawl_runs.ok = 0`; hide Not on LinkedIn badges |
| D1 write conflict | Idempotent upsert on `canonical_key` |
| Stripe webhook fail | Stripe retries; unlocks stay free-tier until `subscriptions.stripe_status` is active |
| Email send fail | Log; magic link can be resent from `/login` |
| CV upload non-PDF / >5MB | 400, no write to R2 |
| Quota exceeded | Pricing modal; no redirect |

## 11. Testing

- Matcher: fixture pairs (same job different titles, different companies, stale 46-day job) — no badge / badge / unknown
- Remote heuristic: labeled titles/JDs
- Dedup: three drafts → one job, three sightings
- Quota: 5th unlock ok, 6th blocked, next UTC week resets; repeat same job free
- Staffing filter: agency names dropped; seed studio kept
- Consent: opt-in default 0; delete removes R2
- Crawler: recorded JSON fixtures for Greenhouse/Lever boards, no live LinkedIn in CI

## 12. Wrangler bindings (names)

```
D1: DB
R2: FILES
KV: LOCKS
Queue producers/consumers: CRAWL_CAREER, CRAWL_LINKEDIN, CRAWL_INDEED
EMAIL: EMAIL
Browser: BROWSER (optional)
```

Secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET`.

`compatibility_date` = ship date. `nodejs_compat` on. `wrangler types` generates `Env`. No handmade binding interfaces.

## 13. Copy constraints

- Homepage: jobs from studio career pages, including roles not posted on LinkedIn
- Never claim 100% coverage or real-time LinkedIn
- Badge tooltip: “We did not find this role on LinkedIn in our last successful index.”
- Privacy: two purposes — providing the job product vs sharing profile with recruiters (opt-in)

## 14. Launch bar (week 8–10)

Must be true:

- ≥300 listed remote/hybrid jobs with career_page sighting
- Hidden badge only when LinkedIn index is fresh
- SEO hubs live + sitemap
- Auth + 5 unlocks + Stripe EUR
- Profile + CV + talent-pool checkbox + delete
- Crawl career still works if LinkedIn queue is failing

Site #2 starts only after that bar.

## 15. Open placeholders (do not block implementation)

- Public brand and domain (internal name: Studio Direct / tenant `gaming`)
- Legal entity name on Privacy/Terms
- Exact Google OAuth callback once domain exists
