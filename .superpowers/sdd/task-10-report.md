# Task 10 report: Cron queue fan-out

## Status

Implemented `enqueueCronWork` and wired the crawler scheduled handler to:

- select every company whose `career_url` is not null;
- send one `{ kind: "career", companyId }` message per company;
- send the fixed `unity remote` and `unreal remote` queries to both LinkedIn and Indeed queues;
- record `{ "enqueuedCareer": N }` in `crawl_runs.stats_json`;
- perform no outbound HTTP.

The existing `/health` response and queue `ackAll()` behavior are unchanged.

## TDD evidence

### RED

Before `apps/crawler/src/cron.ts` existed:

```text
node --input-type=module -e "... startVitest ... src/cron.test.ts ..."

FAIL src/cron.test.ts
Error: Cannot find module './cron'
Test Files 1 failed (1)
```

This was the expected failure: the new cron enqueue API had not been implemented.

### GREEN

After the minimal implementation:

```text
Test Files 1 passed (1)
Tests      1 passed (1)
```

The fake-queue test proves:

- exactly five career messages are emitted;
- every career message is `{ kind: "career", companyId }`;
- no career message has a `type` property;
- both LinkedIn and Indeed receive the two fixed dictionary-query messages;
- returned stats are `{ enqueuedCareer: 5 }`;
- `globalThis.fetch` is never called.

The worker scheduled test loads the D1 schema, inserts the five equivalent seed
companies, invokes `scheduled`, and verifies
`stats_json = '{"enqueuedCareer":5}'` with no fetch.

## Verification

```text
pnpm --filter @gaming/crawler test
Test Files 1 passed (1), Tests 3 passed (3)
Test Files 3 passed (3), Tests 3 passed (3)

pnpm --filter @gaming/crawler typecheck
exit 0

git diff --check
exit 0
```

## Scope and security

- No third-party HTTP or any `fetch` was added.
- No Wrangler configuration, Cloudflare account ID, deployment, or Task 11+
  behavior was changed.
- No production seed was run.

## QA Data Important fix

Added a dedicated Node Vitest config for `src/**/*.test.ts` and included it in
the crawler package test script after the existing Wrangler contract and
worker-pool phases. Queue message types now come from `@gaming/shared`.

```text
pnpm --filter @gaming/crawler test

> @gaming/crawler@0.0.0 test C:\Users\dotat\Desktop\Saas JOBS\apps\crawler
> vitest run --config vitest.wrangler.config.ts && vitest run --config vitest.config.ts && vitest run --config vitest.node.config.ts

 RUN  v4.1.0 C:/Users/dotat/Desktop/Saas JOBS/apps/crawler

 Test Files  1 passed (1)
      Tests  3 passed (3)

 RUN  v4.1.0 C:/Users/dotat/Desktop/Saas JOBS/apps/crawler

 Test Files  3 passed (3)
      Tests  3 passed (3)

 RUN  v4.1.0 C:/Users/dotat/Desktop/Saas JOBS/apps/crawler

 ✓ src/cron.test.ts > enqueueCronWork > enqueues five kind-based career messages and fixed board queries without HTTP 2ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
```
