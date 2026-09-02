# Task 8 report: OpenNext homepage stub

## TDD

- RED: Added `apps/web/lib/copy.test.ts` first and ran
  `pnpm --filter @gaming/web test`. The run failed because `./copy` did not
  exist, which was the expected missing-feature failure.
- GREEN: Added `HOMEPAGE_CLAIM` with the approved exact string. The filtered
  test run then passed 2 test files and 5 tests, including the exact-copy and
  prohibited-claim assertions.

## Implementation

- Added the App Router layout and force-dynamic homepage under `apps/web/app/`.
- The homepage renders the `Studio Direct` h1 and `HOMEPAGE_CLAIM`.
- Added minimal Next.js and OpenNext Cloudflare configuration.
- Added Next.js, React, OpenNext, and React type dependencies and scripts.
- Removed the unused `apps/web/lib/placeholder.ts`.
- Did not change `wrangler.jsonc` or add routes or queue consumers.

## Verification

- `pnpm --filter @gaming/web test`: PASS (2 files, 5 tests).
- `pnpm --filter @gaming/web typecheck`: PASS.
- `pnpm --filter @gaming/web build`: PASS; `/` is reported as dynamic.
- `pnpm --filter @gaming/web dev` plus an HTTP request to `/`: HTTP 200;
  response HTML contained `<h1>Studio Direct</h1>` and the exact approved
  claim. The development server was stopped afterward.
- `pnpm --filter @gaming/web cf:build`: BLOCKED on native Windows because
  Next.js standalone output could not create pnpm dependency symlinks
  (`EPERM`). OpenNext itself warns that WSL is recommended. Run this command
  in WSL or with Windows Developer Mode/symlink permission to verify the
  adapter bundle.
