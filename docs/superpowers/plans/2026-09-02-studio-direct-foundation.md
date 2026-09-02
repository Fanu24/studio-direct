# Studio Direct Foundation Implementation Plan

> **Squad:** Platform. **Coordinatore:** non implementa. **Implementer:** un ruolo per task (vedi tabella). **QA:** QA Platform (task 8: QA Product; 6/9/10: QA Data). **Architetto:** review obbligatoria task 2 e 4 se lo schema diverge. Playbook: [org](./2026-09-02-studio-direct-org.md).

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development. Fresh implementer **named by role** per task, then squad QA. One writer on the branch.

**Goal:** A pnpm monorepo on Cloudflare with D1 (EU), locked `JobDraft`/`QueueMessage` types, five seed studios, an OpenNext homepage, and a crawler that enqueues career messages and acks without fetching.

**Architecture:** `apps/web` (OpenNext) and `apps/crawler` (Queues + Cron) share `packages/shared` and `packages/db`. Crawler consumers are no-ops until the crawler plan.

**Tech Stack:** pnpm workspaces, TypeScript, Wrangler, D1, Vitest, OpenNext, `@cloudflare/vitest-pool-workers` for the crawler worker.

## Global Constraints

- Copy homepage claim verbatim: `Jobs from studio career pages, including roles not posted on LinkedIn.`
- `wrangler.jsonc` only; `nodejs_compat`; `wrangler types` for `Env`
- D1 created with `--jurisdiction eu`
- Schema = spec §7 tables (create all now; web tables unused until plan 3)
- Queue messages use `kind`, never `type`
- `apps/web/app/` not `src/app`
- No LinkedIn/Indeed HTTP, no Stripe, no Better Auth, no Browser Rendering in this plan
- Bindings names: `DB`, `FILES`, `LOCKS`, `CRAWL_CAREER`, `CRAWL_LINKEDIN`, `CRAWL_INDEED`, `EMAIL`

## Team (questa squadra)

| Task | Implementer (R) | QA | Note |
| --- | --- | --- | --- |
| 1 | Cloudflare / infra | QA Platform | workspace only |
| 2 | Shared types | QA Platform | Architetto accountable sul contratto |
| 3 | Shared types | QA Platform | |
| 4 | Schema / D1 | QA Platform | vietato `company_crawl_state` |
| 5 | Cloudflare / infra | QA Platform | `wrangler.jsonc`, poi `wrangler types` |
| 6 | Schema / D1 | QA Data | 5 career_url veri |
| 7 | Shared types | QA Platform | consult HTTP reliability |
| 8 | SEO / frontend | QA Product | solo homepage stub |
| 9 | HTTP reliability | QA Data | ack, no fetch |
| 10 | HTTP reliability | QA Data | enqueue only |

**Sprint exit:** Coordinatore + QA Lead. Criteri in fondo a questo file.

---

### Task 0: Git + Cursor Origin remote (prima del codice)

**Squad / role:** Platform · Cloudflare / infra (git)  
**QA:** Coordinatore verifica `git remote -v` punta a `origin.cursor.com`  
**Responsabile verso di te:** ti manda l’URL `cursor.com/codebase/...` e “clona sull’altro PC”

- [ ] `git init -b main` se manca `.git`
- [ ] `.gitignore`: `node_modules`, `.wrangler`, `.open-next`, `.env`, `.env.*`, `.superpowers/sdd/`
- [ ] Commit spec + piani
- [ ] Remote **Cursor Origin** (`studio-direct`). Su questo Windows: creare il repo da WSL (`origin repo create`) o dalla UI codebase, poi `git push -u origin main`. **Non GitHub.** CLI Origin non gira su Windows nativo.
- [ ] Non committare segreti

Poi Task 1.

### Task 1: pnpm workspace skeleton

**Squad / role:** Platform · Cloudflare / infra  
**QA:** QA Platform  
**Coordinator gate:** `pnpm --filter @gaming/shared test` green; four packages exist.

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `apps/web/package.json`
- Create: `apps/crawler/package.json`
- Create: `packages/shared/package.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/db/package.json`
- Create: `packages/db/src/index.ts`

**Interfaces:**
- Consumes: nothing
- Produces: packages `@gaming/shared`, `@gaming/db`, `@gaming/web`, `@gaming/crawler`

- [ ] **Step 1: Write the failing workspace test**

Create `packages/shared/src/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "./index.ts";

describe("@gaming/shared", () => {
  it("exports a package name", () => {
    expect(PACKAGE_NAME).toBe("@gaming/shared");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/shared test`

Expected: FAIL — no package / `PACKAGE_NAME` not exported

- [ ] **Step 3: Write minimal workspace**

Root `package.json`:

```json
{
  "name": "studio-direct",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`packages/shared/package.json`:

```json
{
  "name": "@gaming/shared",
  "version": "0.0.0",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/shared/src/index.ts`:

```ts
export const PACKAGE_NAME = "@gaming/shared";
```

Add matching `package.json` stubs for `@gaming/db`, `@gaming/web`, `@gaming/crawler` with `"type": "module"` and empty `src/index.ts` / `app` later. `.gitignore`: `node_modules`, `.wrangler`, `.open-next`, `dist`, `.env`, `worker-configuration.d.ts` if generated (do **not** gitignore if the project commits generated types — prefer commit after `wrangler types`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm install` then `pnpm --filter @gaming/shared test`

Expected: PASS `1 passed`

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json .gitignore apps packages
git commit -m "chore: scaffold pnpm workspace for Studio Direct"
```

---

### Task 2: Locked JobDraft and QueueMessage types

**Squad / role:** Platform · Shared types  
**QA:** QA Platform  
**Architetto:** must approve this commit (field names, `kind` not `type`).  
**Coordinator gate:** `isQueueMessage({ type: "career" }) === false`.

**Files:**
- Create: `packages/shared/src/jobs.ts`
- Create: `packages/shared/src/jobs.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: Task 1 package
- Produces: `Source`, `JobDraft`, `QueueMessage`, `JobSource`, `isQueueMessage`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { isQueueMessage } from "./jobs.ts";

describe("QueueMessage", () => {
  it("accepts kind career with companyId", () => {
    expect(isQueueMessage({ kind: "career", companyId: "c1" })).toBe(true);
  });

  it("rejects type instead of kind", () => {
    expect(isQueueMessage({ type: "career", companyId: "c1" })).toBe(false);
  });

  it("accepts linkedin and indeed query messages", () => {
    expect(isQueueMessage({ kind: "linkedin", query: "unity remote" })).toBe(true);
    expect(isQueueMessage({ kind: "indeed", query: "qa remote" })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/shared test src/jobs.test.ts`

Expected: FAIL cannot find module

- [ ] **Step 3: Write types**

```ts
export type Source = "career_page" | "linkedin" | "indeed";

export type JobDraft = {
  source: Source;
  sourceUrl: string;
  companyName: string;
  title: string;
  location: string | null;
  remote: "remote" | "hybrid" | "onsite" | "unknown";
  descriptionHtml: string;
  applyUrl: string;
  postedAt: string | null;
  rawJson: string;
};

export type QueueMessage =
  | { kind: "career"; companyId: string }
  | { kind: "linkedin"; query: string }
  | { kind: "indeed"; query: string };

export interface JobSource {
  fetch(message: QueueMessage): Promise<JobDraft[]>;
}

export function isQueueMessage(value: unknown): value is QueueMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.type !== undefined) return false;
  if (v.kind === "career") return typeof v.companyId === "string";
  if (v.kind === "linkedin" || v.kind === "indeed") return typeof v.query === "string";
  return false;
}
```

Export from `index.ts`. Field names on `JobDraft` are camelCase in TypeScript; D1 columns stay snake_case in SQL.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/shared test src/jobs.test.ts`

Expected: PASS 3 tests

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat: lock JobDraft and QueueMessage kinds"
```

---

### Task 3: normalize, slug, apply URL canonicalizer

**Squad / role:** Platform · Shared types  
**QA:** QA Platform

**Files:**
- Create: `packages/shared/src/normalize.ts`
- Create: `packages/shared/src/normalize.test.ts`

**Interfaces:**
- Produces: `normalizeCompanyName`, `slugTitle`, `canonicalApplyUrl`, `canonicalKeyFromUrls`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { canonicalApplyUrl, normalizeCompanyName, slugTitle } from "./normalize.ts";

describe("normalizeCompanyName", () => {
  it("maps Ubisoft Entertainment to ubisoft", () => {
    expect(normalizeCompanyName("Ubisoft Entertainment")).toBe("ubisoft");
  });
});

describe("canonicalApplyUrl", () => {
  it("strips tracking params", () => {
    expect(
      canonicalApplyUrl("https://jobs.example.com/x?gh_jid=1&utm_source=li"),
    ).toBe("https://jobs.example.com/x?gh_jid=1");
  });
});

describe("slugTitle", () => {
  it("slugs gameplay titles", () => {
    expect(slugTitle("Senior Gameplay Engineer (Remote)")).toBe(
      "senior-gameplay-engineer-remote",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/shared test src/normalize.test.ts`

Expected: FAIL module not found

- [ ] **Step 3: Write implementation**

Strip `utm_*`, `fbclid`, `gclid` from apply URLs. Lowercase, collapse punctuation for company names; drop `entertainment`, `inc`, `ltd`, `games`, `studio`, `studios` suffixes when leftover tokens remain. Slug: lowercase, non-alphanumeric to `-`, trim dashes.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/shared test src/normalize.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/normalize.ts packages/shared/src/normalize.test.ts
git commit -m "feat: add company normalize, title slug, apply URL canonicalizer"
```

---

### Task 4: D1 schema spec §7 + Drizzle

**Squad / role:** Platform · Schema / D1  
**QA:** QA Platform  
**Architetto:** reject extra crawl-state tables.

**Files:**
- Create: `packages/db/migrations/0001_init.sql`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/src/schema.test.ts`

**Interfaces:**
- Produces: SQL tables `tenants`, `companies`, `jobs`, `job_sightings`, `jobs_fts`, `users` (or Better Auth names added in web plan — create spec `users` plus empty auth placeholders only if Better Auth will own `user`/`session`/`account`; **create spec tables now**: profiles, experience_entries, profile_skills, unlocks, subscriptions, consent_events, crawl_runs)
- Unique index `idx_jobs_tenant_canonical_unique` on `jobs(tenant_id, canonical_key)`

- [ ] **Step 1: Write the failing test**

Use `better-sqlite3` or wrangler local: assert `0001_init.sql` contains `CREATE TABLE jobs` and `CREATE VIRTUAL TABLE jobs_fts` and does **not** contain `company_crawl_state`.

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8");

describe("0001_init.sql", () => {
  it("has spec tables and FTS5", () => {
    expect(sql).toContain("CREATE TABLE tenants");
    expect(sql).toContain("CREATE TABLE jobs");
    expect(sql).toContain("CREATE VIRTUAL TABLE jobs_fts");
    expect(sql).toContain("CREATE TABLE crawl_runs");
    expect(sql).not.toContain("company_crawl_state");
    expect(sql).not.toContain("job_source_state");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/db test`

Expected: FAIL file missing

- [ ] **Step 3: Write SQL matching spec §7**

Include `listed INTEGER NOT NULL DEFAULT 1`, `exclusivity TEXT NOT NULL DEFAULT 'unknown'`, `seen_on_indeed INTEGER NOT NULL DEFAULT 0`, FTS5 triggers to keep `jobs_fts` in sync on insert/update/delete. Drizzle `schema.ts` maps the same columns (camelCase in TS).

Create D1:

```bash
npx wrangler d1 create gaming-jobs --jurisdiction eu
```

Put the returned `database_id` in both wrangler files in Task 5.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/db test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/db
git commit -m "feat: add D1 schema from spec section 7"
```

---

### Task 5: wrangler.jsonc for web and crawler

**Squad / role:** Platform · Cloudflare / infra  
**QA:** QA Platform  
**Forbidden:** `wrangler.toml`, handmade `Env`.

**Files:**
- Create: `apps/crawler/wrangler.jsonc`
- Create: `apps/web/wrangler.jsonc`
- Create: `apps/crawler/src/index.ts` (temporary fetch-only if needed for typegen)

**Interfaces:**
- Produces: bindings `DB`, `FILES`, `LOCKS`, `CRAWL_*`, `EMAIL` on crawler; `DB`, `FILES`, `EMAIL` on web (no queue consumers on web)
- After edit: `pnpm --filter @gaming/crawler exec wrangler types` and same for web

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("crawler wrangler", () => {
  const raw = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  it("is jsonc and names crawl queues", () => {
    expect(raw).toContain("crawl-career");
    expect(raw).toContain("CRAWL_CAREER");
    expect(raw).not.toContain("wrangler.toml");
  });
});
```

Place test at `apps/crawler/wrangler.test.ts` or keep as db-level read of both files from `packages/db`.

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL missing wrangler.jsonc

- [ ] **Step 3: Write wrangler.jsonc**

Crawler: Cron `"0 */6 * * *"`, D1 `gaming-jobs`, KV `LOCKS`, R2 `FILES`, Email `EMAIL`, three queue producers and three consumers `max_batch_size: 1`. Web: D1, R2, Email only. `compatibility_flags`: `["nodejs_compat"]`. `compatibility_date`: `"2026-09-02"`.

No `BROWSER` binding.

- [ ] **Step 4: Generate Env and pass test**

Run: `pnpm --filter @gaming/crawler exec wrangler types`

Expected: `worker-configuration.d.ts` contains `DB: D1Database` and queue types.

Run wrangler test. Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/wrangler.jsonc apps/crawler/wrangler.jsonc apps/crawler/worker-configuration.d.ts apps/web/worker-configuration.d.ts
git commit -m "chore: add wrangler.jsonc bindings for web and crawler"
```

---

### Task 6: Seed tenant gaming + 5 companies

**Squad / role:** Platform · Schema / D1  
**QA:** QA Data

**Files:**
- Create: `packages/db/seed/companies.json`
- Create: `packages/db/src/seed.ts`
- Create: `packages/db/src/seed.test.ts`

**Interfaces:**
- Produces: `seedLocal(db)` idempotent; tenant slug `gaming` name `Studio Direct`; five allowlisted studios with `career_url` and `ats_type` where known (e.g. Greenhouse slug)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { SEED_COMPANIES, TENANT_SLUG } from "./seed.ts";

describe("seed", () => {
  it("uses tenant gaming and five companies", () => {
    expect(TENANT_SLUG).toBe("gaming");
    expect(SEED_COMPANIES).toHaveLength(5);
    expect(SEED_COMPANIES.every((c) => c.career_url.startsWith("https://"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL

- [ ] **Step 3: Write seed**

Pick five studios with public Greenhouse or Lever boards (verify URLs at implement time; examples: Riot, CD PROJEKT RED, Larian, Valve, Paradox — replace with working board URLs). `listed = 1`. Re-run inserts 0 new companies (unique `tenant_id + name_norm`).

Script: `pnpm --filter @gaming/db seed` → `wrangler d1 execute gaming-jobs --local --file=...` or drizzle runner.

- [ ] **Step 4: Run test + seed**

Expected: test PASS; local D1 has 1 tenant, 5 companies

- [ ] **Step 5: Commit**

```bash
git add packages/db/seed packages/db/src/seed.ts packages/db/src/seed.test.ts
git commit -m "feat: seed Studio Direct tenant and five studios"
```

---

### Task 7: KV host lock helper

**Squad / role:** Platform · Shared types (consult HTTP reliability)  
**QA:** QA Platform

**Files:**
- Create: `packages/shared/src/host-lock.ts`
- Create: `packages/shared/src/host-lock.test.ts`

**Interfaces:**
- Produces: `acquireHostLock(kv, hostname, nowMs, minIntervalMs = 2000): Promise<{ acquired: boolean; retryAfterMs?: number }>`

- [ ] **Step 1: Write the failing test**

In-memory fake KV: first acquire true, second within 2s false with retryAfterMs.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement with key `lock:host:${hostname}`**

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit** `feat: add per-host crawl lock helper`

---

### Task 8: OpenNext homepage stub

**Squad / role:** Platform · SEO / frontend  
**QA:** QA Product

**Files:**
- Create: `apps/web/open-next.config.ts`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/lib/copy.ts`
- Create: `apps/web/lib/copy.test.ts`

**Interfaces:**
- Produces: `HOMEPAGE_CLAIM` constant; `/` renders h1 Studio Direct + claim. `dynamic = "force-dynamic"`. No `/jobs` yet.

- [ ] **Step 1: Write copy test** asserting exact claim string and no `100%`

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement layout/page/copy**

- [ ] **Step 4: `pnpm --filter @gaming/web test` PASS; `pnpm --filter @gaming/web dev` shows claim**

- [ ] **Step 5: Commit** `feat: scaffold OpenNext homepage with career-page claim`

---

### Task 9: Crawler health + queue ack + cron crawl_runs stub

**Squad / role:** Platform · HTTP reliability  
**QA:** QA Data  
**Forbidden:** any third-party HTTP.

**Files:**
- Create: `apps/crawler/src/index.ts`
- Create: `apps/crawler/tests/health.test.ts`
- Create: `apps/crawler/tests/queue.test.ts`
- Create: `apps/crawler/tests/scheduled.test.ts`
- Create: `apps/crawler/vitest.config.ts`

**Interfaces:**
- `GET /health` → `{ ok: true, worker: "crawler" }`
- `queue`: ack every message; **no fetch**
- `scheduled`: insert `crawl_runs` `source='career_page'`, `ok=1`, `stats_json='{"enqueued":0}'` in this stub (Task 10 will enqueue)

- [ ] **Step 1: Write failing worker tests** using `cloudflare:test`

- [ ] **Step 2: Run `pnpm --filter @gaming/crawler test` — FAIL missing worker**

- [ ] **Step 3: Implement stub worker; apply `0001_init.sql` in `beforeAll`**

- [ ] **Step 4: Tests PASS; `curl /health`**

- [ ] **Step 5: Commit** `feat: crawler health, queue ack, crawl_runs cron stub`

---

### Task 10: Cron enqueues one career message per seed company

**Squad / role:** Platform · HTTP reliability  
**QA:** QA Data  
**Forbidden:** fetch inside cron.

**Files:**
- Modify: `apps/crawler/src/index.ts`
- Create: `apps/crawler/src/cron.ts`
- Create: `apps/crawler/src/cron.test.ts`

**Interfaces:**
- Consumes: `companies` where `career_url IS NOT NULL`; `CRAWL_CAREER.send({ kind: "career", companyId })`
- Produces: `enqueueCronWork` also sends dictionary queries to LinkedIn/Indeed queues (messages only; consumers still ack). `crawl_runs.stats_json` includes `{ enqueuedCareer: N }`
- Still **no outbound HTTP** to boards

- [ ] **Step 1: Write failing test** with fake queue: 5 career messages all `kind: "career"`

- [ ] **Step 2: Run test — FAIL**

- [ ] **Step 3: Implement `enqueueCronWork`; wire `scheduled`**

- [ ] **Step 4: Test PASS**

- [ ] **Step 5: Commit** `feat: cron enqueues career QueueMessages without fetching`

---

## Foundation done when

**Owners:** Coordinatore + QA Lead (Platform sprint exit).

- `pnpm test` passes for shared, db, web copy, crawler
- Local D1 has schema + tenant `gaming` + 5 companies
- `/` shows the claim; crawler `/health` ok
- Cron enqueues; consumers ack; zero third-party fetches
- No `wrangler.toml`, no `type:` queue field, no extra crawl-state tables
