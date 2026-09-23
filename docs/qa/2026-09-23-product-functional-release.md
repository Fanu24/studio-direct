# Functional product release — 23 September 2026

The September product specification, including the owner's later decisions, is implemented and enabled on the [Nodework preview](https://nodework-web.xavier-ff2.workers.dev). Visual design and commercial activation remain separate work. Stripe remains in sandbox.

## Delivered version

- Application commit: `1d81549346b09a007f77c87933032d25b3df2d8c` on `feat/auth-payments-source-discovery`, [PR #2](https://github.com/Fanu24/studio-direct/pull/2). The subsequent documentation commit does not change the deployed application.
- [Linux CI](https://github.com/Fanu24/studio-direct/actions/runs/35860507714): successful type checks, portable Node/Workers suites, fresh database/reference upgrade, Chromium posting form, OpenNext build, Worker bundling and local setup.
- Cloudflare web version: `524212cd-15fa-45d3-b779-1d9278b5618f`.
- Cloudflare crawler version: `90521b8c-5996-4aa3-8b04-b423aeec9130`.
- D1 additive migrations through `0032_product_operations.sql`; foreign-key check clean. Existing account/order/reference records preserved. A Time Travel bookmark was recorded before schema changes.
- All 14 `PRODUCT_*` flags enabled; `EARLY_ACCESS_FREE_FIRST_POST` disabled. Matching internal service secrets installed on both Workers.
- `SOCIAL_DELIVERY_ENABLED=false` and `NEWSLETTER_DELIVERY_ENABLED=false`.

## Functional scope

Candidate profiles, password/magic-link/Google access, private CVs, immutable application snapshots, application stages and Early Access are implemented. Company plans include posting credits, seats, perks, explicit overage purchases and subscription/refund reconciliation. Premium, independent manual identity verification, daily Featured Member, matching, shortlists and invitation quotas are implemented.

Reviews require a Premium candidate and approved proof of work for a claimed company. Activated companies can read all reviews, respond to their own and report abuse. Talent Search uses canonical skills, languages, country/area and UTC eligibility, privacy controls and access limits. Confidential posts stay outside every public distribution surface.

Daily ATS integrations support Greenhouse, Lever and Ashby, including content updates, closure and unpaid overage drafts. Social queues, subscribed newsletter delivery, taxonomy moderation, company/review verification and support workflows are implemented. Salary insights use external scraped vacancies exclusively; the initialized preview contains 0 publishable salary cohorts. History accumulates from real daily observations.

The current public catalogue contains 685 external vacancies and 82 salary-text bands. Only one currently has sufficiently explicit currency/period data for the new statistics. The sampled missing periods are not inferred from the size of the salary or unrelated words such as “annual transactions”; cohorts stay unpublished until five valid observations are available. The crawler health endpoint also returned HTTP 200 after deployment.

## Final preview check

17 read-only route checks passed: public rendering, pricing/posting, candidate/employer login, featured/salaries, fully permissive robots, sitemap and anonymous access guards for private pages, export and internal operations. The salary initialization completed against remote D1. No new checkout, fake candidate/job/review/application or outgoing marketing message was created for this release.

Tests exercise business transactions and provider responses locally/CI. This is not a claim that every provider journey was manually repeated online. Earlier Google/magic-link and sandbox checkout/refund evidence remains recorded in the previous deployment reports.

## Remaining owner configuration

- Visual design and any further product changes the owner chooses.
- Real social publishing accounts/tokens and deliberate activation of marketing delivery. Newsletter consent and queues are present; sending is off.
- Company/domain/commercial information and Stripe live activation only when the owner requests commercial launch.
- Actual staff must approve company ownership/work/identity evidence and answer support requests; software records and enforces the workflow and response target.

Detailed entry points, background jobs and connection requirements: [product operations](../product-v2-operations.md). Private deployment receipts are retained locally under `.wrangler/deploy/product-functions-1d81549/`; secrets are excluded from Git. The Windows extraction-path failure and the first expired-auth lookup happened before remote writes; their receipts were retained, and deployment resumed after those causes were corrected.
