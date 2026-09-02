# Studio Direct Web Implementation Plan

> **Squad:** Product. **Coordinatore:** non implementa. **Release:** blocca Stripe prod (task 34) prima di 300 job. **Legal:** task 37–39. Digest (40) consult Squad Data. Playbook: [org](./2026-09-02-studio-direct-org.md).

> **For agentic workers:** Execute **after** Data sprint exit (jobs in D1). Named-role implementer per task, then QA Product.

**Goal:** Public English SEO job board, honest badges, Better Auth, 5 UTC ISO-week unlocks, Stripe €9/€59, private profiles, talent-pool default off, emails from Email Service. Digest Cron stays on the crawler worker.

**Architecture:** OpenNext `apps/web/app`. Reads D1. No queue consumers. Personalized apply state is `force-dynamic` / `Cache-Control: private`.

**Tech Stack:** Next.js OpenNext, Better Auth + D1, Stripe, Turnstile, R2, Vitest.

## Global Constraints

- Routes under `apps/web/app/`
- `HOMEPAGE_CLAIM` exact; badge tooltip: `We did not find this role on LinkedIn in our last successful index.`
- Never cache unlock/session HTML on CDN
- JSON-LD `JobPosting.url` = our job page; application URL = preferred apply; **description HTML is the full JD with no unlock wall**
- Profiles have no public `/talent` URLs
- Better Auth + D1; no Clerk; no Resend
- Unlock: 5 distinct jobs per UTC ISO week; same job same week free; `week_id` = `YYYY-Www`
- Paid digest only for `subscriptions.stripe_status = active` and `period_end > now`
- Crawler Cron triggers digest (Task 40), not OpenNext `scheduled`

## Team (questa squadra)

| Task | Implementer | QA | Extra |
| --- | --- | --- | --- |
| 26–30 | SEO / frontend | QA Product | |
| 31–33 | Auth / identity | QA Product | |
| 34 | Billing | QA Product | **Release gate** |
| 35–38 | Profile / privacy | QA Product | 37–38 **Legal** |
| 39 | SEO + Legal copy | QA Product | **Legal** |
| 40 | Billing + crawler Cron | QA Product | consult Data |

---

### Task 26: Job queries + `/jobs` list

**Files:**
- Create: `apps/web/lib/jobs/queries.ts`
- Create: `apps/web/lib/jobs/queries.test.ts`
- Create: `apps/web/app/jobs/page.tsx`

**Interfaces:**
- Produces: `listJobs(db, tenantId, filters)` — default remote in `["remote","hybrid"]`, `listed=1`
- Filters: `hidden` (exclusivity=`hidden_from_linkedin` only), `q` FTS5, company, seniority (title contains), source (join sightings)
- Pagination `page`, `pageSize`

- [ ] **Step 1: Memory/sqlite tests for default remote filter and hidden omitting `unknown`**

- [ ] **Step 2–4:** Implement with Drizzle/SQL indexes

- [ ] **Step 5: Commit** `feat(web): jobs list query and /jobs page`

---

### Task 27: `/jobs/[slug]` + JSON-LD + badge

**Files:**
- Create: `apps/web/lib/jobs/jsonld.ts`
- Create: `apps/web/lib/jobs/jsonld.test.ts`
- Create: `apps/web/lib/jobs/exclusivity.ts` — `showBadge(exclusivity)` true only for `hidden_from_linkedin`
- Create: `apps/web/app/jobs/[slug]/page.tsx`

**Interfaces:**
- JSON-LD includes `title`, `description` (full JD), `url` our origin + `/jobs/slug`, `directApply` target = `apply_url`
- Badge + tooltip only if `showBadge`
- Apply button is a server component that does **not** put apply_url in HTML for anonymous users: use a form POST to `/api/unlock` (URL revealed after unlock). JD body still public.

- [ ] **Step 1–5:** jsonld test; commit `feat(web): job page JSON-LD and honest badge`

---

### Task 28: Homepage latest hidden + search

**Files:**
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/app/jobs/search-form.tsx` if needed

**Interfaces:**
- Latest 8 `hidden_from_linkedin` jobs; search GET `/jobs?q=`
- Claim string unchanged

- [ ] **Step 1–5:** Commit `feat(web): homepage hidden list and search`

---

### Task 29: Programmatic hubs

**Files:**
- Create: `packages/shared/src/hubs.ts` — role slugs from spec §9
- Create: `apps/web/app/remote-[role]-jobs/page.tsx`
- Create: `apps/web/app/companies/[slug]/page.tsx`
- Create: `apps/web/app/skills/[slug]/page.tsx`

**Interfaces:**
- Unknown role → 404
- Internal links to jobs

- [ ] **Step 1–5:** Test hub slug allowlist. Commit `feat(web): SEO hubs for roles, companies, skills`

---

### Task 30: `/hidden-jobs` + sitemap + cache headers

**Files:**
- Create: `apps/web/app/hidden-jobs/page.tsx`
- Create: `apps/web/app/sitemap.ts`
- Create: `apps/web/lib/cache.ts`

**Interfaces:**
- Sitemap: `/`, `/jobs`, hubs, each listed job slug, companies — **not** `/profile`, `/login`, `/talent`
- Public pages: `Cache-Control: public, s-maxage=300` only on pages with `revalidate` and **no cookies**. Job page with apply widget: `private, no-store` if session, else public JD with `s-maxage=300` **without** apply URL

- [ ] **Step 1–5:** sitemap unit test excludes `/profile`. Commit `feat(web): hidden landing, sitemap, cache rules`

---

### Task 31: Better Auth Google + magic link + Turnstile

**Files:**
- Create: `apps/web/lib/auth/index.ts`
- Create: `apps/web/app/api/auth/[...all]/route.ts`
- Create: `apps/web/app/login/page.tsx`
- Create: `apps/web/lib/auth/turnstile.ts`

**Interfaces:**
- Better Auth D1 adapter using existing `users` or Auth’s `user` table — **one user table**, documented in this task after you generate Better Auth schema; migrate with `0002_auth.sql` if names differ from spec `users`
- Magic link via `env.EMAIL.send`
- Turnstile verify on email submit
- Google OAuth env secrets

- [ ] **Step 1:** Test Turnstile token missing → 400

- [ ] **Step 2–4:** Wire auth; magic-link failure logs and `/login` resend

- [ ] **Step 5: Commit** `feat(web): Better Auth Google, magic link, Turnstile`

---

### Task 32: Soft-gate onboarding

**Files:**
- Create: `apps/web/app/onboarding/page.tsx`
- Create: `apps/web/lib/profile/gate.ts`
- Create: `apps/web/lib/profile/gate.test.ts`

**Interfaces:**
- `needsOnboarding(profile)` true if missing display_name, target_role, or remote_pref
- Unlock route redirects to `/onboarding?next=` if needed
- Talent-pool checkbox **not** on this page

- [ ] **Step 1–5:** Commit `feat(web): onboarding gate before first unlock`

---

### Task 33: Unlock quota 5 per UTC ISO week

**Files:**
- Create: `apps/web/lib/unlocks/week.ts`
- Create: `apps/web/lib/unlocks/quota.ts`
- Create: `apps/web/lib/unlocks/quota.test.ts`
- Create: `apps/web/app/api/unlock/route.ts`

**Interfaces:**
- `isoWeekId(date: Date): string` e.g. `2026-W36` UTC
- `canUnlock({ isPaid, existingUnlockSameJob, countThisWeek })`
- Paid (`stripe_status=active` and period_end future) → unlimited
- Insert unlocks unique `(user_id, job_id, week_id)`
- 6th distinct job → 402 `{ code: "quota" }` no redirect
- Success → `{ applyUrl }` JSON for client redirect

- [ ] **Step 1: Tests:** 5th ok, 6th blocked, same job free, next ISO week resets

- [ ] **Step 2–4:** Implement

- [ ] **Step 5: Commit** `feat(web): UTC ISO-week unlock quota`

---

### Task 34: Stripe EUR €9 / €59

**Squad / role:** Product · Billing  
**QA:** QA Product  
**Release:** `STRIPE_ENABLED=false` until 300 career_page jobs.

**Files:**
- Create: `apps/web/lib/billing/plans.ts`
- Create: `apps/web/app/api/stripe/checkout/route.ts`
- Create: `apps/web/app/api/stripe/webhook/route.ts`
- Create: `apps/web/lib/billing/plans.test.ts`

**Interfaces:**
- `PLAN_COPY.monthly.label === "€9 / month"`; yearly `"€59 / year"`
- Webhook updates `subscriptions`; until active, quota stays free
- **Gate:** do not enable Checkout in production until crawler launch bar (300 jobs). Code can land behind `STRIPE_ENABLED=false`

- [ ] **Step 1–5:** Commit `feat(web): Stripe EUR plans and webhook`

---

### Task 35: Profile experience, skills, completeness, nudge

**Files:**
- Create: `apps/web/app/profile/page.tsx`
- Create: `apps/web/lib/profile/completeness.ts`
- Create: `apps/web/lib/profile/completeness.test.ts`

**Interfaces:**
- Completeness: 20 name+role, 20 location/remote pref, 20 ≥1 experience, 20 ≥3 skills, 20 CV (0 until Task 36)
- After unlock response include `completeness`; client shows nudge if &lt; 80

- [ ] **Step 1–5:** Commit `feat(web): profile completeness score`

---

### Task 36: R2 CV upload

**Files:**
- Create: `apps/web/app/api/profile/cv/route.ts`
- Create: `apps/web/lib/profile/cv.ts`
- Create: `apps/web/lib/profile/cv.test.ts`

**Interfaces:**
- PDF only, max 5 MB; key `cv/{userId}/{uuid}.pdf`
- Non-PDF / too large → 400, no R2 write

- [ ] **Step 1–5:** Commit `feat(web): R2 CV upload with PDF and size checks`

---

### Task 37: Talent pool opt-in default off

**Squad / role:** Product · Profile / privacy  
**QA:** QA Product  
**Security / Legal:** parallel review (default off, apply does not opt in).

**Files:**
- Create: `apps/web/lib/profile/talent-pool.ts`
- Create: `apps/web/lib/profile/talent-pool.test.ts`
- Create: `apps/web/app/settings/page.tsx`
- Create: `apps/web/app/api/account/talent-pool/route.ts`

**Interfaces:**
- `defaultTalentPoolOptIn(): 0`
- Unlock routes never set opt-in
- `consent_events` row on change

- [ ] **Step 1–5:** Commit `feat(web): talent pool opt-in default off`

---

### Task 38: Export JSON + delete account

**Files:**
- Create: `apps/web/lib/profile/export.ts`
- Create: `apps/web/lib/profile/delete-account.ts`
- Create: `apps/web/app/api/account/export/route.ts`
- Create: `apps/web/app/api/account/delete/route.ts`
- Tests: export has no `publicUrl` / `/talent`; delete R2 then SQL

**Interfaces:**
- Delete order: R2 CV, experience, skills, unlocks, consent, subscriptions, profiles, auth session/account/user

- [ ] **Step 1–5:** Commit `feat(web): account export and delete`

---

### Task 39: `/pricing` `/terms` `/privacy`

**Files:**
- Create: `apps/web/lib/legal/copy.ts`
- Create: `apps/web/lib/legal/copy.test.ts`
- Create: `apps/web/app/pricing/page.tsx`
- Create: `apps/web/app/terms/page.tsx`
- Create: `apps/web/app/privacy/page.tsx`

**Interfaces:**
- Terms: third parties, incomplete, no real-time LinkedIn, badge meaning
- Privacy: job product vs recruiter opt-in
- Legal entity placeholder until launch

- [ ] **Step 1–5:** Commit `feat(web): pricing and legal copy`

---

### Task 40: Emails — quota + paid digest from crawler Cron

**Files:**
- Create: `apps/web/lib/email/send.ts`
- Create: `apps/web/lib/email/digest.ts`
- Create: `apps/web/lib/email/digest.test.ts`
- Create: `apps/web/app/api/internal/digest/route.ts` — `Authorization: Bearer` **crawler service secret**, not a public cron
- Modify: `apps/crawler/src/index.ts` scheduled: after enqueue, POST digest URL with secret (or send EMAIL directly from crawler using same `buildDigestEmail` moved to `packages/shared`)

**Interfaces:**
- **Prefer** `buildDigestEmail` in `packages/shared` so crawler can `EMAIL.send` without OpenNext scheduled
- Recipients: join `subscriptions` + auth email; skip empty email
- Free users not mailed
- Quota-exceeded email optional from unlock 402 path

- [ ] **Step 1:** Tests for recipient filter and empty hidden list copy

- [ ] **Step 2–4:** Implement send on crawler Cron

- [ ] **Step 5: Commit** `feat: hidden digest from crawler Cron via Email Service`

---

## Web done when

**Owners:** Coordinatore + QA Lead + Release.

- Manual checks from spec §14: badge honesty, 5/6 unlocks, Stripe fail-open, talent-pool off, delete wipes R2, sitemap has no talent URLs, terms/privacy two purposes
