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
