# Studio Direct Crawler Implementation Plan

> **Squad:** Data. **Coordinatore:** non implementa. **Security/Legal:** obbligatorio task 23–24. **Architetto:** task 19 e 25. Playbook: [org](./2026-09-02-studio-direct-org.md).

> **For agentic workers:** Execute **after** Platform sprint exit is green. One named-role implementer per task, then QA Data. Parallel QA+Security only on 23–24.

**Goal:** Fill D1 with remote/hybrid gaming jobs from studio career pages (Greenhouse, Lever, career-page JSON-LD), recompute exclusivity honestly, and treat LinkedIn/Indeed as best-effort (empty parse is success-path for “no drafts”).

**Architecture:** One Queue message = one fetch. Three queues. KV host lock. `crawl_runs.ok=0` on 429/403. Career continues if LinkedIn fails. No Browser Rendering.

**Tech Stack:** Crawler Worker, D1, Queues, KV, Vitest, fixture HTML/JSON only in CI.

## Global Constraints

- Same locked types as the index (`JobDraft`, `QueueMessage` with `kind`)
- Spec §7 schema only
- User-Agent: `StudioDirectBot/1.0 (+https://studio-direct.example/bot; jobs@studio-direct.example)` — replace domain when it exists
- No live LinkedIn/Indeed in CI
- `hidden_from_linkedin` only if career sighting AND no LinkedIn match AND last LinkedIn `crawl_runs.ok=1` within 24h AND that run ingested ≥1 parseable draft **or** completed a full dictionary pass with ok=1 (if the pass returns 0 drafts, index is “fresh but empty”: badges stay `unknown` — silence > lying)
- Indeed adapter is allowed to return `[]`; it is not a launch dependency
- Do not scrape Hitmarker; do not add stealth browsers
- Path to 300 jobs is **data + ATS**, not new HTML mega-parsers
- wrangler.jsonc; `wrangler types` after binding edits

## Team (questa squadra)

Implementer mapping: 11–12, 22 HTTP reliability · 13–15 ATS adapters · 16–20 Matching · 21 ATS+HTTP · 23–24 HTTP + **Security** · 25 infra + Architetto + QA Lead.

**QA:** QA Data su ogni task. **Forbidden globale:** live LinkedIn/Indeed in CI, stealth, extra D1 tables.

---

### Task 11: crawl_runs writer + 429/403 → ok=0 + queue delay

**Squad / role:** Data · HTTP reliability  
**QA:** QA Data

**Files:**
- Create: `apps/crawler/src/http/public-fetch.ts`
- Create: `apps/crawler/src/http/public-fetch.test.ts`
- Create: `apps/crawler/src/runs.ts`

**Interfaces:**
- Produces: `fetchPublicText(url, fetchImpl, userAgent): Promise<{ status: number; body: string }>`
- Produces: `RateLimitedError` with `status` 429|403 and `retryAfterSeconds`
- Produces: `retryDelaySeconds(err): number | null`
- On 429/403 throw `RateLimitedError`; caller writes `crawl_runs.ok=0` and `message.retry({ delaySeconds })`

- [ ] **Step 1: Write tests** — 200 returns body; 403 throws RateLimitedError; Retry-After 45 → delay 45

- [ ] **Step 2: Run tests — FAIL**

- [ ] **Step 3: Implement GET with the product User-Agent only. No cookie jars.**

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit** `feat(crawler): public GET helper and rate-limit errors`

---

### Task 12: Use host lock on fetch

**Files:**
- Create: `apps/crawler/src/locks/kv-lock.ts`
- Create: `apps/crawler/src/locks/kv-lock.test.ts`

**Interfaces:**
- Consumes: `acquireHostLock` from `@gaming/shared`
- Produces: wrapper around `env.LOCKS`

- [ ] **Step 1–5:** Test double-fetch same host within 2s second call not acquired. Commit `feat(crawler): kv host lock on fetches`

---

### Task 13: Greenhouse JobSource

**Files:**
- Create: `apps/crawler/src/sources/greenhouse.ts`
- Create: `apps/crawler/test/fixtures/greenhouse-board.json`
- Create: `apps/crawler/src/sources/greenhouse.test.ts`
- Create: `apps/crawler/src/sources/career.ts` (dispatcher by `ats_type`)

**Interfaces:**
- Consumes: `QueueMessage` kind career; loads company from repo (companyId)
- Produces: `JobDraft[]` with `source: "career_page"`, applyUrl from Greenhouse absolute URL
- Public URL pattern: `https://boards-api.greenhouse.io/v1/boards/{ats_slug}/jobs?content=true`

- [ ] **Step 1: Fixture with one remote gameplay job + one onsite; test maps remote draft and keeps onsite as remote unknown/onsite**

- [ ] **Step 2–4:** Implement parser; no live HTTP in test (inject fetch)

- [ ] **Step 5: Commit** `feat(crawler): Greenhouse board JobSource`

---

### Task 14: Lever JobSource

**Files:**
- Create: `apps/crawler/src/sources/lever.ts`
- Create: `apps/crawler/test/fixtures/lever-postings.json`
- Create: `apps/crawler/src/sources/lever.test.ts`

**Interfaces:**
- Public JSON: `https://api.lever.co/v0/postings/{ats_slug}?mode=json`
- Same `JobDraft` shape as Greenhouse

- [ ] **Step 1–5:** Fixture test; commit `feat(crawler): Lever JobSource`

---

### Task 15: Career-page JSON-LD JobPosting

**Files:**
- Create: `apps/crawler/src/sources/jsonld.ts`
- Create: `apps/crawler/src/sources/jsonld.test.ts`
- Create: `apps/crawler/test/fixtures/career-jsonld.html`

**Interfaces:**
- Produces: `parseJobPostingJsonLd(html, companyName, pageUrl): JobDraft[]`
- Career dispatcher: if no ats_type, GET `career_url` and parse JSON-LD; else ATS first

- [ ] **Step 1–5:** Fixture with schema.org JobPosting; commit `feat(crawler): JSON-LD JobPosting parser`

---

### Task 16: Remote heuristic

**Files:**
- Create: `packages/shared/src/remote.ts`
- Create: `packages/shared/src/remote.test.ts`

**Interfaces:**
- Produces: `classifyRemote({ title, location, descriptionHtml }): JobDraft["remote"]`

- [ ] **Step 1: Labeled cases:** `"Remote Unity Developer"` → remote; `"London, UK (5 days office)"` → onsite; `"Hybrid, 2 days in office"` → hybrid

- [ ] **Step 2–5:** Implement word lists; commit `feat: remote/hybrid/onsite heuristic`

---

### Task 17: Staffing reject + seed allowlist

**Files:**
- Create: `packages/shared/src/staffing.ts`
- Create: `packages/shared/src/staffing.test.ts`

**Interfaces:**
- Produces: `isStaffingDraft(draft, { allowlistedCompany: boolean }): boolean`
- Allowlisted seed companies skip unless the title is clearly an agency posting

- [ ] **Step 1–5:** Agency name dropped; `allowlistedCompany: true` kept. Commit `feat: staffing reject with studio allowlist`

---

### Task 18: Dedup upsert + sightings + preferred apply_url

**Files:**
- Create: `apps/crawler/src/pipeline/ingest.ts`
- Create: `apps/crawler/src/pipeline/ingest.test.ts`
- Create: `apps/crawler/src/repo/types.ts`
- Create: `apps/crawler/test/fakes/memory-jobs-repo.ts`

**Interfaces:**
- Produces: `ingestDrafts(drafts, ctx): { upserted: number; jobIds: string[]; droppedStaffing: number }`
- Canonical key: `canonicalApplyUrl` else `normalizeCompanyName + slugTitle` if postedAt within 45 days
- Three drafts (career, linkedin, indeed) same URL → one job, three sightings
- `apply_url` prefers career_page sighting
- Onsite drafts stored `listed=0`
- Memory repo for unit tests; D1 repo in Task 21

- [ ] **Step 1–5:** Three-source dedup test. Commit `feat(crawler): ingest, dedup, sightings, preferred apply URL`

---

### Task 19: Exclusivity recompute

**Squad / role:** Data · Matching  
**QA:** QA Data  
**Architetto:** accountable (badge honesty).

**Files:**
- Create: `packages/shared/src/exclusivity.ts`
- Create: `packages/shared/src/exclusivity.test.ts`
- Create: `apps/crawler/src/pipeline/exclusivity.ts`

**Interfaces:**
- Produces: `jaccard(a: string[], b: string[]): number`
- Produces: `linkedinTitlesMatch(a, b): boolean` — Jaccard ≥ 0.55 on title tokens
- Produces: `computeExclusivity({ hasCareer, linkedinSighting, linkedinFresh, postedAtIso, now }): "hidden_from_linkedin" | "on_boards" | "unknown"`
- LinkedIn match also requires `normalizeCompanyName` equal and posted within 45 days
- `linkedinFresh` false → always `unknown` (no badge)

- [ ] **Step 1: Fixtures:** same job different titles → match; different companies → no; 46-day-old → no match; stale index → unknown

- [ ] **Step 2–5:** Implement; commit `feat: exclusivity matcher and hidden-from-linkedin rules`

---

### Task 20: Close jobs after 3 successful misses / 404

**Files:**
- Create: `apps/crawler/src/pipeline/close-stale.ts`
- Create: `apps/crawler/src/pipeline/close-stale.test.ts`

**Interfaces:**
- After a **successful** career fetch (`ok=1`), jobs for that company with career_page sighting not in `seenJobIds` increment a miss counter **in memory during ingest** using `job_sightings.seen_at` vs this run — spec: 3 consecutive successful crawls of that source with no sighting → `listed=0`
- Implement misses as: if last 3 successful `crawl_runs` for `career_page` did not include this job id in stats, close. Simpler YAGNI: `listed=0` if apply_url 404s or ATS marks closed; plus if job not returned in 3 successful board pulls for that company (store `last_seen_at` on `job_sightings` only — **do not add tables**; compare `seen_at` older than 3 successful run timestamps from `crawl_runs`)

- [ ] **Step 1–5:** Tests for close after 3 misses and ATS empty board. Commit `feat(crawler): close stale career jobs`

---

### Task 21: D1 JobsRepository + career consumer

**Files:**
- Create: `apps/crawler/src/repo/d1.ts`
- Create: `apps/crawler/src/consumers/career.ts`
- Create: `apps/crawler/src/consumers/career.test.ts`
- Modify: `apps/crawler/src/index.ts`

**Interfaces:**
- `handleCareerMessage({ kind:"career", companyId }, env)` loads company, locks host, `CareerJobSource.fetch`, ingest, close-stale, `crawl_runs` career_page
- Career `ok=1` even if latest LinkedIn run `ok=0`

- [ ] **Step 1–5:** Inject Greenhouse fixture fetch; LinkedIn run failed; exclusivity `unknown`. Commit `feat(crawler): D1 repo and career consumer`

---

### Task 22: Cron 6h — career per company, board queries per dictionary

**Files:**
- Modify: `apps/crawler/src/cron.ts`
- Create: `packages/shared/src/dictionary.ts` — remote gaming queries (unity remote, unreal remote, …)
- Create: `apps/crawler/src/cron.test.ts`

**Interfaces:**
- `enqueueCronWork` sends one `{ kind:"career", companyId }` per company with career_url
- One `{ kind:"linkedin", query }` and `{ kind:"indeed", query }` per dictionary entry
- Never fetch inside cron

- [ ] **Step 1–5:** Fake queues record counts. Commit `feat(crawler): cron fan-out to three queues`

---

### Task 23: LinkedIn best-effort consumer (CI fixtures only)

**Squad / role:** Data · HTTP reliability  
**QA:** QA Data  
**Security / Legal:** parallel review — public GET only, no playbook, no login.

**Files:**
- Create: `apps/crawler/src/sources/linkedin.ts`
- Create: `apps/crawler/src/consumers/linkedin.ts`
- Create: `apps/crawler/src/consumers/linkedin.test.ts`
- Create: `apps/crawler/test/fixtures/linkedin-empty.html`
- Create: `apps/crawler/test/fixtures/linkedin-jsonld.html` (synthetic JobPosting; not a live scrape recipe)

**Interfaces:**
- GET `https://www.linkedin.com/jobs/search/?keywords={query}` is **not** called in CI
- Tests inject HTML: empty → `[]` and `crawl_runs.ok=1` with `stats.fetched=0` (fresh empty index → badges stay unknown)
- 403 → `ok=0`, throw RateLimitedError
- If JSON-LD JobPosting present in fixture, upsert sightings `source=linkedin`

- [ ] **Step 1–5:** Commit `feat(crawler): LinkedIn best-effort consumer (fixtures)`

---

### Task 24: Indeed best-effort consumer (may return [])

**Squad / role:** Data · HTTP reliability  
**QA:** QA Data  
**Security / Legal:** parallel review. Indeed `[]` is an acceptable launch.

**Files:**
- Create: `apps/crawler/src/sources/indeed.ts`
- Create: `apps/crawler/src/consumers/indeed.ts`
- Create: `apps/crawler/src/consumers/indeed.test.ts`

**Interfaces:**
- Same as LinkedIn: empty HTML → `[]`; 403 → ok=0
- **Launch bar does not require Indeed jobs**
- `seen_on_indeed=1` only when a real sighting exists

- [ ] **Step 1–5:** Commit `feat(crawler): Indeed best-effort consumer`

---

### Task 25: Wire queue router + ops path toward 300 jobs

**Files:**
- Modify: `apps/crawler/src/index.ts`
- Create: `apps/crawler/src/index.test.ts`
- Create: `packages/db/seed/README.md` — how to add CSV companies (name, career_url, ats_type, ats_slug); no Hitmarker

**Interfaces:**
- `routeQueueBatch` dispatches by queue name `crawl-career` | `crawl-linkedin` | `crawl-indeed`
- Document: grow seed to 500; measure listed remote career_page jobs; Ashby/Workable only if Greenhouse+Lever+JSON-LD cannot hit 300

- [ ] **Step 1:** Test router calls the matching handler only

- [ ] **Step 2–4:** Implement; `wrangler types`

- [ ] **Step 5: Commit** `feat(crawler): route three queues and document seed growth`

---

## Crawler done when

**Owners:** Coordinatore + QA Lead (Data sprint exit). Security sign-off on 23–24.

- Fixture tests pass with **no** network to LinkedIn/Indeed
- Career ingest writes jobs + sightings
- Failed LinkedIn run ⇒ no Not on LinkedIn badges
- Empty LinkedIn parse ⇒ unknown badges
- Operator can add companies via seed files toward 300 listed career jobs
