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

Volume ladder: their `discount` object maps a slider position to a post count
and a percentage, and the two diverge above 30 posts (slider 32 is 31 posts,
slider 50 is 40 posts). Transcribed **by post count** it is the
`BUNDLE_LADDER` table in section 1, which is the authoritative copy; there is
no formula, and no percentage may be interpolated between its rows. Bundled
posts are "valid for 24 months".

Three things about their page we are deliberately **not** copying:

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
- **Premium support at $99.** We do not sell it, because we have nothing to
  sell. The repo has no contact route, no published support address and no
  channel of any kind: a search for a contact page, a `support@` address or a
  `mailto:` across `apps/web` finds nothing, and `/ads` currently routes
  employers to `/login` because there is no alternative. Charging $99 for a
  service that does not exist is the same failure as publishing a view
  multiplier we cannot substantiate. If a support channel is ever built, the
  price is already transcribed above and can be switched on then.

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
```

There is no `SUPPORT_CENTS`. Premium support is not sold; see the reference
prices above.

`quoteListing(selection)` returns `{ lines, subtotalCents, discountCents,
totalCents }`, where a line is `{ code, label, unitCents, quantity,
amountCents }`. The quote is what the checkout charges, what the order row
stores as `line_items_json`, and what the receipt and confirmation email
render. There is exactly one price calculation in the codebase and everything
else reads its output.

`quoteBundle(posts)` applies the ladder. `BUNDLE_LADDER` is an explicit table
of `{ minPosts, percent }` rows transcribed verbatim from the reference, by
post count:

```
 2->20   4->29   6->30   8->31  10->32  12->33  14->34  16->35  18->36
20->37  22->38  24->39  26->40  28->41  30->42  31->43  32->44  33->45
34->46  35->47  36->48  37->49  38->50  39->51  40->55
```

Only two rules are not in the table: below the first row there is no discount,
and at or above the last row the percent is that row's value. Nothing is
interpolated, and no percentage is derived by formula — the ladder is not
linear, and it changes step size twice.

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

The partial unique index on `stripe_session_id` keeps at most one order row per
Checkout session. It is a data-integrity constraint on the row
`POST /api/listings` writes. **It is not a webhook idempotency mechanism** —
the webhook never inserts an order row, so the index is never contended. What
actually makes delivery idempotent is the `stripe_events` table below plus the
conditional status update in the lifecycle.

### Order lifecycle

Exactly one writer per transition, and every transition is a guarded UPDATE
rather than a read-then-write.

- **`pending`** — written by `POST /api/listings` at insert.
- **`paid`** — written by the webhook, as one conditional statement:
  `UPDATE job_orders SET status='paid', paid_at=?, stripe_payment_intent=?,
  updated_at=? WHERE stripe_session_id=? AND status='pending'`. Zero rows
  changed means a replay, and the handler returns without repeating the work.
  This is the guard that protects **bundle** fulfilment, which has no `job_id`
  for the publish check to key on.
- **`published`** — written at the end of `publishOrder`, only for
  `kind = 'single'`.
- A **bundle order terminates at `paid`.** There is no listing to publish. The
  manage page renders a `paid` bundle as complete and lists its credits, never
  as still awaiting payment.
- **`failed`** — `checkout.session.async_payment_failed`.
- **`cancelled`** — `checkout.session.expired`.
- **`refunded`** — written by hand; there is no self-serve refund.

### `stripe_events`

The real idempotency mechanism. Stripe delivers at least once and retries any
non-2xx, and the damage from a replay is not theoretical: minting credits is an
unconditional insert, so one retry of a 25-post bundle would mint 25 extra
credits — $7,475 of free listings — and would also double-increment the coupon
counter and re-send the receipt.

```sql
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  order_id TEXT,
  received_at TEXT NOT NULL
);
```

The webhook's **first** write, before any fulfilment, is
`INSERT INTO stripe_events (id, type, order_id, received_at) VALUES (?,?,?,?)
ON CONFLICT(id) DO NOTHING`. Zero rows changed means the event has already been
handled: answer 200 and stop. Credit minting, the coupon increment, the sticky
extension and the receipt email all sit behind this guard.

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
| `slot_index` | INTEGER NOT NULL | 0 to N-1 within that order |
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_credits_slot
  ON job_credits (order_id, slot_index);
```

`idx_job_credits_slot` is belt and braces behind `stripe_events`: minting is
`INSERT OR IGNORE` over slots 0 to N-1, so even a replay that somehow got past
the event guard cannot mint an extra credit.

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

**The sub-minimum clamp.** Stripe refuses a `mode=payment` session under its
$0.50 minimum charge, so a coupon that all but clears the cart must never reach
Stripe. `applyCoupon` clamps a resulting total in the range 1 to 49 cents down
to 0. The buyer typed a valid coupon and can do nothing about a 37-cent
remainder; forgiving it costs at most 49 cents and removes a branch the UI
would otherwise have to explain. A zero total then takes the free-order path in
section 3, which skips Stripe and publishes inline.

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

### Tables dropped: migration `0011_drop_candidate_paywall.sql`

```sql
DROP TABLE IF EXISTS unlocks;
DROP TABLE IF EXISTS subscriptions;
```

**A separate file for deploy ordering, not tidiness.** 0010 only widens the
schema, so it is safe to apply *before* the deploy. These two DROPs are safe
only *after* it: until the new worker is live, the code running in production
reads both tables on every request — `lib/unlocks/quota.ts` via `/api/unlock`,
`lib/unlocks/history.ts` via `/dashboard` (which is `force-dynamic`),
`lib/profile/export.ts` via the GDPR export, and `lib/profile/delete-account.ts`
via account deletion. D1 answers a dropped table with `no such table`, which
the app catches and renders as a 500 while the worker still reports
`outcome: ok` — the exact failure mode that made the first production day
unreadable.

Dropping the data is safe regardless: nobody has ever subscribed. Their
readers are handled in section 9.

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
   URL
3. Position / job title
4. Description
5. Location, or Remote
6. Main skill, other skills, benefits - **selects over the shipped
   vocabulary**, not free text (see below)
7. Twitter handle
8. Salary range, min and max, yearly USD
9. Invoice details - address, legal name, VAT number
10. Your own posting URL, if you have one
11. Add-ons: sticky, highlight, logo, auto-renew
12. Coupon code

**The logo is a URL, not an upload.** `companies.logo_url` is rendered straight
into an `<img src>` on the company directory and detail pages, and emitted as
`hiringOrganization.logo` in the JSON-LD. Every value in that column today is
an absolute URL. The only upload precedent in the repo, `lib/profile/cv.ts`,
stores an R2 *object key* and there is no route anywhere that reads an object
back out, so an uploaded file would not be a URL and the add-on would ship
broken. The logo add-on therefore buys *rendering the company mark on the row*,
and the buyer supplies an `https` URL validated by the same rule as the company
URL. No R2 object, no image-serving route, no wrangler change. If hosted
uploads are ever wanted, that is a later slice with its own serving route,
MIME allowlist and size cap.

**Apply always stays on Nodework.** Field 10 is not a choice between our form
and a redirect. `jobs.apply_url` is NOT NULL, so fulfilment must write
something; the employer's own posting URL is stored there and is what the
crawler dedupe guard in section 4 canonicalises against. It is **never**
rendered as the public apply button. Every listing, paid or crawled, uses the
on-site `job_applications` flow. This is the only reading consistent with what
the site already promises — `/about` says "Apply stays on Nodework. Imported
apply URLs are not used as the public button", the current `/post-web3-job`
says "candidates submit on this site, not a redirect chain", and
`lib/jobs/jsonld.ts` hardcodes `directApply: true` with the on-site apply URL
as the action target, which a redirect listing would make a false structured
data claim. When the employer has no URL, store the on-site apply URL.

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
  existing checkout route's contract exactly. **When the re-quoted total is 0**
  — a 100%-off coupon, or one clamped there by the sub-minimum rule in
  section 7 — and auto-renew was not selected, Stripe is skipped entirely: the
  order is marked `paid` inline and `publishOrder` runs in the request. Stripe
  refuses a `mode=payment` session under its $0.50 minimum, so sending a
  zero-total cart there would 502 and the buyer would never get the listing
  they were promised.
- `POST /api/listings/redeem` - validate the draft exactly as `/api/listings`
  does, **reject any paid add-on** with 400 `{code:"addons_not_redeemable"}`,
  then spend a credit and publish inline. A credit buys the base post and
  nothing else, so no Stripe session is ever created here. A buyer who wants a
  sticky buys that listing as a normal single post instead.
- `POST /api/stripe/webhook` - extended, not replaced. It handles
  `checkout.session.completed` (subject to the payment gate in section 4),
  `checkout.session.async_payment_succeeded` (the same fulfilment path),
  `checkout.session.async_payment_failed` (`status = 'failed'`; publish
  nothing, and if it somehow already published, set `listed = 0`),
  `checkout.session.expired` (`status = 'cancelled'`), and `invoice.paid` plus
  `customer.subscription.deleted` from section 8. Every other event type is
  acknowledged with 200 and ignored, as today.

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

### The payment gate

Fulfilment from `checkout.session.completed` runs **only when the session is
actually funded**: `session.payment_status` is `paid`, or `no_payment_required`
for the zero-total session a full coupon produces. Do not test `=== 'paid'`
alone; that silently refuses to publish a fully-couponed order.

Stripe fires `checkout.session.completed` when the session *completes*, not
when funds settle. A delayed-notification method arrives with
`payment_status: "unpaid"` and settles later via
`checkout.session.async_payment_succeeded` or `async_payment_failed`. On
`unpaid`, record `stripe_session_id` and `stripe_payment_intent`, leave the
order `pending`, and return 200 without publishing. The existing
`applyStripeEvent` has no such check, and the webhook is being extended rather
than replaced, so this gate has to be added deliberately or the old unguarded
pattern is what gets copied.

### Fulfilment is resumable, not transactional

D1 in the Workers runtime has **no interactive transactions**. `db.batch()` is
the only atomic primitive, it appears nowhere in production code (only in two
crawler test files), and it cannot express this sequence anyway: step 1 needs
the company id before step 2, and step 5 needs the insert's error before it can
retry the slug.

`publishOrder` is therefore written as a **resumable sequence in which every
step is individually idempotent** and any step may be re-entered by a Stripe
retry. Two consequences that the order of writes below depends on:

- **The job insert is an upsert**, `ON CONFLICT (tenant_id, canonical_key) DO
  UPDATE`, on `'employer:' + order.id`, mirroring the crawler's `upsertJob`.
  A plain INSERT would throw forever on a retry after a mid-way crash, and the
  paid listing would never publish.
- **`job_orders.job_id` is written immediately after the job insert**, not at
  the end. It is the re-entry flag, and a flag written last is a flag that is
  never there when it is needed.
- Do **not** guard entry with a one-way `status = 'publishing'` gate. A crash
  after that gate makes every later retry bounce off it, which is the wedge
  this subsection exists to prevent.

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
6. `job_orders.job_id` is written here, immediately after the insert
   succeeds, so a retry short-circuits at the top.
7. `apply_url` = the employer's posting URL if they gave one, else the on-site
   apply URL. Stored for dedupe and support; never rendered as the public apply
   button.
8. `listed = 1`, `posted_at = now` as ISO-8601. Never RFC 1123 - SQLite
   compares TEXT, and a mixed-format `posted_at` previously sorted every
   `"Fri, ..."` above every `"2026-..."`, silently breaking date ordering, the
   30-day windows and the growth leaderboard.
9. `exclusivity = 'unknown'`. Not `hidden_from_linkedin`: that value drives the
   "Not on LinkedIn" badge, which is a claim about the job we have no way to
   verify for a self-submitted listing.
10. `description_html` sanitized **at write time** with
   `sanitizeJobDescriptionHtml`, not only at render. The raw value otherwise
   reaches `lib/jobs/jsonld.ts` and `lib/jobs/meta.ts` too.
11. `salary_min` and `salary_max` stored **only** when both bounds parse and are
   yearly USD, matching `web3CareerStatedSalary`. `rebuildSalaryRollups`
   averages this column directly, so one bad employer figure corrupts every
   `/web3-salaries` page.
12. **Taxonomy** via a new `attachListingTaxonomy` in
    `apps/web/lib/listings/taxonomy.ts`. It must not be the crawler's
    `attachTaxonomy`, which opens with `DELETE FROM job_tags WHERE job_id = ?`
    and `DELETE FROM job_locations WHERE job_id = ?`. It reuses the same
    vocabulary guards and the same `locationHierarchy` expansion, so a Berlin
    listing gets `berlin`, `germany` and `europe` rows exactly as a crawled one
    does.
13. `job_benefits` rows are written. This is the first code path in the repo
    that ever writes them, and it makes the `/{benefit}-jobs` landings - which
    render empty today - start to fill once a benefit clears the `count >= 5`
    sitemap threshold. That is an intended SEO surface change, called out here
    so it is not discovered later as a surprise.
14. `job_orders.status = 'published'`, `job_id` set, `paid_at` stamped.
15. Confirmation email to the buyer with the receipt and the manage link.

No `job_sightings` row is written. Sightings drive `unlistStaleApiJobs`, whose
21-day staleness sweep would otherwise unlist a paid listing.

### The crawler must not duplicate a paid listing

A namespaced `canonical_key` prevents an *overwrite*, but not a *duplicate*: if
the crawler later imports the same job from the API, a second row appears. The
crawler's ingest gains one guard - skip a draft whose canonicalised apply URL
matches an existing `source = 'employer'` job in the same tenant.

That lookup runs once per draft on a table with no index on `apply_url`, which
is how the 16-million-row day happened. Migration 0010 adds a partial index so
it seeks instead of scanning, and stays small because almost every job is
crawled, not bought:

```sql
CREATE INDEX IF NOT EXISTS idx_jobs_employer_apply
  ON jobs (apply_url) WHERE source = 'employer';
```

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
salary ranking that can be bought is not a salary ranking.

**`/ads` is rewritten here, not in section 9.** Three claims on it go false the
moment sticky and highlight are self-serve, and a fourth was always too broad:

- "Sorts to the top of every list the job already qualifies for" - narrowed to
  name the exception: date-ordered lists only, never the salary-ordered pages.
- "There is no self-serve checkout for featured placement yet. Reach out
  through the account route below and we will set it up manually." - false.
- The second "There is no self-serve checkout for this yet. Create a free
  Nodework account so we have a way to reach you" - false.
- `/post-web3-job`'s "There is a featured placement format described on the
  advertising page. It is also not self-serve yet." - false.

The "Not offered yet" list stays exactly as it is: no banners, no display
units, no newsletter sponsorship, no guaranteed impressions. Those are still
true, and they are the part of the page worth keeping.

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

Add-ons are **not** included in a bundle credit, and **cannot be bought during
a redemption**. A credit buys the $299 base post and nothing else;
`/api/listings/redeem` rejects a selection carrying sticky, highlight, logo or
auto-renew with 400 `{code:"addons_not_redeemable"}`. A buyer who wants a
sticky buys that listing as a normal single post through `/api/listings`
instead of spending a credit.

The alternative - taking a Stripe payment for the add-ons during a redemption -
was rejected because the spend above is irreversible as written: it has no
un-spend path, so a cancelled add-on payment would destroy a $299 credit and
publish nothing. Adding an add-on to an already-published listing is out of
scope in this slice, alongside editing one.

The redemption order row is a real `job_orders` row with `kind = 'single'`,
`total_cents = 0`, a single `bundle_credit` line, and `job_credits.spent_order_id`
pointing at it, so every published listing has an order behind it and the
manage page can show what became of each credit.

## 7. Coupons

`applyCoupon(quote, coupon, now)` is a pure function in the catalog module.
Validity is checked server-side at checkout - `starts_at`, `expires_at`,
`redeemed_count < max_redemptions` - and `redeemed_count` is incremented at
**fulfilment**, not at checkout creation, so an abandoned checkout does not
burn a redemption. There is no admin UI in this slice; coupons are inserted by
hand with `wrangler d1 execute`.

## 8. Auto-renew

The 30-day sticky may be set to renew. Implemented as a Stripe Checkout session
in `mode=subscription` with the 30-day sticky as the only line item carrying
`line_items[0][price_data][recurring][interval]=month` at $299, and the base
post and every other add-on as additional one-time `line_items[n]` with no
`recurring` block.

**Not `add_invoice_items`.** That field's `price_data` requires a `product` ID
string and has no `product_data`, so it cannot create a product inline, and no
Stripe Product or Price object exists for this catalog — the catalog module is
defined as pure and I/O-free precisely so that none has to. Plain `line_items`
takes the same inline `price_data[product_data][name]` shape
`checkoutFormForPlan` already emits, and Stripe's own Checkout reference says
one-time prices in a subscription session "will be on the initial invoice
only", which is exactly the behaviour wanted.

`invoice.paid` extends `featured_until` by 30 days from the later of now and
the current expiry, subject to two guards:

- **The first invoice is skipped.** An `invoice.paid` whose `billing_reason` is
  `subscription_create` is ignored: that is the payment fulfilment already ran
  on, and `publishOrder` has already set `featured_until` to 30 days out.
  Without this the buyer gets 60 days for one payment. Only
  `subscription_cycle` and `subscription_update` extend.
- **Each invoice extends at most once.** The extension is incremental, so
  unlike an absolute `period_end` upsert it is not self-idempotent, and neither
  the session index nor `publishOrder`'s `job_id` check guards it — both are
  about publishing. The `stripe_events` row is the guard.

`customer.subscription.deleted` stops extending and lets the current window run
out. When auto-renew is off - the default - the session is a plain
`mode=payment`.

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
- `apps/web/app/jobs/[slug]/unlock-form.tsx` and `unlock-form.test.ts` - the
  only importer of `lib/unlocks/client`. An orphaned file still fails
  `tsc --noEmit`, so it has to go with the directory, not merely stop being
  rendered.
- `unlockGateResponse` in `apps/web/lib/profile/gate.ts` and its test block.
  `/api/unlock` was its only caller. `safeNextPath`, `onboardingLocation`,
  `needsOnboarding` and `saveOnboardingProfile` stay - `/login` and
  `/onboarding` still use them.
- the "Email digest" panel in `apps/web/app/settings/page.tsx`, whose copy
  promises the digest "once billing is live" and whose only implementation is
  the crawler digest deleted above.

Changed:

- `job-detail-view.tsx` (which lives at `app/[slug]/[id]/job-detail-view.tsx`,
  not in `_components`): `const gated = showBadge(job.exclusivity)` goes, along
  with the `UnlockApplyForm` import and its render. Every job gets the plain
  on-site apply path. The "Not on LinkedIn" badge itself stays - it is a fact
  about the job, and was only ever incidentally the paywall trigger.
- `app/dashboard/page.tsx` loses every unlock and plan surface: the
  `lib/unlocks/history` and `lib/unlocks/quota` imports, the
  `UnlockHistoryDatabase` member of `DashboardEnv`, the three calls in its
  `Promise.all`, the `meter`, the shell lead "Your unlocks, profile and plan at
  a glance.", the "Unlocks this week" tile, the "Plan" tile and the whole
  "Recent unlocks" section. What remains is the profile tile and the latest
  jobs. `.dash-tiles` is a multi-column grid, so decide explicitly whether the
  profile tile is promoted or the grid collapses; the now-dead
  `.dash-tile--unlocks` and `.dash-meter` rules in `app/styles/account.css` go
  with it.
- `app/settings/page.tsx` says account deletion "removes your profile, CV and
  unlock history". There is no unlock history any more.
- `lib/profile/talent-pool.test.ts` imports `../unlocks/week` and
  `../unlocks/quota`. Whatever it needs from them moves with it or is inlined.
- `app/api/stripe/webhook/route.test.ts` imports `isPaidSubscription` from
  `lib/unlocks/quota`.
- `PRIVACY_COPY.jobProductPurpose` in `lib/legal/copy.ts` is the site's GDPR
  Purpose 1 statement, rendered as the entire body of the `#job-board` section
  on `/privacy`. It currently says we process "your account, profile, unlocks,
  CV, and billing data ... (sign-in, search, apply links, quota, and paid
  plans)". Unlocks, quota and candidate paid plans all stop existing, and a new
  category of data appears that it does not mention at all: employer buyer
  data - name, email, invoice details and payment records in `job_orders`. The
  purpose statement is rewritten for both.
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
| `app/dashboard/page.test.tsx` | mocks `lib/unlocks/history`; asserts "Unlocks this week", "2 of 5 used, resets Monday UTC", "Free plan" and "Recent unlocks" |
| `app/api/unlock/route.test.ts` | the whole gate contract; deleted with the route |
| `app/jobs/[slug]/unlock-form.test.ts` | deleted with the component |
| `lib/profile/gate.test.ts` | the `unlockGateResponse` block only; the rest stays |
| `lib/profile/export.test.ts`, `lib/profile/delete-account.test.ts`, `app/api/account/delete/route.test.ts` | the export's `unlocks` / `subscription` keys and the exact `SQL_DELETE_ORDER` |
| `app/privacy/page.test.tsx` | asserts `PRIVACY_COPY.jobProductPurpose` renders; it asserts the constant, so it will not catch a stale rewrite |
| `app/ads/page.test.tsx` | the "not self-serve yet" claims |

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
  every row of `BUNDLE_LADDER` including both changes of step size and the cap
  at the last row, coupon percent and amount, the never-below-zero floor, the
  1-to-49-cent clamp, and the exact reference totals ($299 alone; $448 for
  their default cart).
- `publish.test.ts` - against a `node:sqlite` database seeded from the real
  migrations: publishes once, is idempotent on a second call, resolves a slug
  collision, refuses a non-yearly-USD salary, writes the three-row Berlin
  location hierarchy, writes a sanitized description, and never writes a
  sighting row.
- `credits.test.ts` - concurrent redemption spends exactly one credit; an
  expired credit is not spendable.
- webhook - a replayed `checkout.session.completed` publishes one listing, not
  two; a replayed bundle completion mints N credits, not 2N; a session with
  `payment_status: "unpaid"` publishes nothing; `async_payment_failed` after an
  `unpaid` completion leaves the order `failed` and no listing live; an
  `invoice.paid` with `billing_reason: "subscription_create"` does not extend
  the sticky window a second time.
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

**The two migrations go on opposite sides of the deploy.**

`0010_employer_listings.sql` only widens the schema, so it is applied
**before** the deploy that starts selecting the new columns.
`0011_drop_candidate_paywall.sql` drops tables the currently-live worker still
reads on every request, so it is applied **after** the deploy, once the code
that reads them is gone. Running 0011 first 500s `/dashboard`, the GDPR export
and account deletion for the whole window between migration and deploy.

Migration 0010 must be applied to production before the deploy that starts
selecting the new columns. `/web3-companies/[slug]` has `revalidate = 300` and
no `generateStaticParams`, so it renders against the production database on
every request; a schema-widening deploy that lands first returns 500 from every
template that reads a new column, and the post-deploy smoke check only probes
routes that may not exercise them.
