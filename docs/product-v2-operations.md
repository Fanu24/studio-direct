# Nodework product update: functional handoff

Implemented and enabled on the Cloudflare preview on 23 September. See the [release and verification record](qa/2026-09-23-product-functional-release.md) for the exact version and operational limits.

The September owner decisions in `PLAN.md` override the original specification. Visual design and live commercial launch remain separate work. All new purchases require Stripe sandbox keys.

## Implemented surfaces

| Area | Entry points and behavior |
| --- | --- |
| Candidate account | `/login`, `/reset-password`, `/account/profile`, `/account/privacy`: verified password, magic link and Google; canonical skills/languages/location; photo and private PDF CV; separate public, discovery and featured preferences; no wallet. |
| Applications | Native email applications and authenticated redirect snapshots; anonymous redirect events; one application per candidate/job; immutable submitted CV/profile; bulk stages and notes; annual-plan CSV and matching; Premium progress history. Aggregated jobs stay external. |
| Early Access | Public listing, server-enforced 12-hour application window, Premium/invitation bypass, countdown and opening reminder. External application destinations are withheld while locked. |
| Company plans | `/pricing`, `/employer`, `/employer/team`, `/employer/billing`: four annual plans, atomic credit reservations/ledger, plan periods, seats, bumps, included pins, hidden salaries, explicit extra-post purchases, renewals/cancellation/refunds. An ownership claim still needs verification after payment. |
| Candidate purchases | `/account/premium`, `/account/verification`, `/account/billing`: monthly/yearly Premium, independent manual identity verification, evidence restricted to owner/admin, billing recovery and invoices. |
| Featured member | Daily UTC selection with 90/30-day exclusion, homepage/job widgets, search placement, public profile badge, `/featured` history, private next-day view comparison and admin override. |
| Reviews | Company page and `/account/reviews`: Premium candidates only, claimed companies only, proof of completed work before publication, 12-month frequency/30-day editing, reports and audited moderation. Activated company accounts can read all reviews and respond to their own regardless of annual tier. |
| Salary insights | `/salaries/{role}/{country-or-remote}`: external scraped vacancies only, canonical roles, stated compensation, daily FX normalization, minimum five observations, quartiles/median/distributions and accumulated history. Native and managed ATS jobs are excluded. History grows from actual daily observations. |
| Talent | `/dashboard/talent`, `/employer/shortlist`: Platinum filters and job matching, Scale/Platinum daily 20-person shortlist, invitation quotas/packs, rate limits/access logs, discovery privacy and company profile views. Public social links remain allowed; email/CV are never Talent Search results. |
| Distribution | Leased X/LinkedIn/Telegram outbox with retries and uncertain-outcome reconciliation; recruiter delivery links; weekly subscribed newsletter with public jobs, entitled featured jobs, featured candidate and salary insight; unsubscribe and per-event preferences. |
| Company integrations | `/employer/integrations`: daily Greenhouse/Lever/Ashby import, canonical defaults, incomplete drafts, automatic included publication, explicit checkout for extras, updates and closure after a complete upstream fetch. Public aggregation does not reimport managed/confidential company feeds. |
| Confidential hiring | Authenticated candidate access through `/private-jobs/{id}`, optional sector in place of company name; excluded from listings, search, API, sitemap, social and newsletters. Owners retain management access. |
| Operations | `/admin/product`, `/admin/references`, `/account/support`: review/identity evidence, taxonomy requests/merges, feature flags, roles, featured overrides, distribution reconciliation, support replies and audit. Platinum first-response target is tracked as 24 weekday hours UTC, excluding weekends; staff must actually answer. |

## Deployment

1. Apply additive migrations **0026–0032** before the new web/crawler code. Use the existing Nodework preview bindings, not the historical `gaming-*` resources in the default development templates.
2. Deploy the exact successful Linux CI artifacts. Preserve private R2, D1, email, Google and sandbox Stripe credentials.
3. Bind crawler `PRODUCT_WEB` to the deployed web Worker. Install the same random `PRODUCT_INTERNAL_SECRET` (32+ characters) on both Workers. The internal endpoint rejects requests without that secret.
4. Activate the `PRODUCT_*` flags in D1 after deployment. `EARLY_ACCESS_FREE_FIRST_POST` is an optional promotion and stays off. Dependencies are enforced by `effectiveProductFlags`.
5. Keep `SOCIAL_DELIVERY_ENABLED=false` and `NEWSLETTER_DELIVERY_ENABLED=false` until the owner configures outbound publication. Queues, consent and admin status are usable while delivery is off. Never pretend an unconfigured channel has delivered.

The five-minute cron processes product operations and notifications; the six-hour cron, which also runs at 00:00 UTC, queues due daily ATS, salary and shortlist work. Daily selection/statistics have idempotency records. Public career discovery remains a separate existing pipeline.

New marketing credentials, all optional until publication is enabled: `X_USER_ACCESS_TOKEN` with user publishing permission, `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_AUTHOR_URN`, a supported `LINKEDIN_VERSION`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. The existing verified email sender delivers opted-in newsletters. Use Worker secrets, never committed values.

For an uncertain social outcome, inspect the provider first and then mark delivered, retry a confirmed missing post or cancel in `/admin/product`. The code does not blindly resend requests whose remote outcome is unknown.

## Scope of verification

Tests exercise real SQLite migrations and business transactions with simulated external provider responses. Coverage includes plan credits/seats, applications/snapshots, Early Access, search and invitations, private content exclusion, manual work verification, salary provenance, refunds/subscriptions, and ATS publication/update/closure. The matching function has ten score cases plus boundary checks. A full existing suite is followed only by repairs of its failing compatibility fixtures; no extra browser checkout campaign is required.

Provider credentials and operational activation are distinct from implemented functionality. The deployment and QA receipts record which version is actually online. A design model should receive the repository, `PLAN.md`, this document and the latest deployment receipt, and preserve the access/payment rules while changing presentation.
