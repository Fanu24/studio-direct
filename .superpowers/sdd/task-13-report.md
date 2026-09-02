# Task 13 Report: Greenhouse JobSource

## Status

Implemented the Greenhouse career-page adapter and Greenhouse-only career dispatcher.

## TDD

- RED: `pnpm --filter @gaming/crawler exec vitest run --config vitest.node.config.ts src/sources/greenhouse.test.ts`
  - Failed because `./greenhouse` did not exist.
- GREEN: the same targeted command passed 3 tests.
- Full suite: `pnpm --filter @gaming/crawler test` passed 11 tests across 5 Node test files, 3 Worker integration files, and 1 Wrangler pool file.
- Typecheck: `pnpm --filter @gaming/crawler typecheck` passed.

## Coverage

- Fixture contains one remote gameplay role and one onsite role.
- Greenhouse fields map to locked `JobDraft` fields.
- Remote location maps to `remote`; Los Angeles maps to `onsite`.
- `source` is `career_page`.
- `applyUrl` and `sourceUrl` use the absolute Greenhouse job URL.
- Career dispatch loads the company through injected `getById(id)` and fetches through injected `fetchImpl`.
- Dispatcher supports only `ats_type: "greenhouse"`.

## Constraints

- No live HTTP, Lever, JSON-LD, Hitmarker, stealth, schema, Wrangler, account, or deployment changes.
- No dependency changes.

## Concern

The Worker-pool portion of the full test command emitted pre-existing Vitest/workerd environment-teardown warnings while still exiting 0 with all tests passing.

## QA Data Important Fix

- Routed Greenhouse board requests through `fetchPublicText` with the product User-Agent.
- Added coverage for GET headers and 429 `RateLimitedError` propagation, including `Retry-After`.

### Targeted test evidence

Command:

```text
pnpm --dir apps/crawler exec vitest run --config vitest.node.config.ts src/sources/greenhouse.test.ts
```

Output:

```text
RUN  v4.1.0 C:/Users/dotat/Desktop/Saas JOBS/apps/crawler

✓ src/sources/greenhouse.test.ts > parseGreenhouseBoard > maps Greenhouse jobs to career-page drafts
✓ src/sources/greenhouse.test.ts > parseGreenhouseBoard > does not classify an onsite location as remote
✓ src/sources/greenhouse.test.ts > CareerJobSource > dispatches a career message to Greenhouse with injected fetch
✓ src/sources/greenhouse.test.ts > fetchGreenhouseBoard > propagates RateLimitedError for a 429 response

Test Files  1 passed (1)
Tests       4 passed (4)
Exit code: 0
```

### Full crawler test evidence

Command:

```text
pnpm --filter @gaming/crawler test
```

Output:

```text
> @gaming/crawler@0.0.0 test
> vitest run --config vitest.wrangler.config.ts && vitest run --config vitest.config.ts && vitest run --config vitest.node.config.ts

Test Files  1 passed (1)
Tests       3 passed (3)

Test Files  3 passed (3)
Tests       3 passed (3)

Test Files  5 passed (5)
Tests       12 passed (12)
Exit code: 0
```
