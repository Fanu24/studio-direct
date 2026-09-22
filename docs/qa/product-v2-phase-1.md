# Product v2 — phase 1, work in progress

Phase 1 is **not accepted**. The new code follows commit `165c5b0`; no new migration or product flag has been applied to the online preview. Stripe remains in test mode. This record does not claim completion of the other six phases in PLAN.md.

## Owner clarification: market salary data

Salary pages and all market salary aggregates use **externally scraped vacancies only**. Native Nodework posts and company-managed native ATS posts are excluded, whether their salary is visible or hidden. This supersedes the attachment's suggestion to include native salaries. The original attachment is preserved unchanged. Salary filters on the general job board can still match native ranges without revealing a hidden range.

The same source restriction covers roles, locations, seniority, company averages, tag ranges, breakdowns, scheduled rollups and the jobs shown on salary pages. Minimum sample: five reliable ranges. The internal application-volume section was removed from salary pages. Low-sample salary pages are noindex; robots.txt remains permissive.

## Implemented

- Shared current/legacy pricing and feature switches; 476 skills, 48 benefits, 86 roles, 250 countries/territories, 34,146 GeoNames cities, 183 languages and 270 eligibility choices. Reference-only imports with source hashes/licenses; no synthetic public activity.
- Additive migrations 0024–0025, typed schema, canonical reference API and native form validation. Geographic/time-zone eligibility, skills/languages, city IDs, HTML sanitization and plain text are validated on the server.
- One-time USD150 claim checkout, signed payment/refund processing, company account activation, private claim status and admin ownership approval. Payment never automatically proves ownership.
- Native job checkout with server-calculated itemized prices, coupons, sandbox guard, signed webhook fulfillment and explicit Stripe reconciliation. First-time buyers need no existing employer account. The private purchase status page works while payment is pending.
- Company account activation and included pending claim after native/legacy job purchase. Upgrade backfills included claims for valid old paid jobs; legacy credit redemption grants the same entitlement without another claim charge.
- New form mounted behind PRODUCT_POSTING_V2; session-tab draft restoration across login; conditional fields, blur/submit validation and order idempotency. Legacy bundles retire for new sales when the flag is on; historical orders and credits retain their terms.
- Native job dashboard editing and reposting. Content edits preserve purchased options, publication slug, pin and expiry; unauthorized/refunded editing is rejected. Company identity changes require support review.
- Public salary redaction in list/detail/API/JSON-LD, correct currency/period JSON-LD, annual USD salary filters, native-only pin ordering/highlight expiry, crypto-pay filter/badges/API, structured public requirements, and safe links for skills without an SEO landing page.
- Whitelisted public requirements omit private application emails and hidden salary values. Private snapshots remain in billing/job detail storage.
- Daily bounded FX refresh with a database lease, validation and failure retention; rates older than seven days are excluded from conversions. Source: [ExchangeRate-API open endpoint](https://www.exchangerate-api.com/docs/free), with required attribution in the footer. No public raw-rate endpoint. A real read on 22 September validated all 20 supported currencies, observation 2026-09-22T00:02:31Z.
- Early Access and confidential options are not sold before their delivery/enforcement phases. Annual plan fulfillment is still a later phase.

## Evidence

- Last successful baseline CI: 35758756522 for 165c5b0, including portable Node/Workers tests, types, OpenNext build, Worker bundles and local setup.
- Local full run `work/control/product-foundation-check-02/receipt.json`: shared/DB/crawler passed; web had two obsolete page-test mocks fail after the page became flag-aware/asynchronous. Both tests were repaired, with additional enabled/disabled-offer checks; all seven targeted tests passed. All shared/DB/web typechecks passed in that run.
- Subsequent integration checks: 75 tests passed across public queries, native publication/privacy, signed HTTP checkout/edit/refund/reconciliation, API and job views. Web and crawler typechecks passed. Salary/posting page follow-up: 14 tests passed.
- Upgrade test 0023 → current and two complete reference imports passed again after the claim backfill and FX schema additions: original jobs/prices preserved, included legacy claim retained pending, no automatic ownership approval or feature activation, foreign keys valid.
- Browser component journey uses the actual React form with local reference/checkout fixtures. Separate HTTP integration tests use real in-memory migrations and a signed webhook with a fake Stripe transport. These are **not** a real new-offer Stripe payment or deployed D1/browser journey.
- Browser setup attempts 01–04 failed before running the form (module resolution, native Windows ancestor scanning, absent Chromium). The QA bundler now reads only workspace files using Node; Chromium is installed in ignored .wrangler/playwright. Browser attempts 05–06 exposed select-label and blur-layout issues. Attempt 07 passed after fixing them: required fields, arrangement/location/time-zone controls, canonical selections, price total, draft restoration and retained idempotency key. Receipts are outside the repo in work/control/product-browser-check-*.

## Remaining before phase acceptance

- Complete browser verification for posting and company claim, including retries/expiration and relevant ownership boundaries.
- Confirm preview D1 migrations/reference import and the native paid journey against Stripe sandbox, then the intended deployment/flag activation. No live payments or final design.
- Finish canonical filter/location coverage and review imported salary provenance/units before the phase-5 salary expansion. Unknown currencies must not be invented.
- Build/test the new working tree on Linux CI. Do not deploy partial artifacts from an older commit.

## Rollback

Disable PRODUCT_POSTING_V2 and its dependent sales flags. Preserve financial/claim history and continue signed fulfillment/reversal processing for existing purchases. Existing native editing and order status remain available. Never run a destructive down migration automatically.
