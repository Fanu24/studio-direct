# Nodework product differentiation plan

Status: repository inventory and product clarifications complete; phase 1 implementation in progress. This is a plan, not a completion report.

Source: [September 2026 specification](docs/specs/nodework-product-update-2026-09.md), supplied as `Workin aggiornamento.md`. SHA-256: `6a68f3f43b1c5bf360218467e46c9368c7d2ad8c18f39cfe9ce544ccd7e40ae2`.

The owner's conversation instructions take precedence over the attached specification. In particular, clarify material product ambiguities before implementation, despite the document's instruction to proceed without clarification. This specification now supersedes competitor parity as the target for the changed features.

## Owner decisions and operating constraints

- Confirmed: social links and GitHub remain visible normally; email addresses and direct contact details must not be exposed in public profiles or Talent Search. Remove the wallet feature entirely, including UI, fields, exports and completeness requirements. Portfolio remains part of the original profile links; contact-detail checks also apply to public free text. Private CV delivery to an employer for an application is a separate, authenticated workflow.
- Confirmed: company accounts can read ALL company reviews. They can reply to reviews of their own company and report false reviews without an annual/Premium plan. A company account activates after buying an annual plan, buying a job post, or purchasing a standalone company-page claim for USD 150. The claim is included with a job post. Treat the standalone claim as a one-time purchase; no recurring claim fee was requested. Selecting a company or completing a free signup does not activate the account. Central pricing gains `companyClaim: 15000`.
- Confirmed: only Premium candidates may submit company reviews, only for claimed company pages, and evidence that they actually worked for the company must be verified before publication. Companies cannot write reviews. An interview alone is insufficient. Use private evidence upload and manual admin review initially; evidence is not disclosed to company accounts or the public. Anonymous-review identity remains internal. Premium expiry does not erase a previously accepted review.
- Confirmed: ATS overages remain drafts until the employer explicitly approves payment. No automatic overage charges. Explain this before enabling the integration and near the included-credit allowance via an info tooltip supporting hover, keyboard focus and mobile tap. Warn before credits run out and show pending drafts in the dashboard.
- Confirmed (latest clarification): salary pages and market salary statistics use external scraped vacancies only. Native job posts and company-managed native ATS posts never contribute, whether their salary is public or hidden. This overrides section 4.3 and the earlier aggregate-use wording. Native salary filters still use the stored range without exposing a hidden range.
- Stripe stays in test mode. Design and visual identity remain a separate phase; implement the functional and accessible controls required by the specification.
- Existing `robots.txt` remains fully permissive, with no `Disallow` rules. Authenticated areas and confidential content still require authorization. Profile-specific indexing preferences and confidential `noindex` are distinct from crawl rules.
- Use the `agent-deployment` skill automatically for expected long-running commands and authorized delegation. Read its waiting reference and establish a completion route before launching a long command; do not create an agent merely to wait. The skill itself does not authorize delegation.
- No new real user, job, review, CV, purchase, social post or newsletter is created merely to make the preview look populated. Reference taxonomies and legitimate geographic datasets are product data, not fabricated activity.

## Verified repository inventory

| Area | Current implementation | Integration approach |
| --- | --- | --- |
| Runtime | pnpm monorepo; Next.js 15 App Router and React 19 in `apps/web`; OpenNext on Cloudflare Workers | Extend the existing app and preserve deployed bindings. |
| Data | D1/SQLite; Drizzle definitions in `packages/db/src/schema.ts`, SQL migrations 0001–0023; much runtime code uses prepared D1 SQL via `apps/web/lib/platform.ts` | Add migrations and keep schema, SQL queries, test databases and exports aligned. |
| Auth | Better Auth in `apps/web/lib/auth/index.ts`; Google and magic links, shared users with candidate/employer portals | Add verified email/password and recovery without removing existing login methods or duplicating users. |
| Job posting | `app/post-web3-job/page.tsx`, `_components/listing-form.tsx`, `description-editor.tsx`, `lib/billing/listing-input.ts`, `listing-catalog.ts` | Replace new-post form/pricing behind flags while preserving historical order snapshots. |
| Billing | Stripe Checkout/webhooks; employer orders, bundle credits, recurring listings, refunds and reconciliation | Reuse signature verification and event idempotency; add company and candidate subscription entitlements. |
| Candidates | `profiles`, `experience_entries`, `profile_skills`, `job_applications`; profile/privacy/CV and candidate dashboard already exist | Extend these tables and workflows rather than create a second candidate database. |
| Companies | Existing company directory, employer onboarding and `employer_accounts` keyed by user | Add verified company ownership, membership and company-scoped billing. |
| Discovery | Separate crawler Worker; Greenhouse, Lever, Ashby, career JSON-LD, source catalog | Keep public aggregation separate from company-authorized paid ATS integrations. |
| Scheduling | `apps/crawler/src/index.ts`, `cron.ts`, queues/KV; current 5-minute operations and 6-hour collection | Add bounded product jobs, daily idempotency and a midnight UTC trigger without duplicating the source sweep. |
| Email | Cloudflare Email Sending; shared `notification_outbox` and `packages/shared/src/notifications.ts` | Extend the existing delivery/retry mechanism with typed events, preferences and deduplication. |
| Public pages | `lib/jobs/queries.ts`, `job-row.tsx`, `job-card.tsx`, job details, public API, sitemap, company and salary pages | Centralize visibility/projection rules so all surfaces apply the same policy. |
| Validation/deploy | Vitest Node + Workers suites; CI builds Linux OpenNext artifacts; explicit `wrangler.preview.jsonc` configs | Phase-specific business and end-to-end checks, then the existing build/deployment process. |

## Conflicts and chosen technical resolutions

1. The specification says candidate profiles and several cross-cutting functions do not exist. They do. Preserve their IDs, history and private files and extend them.
2. `/dashboard` currently serves candidates, while the specification uses it for employers. Introduce `/account/*` candidate routes, retain old candidate links, keep `/employer/*` working, and use role-aware routing with an explicit switch for users holding both roles. Never infer employer authorization from a URL alone.
3. `/companies/{slug}`, `/jobs/{slug}` and `/talent/{id}` already have behavior. Add the new views and handle resolution without breaking existing slugs/IDs, canonical job URLs (`/{slug}/{id}`), saved links or external referrals.
4. Existing `jobs.source` identifies the import provider (`career_page`, `manual`, `ats`, etc.). Preserve it and add an explicit commercial origin/distribution classification. A public ATS source remains aggregated; only a verified company integration can create a credit-consuming native ATS post.
5. Existing `job_locations`, `benefits`, `job_benefits`, profile skills and applications must not be recreated under conflicting names. Add canonical reference tables and nullable associations, migrate known mappings and retain original legacy data.
6. The requirement to remove old skill fields conflicts with additive, reversible migrations. Stop using them in the new form, backfill canonical associations, and retain deprecated storage until a separately reviewed cleanup. Rollback disables the feature and restores the previous reader rather than deleting user data.
7. The pricing example omits inherited Scale/Platinum perks that the table explicitly includes. The table is authoritative except where superseded by the owner's clarifications (notably company review access/replies); each plan will have complete, explicit entitlements. Preserve historical prices/orders and legacy bundle redemption; remove old upsells from new purchases when the new offer is enabled.
8. Prices currently live in multiple modules and some metadata text. Create one shared `pricing.ts` for active prices, limits and legacy offer configuration. Components, templates, Stripe payloads and tests consume it; historical charged amounts remain immutable database snapshots. Do not silently reprice existing Stripe subscriptions.
9. A paid Premium subscription is not identity verification. Only a completed verification grants `verified_at`; adjust the Early Access tooltip so it does not falsely promise that every paying member is identity-verified. Retain its intended explanation and accessible interactions.
10. The Early Access button cannot be a native disabled button if it must open a bubble. Use an accessible gated action with `aria-disabled` behavior and enforce access on the server. Use timestamps for automatic expiry; notifications may run on the next scheduler tick.
11. Missing salary/geo/skill data in existing imported jobs must not make them disappear or pass invented validation. Strict new form rules apply to new native posts; old/aggregated records get null-safe views and only reliable mappings enter statistics.
12. Hidden salary must not leak through JSON-LD, APIs, HTML payloads, feeds, social messages or per-job comparison percentages. Exclude the per-job percentage box for hidden salaries; exclude native ranges entirely from market salary aggregates. Only reliable externally scraped salaries enter aggregates, with a minimum cohort of five.
13. Profile public/discoverable defaults apply to new onboarding with visible controls. Never silently publish an existing private profile or override an existing opt-out. Contact visibility follows the owner's clarification above.
14. Free candidates see basic application status; Premium gets detailed stage notifications. Billing/security/consent notifications remain available regardless of subscription. Review access, submission and company replies now follow the confirmed owner rules above, superseding sections 2.4, 2.5, 3.1, 3.2 and 4.2 where they conflict. Every review requires verified work evidence; the optional 48-hour publication timer must never bypass that approval. Company reporting creates a moderation task rather than granting the company a deletion/hiding action.
15. Confidential means authenticated candidate access via invitations or direct links as specified, not a guessable public page with only `noindex`. Public API, sitemap, cached payloads, related-job widgets, feeds, crawler exports, social and newsletter queries must exclude it.
16. The former separate recruiter database product conflicts with Platinum-only Talent Search and invitation-based contact. Retire new sales/export of that product under the new offer flag, preserve order/audit history, and implement the specified per-job application CSV separately. Do not repurpose consent to an application as public-profile consent.
17. Paid features must not be purchasable before their delivery is enabled. Phase 1 can ship hide-salary and pin; Early Access sales remain off until phase 2 enforcement is ready, and confidential sales remain off until phase 7 visibility checks pass.
18. Keep `Nodework` as the product name: it is the name throughout the specification. The attachment filename does not authorize a rebrand.
19. Current posting requires a completed employer account before Checkout. Replace this for first purchases with an authenticated buyer and a private pending-company/post draft. Activate verified purchase entitlements, company membership and the employer account only on a validated paid webhook or equivalent paid-order reconciliation. An unpaid, canceled or failed checkout must not unlock company review access. Company-directory records imported by the crawler are not purchased company accounts. Verify ownership independently of payment before granting control over an existing company's page or review replies.

## Cross-phase architecture and data strategy

- Shared pure modules in `packages/shared/src/product/`: `pricing.ts`, `flags.ts`, `eligibility.ts`, `match-score.ts`, `profile-completeness.ts` and reference types. Export explicitly from the shared package.
- Server policies in `apps/web/lib/product/`: feature resolution, company entitlements, safe public job/profile projections, quota and credit reservations. Use the same policies in web handlers and background tasks.
- Flags proposed: `PRODUCT_POSTING_V2`, `PRODUCT_PROFILES_V2`, `PRODUCT_EARLY_ACCESS`, `PRODUCT_COMPANY_PLANS`, `PRODUCT_CANDIDATE_PREMIUM`, `PRODUCT_FEATURED_MEMBERS`, `PRODUCT_REVIEWS`, `PRODUCT_SALARY_INSIGHTS`, `PRODUCT_TALENT_SEARCH`, `PRODUCT_SOCIAL_SHARING`, `PRODUCT_NEWSLETTER`, `PRODUCT_CONFIDENTIAL_POSTS`, `PRODUCT_ATS_INTEGRATIONS`; `EARLY_ACCESS_FREE_FIRST_POST=false`. Validate dependencies and enforce flags on the server, not just the UI.
- Migration numbers below are proposed starting at 0024; split only when needed, with a recorded map. Each phase includes fresh-database and upgrade checks. Keep rollback instructions and compatibility readers; never run a destructive down migration automatically against deployed user data.
- Billing and quotas require atomic reservations, unique idempotency keys, retry-safe fulfillment and release on failed/expired checkout. Test duplicate/out-of-order Stripe events, two simultaneous publications, two seat invitations and two quota consumers.
- All public UI and code comments are English. Reuse the current editor, sanitization, email, form and tooltip primitives where practical.
- External dependencies: select a standardized city dataset and reliable FX source with recorded provenance; do not fabricate data or assume unknown currencies/periods. Social credentials/accounts will be needed before real delivery checks. Keep integration flags off until connected and verified; no silent fallback that claims a message was posted.

## Phase 1 — Foundations, taxonomies, posting and pay-as-you-go pricing

Specification: **2.1, 2.2, 4.4, 4.6, 7**, foundational **5, 6, 9** constraints.

Existing touchpoints: `app/post-web3-job/page.tsx`, `_components/listing-form.tsx`, `listing-extras.tsx`, `description-editor.tsx`, `lib/billing/listing-input.ts`, `listing-catalog.ts`, `employer-orders.ts`, `listing-management.ts`, `app/api/employer/{checkout,edit,redeem}/route.ts`, `lib/jobs/{queries,jsonld,public-api}.ts`, listing components and shared taxonomy modules.

New modules: shared pricing/reference types and validators; reference-data queries/endpoints; city/region/skill/language typeaheads; structured salary/eligibility components; a canonical public job projection; paid company-page claim checkout and purchase-gated employer activation. Preserve old form/order payload decoding for existing records. Claim payment creates an entitlement, not proof of company ownership: existing page control and claimed status also require verified domain/admin approval.

Migrations proposed: **0024_product_reference_data.sql** (feature flags, skills/aliases, benefits alignment and cross-taxonomy uniqueness, languages, canonical cities, regions, roles and FX); **0025_native_job_fields.sql** (structured salary, eligibility, required/preferred skills, languages, company social links, commercial origin, addons, publication/bump fields, compatible location links, pending company claims and paid account activation).

Reference-data tasks: at least 300 real skills, 40 benefits and 60 canonical roles with provenance and collision validation; ISO languages/countries, semantic region deduplication and standardized city IDs. Separate reference import from demo seeds.

Acceptance: ordered required fields, blur/submit errors, sanitized HTML and plain text; correct location/remote/time-zone conditions; limits and canonical selections; current prices and coupon totals; hidden salary redaction across public surfaces; crypto badge/filter/API; pin ordering and additive included/purchased pin duration; existing jobs still render. Unit and end-to-end checkout/form tests use the central price configuration.

## Phase 2 — Candidate profiles, applications and Early Access

Specification: **3.1, 3.4, 2.3, 2.6** (applications/stages), **4.7** (base notifications), relevant **5–6**.

Existing touchpoints: `lib/auth/{index,client,email,portals}.ts`, `app/login/*`, profile pages/actions, `lib/profile/*`, `app/talent/[id]/page.tsx`, `app/api/apply/route.ts`, `lib/jobs/{apply,candidate-applications,application-destination}.ts`, application management/CV routes, employer applications page, notification outbox.

New modules/routes: `/account/*` compatibility views; profile handles and public projection; candidate languages/links; email/password verification/reset; `InfoTooltip`; server-gated native apply/redirect endpoint; Early Access reminders; profile snapshots and stage history. No wallet field.

Migration proposed: **0026_candidate_applications_v2.sql** extending `profiles` and `job_applications`, normalized candidate relations, profile handles, application snapshots/stages, unique authenticated application keys, notification preferences and early-access subscriptions. Preserve historical anonymous records; enforce uniqueness for new authenticated submissions.

Acceptance: verified signup and existing login methods; completeness with specified weights; public/private/discoverable behavior and no contact leakage; one application per native post, Email persistence/delivery and Redirect snapshots; anonymous native redirect counting; aggregated direct application without internal records; all five button states, invited/Premium bypass, no redirect URL in any pre-expiry public payload; expiry boundary checks and retry-safe notifications. Candidate Premium entitlement reader is established here, with purchasing enabled in phase 4.

## Phase 3 — Annual company plans and core perks

Specification: **2.4** (plans/credits/duration/score/export/badge/bump/seats/pin/hide salary/analytics), **2.5, 2.6** (team/billing/company), and the owner's purchase-gated company account clarification. Review replies are available to every activated company account, independent of annual tier.

Existing touchpoints: employer account/onboarding modules, employer orders/credits/reconciliation, Stripe checkout/webhook, company queries/views, listing publication, candidate application lists and CSV, shared listing-period reconciliation.

New modules/routes: company membership/ownership; annual plan checkout and billing portal; immutable credit ledger/reservations; entitlement calculator; pure `matchScore(post, profile)`; team invitation acceptance; bump action; internal job events and analytics; company page editing and partner badges.

Migration proposed: **0027_company_plans.sql** with company members/invitations/verified ownership, plans/billing periods, plan credits/ledger, publication reservations, job event aggregates and score snapshots. Company selection alone must never claim another company's existing page; ownership requires verified domain/admin approval.

Acceptance: all four annual plans, correct charges and inherited perks; atomic credits and renewal expiry; paid extra posts; max-five active Platinum posts under concurrency and $50 over annual fair use; one bump; plan pin plus purchased pin; seat limits/Owner-only billing; CSV scoped to authorized applications; at least ten match-score cases; analytics excludes aggregate posts; lapsed plans lose future entitlements without rewriting valid historical purchase terms.

## Phase 4 — Candidate Premium, verification and featured member

Specification: **3.2, 3.3**, Premium ordering integration in **2.6/4.1**.

Existing touchpoints: `lib/billing/plans.ts`, Stripe routes, subscriptions/profile reads, home and job detail components, notification scheduler and existing profile visibility/export/deletion.

New modules/routes: monthly/annual USD candidate plans; `/account/premium` and verification request flow; manual admin verification initially (no external identity service needed to implement the allowed option); featured selection, widgets, `/featured`, and next-day personal view statistics.

Migration proposed: **0028_candidate_premium_featured.sql**, keeping existing subscriptions intact and adding provider references, verification requests/audit, profile view events and one featured record per UTC date.

Acceptance: test-mode subscribe/cancel/renew/revoke, preserved free-profile data, premium tie-break after score, verified badge only after approval, midnight selection idempotency, 90/30-day fallback, privacy changes removing a featured profile from public views, all placements and history, admin override audit and deduplicated notices. The live Talent Search placement is integrated when phase 6 exists; test its shared result-policy contract here.

## Phase 5 — Company reviews and salary insights

Specification: **4.2, 4.3** and review replies from **2.4**.

Existing touchpoints: company/job views, salary queries/rollups, canonical metadata and sitemap, admin area, scheduled work and notification outbox.

New modules/routes: review submission/edit/report/moderation and response endpoints; server-side review-text access policy; `/salaries` role/location pages; role mapping, daily FX normalization/statistics, job salary-insight component and public structured data.

Migration proposed: **0029_reviews_salary_insights.sql** with reviews/responses/reports/moderation history, private work-evidence records and their approval/rejection audit, and materialized salary stats/history. Reviewer identity remains private for anonymous reviews. Add authenticated evidence upload/download handlers using private R2 keys, restricted to the submitting candidate and authorized admins.

Acceptance: only candidate accounts with active Premium and verified email may submit, only on claimed pages; company accounts cannot review. Check account age, proven work relationship before publication, 12-month uniqueness and 30-day edit window; same-domain restriction; no company deletion privilege; server-side text access for Premium candidates and activated company accounts (text absent from blurred unauthorized HTML/JSON); all activated companies may reply to their own reviews; evidence private and admin-reviewed, including attempts to bypass approval via timers/API edits; FX-period conversion, minimum five reliable externally scraped jobs with all native/native-ATS posts excluded, truthful historical trends (no invented months), crypto share and no individual hidden-salary disclosure.

## Phase 6 — Shortlists, Talent Search, newsletter, hiring carousel and social delivery

Specification: remaining discovery/visibility perks from **2.4**, **4.1, 4.5, 4.7**, featured placement from **3.3**.

Existing touchpoints: talent search/profile access modules and logs, old recruiter views, home/job components, notification/digest modules, crawler queue routing and cron.

New modules/routes: `/dashboard/talent`, company-scoped matching and invitation APIs, daily native-job shortlist refresh, quota ledger/extra-pack checkout, five-minute hiring carousel cache, newsletter preferences/issues/features and unsubscribe, per-channel social adapters with backoff and deduplication.

Migration proposed: **0030_talent_communications.sql** with shortlists, invitations/quota ledger, richer profile view events, newsletter subscriptions/issues/features, social shares/outbox and scheduler checkpoints. Reuse the existing notification queue rather than build a second delivery system.

Acceptance: discoverability/eligibility/completeness and company authorization; premium tie-break, featured placement within applicable search privacy/filter constraints; per-job and monthly quotas under concurrency, no duplicate invites, invite bypass; public links follow the owner decision and direct contacts remain hidden; matching companies in carousel; exact Scale/Platinum newsletter entitlement; real channel delivery only after the owner connects the site's X/LinkedIn/Telegram accounts. No fabricated successful social deliveries when credentials are absent.

## Phase 7 — Confidential posts, company ATS integrations, priority support and administration

Specification: remaining **2.4** perks, **6** admin pages, final **5/9** audit.

Existing touchpoints: shared job visibility projections, all public job surfaces, crawler ATS adapters and ingestion, support requests, admin actions/routes, billing/plan entitlements and source catalog.

New modules/routes: confidential publication/delivery policy; `/dashboard/integrations`, field mapping and company-authorized sync; admin review/taxonomy/flag/featured pages and audit; Platinum support queue labels and response-deadline tracking.

Migration proposed: **0031_integrations_administration.sql** with ATS integrations/mappings/sync runs, paid import reservations, support priority metadata and administrative audit. Keep company-managed ATS imports distinguishable from public career-board aggregation.

Acceptance: confidential content absent from every public index/feed/social/newsletter/API/cache, authenticated candidate direct-link access and authorized invitations; daily Greenhouse/Lever/Ashby imports, required-field validation before paid publication, credits/fair-use enforcement, overage drafts with explicit checkout and no automatic charges; advance information tooltip and low-credit warnings; removed ATS jobs closed without canceling unrelated native posts; no republishing a confidential company-managed vacancy via the public crawler; admin controls with audit; priority queue operational without claiming that software can guarantee a human response.

## Phase gates and completion evidence

- Before each implementation phase, resolve its dependencies and remaining product decisions, review the exact existing source and record any newly found conflict here.
- For each feature, cover meaningful business boundaries with unit tests and at least one end-to-end main journey as required by the specification. Include native-vs-aggregated, authorization, visibility and monetary idempotency boundaries. Avoid tests that only copy implementation constants.
- Run migration upgrade tests against realistic old data plus fresh schema setup. Check rollback by disabling the flag with data retained. Do not treat a schema-only migration or passing unit tests as a delivered user journey.
- End each phase with relevant tests/typecheck/build passing, applied migrations in the validation environment, explicit feature activation state and a recorded deployment/acceptance result. Do not advance past failed acceptance or claim an unconnected external channel was tested.
- Record evidence in `docs/qa/product-v2-phase-N.md` with commit/version, commands, results, environment, limitations and rollback. Only widen testing after a new change or unresolved concern.
- Preserve existing unrelated advertising/crawler functions and all valid public URLs. Stripe live, final design and commercial launch remain outside this implementation's authorization.

## Progress

- [x] Entire attachment read; original snapshot saved.
- [x] Current runtime, data/auth, posting/pricing, email and scheduler inventoried.
- [x] Specification sections mapped to seven phases and migration/module targets.
- [x] Public links/direct contacts/wallet decision recorded.
- [x] Review readership/submission/proof/reply and ATS overage decisions received.
- [x] Company activation clarified: annual plan, job post, or standalone USD 150 claim; claim included with a job. Only claimed pages may receive candidate reviews; companies cannot review.
- [ ] Phase 1 accepted.
- [ ] Phase 2 accepted.
- [ ] Phase 3 accepted.
- [ ] Phase 4 accepted.
- [ ] Phase 5 accepted.
- [ ] Phase 6 accepted.
- [ ] Phase 7 accepted.

Phase 1 work is local: reference data, additive migrations, paid claims, native checkout/publication/editing, public projections, external-only salary statistics, and browser verification. No new migration or feature flag has been applied online. Stripe configuration is unchanged. See docs/qa for verification evidence as each phase is completed.
