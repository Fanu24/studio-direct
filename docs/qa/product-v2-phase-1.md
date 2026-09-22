# Product v2 — phase 1, work in progress

This is an intermediate verification record. Phase 1 is **not accepted** and no new flag or migration is enabled online. The target specification and owner overrides are in PLAN.md.

## Implemented locally

- Shared USD pricing (including the one-time company claim), inherited plan entitlement definitions, opt-in addons, feature dependencies and rollback switches. Legacy orders retain their historical configuration.
- 476 skills, 48 separate benefits, 86 role definitions, 250 countries/territories, 34,146 canonical cities, 183 languages with native names, and 270 deduplicated eligibility choices. Reference-only importer, provenance hashes and licenses are retained in packages/db/reference.
- Additive migrations 0024 and 0025, with new native posting fields and paid company claim/account records. No remote migration applied.
- Server-side native form validation, canonical reference lookups, geographic expansion, sanitized rich text and plain-text descriptions.
- Company claim test checkout, private order/status page, signed webhook fulfillment, recovery from Stripe, manual ownership approval and refund revocation. A claim creates no job/credit. Payment creates account access; ownership verification grants company-page control separately.
- A company claim entitlement is included by the shared fulfillment helper for job/annual-plan purchases. These new purchase flows are still being connected; do not interpret the helper tests as completed annual-plan checkout.
- Product-aware employer activation blocks free onboarding when the new posting flag is enabled, preserves prior paid legacy access and retains old free records without granting new paid permissions.
- New job form component is under construction and is not mounted on the public posting page. Its checkout endpoint is not implemented yet.

## Verification evidence

Bounded local run: work/control/product-foundation-check-01/receipt.json (outside the repository). All portable Node suites and TypeScript checks for shared, DB and web completed with exit 0. Exact test counts follow below. This run preceded the latest form/editor changes and the standalone-claim checkout concurrency fix; follow-up checks passed: 14 claim/HTTP tests, web TypeScript, and the isolated upgrade/reference import check. The new form remains unmounted and still requires a browser journey.

A separate HTTP workflow test exercises checkout creation using a fake Stripe transport, a correctly signed paid webhook, admin-only ownership approval, and a signed refund. This proves server integration, **not** a real Stripe sandbox payment or a browser journey. Test fixtures use in-memory SQLite and never create remote activity.

- Tests  193 passed (193)
- Duration  2.63s (transform 339ms, setup 0ms, collect 1.40s, tests 84ms, environment 2ms, prepare 1.28s)
- Tests  18 passed (18)
- Duration  904ms (transform 160ms, setup 0ms, collect 604ms, tests 215ms, environment 1ms, prepare 240ms)
- Tests  610 passed | 1 skipped (611)
- Duration  23.24s (transform 1.83s, setup 0ms, collect 12.91s, tests 10.19s, environment 16ms, prepare 7.98s)
- Tests  107 passed (107)
- Duration  3.89s (transform 959ms, setup 0ms, import 2.69s, tests 1.06s, environment 1ms)

## Required before phase acceptance

- Complete v2 native checkout/publication, dashboard editing, price breakdown and coupon handling; connect the new form behind its flag. Backfill included claims for legacy paid job owners and integrate claim creation on legacy credit redemption before enabling the new claim offer.
- Apply public salary/visibility rules across every reader; validate pin order, crypto-pay filter/badge/API, and legacy-job rendering.
- Finish company claim browser QA, retry/expiration and concurrent ownership cases; keep Stripe in test mode.
- Isolated SQLite upgrade from 0023 and two full reference imports passed (34,146 cities); old jobs/prices were retained, no flags enabled, foreign keys valid. Confirm the same import in the intended D1 environment before activation.
- Browser end-to-end tests for the new form, required-field blur errors, canonical choices, checkout and company claim.
- Build the Workers artifacts through the existing Linux CI, apply reviewed migrations/reference data to preview, and activate only accepted functionality. No final graphical redesign in this phase.

## Rollback

Disable PRODUCT_POSTING_V2 to disable dependent flags; do not remove financial/ownership audit records. Signed webhooks for existing purchases still need to be processed. Keep the old route/form/order readers for historical orders and credits. No destructive down migration is authorized.
