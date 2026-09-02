# Studio Direct v1 — plan index

> **For agentic workers:** You are the **Coordinatore / EM**. Read [2026-09-02-studio-direct-org.md](./2026-09-02-studio-direct-org.md) first. Then execute **one plan file at a time, in order**, using subagent-driven-development: **one implementer (named role) per task**, then **QA di squadra**, Security when RACI says S. You do **not** write product code. Do not staple old specialist dumps.

**Goal:** Ship the English gaming job site in the spec, on Cloudflare, with a career-page inventory and an honest Not on LinkedIn badge.

**Architecture:** Three sequential **squads**. Platform (foundation) → Data (crawler) → Product (web). LinkedIn/Indeed are best-effort freshness signals, not inventory.

**Org:** Coordinatore, Architetto, QA Lead, Security/Legal, Release + tre squad (Platform, Data, Product) con specialisti e QA dedicati. Dettaglio ruoli e RACI: [org playbook](./2026-09-02-studio-direct-org.md).

**Tech Stack:** pnpm, OpenNext on Workers, crawler Worker, D1 EU, R2, KV, three Queues, Email Service, Better Auth, Stripe EUR, Vitest.

## Controller verdict (piani tecnici)

Specialists A/B/C drafts were **not mergeable**. Controller: **SANE WITH FIXES**. These three plan files + the org playbook are the source for execution.

## Execute in this order

0. [Org / team playbook](./2026-09-02-studio-direct-org.md) — ruoli, RACI, voce verso di te, **Cursor Origin su due PC**
1. [Foundation — Squad Platform](./2026-09-02-studio-direct-foundation.md) — Tasks 1–10
2. [Crawler — Squad Data](./2026-09-02-studio-direct-crawler.md) — Tasks 11–25
3. [Web — Squad Product](./2026-09-02-studio-direct-web.md) — Tasks 26–40

Spec: `docs/superpowers/specs/2026-09-02-gaming-jobs-network-design.md`

## Global constraints (every plan)

- Cloudflare only (Workers Paid). Exceptions: Stripe, Google OAuth.
- `wrangler.jsonc` only. `wrangler types` generates `Env`. No handmade binding interfaces.
- App dir: `apps/web/app/` (no `src/app`).
- Queue discriminator: `kind`, never `type`.
- D1 schema = spec §7 only. No `company_crawl_state` / `job_source_state`.
- Queues and Cron live on `apps/crawler` only.
- Browser Rendering unbound in v1.
- No live LinkedIn/Indeed in CI. No scrape playbook. No Hitmarker scrape.
- Badge hidden unless LinkedIn `crawl_runs.ok=1` within 24h.
- Stripe only after ≥300 listed career_page remote/hybrid jobs.
- Copy never claims 100% coverage or real-time LinkedIn.
- UI English. Tenant slug `gaming`. Display name Studio Direct until domain exists.

## Locked types

```ts
type Source = "career_page" | "linkedin" | "indeed";

type JobDraft = {
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

type QueueMessage =
  | { kind: "career"; companyId: string }
  | { kind: "linkedin"; query: string }
  | { kind: "indeed"; query: string };

interface JobSource {
  fetch(message: QueueMessage): Promise<JobDraft[]>;
}
```

Bindings: `DB`, `FILES`, `LOCKS`, `CRAWL_CAREER`, `CRAWL_LINKEDIN`, `CRAWL_INDEED`, `EMAIL`. Queue names: `crawl-career`, `crawl-linkedin`, `crawl-indeed`.
