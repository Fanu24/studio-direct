# Product v2 — phase 1, work in progress

Phase 1 is **not fully accepted**. Application commit `d586f47` is deployed on the Cloudflare preview after successful CI35768135335. Migrations0024–0025 and reference imports are applied. Posting/claim flags were enabled for one sandbox payment journey and restored OFF afterward. Stripe remains in test mode. The owner explicitly stopped further testing after this payment; do not launch another QA campaign automatically. This record does not claim completion of the other six phases in PLAN.md.

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

- Browser attempt 08 passed the posting and standalone claim journeys, including both login/draft recovery paths. Claim status/reconciliation remain available when new claim sales are disabled; 15 claim business/HTTP tests passed, including that rollback case.
- CI 35765179016 for 90870c9 passed all Node suites and typechecks, then failed the old Workers scheduler assertion that cron never calls fetch. It now explicitly mocks and verifies the one daily FX call and queued source dispatch; the next CI run must confirm this fix.
- CI 35765994574 for 7ec7b69 passed all Node/Workers tests, types, upgrade/reference checks and the Chromium journeys. Its production build failed inside next/font/google parsing an upstream font URL. The existing three font families are now loaded from pinned, hash-verified local originals with their licenses, removing that network dependency; no visual redesign. The next build must confirm the correction.
- Additional salary provenance audit fixed legacy checkout/credit publication to explicitly mark those jobs native. Manual records are also excluded defensively from scraped cohorts and salary-page job lists. The 57 targeted job/query/payment tests and web typecheck passed after this correction.
- CI 35767263257 for ebacac2 succeeded, including the Linux production build and deployable Worker artifacts. The font correction is verified.
- Checkout recovery now resumes only the stored Stripe session, sends completed orders to their status page and permits a new submission after verified expiry. Browser attempt 09 passed explicit expired-checkout retries with retained form/claim fields and a new order ID; 24 business/HTTP recovery tests and web types passed. A subsequent build must include these follow-up fixes.

## Deployed payment and stop instruction

- Exact application CI35768135335 succeeded. Web version5df60161-42a5-4dd0-90b1-9bf7f9f1b21b; crawler versioncec12174-a077-4b9f-897d-b756f1782f27. Both use the tested Linux bundles. D1 references/counts and foreign keys verified before deployment.
- Preview home, salary page, posting page, robots and crawler health succeeded; anonymous account export remains unauthorized. Salary page expressly excludes native Nodework jobs.
- Browser completed a real Stripe **sandbox** Checkout for USD219: base post129 + hidden salary25 + three-day pin65. Verified return page and D1 order paid, one native job published, company access and pending claim created. No ownership approval.
- Order `a2c3a254-ad2d-4b4e-a8c1-b2f8271b4e29` was fully refunded in sandbox. The signed refund delivery left the order refunded, job unlisted, entitlement refunded and claim revoked. Temporary QA company hidden and the QA-only employer profile removed; original user preserved. Financial audit history retained.
- Receipts are stored in ignored `.wrangler/deploy/product-v2-public/`. No real charge and no synthetic public activity left visible. Both product flags were restored to their previous OFF state.
- Owner instruction: finish the open payment test and stop; no further tests, no standalone claim payment and no new implementation followed that instruction. The existing browser receipt now says refunded.

## Outstanding, without automatic retesting

- Standalone paid claim has local business/HTTP/browser evidence, but no real provider journey for the new offer. Do not call it remotely tested.
- Canonical filter/location coverage and imported salary provenance/units remain to review during the planned product work. A company-picker dropdown remained visible after selecting a new company in the remote journey; the payment still completed, and no extra fix/test cycle was started after the owner's stop.
- Candidate profiles, annual plans, Premium, reviews, salary-history expansion, talent/communications and company ATS/confidential features remain later phases. Final design and live commercial launch are deferred.

## Rollback

Disable PRODUCT_POSTING_V2 and its dependent sales flags. Preserve financial/claim history and continue signed fulfillment/reversal processing for existing purchases. Existing native editing and order status remain available. Never run a destructive down migration automatically.
