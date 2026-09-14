# Employer-paid listings: the listing pays, not the candidate

14 September 2026. Replaces the candidate subscription introduced in
`2026-09-02-studio-direct-v1.md`. Follows the lean structure work
(`2026-09-10-lean-web3-structure-design.md`).

## Why

The user's instruction: *"prendi i pagamenti come riferimento da web3.career,
quindi non paga l'utente ma il listing, copia il loro listing e il prezzario,
sistema anche eventuale D1 per il listing."*

Today the site charges the wrong side. `lib/billing/plans.ts` sells candidates
a EUR 9 / month or EUR 59 / year subscription whose only real benefit is
unlimited "unlocks" of apply URLs on `hidden_from_linkedin` jobs, capped at
`FREE_UNLOCKS_PER_WEEK = 5` otherwise. Employers, meanwhile, cannot buy
anything at all: `/post-web3-job`, `/post-web3-job/bundle` and `/ads` are
honest placeholder pages that say, in as many words, that checkout is not
built.

The reference board monetises the opposite way, and so will we. Candidates pay
nothing, ever. Employers pay per listing.

`STRIPE_ENABLED` has been the string `"false"` in `apps/web/wrangler.jsonc`
since launch and the pricing page hides the checkout form entirely while it is
false, so **no candidate has ever been charged**. There is no migration of live
subscribers to plan for, and no refunds to issue. That is what makes removing
the candidate product cheap.

## The reference prices

Read on 2026-09-14 out of web3.career's own page source, not estimated. The
single-post calculator is in `calculateJobPrice(options)` on
`https://web3.career/post-web3-job`; the volume ladder is the `discount` object
on `https://web3.career/post-web3-job/bundle`.

```js
let price = 299;
const stickyPrice1 = 49;   const stickyPrice3  = 99;   const stickyPrice7 = 149;
const stickyPrice14 = 199; const stickyPrice30 = 299;
const highlightStd = 99;   const highlightCstm = 149;
const logoPrice = 49;      const supportPrice  = 99;
```

Volume ladder, posts to discount: 2 -> 20%, 4 -> 29%, 6 -> 30%, then one point
per two posts up to 30 -> 42%, continuing to a floor of 40 posts -> 55%.
Bundled posts are "valid for 24 months".

Two things about their page we are deliberately **not** copying:

- **The view multipliers.** Every add-on row carries a badge: "3x more views",
  "6x more views", "12x more views", "24x more views", "1.5x more views",
  "2x more views". No basis is published for any of them. This project has
  refused unverifiable figures throughout - the `/ads` page currently says, in
  its own copy, that audience numbers will not be published "until we have
  verified numbers worth standing behind". Copying the multipliers would
  contradict a promise already on the site. We copy the prices and write our
  own description of what each add-on mechanically does.
- **The pre-checked add-ons.** Their form opens with 7-day sticky and
  auto-renew already selected, so the default cart is $448, not $299. Ours
  opens at $299 with nothing selected and updates the total as options are
  chosen.

## Decisions taken

Asked and answered by the user before this spec was written:

1. **Currency: USD, their exact numbers.** $299 base, the add-on ladder above.
   Not converted to EUR.
2. **Scope: everything.** Single post, add-ons, bundles with a credit ledger,
   coupons, and the schema underneath all of it.
3. **Publishing: auto-publish on payment, with takedown.** The Stripe webhook
   puts the listing live; an order status field lets it be pulled afterwards.

And one architectural fork, decided in this design:

4. **The submission lives in `job_orders` until it is paid; the `jobs` row is
   created at fulfilment.** The alternative - writing a draft `jobs` row with
   `listed = 0` and flipping it on the webhook - fails on `canonical_key`. The
   crawler's key for a job with an apply URL is `canonicalApplyUrl(applyUrl)`,
   so a draft keyed that way collides with any crawled job sharing the URL, and
   the employer's payment lands on somebody else's imported listing. It also
   writes an FTS row per abandoned checkout, because `jobs_fts_ai` fires on
   insert regardless of `listed`.

## 1. The price catalog

New module `apps/web/lib/billing/listing-catalog.ts`. Pure functions, no I/O,
no database, no `fetch` - so it is exhaustively unit-testable.

```ts
export const LISTING_CURRENCY = "usd" as const;
export const LISTING_BASE_CENTS = 29_900;

export const STICKY_TIERS = [
  { days: 0,  cents: 0 },      { days: 1,  cents: 4_900 },
  { days: 3,  cents: 9_900 },  { days: 7,  cents: 14_900 },
  { days: 14, cents: 19_900 }, { days: 30, cents: 29_900 },
] as const;

export const HIGHLIGHT_TIERS = {
  none:     { cents: 0 },
  standard: { cents: 9_900 },
  custom:   { cents: 14_900 },   // buyer picks the colour
} as const;

export const LOGO_CENTS = 4_900;
export const SUPPORT_CENTS = 9_900;
```

`quoteListing(selection)` returns `{ lines, subtotalCents, discountCents,
totalCents }`, where a line is `{ code, label, unitCents, quantity,
amountCents }`. The quote is what the checkout charges, what the order row
stores as `line_items_json`, and what the receipt and confirmation email
render. There is exactly one price calculation in the codebase and everything
else reads its output.

`quoteBundle(posts)` applies the ladder. The ladder is stored as an explicit
table of `{ minPosts, percent }` breakpoints rather than a formula, because the
reference ladder is not linear: it jumps 20 -> 29 between 2 and 4 posts, then
climbs a point per two posts, then jumps 51 -> 55 at the top. Below 2 posts
there is no discount; above 40 the discount is capped at 55%.

Money is integer cents everywhere. No floats, no currency conversion, no
locale-dependent parsing. `formatUsd(cents)` is the only thing that produces a
"$299" string, and the UI, the email and the receipt all use it.

### Why a new module rather than extending `lib/billing/plans.ts`

`plans.test.ts` asserts, twice, that `JSON.stringify(PLAN_COPY)` contains
neither `"usd"` nor `"$"` - once over the plan table and once over the
URL-encoded checkout body. Those assertions exist to guard the EUR-only
candidate product. Since that product is being deleted (section 9), the module
goes with it; what survives is `verifyStripeWebhook`, which is model-agnostic
and moves to `apps/web/lib/billing/stripe.ts`.

## 2. Database: migration `0010_employer_listings.sql`

**Every statement must be idempotent.** Production's `d1_migrations` table is
empty, so `wrangler d1 migrations apply --remote` restarts from
`0001_init.sql` and dies on "table tenants already exists". Production
migrations are applied one file at a time with
`wrangler d1 execute gaming-jobs --remote --file`, which has no once-only
bookkeeping and may be run twice. Use `CREATE TABLE IF NOT EXISTS` and
`CREATE INDEX IF NOT EXISTS` throughout. `ALTER TABLE ... ADD COLUMN` has no
`IF NOT EXISTS` in SQLite and fails loudly with "duplicate column name" on a
second run; that failure is harmless and means the column is already there, as
documented in `0009_company_description.sql`.

`packages/db/src/migrations-apply.test.ts` executes every migration file into a
fresh in-memory SQLite in sorted filename order on each test run, so a
dialect-incompatible statement fails the whole suite.

### `job_orders`

One row per purchase attempt, single post or bundle.

| column | type | note |
|---|---|---|
| `id` | TEXT PK | `crypto.randomUUID()` |
| `tenant_id` | TEXT NOT NULL | from `requireTenantId(db)`, never hardcoded |
| `kind` | TEXT NOT NULL | `single` or `bundle` |
| `status` | TEXT NOT NULL | `pending`, `paid`, `published`, `failed`, `refunded`, `cancelled` |
| `buyer_email` | TEXT NOT NULL | private, never rendered publicly |
| `buyer_name` | TEXT | |
| `company_name` | TEXT | |
| `invoice_info` | TEXT | free text: address, legal name, VAT number |
| `currency` | TEXT NOT NULL DEFAULT 'usd' | |
| `subtotal_cents` | INTEGER NOT NULL | |
| `discount_cents` | INTEGER NOT NULL DEFAULT 0 | |
| `total_cents` | INTEGER NOT NULL | what Stripe is asked to charge |
| `coupon_code` | TEXT | |
| `line_items_json` | TEXT NOT NULL | the frozen `quoteListing` output |
| `draft_json` | TEXT | the validated listing payload; null for bundles |
| `bundle_posts` | INTEGER | bundle only |
| `stripe_session_id` | TEXT | |
| `stripe_payment_intent` | TEXT | |
| `stripe_subscription_id` | TEXT | auto-renew only |
| `job_id` | TEXT | set when the listing publishes |
| `user_id` | TEXT | optional, when the buyer happened to be signed in |
| `manage_token_hash` | TEXT NOT NULL | SHA-256 of the emailed manage token |
| `created_at` | TEXT NOT NULL | ISO-8601 |
| `paid_at` | TEXT | |
| `updated_at` | TEXT NOT NULL | |

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_orders_session
  ON job_orders (stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_orders_email  ON job_orders (buyer_email, created_at);
CREATE INDEX IF NOT EXISTS idx_job_orders_status ON job_orders (status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_orders_manage ON job_orders (manage_token_hash);
```

The partial unique index on `stripe_session_id` is what makes webhook delivery
idempotent: Stripe retries, and a retry must not publish a second listing.

Indexes lead with the column actually filtered.
`0008_tag_location_lookup_indexes.sql` exists because
`job_tags PRIMARY KEY (job_id, tag_slug)` could not answer "which jobs carry
this tag", and the resulting full scans read 16,180,262 rows in a day against
D1's 5,000,000 free-tier cap - at which point every DB-backed page renders a
Next 500 while the worker still reports `outcome: ok`. New tables do not get to
repeat that.

### `job_credits`

A **ledger with one row per bought post**, not a counter. Spending a credit is
a conditional `UPDATE ... WHERE spent_at IS NULL`, so two tabs cannot spend the
same credit, and what was bought and what it became stays readable.

| column | type | note |
|---|---|---|
| `id` | TEXT PK | |
| `tenant_id` | TEXT NOT NULL | |
| `order_id` | TEXT NOT NULL | the bundle order that minted it |
| `buyer_email` | TEXT NOT NULL | who may spend it |
| `expires_at` | TEXT NOT NULL | `created_at` plus 24 months |
| `spent_at` | TEXT | |
| `spent_order_id` | TEXT | the single-post order that consumed it |
| `job_id` | TEXT | the listing it became |
| `created_at` | TEXT NOT NULL | |

```sql
CREATE INDEX IF NOT EXISTS idx_job_credits_email
  ON job_credits (buyer_email, spent_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_job_credits_order ON job_credits (order_id);
```

### `coupons`

| column | type | note |
|---|---|---|
| `code` | TEXT PK | compared case-insensitively, stored upper-case |
| `kind` | TEXT NOT NULL | `percent` or `amount` |
| `value` | INTEGER NOT NULL | 1-100 for percent, cents for amount |
| `max_redemptions` | INTEGER | null means unlimited |
| `redeemed_count` | INTEGER NOT NULL DEFAULT 0 | |
| `starts_at` | TEXT | |
| `expires_at` | TEXT | |
| `created_at` | TEXT NOT NULL | |

A coupon never reduces a total below zero, and a percent coupon applies to the
subtotal after the bundle discount, not before.

### Columns added to `jobs`

```sql
ALTER TABLE jobs ADD COLUMN order_id TEXT;
ALTER TABLE jobs ADD COLUMN highlight_color TEXT;
```

- `order_id` is the link from a live listing back to the order that paid for
  it. Nothing in the schema connects a job to a buyer today: `jobs` has no
  `user_id`, `owner_id` or `order_id`, and `companies` has no owner either, so
  "who may edit this listing" and "which payment bought it" are both currently
  unrepresentable.
- `highlight_color` holds the hex for the custom brand colour tier.
  `jobs.highlight` is an INTEGER and `job-row.tsx` renders on
  `job.highlight === 1`, so encoding the two tiers as `1` and `2` would make
  tier 2 sort **above** tier 1 while rendering with no highlight at all. Both
  paid tiers therefore set `highlight = 1`; the colour distinguishes them.

**No new column for the logo.** `companies.logo_url` already exists (migration
0006) and the logo is a company attribute - which is also what the bundle page
already promises in copy: "Pulled from the company profile, so it applies to
every job under that profile."

**No new column for sticky.** `jobs.featured_until` already exists (migration
0004) and is already read by the sort. See section 5.

### Tables dropped

```sql
DROP TABLE IF EXISTS unlocks;
DROP TABLE IF EXISTS subscriptions;
```

Safe because nobody has ever subscribed. Their four readers are handled in
section 9.

### `packages/db/src/schema.ts`

The drizzle schema has already drifted from the SQL - it is missing
`companies.description` from migration 0009 and declares only two of the eight
`jobs` indexes. It is brought back in line as part of this work, and the
migrations remain the single source of truth.

## 3. The listing flow

### `/post-web3-job` - the form

One page, sectioned, no wizard. Fields, in the order the reference asks them,
with our differences marked:

1. Your name, your email (labelled "stays private", as theirs is)
2. Company name, company URL (must parse as `http` or `https`), company logo
   upload
3. Position / job title
4. Description
5. Location, or Remote
6. Main skill, other skills, benefits - **selects over the shipped
   vocabulary**, not free text (see below)
7. Twitter handle
8. Salary range, min and max, yearly USD
9. Invoice details - address, legal name, VAT number
10. How to apply: **on Nodework** (our on-site form, the existing
    `job_applications` flow) or **redirect to your own URL**
11. Add-ons: sticky, highlight, logo, premium support, auto-renew
12. Coupon code

The running total is computed client-side from the same catalog table the
server uses, and recomputed server-side at checkout. **The client total is
never trusted**: `POST /api/listings` re-quotes from the draft and the
selection and charges its own number.

The vocabulary point is load-bearing. `attachTaxonomy` filters tags through
`isJobTag(slug)` and locations through
`isCitySlug` / `isCountrySlug` / `isRegionSlug`, and **silently drops anything
outside `packages/shared/src/taxonomy.ts`**. A free-text tag field would let an
employer pay $299 for a listing that carries no tags and no location rows and
therefore appears on no landing page at all. Selects make that impossible.

Turnstile protects the form; `lib/auth/turnstile.ts` already exists and the
reference board protects the same form the same way.

### `/post-web3-job/bundle` - the bundle calculator

A posts stepper, the ladder discount, the total, and a buy button. The four
descriptive pack sizes already on the page (3 / 5 / 10 / 25) stay as presets
above it. The 24-month window becomes a real column
(`job_credits.expires_at`) instead of a description.

### `/pricing` - the employer price list

Rewritten. The candidate column becomes a single honest statement: browsing,
searching, full descriptions and applying are free and always will be, with no
account required to read and no weekly quota. The rest of the page is the
listing price table and the bundle ladder.

### New routes

| route | indexed | note |
|---|---|---|
| `/post-web3-job/checkout/success` | no | reads order state, `force-dynamic` |
| `/post-web3-job/checkout/cancel` | no | |
| `/post-web3-job/manage/[token]` | no | order and listing status, spend credits |

All three go into `PRIVATE_PATHS` in `robots.ts` and stay out of
`STATIC_PATHS` in `sitemap.ts`. Both are hand-written arrays whose tests
deep-equal a literal, so the array and its test are edited together.

`/post-web3-job`, `/post-web3-job/bundle`, `/pricing` and `/ads` currently have
neither `dynamic` nor `revalidate` and are prerendered at build. Any of them
that reads order state, a credit balance or a session must declare
`export const dynamic = "force-dynamic"` or it will silently serve a build-time
snapshot to everyone.

### API routes

- `POST /api/listings` - validate, quote, insert `job_orders` as `pending`,
  create a Stripe Checkout session, return its URL. Returns 503
  `{code:"billing_disabled"}` when `STRIPE_ENABLED !== "true"`, matching the
  existing checkout route's contract exactly.
- `POST /api/listings/redeem` - spend a bundle credit against a manage token.
  No Stripe involved; publishes immediately.
- `POST /api/stripe/webhook` - extended, not replaced.

### Buying without an account

The reference asks for an email, not a login, and so do we. On payment the
buyer is emailed a signed manage link; only the SHA-256 of the token is
stored, so a database read cannot mint a working link. The link shows order
status, the published listing, and any unspent bundle credits. If the buyer
happened to be signed in, `job_orders.user_id` is set as well and the same
orders appear in their account.

This keeps `/onboarding` and the candidate account for what they actually are -
candidate features - rather than making employers create an account to spend
$299.

## 4. Fulfilment

`publishOrder(db, order, now)` in `apps/web/lib/listings/publish.ts`. Called
from the webhook and from the credit-redemption route. **Idempotent**: it
returns the existing `job_id` if `job_orders.job_id` is already set.

Order of writes:

1. **Company.** Upsert by `(tenant_id, name_norm)` using
   `normalizeCompanyName(name)`, mirroring `upsertCompanyProfile`: the
   `DO UPDATE` uses `COALESCE(companies.domain, excluded.domain)` so a later
   null never erases a stored value. Set `logo_url` only if the logo add-on was
   bought. `name_norm` must be a valid slug - `getCompanyBySlug` rejects any
   slug where `slugTitle(slug) !== slug` - so a company whose normalised name
   is not slug-shaped would be unreachable on `/web3-companies/{slug}`.
2. **Job.** `canonical_key = 'employer:' + order.id`. This is the single most
   important line in the fulfilment path. A URL-derived key would collide with
   crawled jobs in both directions: an employer listing could upsert over an
   imported one, and the crawler's `DO UPDATE` - which writes
   `featured_until = excluded.featured_until, highlight = excluded.highlight` -
   could wipe a paid sticky on its next pass. A namespaced key the crawler can
   never generate makes both impossible.
3. `source = 'employer'`, added to the union in `packages/shared/src/jobs.ts`
   (which already carries an unused `'manual'`). `jobs.source` has no CHECK
   constraint, so this is a type-level change only.
4. `external_id = NULL`, so the listing resolves at `/jobs/{slug}` and
   `/jobs/{slug}/apply`. `jobPublicHref` switches on `external_id`, and
   `/{slug}/{id}/apply` resolves only via `getJobByExternalId` - picking the
   wrong one 404s either the canonical URL or the apply page.
5. `slug = jobPublicSlug(companyName, title)`. On
   `UNIQUE constraint failed: jobs.tenant_id, jobs.slug`, retry once with the
   migration-0003 suffix pattern,
   `slug + '-' + substr(replace(id,'-',''), 1, 8)`. Two listings from the same
   employer with the same title collide otherwise.
6. `listed = 1`, `posted_at = now` as ISO-8601. Never RFC 1123 - SQLite
   compares TEXT, and a mixed-format `posted_at` previously sorted every
   `"Fri, ..."` above every `"2026-..."`, silently breaking date ordering, the
   30-day windows and the growth leaderboard.
7. `exclusivity = 'unknown'`. Not `hidden_from_linkedin`: that value drives the
   "Not on LinkedIn" badge, which is a claim about the job we have no way to
   verify for a self-submitted listing.
8. `description_html` sanitized **at write time** with
   `sanitizeJobDescriptionHtml`, not only at render. The raw value otherwise
   reaches `lib/jobs/jsonld.ts` and `lib/jobs/meta.ts` too.
9. `salary_min` and `salary_max` stored **only** when both bounds parse and are
   yearly USD, matching `web3CareerStatedSalary`. `rebuildSalaryRollups`
   averages this column directly, so one bad employer figure corrupts every
   `/web3-salaries` page.
10. **Taxonomy** via a new `attachListingTaxonomy` in
    `apps/web/lib/listings/taxonomy.ts`. It must not be the crawler's
    `attachTaxonomy`, which opens with `DELETE FROM job_tags WHERE job_id = ?`
    and `DELETE FROM job_locations WHERE job_id = ?`. It reuses the same
    vocabulary guards and the same `locationHierarchy` expansion, so a Berlin
    listing gets `berlin`, `germany` and `europe` rows exactly as a crawled one
    does.
11. `job_benefits` rows are written. This is the first code path in the repo
    that ever writes them, and it makes the `/{benefit}-jobs` landings - which
    render empty today - start to fill once a benefit clears the `count >= 5`
    sitemap threshold. That is an intended SEO surface change, called out here
    so it is not discovered later as a surprise.
12. `job_orders.status = 'published'`, `job_id` set, `paid_at` stamped.
13. Confirmation email to the buyer with the receipt and the manage link.

No `job_sightings` row is written. Sightings drive `unlistStaleApiJobs`, whose
21-day staleness sweep would otherwise unlist a paid listing.

### The crawler must not duplicate a paid listing

A namespaced `canonical_key` prevents an *overwrite*, but not a *duplicate*: if
the crawler later imports the same job from the API, a second row appears. The
crawler's ingest gains one guard - skip a draft whose canonicalised apply URL
matches an existing `source = 'employer'` job in the same tenant.

## 5. Sticky and highlight on the board

`jobs.featured_until` and `jobs.highlight` already exist and are already read.
Nothing has ever written them: `ingest.ts` passes
`featuredUntil: existing?.featuredUntil ?? null` and
`highlight: existing?.highlight ?? 0`, faithfully round-tripping values that no
code path can create. Selling sticky placement is what finally writes them.

**The expiry bug must be fixed first.** The current sort is:

```sql
ORDER BY
  CASE WHEN j.featured_until IS NOT NULL THEN 0 ELSE 1 END,
  j.highlight DESC,
  j.posted_at DESC,
  j.id ASC
```

Presence-only. Nothing anywhere compares `featured_until` to the clock, so a
sticky sold for 24 hours would sit at the top of the board forever. The fix is
read-side:

```sql
CASE WHEN j.featured_until IS NOT NULL AND j.featured_until > ? THEN 0 ELSE 1 END
```

bound to the current ISO timestamp, with the same comparison in
`job-row.tsx`, which currently computes
`const sticky = Boolean(job.featuredUntil) || job.highlight === 1`.

**Not a cron sweep.** A nightly
`UPDATE jobs SET featured_until = NULL WHERE featured_until < ...` would fire
`jobs_fts_au` on every affected row, and that trigger deletes and reinserts the
FTS row - rewriting the search index and billing D1 writes to achieve what one
bound parameter does for free.

`orderBy: 'salary'` - used by `/highest-paying-web3-jobs` and the salary pages -
ignores `featured_until` and `highlight` entirely, and keeps ignoring them. A
salary ranking that can be bought is not a salary ranking. `/ads` says so
explicitly, alongside the existing statement that featured placement "is a
placement format, not a ranking bribe".

## 6. Bundles and credits

Buying N posts mints N `job_credits` rows, each with
`expires_at = paid_at` plus 24 months, against the buyer's email.

Spending one is `POST /api/listings/redeem` with a manage token and a listing
draft. It validates the draft exactly as a paid submission does, then:

```sql
UPDATE job_credits
   SET spent_at = ?, spent_order_id = ?, job_id = ?
 WHERE id = (SELECT id FROM job_credits
              WHERE buyer_email = ? AND spent_at IS NULL AND expires_at > ?
              ORDER BY expires_at ASC LIMIT 1)
   AND spent_at IS NULL
```

Oldest-expiring first, and the redundant `AND spent_at IS NULL` on the outer
statement is what makes a double-submit safe. Zero rows changed means no credit
was available, and the caller is told so rather than being given a free
listing.

Add-ons are **not** included in a bundle credit. A credit buys the $299 base
post; sticky, highlight, logo and support are purchased per listing at
redemption time through the normal checkout. This matches the reference, whose
bundle calculator prices add-ons separately from the post count.

## 7. Coupons

`applyCoupon(quote, coupon, now)` is a pure function in the catalog module.
Validity is checked server-side at checkout - `starts_at`, `expires_at`,
`redeemed_count < max_redemptions` - and `redeemed_count` is incremented at
**fulfilment**, not at checkout creation, so an abandoned checkout does not
burn a redemption. There is no admin UI in this slice; coupons are inserted by
hand with `wrangler d1 execute`.

## 8. Auto-renew

The 30-day sticky may be set to renew. Implemented as a Stripe Checkout session
in `mode=subscription` where the *only* recurring line item is the 30-day
sticky at $299 a month, with the base post and every other add-on riding along
as one-time charges via `subscription_data[add_invoice_items][...]` on the
first invoice. `invoice.paid` then extends `featured_until` by 30 days from the
later of now and the current expiry; `customer.subscription.deleted` stops
extending and lets the current window run out.

When auto-renew is off - the default - the session is a plain `mode=payment`.

This is the most intricate part of the slice and the first thing to cut if the
work needs to be smaller. Cutting it means the sticky simply expires and the
buyer is emailed before it does.

## 9. Removing the candidate paywall

Deleted:

- `apps/web/lib/unlocks/` entirely (`quota.ts`, `history.ts`, `week.ts`,
  `client.ts`) and `apps/web/app/api/unlock/`
- `apps/web/app/api/stripe/checkout/` - replaced by `/api/listings`
- the EUR plan table, `planById` and `checkoutFormForPlan` in
  `lib/billing/plans.ts`; `verifyStripeWebhook` moves to
  `lib/billing/stripe.ts`
- `apps/web/app/_components/home/pricing-teaser.tsx` - unreferenced, with no
  matching CSS; dead
- `apps/crawler/src/digest.ts` and its test - `sendHiddenDigest` is imported
  only by its own test, is not wired to the cron, and hard-depends on
  `subscriptions`

Changed:

- `job-detail-view.tsx`: `const gated = showBadge(job.exclusivity)` goes. Every
  job gets the plain on-site apply path. The "Not on LinkedIn" badge itself
  stays - it is a fact about the job, and was only ever incidentally the
  paywall trigger.
- `lib/profile/export.ts`: the GDPR export drops its `unlocks` and
  `subscription` keys.
- `lib/profile/delete-account.ts`: `SQL_DELETE_ORDER` drops both tables. The
  order is functional, not cosmetic - child tables have no
  `ON DELETE CASCADE` - and is asserted by two tests via a `sql:<table>` log.
- `lib/legal/copy.ts`: `PRICING_COPY` is on the locked-copy list and is
  rewritten deliberately, to say candidates pay nothing and listings are
  priced.
- `app/about/page.tsx` claims "No weekly quota on Apply" under a list of things
  the site does not do. That is currently **false** for `hidden_from_linkedin`
  jobs - a live honesty bug. Removing the quota makes it true; the surrounding
  claims get re-read rather than assumed correct.
- `/onboarding` exists today only because `unlockGateResponse` returned a 403
  to it, and its copy says so: "before you unlock an application link". With
  the gate gone it becomes an optional profile step reachable from the account,
  not a forced interstitial.

## 10. Copy rules this slice must hold

Carried forward from `studio-direct-frontend-design-decisions` and still
binding:

- No em dashes, no "Trusted by", no fabricated KPIs.
- No unverified performance claims - which is why the reference's view
  multipliers are not copied.
- A studio never receives a candidate profile because someone applied. The
  talent pool is opt-in and off by default. Employer copy about "access to
  candidates" must not imply otherwise.
- Prices are published on the page before they are on an invoice. This spec
  turns that promise from a placeholder into the actual behaviour.

## 11. Tests that change on purpose

These currently assert the *old* model. Each is rewritten to guard the new
invariant, and none is silently deleted.

| file | what it asserts today |
|---|---|
| `app/post-web3-job/bundle/page.test.tsx` | no currency figure, no `form` / `input` / `select` / `button` element, no href matching checkout, stripe, pay or buy; copy contains "checkout is not built" |
| `app/post-web3-job/page.test.tsx` | no "$N / job post"; copy contains "not live"; both EUR `PLAN_COPY` labels appear |
| `app/pricing/page.test.tsx` | literal EUR 9 and EUR 59 labels; zero checkout forms when the flag is false, `plan=monthly` and `plan=yearly` forms when true |
| `lib/billing/plans.test.ts` | `PLAN_COPY` contains no `"usd"` and no `"$"` |
| `lib/legal/copy.test.ts` | legal text does not match "billing is live"; `PRICING_COPY` pinned to the EUR strings |
| `wrangler.test.ts` | `vars.STRIPE_ENABLED === "false"`; exact 4-binding and 6-secret arrays |
| `app/_components/site-chrome.test.tsx` | chrome exposes `/ads`, `/pricing`, `/post-web3-job` |
| `app/_components/footer-data.test.ts` | two hardcoded route allowlists; the "Other" column ends exactly on `/login` and `/login?intent=start` |

Two mechanical constraints on writing the new tests:

- **Page tests walk only `props.children` and never invoke components.** A
  price rendered inside `<PriceTable/>` is invisible, and the test passes while
  asserting nothing. Render it as `{PriceTable({...})}` - the precedent is
  `PricingPlans`, `JobDetailBody` and `PageHeader`, all of which are called as
  functions for exactly this reason and carry docblocks saying so.
- **Route tests** follow `app/api/unlock/route.test.ts`: `vi.hoisted` mocks,
  `vi.mock("@opennextjs/cloudflare")`, a `node:sqlite` in-memory database
  behind a `createD1()` adapter, and `await import("./route")` inside each
  `it`. The webhook test already signs a real HMAC with `whsec_test_secret`;
  the new fulfilment tests reuse that helper.

## 12. Design and accessibility

The form is the largest piece of UI this app has ever had, and it has no
precedent: `job-apply-form.tsx` is the only real form in the codebase.

- New `app/styles/checkout.css`, imported **only** from `layout.tsx`, in the
  existing ordered list. A component-level CSS import reorders the emitted
  chunks and has already silently reverted the palette once.
- The sheet declares **no** custom properties and no `:root` block. Token order
  is decided by the bundler, not by the import list.
- No selector more specific than a single class around a button.
  `button.button` or `.checkout-form .button` outranks every `.button--*`
  modifier and repaints secondary buttons primary pink - a mistake already made
  twice here.
- Bare `input[type=checkbox]` and `input[type=radio]` are 18x18 and fail the
  24px tap-target floor on all six viewports in all three engines. Every add-on
  control is wrapped in a padded label, following the existing
  `.jobs-filters__check` pattern.
- Keep the global `:focus-visible` outline. Copying `.apply-form`'s
  `outline: none; border-color: var(--accent)` makes every field report
  `hasVisibleFocusIndicator: false`, because the harness diffs only
  `outlineStyle`, `outlineWidth` and `boxShadow`.
- The custom brand colour is rendered as a swatch and a border only. It never
  becomes the text colour of anything, because a buyer-chosen hex cannot be
  contrast-checked in advance.
- The page is `.surface--stage`. The wrapper must not take an opaque
  background: the aurora is painted by `.surface--stage::before` at
  `z-index: -1`, and an in-flow opaque block buries it.
- The live total works without JavaScript: the server-side re-quote is
  authoritative, and the no-JS path submits and prices on the server.
  `qa/motion-nojs-check.mjs` catches this class of regression.
- New rows in `apps/web/qa/templates.mjs` for every new route, with the
  `register` value read off the page's own `<main>` class rather than guessed.

## Out of scope

- An employer account area beyond the signed manage link. No employer login, no
  team seats, no listing analytics.
- Editing a published listing. Takedown is `status` plus `listed = 0`; edits
  are a later slice.
- Refunds beyond recording `status = 'refunded'` by hand. No self-serve refund.
- A coupon admin UI.
- Any banner, newsletter or display ad inventory. `/ads` continues to sell
  exactly one thing: placement of a real listing.
- Migrating or preserving candidate subscriptions - there are none.
- Currency conversion or EUR pricing.

## Testing

Unit, with `pnpm --filter @gaming/web test`:

- `listing-catalog.test.ts` - every sticky tier, both highlight tiers, logo,
  support, every breakpoint of the volume ladder including the 20 -> 29 jump
  and the 55% cap, coupon percent and amount, the never-below-zero floor, and
  the exact reference totals ($299 alone; $448 for their default cart).
- `publish.test.ts` - against a `node:sqlite` database seeded from the real
  migrations: publishes once, is idempotent on a second call, resolves a slug
  collision, refuses a non-yearly-USD salary, writes the three-row Berlin
  location hierarchy, writes a sanitized description, and never writes a
  sighting row.
- `credits.test.ts` - concurrent redemption spends exactly one credit; an
  expired credit is not spendable.
- webhook - a replayed `checkout.session.completed` publishes one listing, not
  two.
- route tests for `/api/listings` under both states of `STRIPE_ENABLED`, and
  for a client-supplied total that disagrees with the server quote.

Schema: `pnpm --filter @gaming/db test` runs every migration into a fresh
database; migration 0010 is additionally run **twice** to prove idempotence.

Whole repo: `pnpm typecheck` and `pnpm test` from the root, both green, which
is also what `.github/workflows/deploy.yml` runs before it builds.

Production build: `pnpm --filter @gaming/web cf:build` on Linux and CI only. A
Windows build bakes `C:\Users\...` into 157 bundle files and produces
"Dynamic require" 500s, and the backslashes are doubled inside JSON so a grep
for a single `C:\Users` finds nothing and the bundle looks clean when it is
not.

Visual and device QA: `pnpm --filter @gaming/web qa` across the new templates,
zero Critical and zero High, per the aurora acceptance bar.

## Going live

Two steps only the user can take, neither of which is part of this
implementation:

1. Set the `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` wrangler secrets,
   and point a Stripe webhook endpoint at `/api/stripe/webhook`.
2. Flip `vars.STRIPE_ENABLED` to `"true"` in `apps/web/wrangler.jsonc`, and
   update the assertion in `wrangler.test.ts` in the same commit.

Until both are done the funnel renders, validates and quotes, and the pay
button reports that checkout is not open - the same contract
`/api/stripe/checkout` uses today.

Migration 0010 must be applied to production **before** the deploy that starts
selecting the new columns. `/web3-companies/[slug]` has `revalidate = 300` and
no `generateStaticParams`, so it renders against the production database on
every request; a schema-widening deploy that lands first returns 500 from every
template that reads a new column, and the post-deploy smoke check only probes
routes that may not exercise them.
