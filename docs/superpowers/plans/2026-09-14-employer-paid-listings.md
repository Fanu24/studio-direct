# Employer-Paid Listings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Employers buy a job listing in USD at web3.career's price list; candidates pay nothing, ever.

**Architecture:** A submitted listing is stored as a `job_orders` row and only becomes a `jobs` row when Stripe confirms payment, so the catalog never holds an unpaid listing. Price arithmetic lives in one pure module that the form, the checkout, the receipt and the tests all read. The candidate subscription and the unlock quota are deleted outright.

**Tech Stack:** Next.js App Router on Cloudflare Workers via OpenNext, D1 (SQLite), Better Auth, Stripe REST (no SDK, hand-rolled `fetch` + HMAC), Vitest with `node:sqlite` as the in-memory D1, custom CSS (no Tailwind, no component library).

**Spec:** `docs/superpowers/specs/2026-09-14-employer-paid-listings-design.md` — read it before Task 1. Every task below argues from it.

## Global Constraints

- **Money is integer cents.** No floats, no currency conversion. `LISTING_CURRENCY = "usd"`.
- **Prices are exactly the reference's:** base 29_900; sticky 4_900 / 9_900 / 14_900 / 19_900 / 29_900 for 1 / 3 / 7 / 14 / 30 days; highlight 9_900 standard, 14_900 custom; logo 4_900. **Premium support is not sold** — the repo has no contact route, no support address and no channel of any kind, and this project does not charge for what it cannot deliver.
- **Apply always stays on Nodework.** `jobs.apply_url` holds the employer's own posting URL for dedupe and support; it is never rendered as the public apply button. There is no redirect option.
- **The company logo is a URL, not an upload.** `companies.logo_url` is rendered straight into an `<img src>` and emitted as `hiringOrganization.logo` in JSON-LD; every value in that column today is an absolute URL.
- **The webhook is idempotent through `stripe_events`,** not through any index on `job_orders`. Stripe delivers at least once and retries every non-2xx.
- **Every migration file must be idempotent.** `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`. `ALTER TABLE ADD COLUMN` has no `IF NOT EXISTS` and fails loudly on a second run; that is accepted and documented in the file header, as in `0009_company_description.sql`.
- **`verbatimModuleSyntax: true`** — type-only imports must be written `import type { X } from "y"` or `import { a, type B } from "y"`.
- **`apps/web/lib/**` uses named exports only.** `export default` appears only in `app/**` for Next page/layout/route files.
- **Import order:** `node:*`, then external packages, then a blank line, then relative imports.
- **`apps/web` and `apps/crawler` use extensionless relative imports.** `packages/shared` and `packages/db` use explicit `.ts`.
- **Page tests walk only `props.children` and never invoke components.** Any component whose copy is asserted must be called as a plain function — `{PriceTable({ ... })}` — not rendered as `<PriceTable />`.
- **Never silently delete a test assertion.** If a task changes one, the task says so and replaces it with an assertion on the new invariant.
- **Copy rules:** no em dashes, no "Trusted by", no fabricated KPIs, no unverified performance claims (this is why the reference's "3x more views" badges are not copied). A studio never receives a candidate profile because someone applied.
- **CSS:** new stylesheets are imported only from `app/layout.tsx`, declare no custom properties and no `:root` block, and use no selector more specific than a single class around a `.button`.
- **Windows note:** never run `pnpm --filter @gaming/web cf:build` locally. It bakes absolute `C:\Users\...` paths into the bundle. Production builds happen in CI only.
- **Never run `next build` while `next dev` is running on the same app** — the build overwrites `.next` and dev then serves pages with no CSS.

---

## File Structure

**Created**

| file | responsibility |
|---|---|
| `apps/web/lib/billing/listing-catalog.ts` | All price arithmetic. Pure, no I/O. |
| `apps/web/lib/billing/stripe.ts` | `verifyStripeWebhook`, moved out of `plans.ts`. |
| `apps/web/lib/billing/listing-checkout.ts` | Builds the Stripe Checkout session body for an order. |
| `apps/web/lib/listings/draft.ts` | Parse and validate a submitted listing. |
| `apps/web/lib/listings/orders.ts` | `job_orders` read/write, manage tokens. |
| `apps/web/lib/listings/taxonomy.ts` | Non-destructive tag / location / benefit attach. |
| `apps/web/lib/listings/publish.ts` | `publishOrder` — order becomes a live job. |
| `apps/web/lib/listings/credits.ts` | Bundle credit ledger. |
| `apps/web/lib/listings/coupons.ts` | Coupon lookup and redemption counting. |
| `apps/web/lib/listings/email.ts` | Receipt and manage-link email bodies. |
| `apps/web/app/api/listings/route.ts` | Submit a listing, create a checkout session. |
| `apps/web/app/api/listings/redeem/route.ts` | Spend a bundle credit. |
| `apps/web/app/post-web3-job/checkout/success/page.tsx` | Post-payment confirmation. |
| `apps/web/app/post-web3-job/checkout/cancel/page.tsx` | Abandoned checkout. |
| `apps/web/app/post-web3-job/manage/[token]/page.tsx` | Order status, credits, spend a credit. |
| `apps/web/app/_components/listing-form.tsx` | The employer form. |
| `apps/web/app/_components/price-table.tsx` | Price list, shared by `/pricing`, `/post-web3-job`, `/ads`. |
| `apps/web/app/styles/checkout.css` | Styles for the form, the add-on rows and the order summary. |
| `packages/db/migrations/0010_employer_listings.sql` | Adds `job_orders`, `job_credits`, `coupons`, two `jobs` columns. |
| `packages/db/migrations/0011_drop_candidate_paywall.sql` | Drops `unlocks` and `subscriptions`. |

**Modified**

| file | change |
|---|---|
| `apps/web/lib/jobs/queries.ts` | Sticky expiry in `ORDER BY`; select `order_id`, `highlight_color`. |
| `apps/web/app/_components/job-row.tsx` | Sticky is `featuredUntil > now`, not presence. |
| `apps/web/app/api/stripe/webhook/route.ts` | Fulfil orders; keep signature verification. |
| `apps/web/app/post-web3-job/page.tsx` | Real form. |
| `apps/web/app/post-web3-job/bundle/page.tsx` | Real bundle calculator. |
| `apps/web/app/pricing/page.tsx` | Employer price list. |
| `apps/web/app/ads/page.tsx` | Real sticky and highlight prices. |
| `apps/web/app/_components/job-detail-view.tsx` | Unlock gate removed. |
| `apps/web/lib/legal/copy.ts` | `PRICING_COPY` rewritten. |
| `apps/web/lib/profile/export.ts`, `delete-account.ts` | Drop `unlocks` and `subscription`. |
| `apps/web/app/robots.ts`, `app/sitemap.ts` | New private paths. |
| `apps/web/app/layout.tsx` | Import `checkout.css`. |
| `apps/web/qa/templates.mjs` | Rows for the new routes. |
| `packages/db/src/schema.ts` | Re-sync with the SQL. |
| `packages/shared/src/jobs.ts` | `'employer'` added to the source union. |
| `apps/crawler/src/pipeline/ingest.ts` | Skip drafts that duplicate an employer listing. |

**Deleted**

`apps/web/lib/unlocks/` (all four files and tests), `apps/web/app/api/unlock/`, `apps/web/app/api/stripe/checkout/`, `apps/web/app/_components/home/pricing-teaser.tsx`, `apps/crawler/src/digest.ts` and `digest.test.ts`, and the plan table from `apps/web/lib/billing/plans.ts` (the file itself goes once `verifyStripeWebhook` has moved).

---

## Phase 1: The money model

### Task 1: Price catalog

**Files:**
- Create: `apps/web/lib/billing/listing-catalog.ts`
- Test: `apps/web/lib/billing/listing-catalog.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `LISTING_CURRENCY`, `LISTING_BASE_CENTS`, `STICKY_TIERS`, `HIGHLIGHT_TIERS`, `LOGO_CENTS`, `BUNDLE_LADDER`, types `StickyDays`, `HighlightTier`, `ListingSelection`, `QuoteLine`, `Quote`, `Coupon`, and functions `quoteListing`, `quoteBundle`, `bundleDiscountPercent`, `applyCoupon`, `formatUsd`, `isStickyDays`, `isHighlightTier`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import {
  applyCoupon,
  bundleDiscountPercent,
  formatUsd,
  quoteBundle,
  quoteListing,
  type ListingSelection,
} from "./listing-catalog";

const BARE: ListingSelection = {
  stickyDays: 0,
  highlight: "none",
  highlightColor: null,
  logo: false,
  autoRenew: false,
};

describe("quoteListing", () => {
  it("charges the base post alone", () => {
    const quote = quoteListing(BARE);
    expect(quote.totalCents).toBe(29_900);
    expect(quote.lines).toHaveLength(1);
    expect(quote.lines[0]?.code).toBe("base");
  });

  it("matches the reference default cart of base plus 7 day sticky", () => {
    expect(quoteListing({ ...BARE, stickyDays: 7 }).totalCents).toBe(44_800);
  });

  it("prices every sticky tier", () => {
    const totals = [0, 1, 3, 7, 14, 30].map(
      (days) => quoteListing({ ...BARE, stickyDays: days as 0 }).totalCents,
    );
    expect(totals).toEqual([29_900, 34_800, 39_800, 44_800, 49_800, 59_800]);
  });

  it("prices both highlight tiers and the logo", () => {
    expect(quoteListing({ ...BARE, highlight: "standard" }).totalCents).toBe(39_800);
    expect(quoteListing({ ...BARE, highlight: "custom" }).totalCents).toBe(44_800);
    expect(quoteListing({ ...BARE, logo: true }).totalCents).toBe(34_800);
  });

  it("adds every add-on together", () => {
    const quote = quoteListing({
      stickyDays: 30,
      highlight: "custom",
      highlightColor: "#008fd6",
      logo: true,
      autoRenew: true,
    });
    expect(quote.totalCents).toBe(29_900 + 29_900 + 14_900 + 4_900);
  });
});

describe("bundleDiscountPercent", () => {
  it("gives nothing below two posts", () => {
    expect(bundleDiscountPercent(1)).toBe(0);
  });

  it("reproduces the reference ladder", () => {
    expect(bundleDiscountPercent(2)).toBe(20);
    expect(bundleDiscountPercent(3)).toBe(20);
    expect(bundleDiscountPercent(4)).toBe(29);
    expect(bundleDiscountPercent(6)).toBe(30);
    expect(bundleDiscountPercent(30)).toBe(42);
    expect(bundleDiscountPercent(40)).toBe(55);
  });

  it("caps at 55 percent above forty posts", () => {
    expect(bundleDiscountPercent(500)).toBe(55);
  });
});

describe("quoteBundle", () => {
  it("discounts ten posts by 32 percent", () => {
    const quote = quoteBundle(10);
    expect(quote.subtotalCents).toBe(299_000);
    expect(quote.discountCents).toBe(95_680);
    expect(quote.totalCents).toBe(203_320);
  });

  it("never returns a fractional cent", () => {
    for (let posts = 1; posts <= 50; posts += 1) {
      expect(Number.isInteger(quoteBundle(posts).totalCents)).toBe(true);
    }
  });
});

describe("applyCoupon", () => {
  const now = new Date("2026-09-14T00:00:00.000Z");

  it("takes a percentage off the post-bundle subtotal", () => {
    const quote = applyCoupon(quoteListing(BARE), {
      code: "LAUNCH",
      kind: "percent",
      value: 10,
      maxRedemptions: null,
      redeemedCount: 0,
      startsAt: null,
      expiresAt: null,
    }, now);
    expect(quote.totalCents).toBe(26_910);
  });

  it("never takes the total below zero", () => {
    const quote = applyCoupon(quoteListing(BARE), {
      code: "FREE",
      kind: "amount",
      value: 999_999,
      maxRedemptions: null,
      redeemedCount: 0,
      startsAt: null,
      expiresAt: null,
    }, now);
    expect(quote.totalCents).toBe(0);
  });

  it("clamps a sub-minimum remainder to zero", () => {
    // Stripe refuses a mode=payment session under $0.50, so a coupon that all
    // but clears the cart must never reach it. 29_900 - 29_870 = 30 cents.
    const quote = applyCoupon(quoteListing(BARE), {
      code: "NEARLY",
      kind: "amount",
      value: 29_870,
      maxRedemptions: null,
      redeemedCount: 0,
      startsAt: null,
      expiresAt: null,
    }, now);
    expect(quote.totalCents).toBe(0);
  });

  it("leaves a total at or above the stripe minimum alone", () => {
    const quote = applyCoupon(quoteListing(BARE), {
      code: "ALMOST",
      kind: "amount",
      value: 29_850,
      maxRedemptions: null,
      redeemedCount: 0,
      startsAt: null,
      expiresAt: null,
    }, now);
    expect(quote.totalCents).toBe(50);
  });

  it("ignores an expired or exhausted coupon", () => {
    const expired = applyCoupon(quoteListing(BARE), {
      code: "OLD",
      kind: "percent",
      value: 50,
      maxRedemptions: null,
      redeemedCount: 0,
      startsAt: null,
      expiresAt: "2026-01-01T00:00:00.000Z",
    }, now);
    expect(expired.totalCents).toBe(29_900);

    const used = applyCoupon(quoteListing(BARE), {
      code: "GONE",
      kind: "percent",
      value: 50,
      maxRedemptions: 5,
      redeemedCount: 5,
      startsAt: null,
      expiresAt: null,
    }, now);
    expect(used.totalCents).toBe(29_900);
  });
});

describe("formatUsd", () => {
  it("renders whole dollars without decimals", () => {
    expect(formatUsd(29_900)).toBe("$299");
  });

  it("renders part dollars with two decimals", () => {
    expect(formatUsd(26_910)).toBe("$269.10");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- listing-catalog`
Expected: FAIL, "Failed to resolve import ./listing-catalog".

- [ ] **Step 3: Write the implementation**

```ts
export const LISTING_CURRENCY = "usd" as const;
export const LISTING_BASE_CENTS = 29_900;
export const LOGO_CENTS = 4_900;

export const STICKY_TIERS = [
  { days: 0, cents: 0 },
  { days: 1, cents: 4_900 },
  { days: 3, cents: 9_900 },
  { days: 7, cents: 14_900 },
  { days: 14, cents: 19_900 },
  { days: 30, cents: 29_900 },
] as const;

export const HIGHLIGHT_TIERS = {
  none: 0,
  standard: 9_900,
  custom: 14_900,
} as const;

/**
 * The reference ladder is not linear: it jumps 20 -> 29 between two and four
 * posts, then climbs one point per two posts, then jumps 51 -> 55 at the top.
 * It is therefore a table of breakpoints, not a formula.
 */
export const BUNDLE_LADDER = [
  { minPosts: 2, percent: 20 }, { minPosts: 4, percent: 29 },
  { minPosts: 6, percent: 30 }, { minPosts: 8, percent: 31 },
  { minPosts: 10, percent: 32 }, { minPosts: 12, percent: 33 },
  { minPosts: 14, percent: 34 }, { minPosts: 16, percent: 35 },
  { minPosts: 18, percent: 36 }, { minPosts: 20, percent: 37 },
  { minPosts: 22, percent: 38 }, { minPosts: 24, percent: 39 },
  { minPosts: 26, percent: 40 }, { minPosts: 28, percent: 41 },
  { minPosts: 30, percent: 42 }, { minPosts: 31, percent: 43 },
  { minPosts: 32, percent: 44 }, { minPosts: 33, percent: 45 },
  { minPosts: 34, percent: 46 }, { minPosts: 35, percent: 47 },
  { minPosts: 36, percent: 48 }, { minPosts: 37, percent: 49 },
  { minPosts: 38, percent: 50 }, { minPosts: 39, percent: 51 },
  { minPosts: 40, percent: 55 },
] as const;

export type StickyDays = (typeof STICKY_TIERS)[number]["days"];
export type HighlightTier = keyof typeof HIGHLIGHT_TIERS;

export type ListingSelection = {
  stickyDays: StickyDays;
  highlight: HighlightTier;
  highlightColor: string | null;
  logo: boolean;
  autoRenew: boolean;
};

export type QuoteLine = {
  code: string;
  label: string;
  unitCents: number;
  quantity: number;
  amountCents: number;
};

export type Quote = {
  lines: QuoteLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
};

export type Coupon = {
  code: string;
  kind: "percent" | "amount";
  value: number;
  maxRedemptions: number | null;
  redeemedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
};

export function isStickyDays(value: unknown): value is StickyDays {
  return STICKY_TIERS.some((tier) => tier.days === value);
}

export function isHighlightTier(value: unknown): value is HighlightTier {
  return value === "none" || value === "standard" || value === "custom";
}

function stickyCents(days: StickyDays): number {
  return STICKY_TIERS.find((tier) => tier.days === days)?.cents ?? 0;
}

function line(code: string, label: string, cents: number, quantity = 1): QuoteLine {
  return { code, label, unitCents: cents, quantity, amountCents: cents * quantity };
}

function totalled(lines: QuoteLine[], discountCents: number): Quote {
  const subtotalCents = lines.reduce((sum, item) => sum + item.amountCents, 0);
  return {
    lines,
    subtotalCents,
    discountCents,
    totalCents: Math.max(0, subtotalCents - discountCents),
  };
}

export function quoteListing(selection: ListingSelection): Quote {
  const lines = [line("base", "Job post", LISTING_BASE_CENTS)];

  const sticky = stickyCents(selection.stickyDays);
  if (sticky > 0) {
    lines.push(line("sticky", `Pinned to the top for ${selection.stickyDays} days`, sticky));
  }

  const highlight = HIGHLIGHT_TIERS[selection.highlight];
  if (highlight > 0) {
    lines.push(line(
      "highlight",
      selection.highlight === "custom" ? "Highlighted row, your colour" : "Highlighted row",
      highlight,
    ));
  }

  if (selection.logo) lines.push(line("logo", "Company logo on the row", LOGO_CENTS));

  return totalled(lines, 0);
}

export function bundleDiscountPercent(posts: number): number {
  let percent = 0;
  for (const step of BUNDLE_LADDER) {
    if (posts >= step.minPosts) percent = step.percent;
  }
  return percent;
}

export function quoteBundle(posts: number): Quote {
  const count = Math.max(1, Math.floor(posts));
  const lines = [line("base", "Job post", LISTING_BASE_CENTS, count)];
  const subtotal = LISTING_BASE_CENTS * count;
  const discount = Math.round((subtotal * bundleDiscountPercent(count)) / 100);
  return totalled(lines, discount);
}

function couponIsUsable(coupon: Coupon, now: Date): boolean {
  if (coupon.maxRedemptions !== null && coupon.redeemedCount >= coupon.maxRedemptions) {
    return false;
  }
  if (coupon.startsAt && Date.parse(coupon.startsAt) > now.getTime()) return false;
  if (coupon.expiresAt && Date.parse(coupon.expiresAt) <= now.getTime()) return false;
  return true;
}

/** Stripe refuses a mode=payment session below this. */
export const STRIPE_MINIMUM_CENTS = 50;

export function applyCoupon(quote: Quote, coupon: Coupon | null, now: Date): Quote {
  if (!coupon || !couponIsUsable(coupon, now)) return quote;

  const base = quote.subtotalCents - quote.discountCents;
  const off = coupon.kind === "percent"
    ? Math.round((base * Math.min(100, Math.max(0, coupon.value))) / 100)
    : Math.max(0, coupon.value);

  const raw = Math.max(0, base - off);
  // A 37-cent remainder is not something the buyer can do anything about, and
  // Stripe will not take it. Forgive it: at most 49 cents, and it removes a
  // branch the UI would otherwise have to explain.
  const total = raw > 0 && raw < STRIPE_MINIMUM_CENTS ? 0 : raw;

  return {
    ...quote,
    discountCents: quote.subtotalCents - total,
    totalCents: total,
  };
}

export function formatUsd(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const rest = Math.abs(cents % 100);
  return rest === 0 ? `$${whole}` : `$${whole}.${String(rest).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/web test -- listing-catalog`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/billing/listing-catalog.ts apps/web/lib/billing/listing-catalog.test.ts
git commit -m "feat(web): the listing price list, in one place"
```

---

### Task 2: Migration 0010 and the schema re-sync

**Files:**
- Create: `packages/db/migrations/0010_employer_listings.sql`
- Modify: `packages/db/src/schema.ts`
- Test: `packages/db/src/migrations-apply.test.ts` (add an idempotence case)

**Interfaces:**
- Consumes: nothing.
- Produces: tables `job_orders`, `job_credits`, `coupons`; columns `jobs.order_id`, `jobs.highlight_color`. Every later task binds against these names.

- [ ] **Step 1: Write the failing test**

Append to `packages/db/src/migrations-apply.test.ts`:

```ts
it("creates the employer listing tables", () => {
  const db = applyAllMigrations();
  const names = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => (row as { name: string }).name);

  expect(names).toContain("job_orders");
  expect(names).toContain("job_credits");
  expect(names).toContain("coupons");
  expect(names).toContain("stripe_events");

  const jobColumns = db
    .prepare("PRAGMA table_info(jobs)")
    .all()
    .map((row) => (row as { name: string }).name);
  expect(jobColumns).toContain("order_id");
  expect(jobColumns).toContain("highlight_color");
});

it("re-runs 0010's table and index statements without error", () => {
  const db = applyAllMigrations();
  const sql = readFileSync(
    join(MIGRATIONS_DIR, "0010_employer_listings.sql"),
    "utf8",
  );
  // ALTER TABLE ADD COLUMN has no IF NOT EXISTS and is expected to throw on a
  // second run; every other statement must be safely repeatable.
  const repeatable = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0 && !/^ALTER TABLE/i.test(statement));

  for (const statement of repeatable) {
    expect(() => db.exec(`${statement};`)).not.toThrow();
  }
});
```

If `applyAllMigrations`, `MIGRATIONS_DIR` or the `readFileSync`/`join` imports do not already exist in that file, read the file first and reuse whatever it already calls its helpers; do not introduce a second way of applying migrations.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/db test`
Expected: FAIL, "expected [ ... ] to contain 'job_orders'".

- [ ] **Step 3: Write the migration**

`packages/db/migrations/0010_employer_listings.sql`:

```sql
-- Employer-paid listings. Candidates stop paying; a listing is bought by the
-- employer who posts it.
--
-- Idempotent on purpose: production's d1_migrations table is empty, so
-- `wrangler d1 migrations apply --remote` restarts from 0001 and dies on
-- "table tenants already exists". A single migration is applied to production
-- with `wrangler d1 execute gaming-jobs --remote --file <path>`, which has no
-- once-only bookkeeping and may be run twice.
--
-- `ALTER TABLE ... ADD COLUMN` has no IF NOT EXISTS in SQLite, so a second run
-- of this file fails with "duplicate column name". That failure is loud and
-- harmless: it means the column is already there.

CREATE TABLE IF NOT EXISTS job_orders (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_name TEXT,
  company_name TEXT,
  invoice_info TEXT,
  currency TEXT NOT NULL DEFAULT 'usd',
  subtotal_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  coupon_code TEXT,
  line_items_json TEXT NOT NULL,
  draft_json TEXT,
  bundle_posts INTEGER,
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  stripe_subscription_id TEXT,
  job_id TEXT,
  user_id TEXT,
  manage_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_orders_session
  ON job_orders (stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_orders_manage
  ON job_orders (manage_token_hash);
CREATE INDEX IF NOT EXISTS idx_job_orders_email ON job_orders (buyer_email, created_at);
CREATE INDEX IF NOT EXISTS idx_job_orders_status ON job_orders (status, created_at);

CREATE TABLE IF NOT EXISTS job_credits (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  slot_index INTEGER NOT NULL,
  buyer_email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  spent_at TEXT,
  spent_order_id TEXT,
  job_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_credits_email
  ON job_credits (buyer_email, spent_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_job_credits_order ON job_credits (order_id);

-- Minting is INSERT OR IGNORE over slots 0..N-1, so a replayed webhook cannot
-- mint an extra credit even if it somehow got past the stripe_events guard.
-- Without this, one retry of a 25-post bundle mints 25 free listings.
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_credits_slot
  ON job_credits (order_id, slot_index);

-- The actual webhook idempotency mechanism. Stripe delivers at least once and
-- retries every non-2xx; the unique index on job_orders.stripe_session_id does
-- NOT help, because the webhook never inserts an order row - POST /api/listings
-- already did. The handler's first write is
--   INSERT INTO stripe_events (...) VALUES (...) ON CONFLICT(id) DO NOTHING
-- and zero rows changed means "already handled, return 200 and stop".
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  order_id TEXT,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  value INTEGER NOT NULL,
  max_redemptions INTEGER,
  redeemed_count INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL
);

-- Which order paid for this listing. Nothing in the schema connected a job to
-- a buyer before: jobs had no user_id, owner_id or order_id, and companies had
-- no owner either.
ALTER TABLE jobs ADD COLUMN order_id TEXT;

-- The hex for the custom brand colour tier. jobs.highlight is an INTEGER and
-- job-row.tsx renders on `highlight === 1`, so the two paid tiers cannot be
-- encoded as 1 and 2 - tier 2 would sort above tier 1 and render unhighlighted.
-- Both paid tiers set highlight = 1; this column tells them apart.
ALTER TABLE jobs ADD COLUMN highlight_color TEXT;

CREATE INDEX IF NOT EXISTS idx_jobs_order ON jobs (order_id);

-- The crawler's new anti-duplicate guard looks a draft's canonicalised apply
-- URL up against employer listings, once per draft. jobs has no index on
-- apply_url, and an unindexed per-draft scan of jobs is exactly how 1,283
-- queries came to read 16,180,262 rows in a day. Partial, so it stays small:
-- almost every job is crawled, not bought.
CREATE INDEX IF NOT EXISTS idx_jobs_employer_apply
  ON jobs (apply_url) WHERE source = 'employer';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/db test`
Expected: PASS.

- [ ] **Step 5: Re-sync the drizzle schema**

`packages/db/src/schema.ts` has already drifted: it is missing `companies.description` from migration 0009 and declares only two of the eight `jobs` indexes. Add `description` to `companies`, add `orderId` and `highlightColor` to `jobs`, and declare the three new tables. Follow the table-definition style already in that file exactly.

- [ ] **Step 6: Type-check and commit**

```bash
pnpm --filter @gaming/db typecheck && pnpm --filter @gaming/db test
git add packages/db/migrations/0010_employer_listings.sql packages/db/src/schema.ts packages/db/src/migrations-apply.test.ts
git commit -m "feat(db): tables for orders, bundle credits and coupons"
```

---

### Task 3: Move the webhook verifier out of the plan module

**Files:**
- Create: `apps/web/lib/billing/stripe.ts`
- Modify: `apps/web/lib/billing/plans.ts`, `apps/web/lib/billing/plans.test.ts`, `apps/web/app/api/stripe/webhook/route.ts`
- Test: `apps/web/lib/billing/stripe.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `verifyStripeWebhook({ payload, header, secret, now?, toleranceSeconds? }): boolean` and `isStripeCheckoutEnabled(value): boolean` from `lib/billing/stripe.ts`. Tasks 11, 12, 13, 19, 20 and 21 import them from there.

This is a pure move so that Task 17 can delete `plans.ts` without taking either function with it. Both move now rather than later, so no task written after this one ever imports from `plans.ts`.

- [ ] **Step 1: Move the two survivors**

Cut `verifyStripeWebhook`, its private helper `safeEqualHex`, and `isStripeCheckoutEnabled` out of `apps/web/lib/billing/plans.ts` into a new `apps/web/lib/billing/stripe.ts`, keeping the bodies byte-identical. The new file's only import is `import { createHmac, timingSafeEqual } from "node:crypto";`.

Re-point the existing consumers of `isStripeCheckoutEnabled` — `app/pricing/page.tsx` and `app/api/stripe/checkout/route.ts` — at the new path. Both are rewritten or deleted later, but they must compile now.

- [ ] **Step 2: Move its tests**

Move every `describe("verifyStripeWebhook", ...)` block out of `plans.test.ts` into a new `stripe.test.ts`, changing only the import path. Do not weaken an assertion while moving it.

- [ ] **Step 3: Re-point the one consumer**

In `apps/web/app/api/stripe/webhook/route.ts`, import `verifyStripeWebhook` from `../../../../lib/billing/stripe` instead of `../../../../lib/billing/plans`.

- [ ] **Step 4: Run the suite**

Run: `pnpm --filter @gaming/web test && pnpm --filter @gaming/web typecheck`
Expected: PASS, with the same total test count as before the move.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/billing apps/web/app/api/stripe/webhook/route.ts
git commit -m "refactor(web): the webhook verifier is not part of the plan table"
```

---

## Phase 2: The listing domain

### Task 4: Draft validation

**Files:**
- Create: `apps/web/lib/listings/draft.ts`
- Test: `apps/web/lib/listings/draft.test.ts`

**Interfaces:**
- Consumes: `isJobTag`, `isCitySlug`, `isCountrySlug`, `isRegionSlug`, `slugifyTag`, `BENEFITS` from `@gaming/shared`; `sanitizeJobDescriptionHtml` from `../jobs/sanitize-description`.
- Produces: `type ListingDraft`, `type DraftResult`, `parseListingDraft(raw: Record<string, string>): DraftResult`.

Read `apps/web/lib/jobs/apply.ts` first; this file follows its shape exactly (`cleanText`, the `EMAIL` and `HTTP_URL` regexes, a discriminated result rather than thrown errors).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { parseListingDraft } from "./draft";

const RAW = {
  title: "Senior Solidity Engineer",
  description: "<p>Build the thing.</p><script>alert(1)</script>",
  companyName: "Acme Labs",
  companyUrl: "https://acme.example",
  location: "Berlin",
  remote: "onsite",
  mainTag: "solidity",
  tags: "solidity,rust",
  benefits: "pay-in-crypto",
  twitter: "@acme",
  salaryMin: "120000",
  salaryMax: "180000",
  postingUrl: "",
  buyerName: "Dana Fox",
  buyerEmail: "dana@acme.example",
  invoiceInfo: "Acme Labs, Berlin, VAT DE123",
  companyLogoUrl: "",
};

describe("parseListingDraft", () => {
  it("accepts a complete submission and strips script tags", () => {
    const result = parseListingDraft(RAW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.title).toBe("Senior Solidity Engineer");
    expect(result.draft.descriptionHtml).toContain("Build the thing.");
    expect(result.draft.descriptionHtml).not.toContain("script");
  });

  it("rejects a company URL that is not http", () => {
    const result = parseListingDraft({ ...RAW, companyUrl: "acme.example" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.companyUrl).toBeTruthy();
  });

  it("rejects an unknown tag rather than dropping it", () => {
    const result = parseListingDraft({ ...RAW, tags: "solidity,not-a-real-tag" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.tags).toBeTruthy();
  });

  it("rejects an unknown location rather than dropping it", () => {
    const result = parseListingDraft({ ...RAW, location: "Atlantis" });
    expect(result.ok).toBe(false);
  });

  it("accepts a remote listing with no location", () => {
    const result = parseListingDraft({ ...RAW, remote: "remote", location: "" });
    expect(result.ok).toBe(true);
  });

  it("drops a salary that is not a complete pair", () => {
    const result = parseListingDraft({ ...RAW, salaryMax: "" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.salaryMin).toBeNull();
    expect(result.draft.salaryMax).toBeNull();
  });

  it("drops a salary whose bounds are inverted", () => {
    const result = parseListingDraft({ ...RAW, salaryMin: "200000", salaryMax: "100000" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.salaryMin).toBeNull();
  });

  it("accepts a submission with no posting URL of its own", () => {
    expect(parseListingDraft({ ...RAW, postingUrl: "" }).ok).toBe(true);
  });

  it("rejects a posting URL or logo URL that is not http", () => {
    expect(parseListingDraft({ ...RAW, postingUrl: "acme.example/jobs/1" }).ok).toBe(false);
    expect(parseListingDraft({ ...RAW, companyLogoUrl: "acme.example/logo.png" }).ok).toBe(false);
  });

  it("requires a buyer email", () => {
    expect(parseListingDraft({ ...RAW, buyerEmail: "nope" }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- listings/draft`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the implementation**

The rule that matters: **an unknown tag or location is an error, not a silent drop.** The crawler's `attachTaxonomy` filters unknown slugs away, which is right for an import it does not control and wrong for a $299 purchase — the employer would pay for a listing that appears on no landing page.

```ts
import {
  BENEFITS,
  isCitySlug,
  isCountrySlug,
  isJobTag,
  isRegionSlug,
  slugifyTag,
} from "@gaming/shared";

import { sanitizeJobDescriptionHtml } from "../jobs/sanitize-description";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTTP_URL = /^https?:\/\/[^\s]+$/i;

export type ListingDraft = {
  title: string;
  descriptionHtml: string;
  companyName: string;
  companyUrl: string;
  companyLogoUrl: string | null;
  location: string | null;
  locationSlug: string | null;
  remote: "remote" | "hybrid" | "onsite";
  mainTag: string;
  tags: string[];
  benefits: string[];
  twitter: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  postingUrl: string | null;
  buyerName: string;
  buyerEmail: string;
  invoiceInfo: string | null;
};

export type DraftResult =
  | { ok: true; draft: ListingDraft }
  | { ok: false; errors: Record<string, string> };

function cleanText(value: string | undefined, max: number): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => slugifyTag(item.trim()))
    .filter((item) => item.length > 0);
}

function yearlyUsd(min: string | undefined, max: string | undefined) {
  const low = Number.parseInt((min ?? "").trim(), 10);
  const high = Number.parseInt((max ?? "").trim(), 10);
  if (!Number.isFinite(low) || !Number.isFinite(high)) return { min: null, max: null };
  if (low <= 0 || high <= 0 || high < low) return { min: null, max: null };
  return { min: low, max: high };
}

export function parseListingDraft(raw: Record<string, string>): DraftResult {
  const errors: Record<string, string> = {};

  const title = cleanText(raw.title, 160);
  if (title.length < 3) errors.title = "Give the role a title.";

  const descriptionHtml = sanitizeJobDescriptionHtml((raw.description ?? "").trim());
  if (descriptionHtml.replace(/<[^>]*>/g, "").trim().length < 40) {
    errors.description = "Describe the role in at least a short paragraph.";
  }

  const companyName = cleanText(raw.companyName, 120);
  if (companyName.length < 2) errors.companyName = "Give the company name.";

  const companyUrl = (raw.companyUrl ?? "").trim();
  if (!HTTP_URL.test(companyUrl)) {
    errors.companyUrl = "Company URL must start with https://.";
  }

  const remote = raw.remote === "remote" || raw.remote === "hybrid" ? raw.remote : "onsite";

  const locationText = cleanText(raw.location, 120);
  let locationSlug: string | null = null;
  if (remote === "remote" && !locationText) {
    locationSlug = null;
  } else if (!locationText) {
    errors.location = "Give a location, or mark the role remote.";
  } else {
    const slug = slugifyTag(locationText);
    if (isCitySlug(slug) || isCountrySlug(slug) || isRegionSlug(slug)) {
      locationSlug = slug;
    } else {
      errors.location = "Pick a location from the list.";
    }
  }

  const mainTag = slugifyTag(cleanText(raw.mainTag, 60));
  if (!isJobTag(mainTag)) errors.mainTag = "Pick a main skill from the list.";

  const tags = Array.from(new Set([mainTag, ...list(raw.tags)])).filter(Boolean);
  if (tags.some((tag) => !isJobTag(tag))) {
    errors.tags = "One of those skills is not on the list.";
  }

  const benefits = list(raw.benefits);
  if (benefits.some((benefit) => !BENEFITS.includes(benefit))) {
    errors.benefits = "One of those benefits is not on the list.";
  }

  // The employer's own posting URL. Optional, stored for dedupe and support,
  // never rendered as the public apply button - apply always stays on Nodework.
  const postingUrl = (raw.postingUrl ?? "").trim();
  if (postingUrl && !HTTP_URL.test(postingUrl)) {
    errors.postingUrl = "That posting URL must start with https://.";
  }

  const companyLogoUrl = (raw.companyLogoUrl ?? "").trim();
  if (companyLogoUrl && !HTTP_URL.test(companyLogoUrl)) {
    errors.companyLogoUrl = "The logo URL must start with https://.";
  }

  const buyerName = cleanText(raw.buyerName, 120);
  if (buyerName.length < 2) errors.buyerName = "Give your name.";

  const buyerEmail = (raw.buyerEmail ?? "").trim().toLowerCase();
  if (!EMAIL.test(buyerEmail)) errors.buyerEmail = "Give an email we can reach you at.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const salary = yearlyUsd(raw.salaryMin, raw.salaryMax);
  const twitter = cleanText(raw.twitter, 60).replace(/^@/, "");

  return {
    ok: true,
    draft: {
      title,
      descriptionHtml,
      companyName,
      companyUrl,
      companyLogoUrl: companyLogoUrl || null,
      location: locationText || null,
      locationSlug,
      remote,
      mainTag,
      tags,
      benefits,
      twitter: twitter || null,
      salaryMin: salary.min,
      salaryMax: salary.max,
      postingUrl: postingUrl || null,
      buyerName,
      buyerEmail,
      invoiceInfo: cleanText(raw.invoiceInfo, 1000) || null,
    },
  };
}
```

If `BENEFITS` is not exported from `@gaming/shared`, add the export in `packages/shared/src/taxonomy.ts` alongside the existing `JOB_TAGS` export rather than re-declaring the list here.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/web test -- listings/draft`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/listings/draft.ts apps/web/lib/listings/draft.test.ts packages/shared/src/taxonomy.ts
git commit -m "feat(web): validate an employer listing before anyone is charged"
```

---

### Task 5: The orders repository

**Files:**
- Create: `apps/web/lib/listings/orders.ts`
- Test: `apps/web/lib/listings/orders.test.ts`

**Interfaces:**
- Consumes: `Quote` and `Coupon` from `../billing/listing-catalog`; `ListingDraft` from `./draft`.
- Produces: `type OrderKind = "single" | "bundle"`, `type OrderStatus = "pending" | "paid" | "published" | "failed" | "refunded" | "cancelled"`, `type JobOrder`, `type OrdersDatabase`, and `newManageToken()`, `hashManageToken(token)`, `createPendingOrder(db, input)`, `attachStripeSession(db, orderId, sessionId)`, `getOrderById(db, id)`, `getOrderBySession(db, sessionId)`, `getOrderByManageToken(db, token)`, `markOrderPaid(db, orderId, patch)`, `markOrderPublished(db, orderId, jobId, now)`.

- [ ] **Step 1: Write the failing test**

Use the `node:sqlite` + `createD1()` harness already in `apps/web/lib/billing/plans.test.ts` — read that file and reuse its adapter verbatim rather than writing a second one. Seed the schema by executing `packages/db/migrations/0010_employer_listings.sql` plus the `job_orders` dependencies it needs.

```ts
describe("orders", () => {
  it("creates a pending order with a hashed manage token", async () => {
    const db = seed();
    const { token } = await createPendingOrder(db, singleInput());
    const stored = db.raw
      .prepare("SELECT manage_token_hash, status FROM job_orders")
      .get() as { manage_token_hash: string; status: string };

    expect(stored.status).toBe("pending");
    expect(stored.manage_token_hash).not.toBe(token);
    expect(stored.manage_token_hash).toHaveLength(64);
  });

  it("finds an order by its manage token and not by its hash", async () => {
    const db = seed();
    const { token, order } = await createPendingOrder(db, singleInput());
    expect((await getOrderByManageToken(db, token))?.id).toBe(order.id);
    expect(await getOrderByManageToken(db, await hashManageToken(token))).toBeNull();
  });

  it("round-trips the quote lines and the draft", async () => {
    const db = seed();
    const { order } = await createPendingOrder(db, singleInput());
    const read = await getOrderById(db, order.id);
    expect(read?.lines[0]?.code).toBe("base");
    expect(read?.draft?.title).toBe("Senior Solidity Engineer");
    expect(read?.totalCents).toBe(29_900);
  });

  it("marks an order paid once and records the payment intent", async () => {
    const db = seed();
    const { order } = await createPendingOrder(db, singleInput());
    await attachStripeSession(db, order.id, "cs_test_1");
    await markOrderPaid(db, order.id, {
      paymentIntent: "pi_1",
      subscriptionId: null,
      now: new Date("2026-09-14T10:00:00.000Z"),
    });
    const read = await getOrderBySession(db, "cs_test_1");
    expect(read?.status).toBe("paid");
    expect(read?.paidAt).toBe("2026-09-14T10:00:00.000Z");
  });

  it("refuses two orders on the same stripe session", async () => {
    const db = seed();
    const a = await createPendingOrder(db, singleInput());
    const b = await createPendingOrder(db, singleInput());
    await attachStripeSession(db, a.order.id, "cs_test_dup");
    await expect(attachStripeSession(db, b.order.id, "cs_test_dup")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- listings/orders`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the implementation**

The token is 32 random bytes as hex; only its SHA-256 is stored, so a database read cannot mint a working manage link.

```ts
import { createHash, randomBytes } from "node:crypto";

import type { Quote } from "../billing/listing-catalog";
import type { ListingDraft } from "./draft";

export type OrderKind = "single" | "bundle";

export type OrderStatus =
  | "pending" | "paid" | "published" | "failed" | "refunded" | "cancelled";

export type JobOrder = {
  id: string;
  tenantId: string;
  kind: OrderKind;
  status: OrderStatus;
  buyerEmail: string;
  buyerName: string | null;
  companyName: string | null;
  invoiceInfo: string | null;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  couponCode: string | null;
  lines: Quote["lines"];
  draft: ListingDraft | null;
  bundlePosts: number | null;
  stripeSessionId: string | null;
  stripePaymentIntent: string | null;
  stripeSubscriptionId: string | null;
  jobId: string | null;
  userId: string | null;
  createdAt: string;
  paidAt: string | null;
  updatedAt: string;
};

export type OrdersDatabase = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(column?: string): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
};

export function newManageToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashManageToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

const COLUMNS = `id, tenant_id, kind, status, buyer_email, buyer_name, company_name,
  invoice_info, currency, subtotal_cents, discount_cents, total_cents, coupon_code,
  line_items_json, draft_json, bundle_posts, stripe_session_id, stripe_payment_intent,
  stripe_subscription_id, job_id, user_id, created_at, paid_at, updated_at`;

type Row = Record<string, unknown>;

function mapOrder(row: Row | null): JobOrder | null {
  if (!row) return null;
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    kind: row.kind as OrderKind,
    status: row.status as OrderStatus,
    buyerEmail: String(row.buyer_email),
    buyerName: (row.buyer_name as string) ?? null,
    companyName: (row.company_name as string) ?? null,
    invoiceInfo: (row.invoice_info as string) ?? null,
    currency: String(row.currency),
    subtotalCents: Number(row.subtotal_cents),
    discountCents: Number(row.discount_cents),
    totalCents: Number(row.total_cents),
    couponCode: (row.coupon_code as string) ?? null,
    lines: JSON.parse(String(row.line_items_json)) as Quote["lines"],
    draft: row.draft_json ? (JSON.parse(String(row.draft_json)) as ListingDraft) : null,
    bundlePosts: row.bundle_posts == null ? null : Number(row.bundle_posts),
    stripeSessionId: (row.stripe_session_id as string) ?? null,
    stripePaymentIntent: (row.stripe_payment_intent as string) ?? null,
    stripeSubscriptionId: (row.stripe_subscription_id as string) ?? null,
    jobId: (row.job_id as string) ?? null,
    userId: (row.user_id as string) ?? null,
    createdAt: String(row.created_at),
    paidAt: (row.paid_at as string) ?? null,
    updatedAt: String(row.updated_at),
  };
}

export type CreateOrderInput = {
  tenantId: string;
  kind: OrderKind;
  buyerEmail: string;
  buyerName: string | null;
  companyName: string | null;
  invoiceInfo: string | null;
  quote: Quote;
  couponCode: string | null;
  draft: ListingDraft | null;
  bundlePosts: number | null;
  userId: string | null;
  now: Date;
};

export async function createPendingOrder(
  db: OrdersDatabase,
  input: CreateOrderInput,
): Promise<{ order: JobOrder; token: string }> {
  const id = crypto.randomUUID();
  const token = newManageToken();
  const iso = input.now.toISOString();

  await db
    .prepare(
      `INSERT INTO job_orders (${COLUMNS})
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, 'usd', ?, ?, ?, ?, ?, ?, ?,
               NULL, NULL, NULL, NULL, ?, ?, NULL, ?)`,
    )
    .bind(
      id, input.tenantId, input.kind, input.buyerEmail, input.buyerName,
      input.companyName, input.invoiceInfo, input.quote.subtotalCents,
      input.quote.discountCents, input.quote.totalCents, input.couponCode,
      JSON.stringify(input.quote.lines),
      input.draft ? JSON.stringify(input.draft) : null,
      input.bundlePosts, input.userId, iso, iso,
    )
    .run();

  await db
    .prepare("UPDATE job_orders SET manage_token_hash = ? WHERE id = ?")
    .bind(hashManageToken(token), id)
    .run();

  const order = await getOrderById(db, id);
  if (!order) throw new Error("order vanished after insert");
  return { order, token };
}
```

`manage_token_hash` is NOT NULL, so the INSERT must supply it. Write the hash inline in the INSERT column list rather than as the follow-up UPDATE shown above; the two-statement form is shown only to make the column obvious. Finish the module with `getOrderById`, `getOrderBySession`, `getOrderByManageToken` (hash the token, then look up), `attachStripeSession`, `markOrderPaid` and `markOrderPublished`, each a single prepared statement over `COLUMNS` and `mapOrder`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/web test -- listings/orders`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/listings/orders.ts apps/web/lib/listings/orders.test.ts
git commit -m "feat(web): job orders, with a manage token we only store hashed"
```

---

### Task 6: Non-destructive taxonomy attach

**Files:**
- Create: `apps/web/lib/listings/taxonomy.ts`
- Test: `apps/web/lib/listings/taxonomy.test.ts`

**Interfaces:**
- Consumes: `locationHierarchy`, `tagLabel`, `locationLabel`, `benefitLabel` from `@gaming/shared` (read `apps/crawler/src/consumers/web3-api.ts` to find their real exported names before writing this).
- Produces: `attachListingTaxonomy(db, jobId, draft): Promise<void>`.

The crawler's `attachTaxonomy` opens with `DELETE FROM job_tags WHERE job_id = ?` and `DELETE FROM job_locations WHERE job_id = ?`. This one must not delete anything: it is called once, at fulfilment, on a job that has just been inserted.

- [ ] **Step 1: Write the failing test**

```ts
it("writes the full location hierarchy for a city", async () => {
  const db = seed();
  await attachListingTaxonomy(db, "job-1", draftInBerlin());
  const slugs = db.raw
    .prepare("SELECT location_slug FROM job_locations WHERE job_id = ? ORDER BY location_slug")
    .all()
    .map((row) => (row as { location_slug: string }).location_slug);
  expect(slugs).toEqual(["berlin", "europe", "germany"]);
});

it("writes no location row for a remote listing", async () => {
  const db = seed();
  await attachListingTaxonomy(db, "job-2", { ...draftInBerlin(), remote: "remote", locationSlug: null });
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM job_locations").get()).toEqual({ n: 0 });
});

it("inserts the parent vocabulary rows it needs", async () => {
  const db = seed();
  await attachListingTaxonomy(db, "job-3", draftInBerlin());
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM tags").get()).toEqual({ n: 2 });
});

it("deletes nothing that is already attached", async () => {
  const db = seed();
  db.raw.prepare("INSERT INTO job_tags (job_id, tag_slug) VALUES ('job-4', 'rust')").run();
  await attachListingTaxonomy(db, "job-4", draftInBerlin());
  const tags = db.raw
    .prepare("SELECT tag_slug FROM job_tags WHERE job_id = 'job-4' ORDER BY tag_slug")
    .all();
  expect(tags.length).toBeGreaterThanOrEqual(2);
});

it("writes benefit rows", async () => {
  const db = seed();
  await attachListingTaxonomy(db, "job-5", draftInBerlin());
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM job_benefits").get()).toEqual({ n: 1 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- listings/taxonomy`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the implementation**

Every write is `INSERT OR IGNORE`, into the parent vocabulary table first and the junction table second, mirroring the crawler's order. No `DELETE`. Locations expand through `locationHierarchy(slug, kind)`, so a Berlin listing gets `berlin`, `germany` and `europe`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/web test -- listings/taxonomy`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/listings/taxonomy.ts apps/web/lib/listings/taxonomy.test.ts
git commit -m "feat(web): attach a listing's tags and locations without deleting any"
```

---

### Task 7: publishOrder

**Files:**
- Create: `apps/web/lib/listings/publish.ts`
- Test: `apps/web/lib/listings/publish.test.ts`
- Modify: `packages/shared/src/jobs.ts`

**Interfaces:**
- Consumes: `JobOrder` from `./orders`, `attachListingTaxonomy` from `./taxonomy`, `normalizeCompanyName`, `slugTitle`, `jobPublicSlug` from `@gaming/shared`.
- Produces: `publishOrder(db, order, now): Promise<{ jobId: string; slug: string }>`.

- [ ] **Step 1: Write the failing test**

```ts
it("publishes a paid order as a listed job", async () => {
  const db = seed();
  const { jobId, slug } = await publishOrder(db, paidOrder(), NOW);
  const job = db.raw.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as Record<string, unknown>;

  expect(job.listed).toBe(1);
  expect(job.source).toBe("employer");
  expect(job.canonical_key).toBe(`employer:${paidOrder().id}`);
  expect(job.external_id).toBeNull();
  expect(job.exclusivity).toBe("unknown");
  expect(job.posted_at).toBe(NOW.toISOString());
  expect(job.order_id).toBe(paidOrder().id);
  expect(slug).toBe("acme-senior-solidity-engineer");
});

it("is idempotent: a replayed webhook publishes one job", async () => {
  const db = seed();
  const first = await publishOrder(db, paidOrder(), NOW);
  const second = await publishOrder(db, await reload(db, paidOrder().id), NOW);
  expect(second.jobId).toBe(first.jobId);
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM jobs").get()).toEqual({ n: 1 });
});

it("suffixes a colliding slug instead of failing", async () => {
  const db = seed();
  await publishOrder(db, paidOrder(), NOW);
  const twin = { ...paidOrder(), id: "order-2" };
  const second = await publishOrder(db, twin, NOW);
  expect(second.slug).not.toBe("acme-senior-solidity-engineer");
  expect(second.slug.startsWith("acme-senior-solidity-engineer-")).toBe(true);
});

it("stores a sticky window and a highlight colour from the paid lines", async () => {
  const db = seed();
  const { jobId } = await publishOrder(db, stickyOrder(), NOW);
  const job = db.raw.prepare("SELECT featured_until, highlight, highlight_color FROM jobs WHERE id = ?").get(jobId);
  expect(job).toEqual({
    featured_until: "2026-09-21T00:00:00.000Z",
    highlight: 1,
    highlight_color: "#008fd6",
  });
});

it("writes no salary when the pair is incomplete", async () => {
  const db = seed();
  const order = paidOrder();
  order.draft!.salaryMin = null;
  const { jobId } = await publishOrder(db, order, NOW);
  const job = db.raw.prepare("SELECT salary_min, salary_max FROM jobs WHERE id = ?").get(jobId);
  expect(job).toEqual({ salary_min: null, salary_max: null });
});

it("writes no job_sightings row", async () => {
  const db = seed();
  await publishOrder(db, paidOrder(), NOW);
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM job_sightings").get()).toEqual({ n: 0 });
});

it("sets the company logo only when the logo add-on was bought", async () => {
  const db = seed();
  await publishOrder(db, paidOrder(), NOW);
  const company = db.raw.prepare("SELECT logo_url FROM companies").get();
  expect(company).toEqual({ logo_url: null });
});

it("marks the order published and links the job back to it", async () => {
  const db = seed();
  const { jobId } = await publishOrder(db, paidOrder(), NOW);
  const order = db.raw.prepare("SELECT status, job_id FROM job_orders WHERE id = ?").get(paidOrder().id);
  expect(order).toEqual({ status: "published", job_id: jobId });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- listings/publish`
Expected: FAIL, module not found.

- [ ] **Step 3: Add `'employer'` to the source union**

In `packages/shared/src/jobs.ts`, add `"employer"` to the `JobSource` union next to the existing unused `"manual"`. `jobs.source` has no CHECK constraint, so this is a type-level change only.

- [ ] **Step 4: Write the implementation**

Write in this order, and re-read the order row first so a replay short-circuits:

```ts
export async function publishOrder(
  db: PublishDatabase,
  order: JobOrder,
  now: Date,
): Promise<{ jobId: string; slug: string }> {
  if (order.jobId) {
    const existing = await db
      .prepare("SELECT slug FROM jobs WHERE id = ?")
      .bind(order.jobId)
      .first<{ slug: string }>();
    if (existing) return { jobId: order.jobId, slug: existing.slug };
  }

  const draft = order.draft;
  if (!draft) throw new Error(`order ${order.id} has no draft to publish`);

  const companyId = await upsertCompany(db, order, draft, now);
  const iso = now.toISOString();
  const jobId = crypto.randomUUID();

  const featuredUntil = stickyUntil(order.lines, now);
  const highlight = order.lines.some((item) => item.code === "highlight") ? 1 : 0;
  const highlightColor = highlight === 1 ? draftHighlightColor(order) : null;

  const base = jobPublicSlug(draft.companyName, draft.title);
  const slug = await insertJob(db, {
    jobId, companyId, order, draft, iso, featuredUntil, highlight, highlightColor,
    slugCandidates: [base, `${base}-${jobId.replace(/-/g, "").slice(0, 8)}`],
  });

  // The re-entry flag, written as soon as the job exists.
  await db
    .prepare("UPDATE job_orders SET job_id = ?, updated_at = ? WHERE id = ?")
    .bind(jobId, iso, order.id)
    .run();

  await attachListingTaxonomy(db, jobId, draft);

  await db
    .prepare(
      `UPDATE job_orders
          SET status = 'published', paid_at = COALESCE(paid_at, ?), updated_at = ?
        WHERE id = ?`,
    )
    .bind(iso, iso, order.id)
    .run();

  return { jobId, slug };
}
```

`stickyUntil` reads the sticky line's day count out of `order.lines` (the frozen quote), so the window is whatever was actually paid for, not whatever the form says now.

`apply_url` is NOT NULL, so fulfilment must write something: store `draft.postingUrl` when the employer gave one, else the absolute URL of our own apply page, built from `SITE_URL` when it is set and `/jobs/{slug}/apply` when it is not. Either way it is **stored for dedupe and support and never rendered** — every listing, paid or crawled, uses the on-site apply flow, which is what `/about` and `lib/jobs/jsonld.ts` (`directApply: true`) already promise.

`companies.logo_url` is set to `draft.companyLogoUrl` only when the order carries a `logo` line.

**Fulfilment is resumable, not transactional.** D1 has no interactive transactions in the Workers runtime; `db.batch()` is the only atomic primitive, appears nowhere in production code (only two crawler test files), and cannot express this sequence anyway — step 1 needs the company id before step 2, and the slug retry needs the insert's error. So every step is individually idempotent and any step may be re-entered by a Stripe retry. Three rules make that work:

1. **The job insert is an upsert**, mirroring the crawler's `upsertJob`:
   `INSERT INTO jobs (...) VALUES (...) ON CONFLICT (tenant_id, canonical_key) DO UPDATE SET ...` on `'employer:' + order.id`. A plain INSERT throws forever on a retry after a mid-way crash, and the paid listing never publishes.
2. **`job_orders.job_id` is written immediately after the job insert**, not at the end. It is the re-entry flag, and a flag written last is never there when it is needed — a crash at the taxonomy step would otherwise leave `job_id` null and send the retry straight back into a duplicate insert.
3. **Do not guard entry with a one-way `status = 'publishing'`.** A crash after that gate makes every later retry bounce off it, which is the wedge this design exists to avoid. Entry is guarded only by `job_orders.job_id IS NOT NULL`.

Order the remaining writes so a crash leaves recoverable state: company first (harmless if orphaned), job second, `job_id` third, taxonomy fourth, order status last.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @gaming/web test -- listings/publish`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/listings/publish.ts apps/web/lib/listings/publish.test.ts packages/shared/src/jobs.ts
git commit -m "feat(web): a paid order becomes a listing"
```

---

### Task 8: Bundle credits

**Files:**
- Create: `apps/web/lib/listings/credits.ts`
- Test: `apps/web/lib/listings/credits.test.ts`

**Interfaces:**
- Consumes: `JobOrder` from `./orders`.
- Produces: `CREDIT_WINDOW_MONTHS = 24`, `mintCredits(db, order, now)`, `countAvailableCredits(db, email, now)`, `spendCredit(db, input): Promise<boolean>`.

- [ ] **Step 1: Write the failing test**

```ts
it("mints one row per post with a 24 month window", async () => {
  const db = seed();
  await mintCredits(db, bundleOrder(10), NOW);
  const rows = db.raw.prepare("SELECT expires_at FROM job_credits").all();
  expect(rows).toHaveLength(10);
  expect((rows[0] as { expires_at: string }).expires_at).toBe("2028-09-14T00:00:00.000Z");
});

it("mints the same N credits when called twice for the same order", async () => {
  const db = seed();
  await mintCredits(db, bundleOrder(10), NOW);
  await mintCredits(db, bundleOrder(10), NOW);
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM job_credits").get()).toEqual({ n: 10 });
});

it("spends exactly one credit, oldest expiring first", async () => {
  const db = seed();
  await mintCredits(db, bundleOrder(3), NOW);
  expect(await spendCredit(db, spend())).toBe(true);
  expect(await countAvailableCredits(db, "dana@acme.example", NOW)).toBe(2);
});

it("spends one credit, not two, when called twice concurrently", async () => {
  const db = seed();
  await mintCredits(db, bundleOrder(1), NOW);
  const [a, b] = await Promise.all([spendCredit(db, spend()), spendCredit(db, spend())]);
  expect([a, b].filter(Boolean)).toHaveLength(1);
});

it("will not spend an expired credit", async () => {
  const db = seed();
  await mintCredits(db, bundleOrder(1), NOW);
  const later = new Date("2029-01-01T00:00:00.000Z");
  expect(await spendCredit(db, { ...spend(), now: later })).toBe(false);
  expect(await countAvailableCredits(db, "dana@acme.example", later)).toBe(0);
});

it("will not spend another buyer's credit", async () => {
  const db = seed();
  await mintCredits(db, bundleOrder(1), NOW);
  expect(await spendCredit(db, { ...spend(), buyerEmail: "someone@else.example" })).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- listings/credits`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the implementation**

The spend is the conditional UPDATE from the spec, and the return value is whether it changed a row:

```sql
UPDATE job_credits
   SET spent_at = ?, spent_order_id = ?, job_id = ?
 WHERE id = (SELECT id FROM job_credits
              WHERE buyer_email = ? AND spent_at IS NULL AND expires_at > ?
              ORDER BY expires_at ASC LIMIT 1)
   AND spent_at IS NULL
```

Read rows-changed the way `apps/web/lib/unlocks/quota.ts` does today — it reads `result.meta.changes` with a fallback to `result.changes`, because the D1 binding and the test adapter report it differently. Copy that helper into this module before Task 16 deletes the file it currently lives in.

`expires_at` is computed with `setUTCMonth(getUTCMonth() + 24)` on a copy of `now`, so it lands on the same day of month two years out.

`mintCredits` inserts slots `0` to `N-1` with `INSERT OR IGNORE` against the unique `(order_id, slot_index)` index, so calling it twice for one order mints nothing the second time. That is defence in depth behind the `stripe_events` guard in Task 12, not a substitute for it — the credit ledger is where a replay would do the most expensive damage.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/web test -- listings/credits`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/listings/credits.ts apps/web/lib/listings/credits.test.ts
git commit -m "feat(web): bundle credits as a ledger, one row per post"
```

---

### Task 9: Coupons

**Files:**
- Create: `apps/web/lib/listings/coupons.ts`
- Test: `apps/web/lib/listings/coupons.test.ts`

**Interfaces:**
- Consumes: `Coupon` from `../billing/listing-catalog`.
- Produces: `findCoupon(db, code): Promise<Coupon | null>`, `redeemCoupon(db, code): Promise<void>`.

- [ ] **Step 1: Write the failing test**

```ts
it("finds a coupon case-insensitively", async () => {
  const db = seed();
  insertCoupon(db, { code: "LAUNCH", kind: "percent", value: 10 });
  expect((await findCoupon(db, "launch"))?.code).toBe("LAUNCH");
});

it("returns null for an unknown code", async () => {
  expect(await findCoupon(seed(), "nope")).toBeNull();
});

it("increments the redemption count", async () => {
  const db = seed();
  insertCoupon(db, { code: "LAUNCH", kind: "percent", value: 10 });
  await redeemCoupon(db, "LAUNCH");
  await redeemCoupon(db, "LAUNCH");
  expect(db.raw.prepare("SELECT redeemed_count FROM coupons WHERE code = 'LAUNCH'").get())
    .toEqual({ redeemed_count: 2 });
});

it("does not increment past max_redemptions", async () => {
  const db = seed();
  insertCoupon(db, { code: "ONE", kind: "percent", value: 10, maxRedemptions: 1 });
  await redeemCoupon(db, "ONE");
  await redeemCoupon(db, "ONE");
  expect(db.raw.prepare("SELECT redeemed_count FROM coupons WHERE code = 'ONE'").get())
    .toEqual({ redeemed_count: 1 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- listings/coupons`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the implementation**

`redeemCoupon` guards in SQL, not in JavaScript, so two concurrent fulfilments cannot both take the last redemption:

```sql
UPDATE coupons
   SET redeemed_count = redeemed_count + 1
 WHERE code = ?
   AND (max_redemptions IS NULL OR redeemed_count < max_redemptions)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/web test -- listings/coupons`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/listings/coupons.ts apps/web/lib/listings/coupons.test.ts
git commit -m "feat(web): coupon lookup and redemption"
```

---

## Phase 3: Stripe and the routes

### Task 10: The checkout session body

**Files:**
- Create: `apps/web/lib/billing/listing-checkout.ts`
- Test: `apps/web/lib/billing/listing-checkout.test.ts`

**Interfaces:**
- Consumes: `JobOrder` from `../listings/orders`.
- Produces: `checkoutFormForOrder(order, { successUrl, cancelUrl }): URLSearchParams`.

**Auto-renew uses plain `line_items`, not `add_invoice_items`.** That field's `price_data` requires a `product` ID string and has no `product_data`, so it cannot create a product inline, and this catalog has no Stripe Product or Price objects — the catalog module is pure and I/O-free precisely so that none has to be provisioned. In `mode=subscription`, the 30-day sticky is the one line carrying `price_data[recurring][interval]=month`; the base post and every other add-on are additional `line_items[n]` with no `recurring` block, which Stripe puts on the initial invoice only. Every line uses the inline `price_data[product_data][name]` shape `checkoutFormForPlan` already emits.

- [ ] **Step 1: Write the failing test**

```ts
function body(order: JobOrder) {
  return Object.fromEntries(
    checkoutFormForOrder(order, {
      successUrl: "https://x.example/ok",
      cancelUrl: "https://x.example/no",
    }),
  );
}

it("charges a plain order once", () => {
  const form = body(singleOrder());
  expect(form.mode).toBe("payment");
  expect(form["line_items[0][price_data][currency]"]).toBe("usd");
  expect(form["line_items[0][price_data][unit_amount]"]).toBe("29900");
  expect(form["metadata[orderId]"]).toBe(singleOrder().id);
  expect(form["client_reference_id"]).toBe(singleOrder().id);
});

it("charges the discounted total, not the subtotal", () => {
  const form = body(discountedOrder());
  const amounts = Object.entries(form)
    .filter(([key]) => key.endsWith("[unit_amount]"))
    .map(([, value]) => Number(value));
  expect(amounts.reduce((sum, n) => sum + n, 0)).toBe(discountedOrder().totalCents);
});

it("makes the 30 day sticky recurring when auto-renew was bought", () => {
  const form = body(autoRenewOrder());
  expect(form.mode).toBe("subscription");
  expect(form["line_items[0][price_data][recurring][interval]"]).toBe("month");
  expect(form["subscription_data[metadata][orderId]"]).toBe(autoRenewOrder().id);
  expect(form["line_items[1][price_data][unit_amount]"]).toBe("29900");
  expect(form["line_items[1][price_data][recurring][interval]"]).toBeUndefined();
});

it("never emits a euro amount", () => {
  expect(JSON.stringify(body(singleOrder()))).not.toContain("eur");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- listing-checkout`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the implementation**

Follow `checkoutFormForPlan`'s shape (a `URLSearchParams` built key by key) so the route can keep the same `fetch` call. Carry `metadata[orderId]` and `client_reference_id` — the webhook resolves the order from `metadata.orderId` first and the session id second.

A discount is applied by charging the discounted amount on the base line rather than by creating a Stripe coupon object, so nothing has to be kept in sync on Stripe's side.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/web test -- listing-checkout`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/billing/listing-checkout.ts apps/web/lib/billing/listing-checkout.test.ts
git commit -m "feat(web): build a stripe checkout session for a listing order"
```

---

### Task 11: POST /api/listings

**Files:**
- Create: `apps/web/app/api/listings/route.ts`, `apps/web/app/api/listings/route.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1, 4, 5, 9, 10; `verifyTurnstile` and `turnstileTokenFromRequest` from `lib/auth/turnstile`; `requireTenantId` from `lib/tenant`.
- Produces: the HTTP contract the form posts to.

Copy the structure of `apps/web/app/api/stripe/checkout/route.ts` exactly: an `env()` wrapper around `getCloudflareContext({ async: true })`, the `STRIPE_ENABLED` gate returning 503 `{code:"billing_disabled"}`, and 502 `{code:"checkout_failed"}` when Stripe does not return a `url`.

- [ ] **Step 1: Write the failing test**

Copy the mocking harness from `apps/web/app/api/unlock/route.test.ts` (`vi.hoisted`, `vi.mock("@opennextjs/cloudflare")`, `await import("./route")` inside each `it`).

```ts
it("refuses when billing is off", async () => {
  mocks.getCloudflareContext.mockResolvedValue({ env: env({ STRIPE_ENABLED: "false" }) });
  const { POST } = await import("./route");
  const response = await POST(formRequest(validForm()));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ code: "billing_disabled" });
});

it("refuses a submission that fails turnstile", async () => {
  mocks.verifyTurnstile.mockResolvedValue({ ok: false, status: 400, error: "no" });
  const { POST } = await import("./route");
  expect((await POST(formRequest(validForm()))).status).toBe(400);
});

it("returns field errors for an invalid draft", async () => {
  const { POST } = await import("./route");
  const response = await POST(formRequest({ ...validForm(), companyUrl: "acme.example" }));
  expect(response.status).toBe(422);
  expect((await response.json() as { errors: Record<string, string> }).errors.companyUrl).toBeTruthy();
});

it("charges the server quote, not the client total", async () => {
  const { POST } = await import("./route");
  await POST(formRequest({ ...validForm(), totalCents: "1" }));
  const body = mocks.fetch.mock.calls[0][1].body as URLSearchParams;
  expect(body.get("line_items[0][price_data][unit_amount]")).toBe("29900");
});

it("stores the order as pending before redirecting to stripe", async () => {
  const { POST } = await import("./route");
  const response = await POST(formRequest(validForm()));
  expect(await response.json()).toEqual({ url: "https://checkout.stripe.test/session" });
  expect(db.raw.prepare("SELECT status FROM job_orders").get()).toEqual({ status: "pending" });
});

it("ignores an unknown coupon rather than failing", async () => {
  const { POST } = await import("./route");
  const response = await POST(formRequest({ ...validForm(), coupon: "NOPE" }));
  expect(response.status).toBe(200);
  expect(db.raw.prepare("SELECT total_cents FROM job_orders").get()).toEqual({ total_cents: 29_900 });
});

it("links the order to the account when the buyer is signed in", async () => {
  mocks.getSession.mockResolvedValue({ user: { id: "user-1", email: "dana@acme.example" } });
  const { POST } = await import("./route");
  await POST(formRequest(validForm()));
  expect(db.raw.prepare("SELECT user_id FROM job_orders").get()).toEqual({ user_id: "user-1" });
});

it("skips stripe entirely when a coupon clears the cart", async () => {
  insertCoupon(db, { code: "ALLFREE", kind: "percent", value: 100 });
  const { POST } = await import("./route");
  const response = await POST(formRequest({ ...validForm(), coupon: "ALLFREE" }));

  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(await response.json()).toEqual({ url: "/post-web3-job/checkout/success?order=" + orderId(db) });
  expect(db.raw.prepare("SELECT status, total_cents FROM job_orders").get())
    .toEqual({ status: "published", total_cents: 0 });
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM jobs WHERE listed = 1").get()).toEqual({ n: 1 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- api/listings`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the implementation**

Order of operations: read the form, verify Turnstile, check `STRIPE_ENABLED`, `parseListingDraft`, read the selection and clamp it through `isStickyDays` / `isHighlightTier`, `quoteListing`, `findCoupon` + `applyCoupon`, read the Better Auth session, `requireTenantId`, `createPendingOrder`, then either the free path or the Stripe path, and return `{ url }`.

The client's own total is never read. A `totalCents` field in the form is ignored entirely.

The session lookup is optional, not a gate — buying a listing never requires an account:

```ts
const session = await createAuth(env).api.getSession({ headers: request.headers });
const userId = session?.user?.id ?? null;
```

- [ ] **Step 4: The free-order path**

Stripe refuses a `mode=payment` session below its $0.50 minimum, so a zero-total cart must never reach it — the buyer would see a 502 and never get the listing the coupon promised.

```ts
if (quote.totalCents === 0 && !selection.autoRenew) {
  await markOrderPaid(db, order.id, { paymentIntent: null, subscriptionId: null, now });
  await redeemCoupon(db, coupon.code);
  const { jobId } = await publishOrder(db, await reload(db, order.id), now);
  return Response.json({ url: `/post-web3-job/checkout/success?order=${order.id}` });
}
```

Auto-renew is excluded because a renewing subscription still needs a Stripe session even when the first period is free.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @gaming/web test -- api/listings`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/listings
git commit -m "feat(web): submit a listing and get a checkout session"
```

---

### Task 12: Fulfil orders on the webhook

**Files:**
- Modify: `apps/web/app/api/stripe/webhook/route.ts`, `apps/web/app/api/stripe/webhook/route.test.ts`
- Create: `apps/web/lib/listings/fulfil.ts`, `apps/web/lib/listings/fulfil.test.ts`

**Interfaces:**
- Consumes: Tasks 5, 7, 8, 9.
- Produces: `fulfilStripeEvent(db, event, now): Promise<boolean>`.

- [ ] **Step 1: Write the failing test**

```ts
it("publishes a single order on checkout.session.completed", async () => {
  const db = await seedPendingSingle();
  await fulfilStripeEvent(db, completedEvent("cs_1"), NOW);
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM jobs WHERE listed = 1").get()).toEqual({ n: 1 });
});

it("publishes once when the same event is delivered twice", async () => {
  const db = await seedPendingSingle();
  await fulfilStripeEvent(db, completedEvent("cs_1"), NOW);
  await fulfilStripeEvent(db, completedEvent("cs_1"), NOW);
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM jobs").get()).toEqual({ n: 1 });
});

it("mints credits for a bundle order and publishes nothing", async () => {
  const db = await seedPendingBundle(5);
  await fulfilStripeEvent(db, completedEvent("cs_2"), NOW);
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM job_credits").get()).toEqual({ n: 5 });
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM jobs").get()).toEqual({ n: 0 });
});

it("redeems the coupon at fulfilment, not at checkout", async () => {
  const db = await seedPendingSingleWithCoupon("LAUNCH");
  await fulfilStripeEvent(db, completedEvent("cs_3"), NOW);
  expect(db.raw.prepare("SELECT redeemed_count FROM coupons WHERE code = 'LAUNCH'").get())
    .toEqual({ redeemed_count: 1 });
});

it("ignores an event for an order that does not exist", async () => {
  const db = seed();
  expect(await fulfilStripeEvent(db, completedEvent("cs_missing"), NOW)).toBe(false);
});

it("mints N credits, not 2N, when a bundle completion is replayed", async () => {
  const db = await seedPendingBundle(25);
  await fulfilStripeEvent(db, completedEvent("cs_2"), NOW);
  await fulfilStripeEvent(db, completedEvent("cs_2"), NOW);
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM job_credits").get()).toEqual({ n: 25 });
});

it("publishes nothing for a session that is not funded yet", async () => {
  const db = await seedPendingSingle();
  await fulfilStripeEvent(db, completedEvent("cs_1", { paymentStatus: "unpaid" }), NOW);
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM jobs").get()).toEqual({ n: 0 });
  expect(db.raw.prepare("SELECT status FROM job_orders").get()).toEqual({ status: "pending" });
});

it("publishes a zero-total session that required no payment", async () => {
  const db = await seedPendingFree();
  await fulfilStripeEvent(db, completedEvent("cs_4", { paymentStatus: "no_payment_required" }), NOW);
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM jobs WHERE listed = 1").get()).toEqual({ n: 1 });
});

it("marks an order failed when the delayed payment fails", async () => {
  const db = await seedPendingSingle();
  await fulfilStripeEvent(db, completedEvent("cs_1", { paymentStatus: "unpaid" }), NOW);
  await fulfilStripeEvent(db, asyncFailedEvent("cs_1"), NOW);
  expect(db.raw.prepare("SELECT status FROM job_orders").get()).toEqual({ status: "failed" });
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM jobs").get()).toEqual({ n: 0 });
});

it("extends the sticky window on a renewal invoice", async () => {
  const db = await seedPublishedAutoRenew();
  await fulfilStripeEvent(db, invoicePaidEvent("sub_1", "subscription_cycle"), new Date("2026-10-14T00:00:00.000Z"));
  const job = db.raw.prepare("SELECT featured_until FROM jobs").get() as { featured_until: string };
  expect(Date.parse(job.featured_until)).toBeGreaterThan(Date.parse("2026-11-01T00:00:00.000Z"));
});

it("does not extend on the subscription's first invoice", async () => {
  const db = await seedPublishedAutoRenew();
  const before = db.raw.prepare("SELECT featured_until FROM jobs").get();
  await fulfilStripeEvent(db, invoicePaidEvent("sub_1", "subscription_create"), NOW);
  expect(db.raw.prepare("SELECT featured_until FROM jobs").get()).toEqual(before);
});

it("does not extend twice for a replayed renewal invoice", async () => {
  const db = await seedPublishedAutoRenew();
  const event = invoicePaidEvent("sub_1", "subscription_cycle");
  await fulfilStripeEvent(db, event, NOW);
  const once = db.raw.prepare("SELECT featured_until FROM jobs").get();
  await fulfilStripeEvent(db, event, NOW);
  expect(db.raw.prepare("SELECT featured_until FROM jobs").get()).toEqual(once);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- listings/fulfil`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the implementation**

**The first write is the event guard, before any fulfilment:**

```ts
const seen = await db
  .prepare(
    `INSERT INTO stripe_events (id, type, order_id, received_at)
     VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
  )
  .bind(event.id, event.type ?? "", orderId, now.toISOString())
  .run();
if (rowsChanged(seen) === 0) return false;   // already handled
```

Read rows-changed with the same `meta.changes` helper Task 8 uses. Everything below sits behind this guard: minting credits, incrementing the coupon, extending a sticky window, and sending the receipt are all non-idempotent on their own.

`fulfilStripeEvent` resolves the order by `event.data.object.metadata.orderId`, falling back to `client_reference_id` and then to `stripe_session_id`, and handles:

- **`checkout.session.completed`** — only when the session is actually funded. Stripe fires this when the session *completes*, not when the money settles: a delayed-notification method arrives `payment_status: "unpaid"` and settles later. The gate is `payment_status === "paid" || payment_status === "no_payment_required"` — not `=== "paid"` alone, which would silently refuse to publish a fully-couponed order. On `unpaid`, record the session and payment intent, leave the order `pending`, and return. Otherwise move the order to `paid` with the conditional update below, then publish (single) or mint credits (bundle), then redeem the coupon.
- **`checkout.session.async_payment_succeeded`** — the same fulfilment path.
- **`checkout.session.async_payment_failed`** — `status = 'failed'`; publish nothing, and if it somehow already published, set `listed = 0`.
- **`checkout.session.expired`** — `status = 'cancelled'`.
- **`invoice.paid`** — extend `featured_until` by 30 days from the later of now and the current expiry, **only** when `billing_reason` is `subscription_cycle` or `subscription_update`. A `subscription_create` invoice is the payment fulfilment already ran on, and `publishOrder` has already set the window; extending it too gives the buyer 60 days for one payment.
- **`customer.subscription.deleted`** — clear `stripe_subscription_id` and stop extending; the current window runs out.

Every other event type returns `false` and is acknowledged with 200, which is what the route already does.

**The paid transition is a guarded UPDATE, not a read-then-write.** This is what protects bundle fulfilment, which has no `job_id` for the publish check to key on:

```sql
UPDATE job_orders
   SET status = 'paid', paid_at = ?, stripe_payment_intent = ?, updated_at = ?
 WHERE stripe_session_id = ? AND status = 'pending'
```

The route itself keeps its current shape: verify the signature, parse, then call `fulfilStripeEvent` instead of `applyStripeEvent`, and always answer `{received:true}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/web test -- listings/fulfil api/stripe/webhook`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/listings/fulfil.ts apps/web/lib/listings/fulfil.test.ts apps/web/app/api/stripe/webhook
git commit -m "feat(web): the webhook publishes the listing that was paid for"
```

---

### Task 13: POST /api/listings/redeem

**Files:**
- Create: `apps/web/app/api/listings/redeem/route.ts` and its test

**Interfaces:**
- Consumes: Tasks 4, 5, 7, 8.
- Produces: the endpoint the manage page posts to.

- [ ] **Step 1: Write the failing test**

```ts
it("publishes a listing against an unspent credit", async () => {
  const { db, token } = await seedBundleWithCredits(3);
  const { POST } = await import("./route");
  const response = await POST(formRequest({ ...validForm(), token }));
  expect(response.status).toBe(200);
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM jobs WHERE listed = 1").get()).toEqual({ n: 1 });
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM job_credits WHERE spent_at IS NULL").get())
    .toEqual({ n: 2 });
});

it("refuses to spend a credit on a listing with paid add-ons", async () => {
  const { db, token } = await seedBundleWithCredits(1);
  const { POST } = await import("./route");
  const response = await POST(formRequest({ ...validForm(), token, stickyDays: "7" }));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ code: "addons_not_redeemable" });
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM job_credits WHERE spent_at IS NULL").get())
    .toEqual({ n: 1 });
});

it("refuses an unknown manage token", async () => {
  const { POST } = await import("./route");
  expect((await POST(formRequest({ ...validForm(), token: "deadbeef" }))).status).toBe(404);
});

it("refuses when no credit is available", async () => {
  const { token } = await seedBundleWithCredits(0);
  const { POST } = await import("./route");
  const response = await POST(formRequest({ ...validForm(), token }));
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ code: "no_credit" });
});

it("publishes nothing when the draft is invalid", async () => {
  const { db, token } = await seedBundleWithCredits(1);
  const { POST } = await import("./route");
  expect((await POST(formRequest({ ...validForm(), token, title: "" }))).status).toBe(422);
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM jobs").get()).toEqual({ n: 0 });
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM job_credits WHERE spent_at IS NULL").get())
    .toEqual({ n: 1 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- listings/redeem`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the implementation**

**Reject any paid add-on first**, with 400 `{code:"addons_not_redeemable"}`. A credit buys the $299 base post and nothing else. Taking a Stripe payment for add-ons mid-redemption was considered and rejected: the credit spend is an irreversible UPDATE with no un-spend path, so a cancelled add-on payment would destroy a $299 credit and publish nothing. A buyer who wants a sticky buys that listing as a normal single post through `/api/listings` instead.

Then validate the draft **before** spending the credit, so an invalid submission cannot burn one. Create a `single` order with `total_cents = 0`, `coupon_code = null` and one `bundle_credit` line, spend the credit, and call `publishOrder`. If `spendCredit` returns false, answer 409 `{code:"no_credit"}` and leave the order at `status = 'cancelled'`.

`job_credits.spent_order_id` points at that order row, so every published listing has an order behind it and the manage page can show what each credit became.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/web test -- listings/redeem`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/listings/redeem
git commit -m "feat(web): spend a bundle credit on a listing"
```

---

### Task 14: The receipt and manage-link email

**Files:**
- Create: `apps/web/lib/listings/email.ts` and its test
- Modify: `apps/web/lib/listings/fulfil.ts`

**Interfaces:**
- Consumes: `sendEmail` from `../email/send`, `formatUsd` from `../billing/listing-catalog`.
- Produces: `orderEmail(order, { manageUrl, listingUrl }): { subject, text, html }`, and `sendOrderEmail(deps)`.

- [ ] **Step 1: Write the failing test**

```ts
it("itemises every paid line and the total", () => {
  const mail = orderEmail(paidOrder(), { manageUrl: "https://x.example/m/abc", listingUrl: "https://x.example/jobs/a" });
  expect(mail.text).toContain("Job post");
  expect(mail.text).toContain("$299");
  expect(mail.text).toContain("https://x.example/m/abc");
});

it("does not leak the manage token into the subject", () => {
  const mail = orderEmail(paidOrder(), { manageUrl: "https://x.example/m/abc", listingUrl: null });
  expect(mail.subject).not.toContain("abc");
});

it("tells a bundle buyer how many posts they hold", () => {
  const mail = orderEmail(bundleOrder(10), { manageUrl: "https://x.example/m/abc", listingUrl: null });
  expect(mail.text).toContain("10");
  expect(mail.text.toLowerCase()).toContain("24 months");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- listings/email`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the implementation**

Plain text and a minimal HTML body, both built from `order.lines` so the receipt and the charge can never disagree. `sendOrderEmail` wraps `sendEmail` from `lib/email/send.ts` with the `EMAIL` binding and `EMAIL_FROM`, and is called from `fulfilStripeEvent` after publishing. A failed send must not fail the webhook: catch, log, and still answer 200, because Stripe will otherwise retry a delivery that already published.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/web test -- listings/email listings/fulfil`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/listings/email.ts apps/web/lib/listings/email.test.ts apps/web/lib/listings/fulfil.ts
git commit -m "feat(web): email the buyer a receipt and their manage link"
```

---

## Phase 4: The board honours what was bought

### Task 15: Sticky expires, and the crawler leaves paid listings alone

**Files:**
- Modify: `apps/web/lib/jobs/queries.ts`, `apps/web/app/_components/job-row.tsx`, `apps/crawler/src/pipeline/ingest.ts`
- Test: `apps/web/lib/jobs/queries.test.ts` (or the existing sort test file), `apps/crawler/src/pipeline/ingest.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("sorts a live sticky first and an expired one back into date order", async () => {
  const db = seedJobs([
    { id: "a", postedAt: "2026-09-01T00:00:00.000Z", featuredUntil: "2026-09-20T00:00:00.000Z" },
    { id: "b", postedAt: "2026-09-10T00:00:00.000Z", featuredUntil: null },
    { id: "c", postedAt: "2026-09-05T00:00:00.000Z", featuredUntil: "2026-09-02T00:00:00.000Z" },
  ]);
  const result = await listJobs(db, { tenantId: TENANT, now: new Date("2026-09-14T00:00:00.000Z") });
  expect(result.jobs.map((job) => job.id)).toEqual(["a", "b", "c"]);
});
```

Plus, in the crawler:

```ts
it("skips a draft whose apply url already belongs to an employer listing", async () => {
  const db = seedWithEmployerJob("https://acme.example/careers/1");
  const result = await ingestDraft(db, draftWithApplyUrl("https://acme.example/careers/1"));
  expect(result.skipped).toBe(true);
  expect(db.raw.prepare("SELECT COUNT(*) AS n FROM jobs").get()).toEqual({ n: 1 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- jobs/queries && pnpm --filter @gaming/crawler test`
Expected: FAIL, the expired sticky still sorts first.

- [ ] **Step 3: Change the sort**

In `apps/web/lib/jobs/queries.ts`, the default `ORDER BY` becomes:

```sql
ORDER BY
  CASE WHEN j.featured_until IS NOT NULL AND j.featured_until > ? THEN 0 ELSE 1 END,
  j.highlight DESC,
  j.posted_at DESC,
  j.id ASC
```

with the current ISO timestamp bound in the right position. Thread a `now` option through `listJobs` defaulting to `new Date()`, so the test can pin it. `orderBy: 'salary'` is left exactly as it is: a salary ranking that can be bought is not a salary ranking.

Also add `j.order_id` and `j.highlight_color` to the selected columns and to the mapped row type.

- [ ] **Step 4: Change the row renderer**

In `apps/web/app/_components/job-row.tsx`, replace

```ts
const sticky = Boolean(job.featuredUntil) || job.highlight === 1;
```

with a comparison against the current time, and apply `job.highlightColor` as an inline custom property on the row when it is set — a border and background tint only, never a text colour.

- [ ] **Step 5: Add the crawler guard**

In `apps/crawler/src/pipeline/ingest.ts`, before the upsert, look up
`SELECT id FROM jobs WHERE tenant_id = ? AND source = 'employer' AND apply_url = ?`
with the canonicalised apply URL and skip the draft when it matches.

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @gaming/web test && pnpm --filter @gaming/crawler test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/jobs/queries.ts apps/web/app/_components/job-row.tsx apps/crawler/src/pipeline/ingest.ts
git commit -m "fix(web): a sticky that expired is not still sticky"
```

---

## Phase 5: The candidate stops paying

### Task 16: Remove the unlock quota

**Files:**
- Delete: `apps/web/lib/unlocks/` (all files and tests), `apps/web/app/api/unlock/`
- Modify: `apps/web/app/_components/job-detail-view.tsx`, `apps/web/lib/profile/gate.ts`, `apps/web/lib/profile/export.ts`, `apps/web/lib/profile/delete-account.ts`, `apps/web/app/dashboard/page.tsx`, `apps/web/app/about/page.tsx`, and every test that asserts the old behaviour

- [ ] **Step 1: Find every importer before deleting anything**

```bash
grep -rn --include=*.ts --include=*.tsx "lib/unlocks\|unlocks/\|FREE_UNLOCKS_PER_WEEK\|RECENT_UNLOCKS_LIMIT\|unlockGateResponse\|submitUnlockForm\|UnlockApplyForm\|isPaidSubscription\|loadSubscriptionStatus" apps/web packages | sort
```

Expect hits in at least: `app/dashboard/page.tsx`, `app/dashboard/page.test.tsx`, `app/jobs/[slug]/unlock-form.tsx`, `app/jobs/[slug]/unlock-form.test.ts`, `app/[slug]/[id]/job-detail-view.tsx`, `lib/profile/gate.ts`, `lib/profile/gate.test.ts`, `lib/profile/talent-pool.test.ts`, `lib/profile/export.ts`, `lib/profile/delete-account.ts`, `app/api/stripe/webhook/route.test.ts`.

Every hit is either deleted or rewritten in this task. Record the list before you start.

- [ ] **Step 2: Write the failing test**

In `apps/web/app/jobs/[slug]/page.test.tsx`, replace the assertion that the non-gated path does not contain `"5 free unlocks"` with one that holds on every path:

```ts
it("shows the on-site apply form for an exclusive job, with no quota", () => {
  const page = JobPage({ params: { slug: "acme-engineer" } });
  const copy = text(page);
  expect(copy).not.toMatch(/unlock/i);
  expect(copy).not.toMatch(/\b5 free\b/);
  expect(elements(page).some((el) => el.props.action === "/api/apply")).toBe(true);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- jobs/`
Expected: FAIL, the copy still contains "unlock".

- [ ] **Step 4: Remove the gate**

The job detail view lives at `app/[slug]/[id]/job-detail-view.tsx`, not in `_components`. Delete `const gated = showBadge(job.exclusivity)` and the branch it drives, plus the `UnlockApplyForm` import and its render; every job renders the plain apply path. Keep `showBadge` itself and the "Not on LinkedIn" badge — it is a fact about the job and was only incidentally the paywall trigger.

**Deleting `lib/unlocks/` breaks five importers the grep in Step 1 will have found. All five are handled here, or `tsc --noEmit` fails:**

- `app/jobs/[slug]/unlock-form.tsx` and `unlock-form.test.ts` are **deleted** — the only importer of `lib/unlocks/client`. An orphaned file still fails type-check, so removing the render is not enough.
- `app/dashboard/page.tsx` loses every unlock and plan surface: the `lib/unlocks/history` and `lib/unlocks/quota` imports, the `UnlockHistoryDatabase` member of `DashboardEnv`, the `countUnlocksThisWeek` / `loadSubscriptionStatus` / `listRecentUnlocks` calls in its `Promise.all`, the `meter`, the shell lead "Your unlocks, profile and plan at a glance.", the "Unlocks this week" tile, the "Plan" tile and the whole "Recent unlocks" section. What remains is the profile tile and the latest jobs. `.dash-tiles` is a multi-column grid, so either promote the profile tile or collapse the grid — decide, do not leave a one-item grid. The now-dead `.dash-tile--unlocks` and `.dash-meter` rules in `app/styles/account.css` go too. `app/dashboard/page.test.tsx` currently mocks `lib/unlocks/history` and asserts "Unlocks this week", "2 of 5 used, resets Monday UTC", "Free plan" and "Recent unlocks"; rewrite it against the new page.
- `unlockGateResponse` in `lib/profile/gate.ts` and its `describe` block in `gate.test.ts` are deleted — `/api/unlock` was its only caller. `safeNextPath`, `onboardingLocation`, `needsOnboarding` and `saveOnboardingProfile` stay; `/login` and `/onboarding` still use them.
- `lib/profile/talent-pool.test.ts` imports `../unlocks/week` and `../unlocks/quota`. Inline what it needs or move the helper.
- `app/api/stripe/webhook/route.test.ts` imports `isPaidSubscription` from `lib/unlocks/quota`; that assertion goes with the subscription model.

Then drop the `unlocks` and `subscription` keys from `lib/profile/export.ts` and both table names from `SQL_DELETE_ORDER` in `lib/profile/delete-account.ts`, updating the assertions in `export.test.ts`, `delete-account.test.ts` and `api/account/delete/route.test.ts` to match the new shape rather than deleting them.

`app/settings/page.tsx` says account deletion "removes your profile, CV and unlock history" — there is no unlock history any more — and carries an "Email digest" panel promising the digest "once billing is live" whose only implementation is the crawler digest deleted in Task 17. Both go.

In `app/about/page.tsx`, the claim "No weekly quota on Apply" is currently false for `hidden_from_linkedin` jobs. It becomes true here; re-read the surrounding NOTS list and correct anything else that no longer holds.

`/onboarding` loses its only forced entry point. Leave the page in place, reachable from the account, and change its copy so it no longer says "before you unlock an application link".

- [ ] **Step 5: Run the suite**

Run: `pnpm --filter @gaming/web test && pnpm --filter @gaming/web typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A apps/web
git commit -m "feat(web): applying is free, on every job"
```

---

### Task 17: Remove the candidate subscription and drop its tables

**Files:**
- Delete: `apps/web/lib/billing/plans.ts` and `plans.test.ts`, `apps/web/app/api/stripe/checkout/`, `apps/web/app/_components/home/pricing-teaser.tsx`, `apps/crawler/src/digest.ts` and `digest.test.ts`
- Create: `packages/db/migrations/0011_drop_candidate_paywall.sql`
- Modify: `apps/web/lib/legal/copy.ts` and its test, `packages/db/src/schema.ts`

- [ ] **Step 1: Confirm the dead code really is dead**

```bash
grep -rn --include=*.ts --include=*.tsx "PLAN_COPY\|planById\|checkoutFormForPlan\|applyStripeEvent\|isStripeCheckoutEnabled\|pricing-teaser\|sendHiddenDigest" apps packages | sort
```

`sendHiddenDigest` should appear only in `digest.ts` and `digest.test.ts`; `pricing-teaser` should appear nowhere but its own file. If either shows another consumer, stop and report it rather than deleting.

- [ ] **Step 2: Write the failing test**

Rewrite `apps/web/lib/legal/copy.test.ts` so `PRICING_COPY` is asserted against the new model:

```ts
it("says candidates pay nothing and listings are priced", () => {
  expect(PRICING_COPY.candidate.toLowerCase()).toContain("free");
  expect(PRICING_COPY.listing).toContain("$299");
});

it("no longer advertises a candidate subscription", () => {
  const copy = JSON.stringify(PRICING_COPY).toLowerCase();
  expect(copy).not.toContain("9 / month");
  expect(copy).not.toContain("59 / year");
});

it("states the GDPR purpose without unlocks or a quota, and names employer data", () => {
  const purpose = PRIVACY_COPY.jobProductPurpose.toLowerCase();
  expect(purpose).not.toContain("unlock");
  expect(purpose).not.toContain("quota");
  expect(purpose).toContain("employer");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- legal/copy`
Expected: FAIL, `PRICING_COPY.candidate` is undefined.

- [ ] **Step 4: Rewrite the copy and delete the modules**

Rewrite **two** constants in `lib/legal/copy.ts`, not one:

- `PRICING_COPY`, with no import from `lib/billing/plans`.
- `PRIVACY_COPY.jobProductPurpose`, which is the site's GDPR Purpose 1 statement and is rendered as the entire body of the `#job-board` section on `/privacy`. It currently reads "we use your account, profile, unlocks, CV, and billing data to operate Nodework as a job board (sign-in, search, apply links, quota, and paid plans)". Unlocks, quota and candidate paid plans all stop existing, and a category it never mentioned appears: employer buyer data — name, email, invoice details and payment records in `job_orders`. Rewrite for both. `app/privacy/page.test.tsx` asserts the constant rather than a literal, so it will not catch a stale rewrite; add a literal assertion that the words "unlock" and "quota" no longer appear.

Then delete the files listed above. `isStripeCheckoutEnabled` and `verifyStripeWebhook` already moved to `lib/billing/stripe.ts` in Task 3, so `plans.ts` has no remaining consumer — confirm that with the grep in Step 1 before deleting it.

- [ ] **Step 5: Write migration 0011**

```sql
-- The candidate subscription and the weekly unlock quota are gone: the listing
-- pays, not the candidate. STRIPE_ENABLED has been "false" in production since
-- launch and the pricing page hid the checkout form while it was, so no
-- candidate was ever charged and there is nothing to migrate.
--
-- Idempotent, like every migration here: production applies a single file with
-- `wrangler d1 execute --remote --file`, which may run it twice.
DROP TABLE IF EXISTS unlocks;
DROP TABLE IF EXISTS subscriptions;
```

Remove both tables from `packages/db/src/schema.ts` in the same commit.

- [ ] **Step 6: Run everything**

Run: `pnpm typecheck && pnpm test`
Expected: PASS across all four packages.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: the candidate subscription is gone"
```

---

## Phase 6: The pages

### Task 18: Checkout styles and the shared price table

**Files:**
- Create: `apps/web/app/styles/checkout.css`, `apps/web/app/_components/price-table.tsx` and its test
- Modify: `apps/web/app/layout.tsx`

**Interfaces:**
- Produces: `PriceTable({ variant })` where `variant` is `"listing" | "bundle" | "addons"`. Called as a function, never as `<PriceTable />`.

- [ ] **Step 1: Write the failing test**

```ts
it("prints every listing price", () => {
  const copy = text(PriceTable({ variant: "listing" }));
  for (const price of ["$299", "$49", "$99", "$149", "$199"]) {
    expect(copy).toContain(price);
  }
});

it("makes no claim about views", () => {
  const copy = text(PriceTable({ variant: "addons" })).toLowerCase();
  expect(copy).not.toMatch(/\d+x more views/);
  expect(copy).not.toMatch(/more views/);
});

it("shows the bundle ladder with its 24 month window", () => {
  const copy = text(PriceTable({ variant: "bundle" }));
  expect(copy).toContain("24 months");
  expect(copy).toContain("55%");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- price-table`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the component and the stylesheet**

Every figure comes from `listing-catalog.ts` through `formatUsd` — no price is typed as a string in JSX.

`checkout.css` styles: the form grid, add-on option rows as padded labels clearing 24px, the order summary, and the colour swatch. It declares no custom properties, no `:root`, and no selector more specific than a single class around `.button`. `input`, `select`, `textarea`, `label` and `fieldset` are already styled globally in `globals.css`; do not restyle them.

Import it in `app/layout.tsx`, in the existing ordered list, never from a component.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/web test -- price-table`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/styles/checkout.css apps/web/app/_components/price-table.tsx apps/web/app/_components/price-table.test.tsx apps/web/app/layout.tsx
git commit -m "feat(web): one price table, read from the catalog"
```

---

### Task 19: The listing form

**Files:**
- Create: `apps/web/app/_components/listing-form.tsx`
- Modify: `apps/web/app/post-web3-job/page.tsx` and its test

- [ ] **Step 1: Write the failing test**

Replace the assertions that currently require "not live" and the EUR plan labels. The old ones guarded a page with nothing to sell; these guard a page that sells:

```ts
it("posts the listing to the checkout endpoint", () => {
  const page = PostWeb3JobPage({ billingLive: true });
  const form = elements(page).find((el) => el.type === "form");
  expect(form?.props.action).toBe("/api/listings");
  expect(form?.props.method).toBe("post");
});

it("asks for every field the listing needs", () => {
  const names = elements(PostWeb3JobPage({ billingLive: true }))
    .map((el) => el.props.name)
    .filter(Boolean);
  for (const field of [
    "title", "description", "companyName", "companyUrl", "location", "remote",
    "mainTag", "tags", "benefits", "twitter", "salaryMin", "salaryMax",
    "postingUrl", "companyLogoUrl", "buyerName", "buyerEmail", "invoiceInfo", "coupon",
  ]) {
    expect(names).toContain(field);
  }
});

it("opens with no add-on selected, so the price starts at $299", () => {
  const checked = elements(PostWeb3JobPage({ billingLive: true }))
    .filter((el) => el.props.type === "radio" || el.props.type === "checkbox")
    .filter((el) => el.props.defaultChecked === true || el.props.checked === true)
    .map((el) => el.props.value);
  expect(checked.filter((value) => value !== "0" && value !== "none")).toEqual([]);
  expect(text(PostWeb3JobPage({ billingLive: true }))).toContain("$299");
});

it("offers only vocabulary the catalog can render", () => {
  const select = elements(PostWeb3JobPage({ billingLive: true }))
    .find((el) => el.props.name === "mainTag");
  expect(select?.type).toBe("select");
});

it("says checkout is not open when billing is off", () => {
  expect(text(PostWeb3JobPage({ billingLive: false })).toLowerCase())
    .toContain("checkout is not open");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- post-web3-job`
Expected: FAIL.

- [ ] **Step 3: Write the form**

Render it by calling `{ListingForm({ billingLive, tags, locations, benefits })}` as a plain function from the page, so every field and price stays in the tree the tests walk.

The page reads `STRIPE_ENABLED` through `getCloudflareContext` exactly as `/pricing` does today, and declares `export const dynamic = "force-dynamic"`.

Add-on controls are radio groups (sticky, highlight) and checkboxes (logo, support, auto-renew), each wrapped in a padded label. The running total is progressive enhancement only: a small inline script that re-quotes from the same constants and writes into a `<output>` element. With JavaScript off the form still submits, and the server quote is authoritative either way.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/web test -- post-web3-job`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/_components/listing-form.tsx apps/web/app/post-web3-job
git commit -m "feat(web): post a web3 job, for real this time"
```

---

### Task 20: The bundle calculator

**Files:**
- Modify: `apps/web/app/post-web3-job/bundle/page.tsx` and its test

- [ ] **Step 1: Write the failing test**

The current test bans a currency figure, every form element, and any href matching `/checkout|stripe|pay|buy/i`. All four assertions were guards for a page that could not take money. Replace that whole `it(...)` block with:

```ts
it("sells bundles at the reference ladder", () => {
  const copy = text(BundlePage({ billingLive: true }));
  expect(copy).toContain("$299");
  expect(copy).toContain("20%");
  expect(copy).toContain("55%");
  expect(copy).toContain("24 months");
});

it("posts to the checkout endpoint with a post count", () => {
  const page = BundlePage({ billingLive: true });
  const form = elements(page).find((el) => el.type === "form");
  expect(form?.props.action).toBe("/api/listings");
  expect(elements(page).some((el) => el.props.name === "bundlePosts")).toBe(true);
  expect(elements(page).some((el) => el.props.name === "kind" && el.props.value === "bundle")).toBe(true);
});

it("still refuses to imply a purchase when billing is off", () => {
  expect(text(BundlePage({ billingLive: false })).toLowerCase()).toContain("checkout is not open");
});
```

Delete the docblock at the top of the page file that says this page must carry no price and no form; it documented the old invariant and is now wrong.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- bundle`
Expected: FAIL.

- [ ] **Step 3: Write the page**

Keep the four descriptive pack sizes as presets above the stepper. Every figure comes from `quoteBundle`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/web test -- bundle`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/post-web3-job/bundle
git commit -m "feat(web): bundles you can actually buy"
```

---

### Task 21: /pricing becomes the employer price list

**Files:**
- Modify: `apps/web/app/pricing/page.tsx`, `apps/web/app/_components/pricing-plans.tsx` (delete), `apps/web/app/pricing/page.test.tsx`

- [ ] **Step 1: Write the failing test**

Replace the file wholesale. Its two modes both assert the EUR candidate plans.

```ts
it("states plainly that candidates pay nothing", () => {
  const copy = text(PricingPage()).toLowerCase();
  expect(copy).toContain("free");
  expect(copy).not.toContain("€");
  expect(copy).not.toMatch(/per week|weekly quota|unlock/);
});

it("prints the listing prices", () => {
  const copy = text(PricingPage());
  expect(copy).toContain("$299");
  expect(copy).toContain("$49");
});

it("sends employers to the form", () => {
  expect(elements(PricingPage()).some((el) => el.props.href === "/post-web3-job")).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- pricing`
Expected: FAIL.

- [ ] **Step 3: Write the page**

Delete `pricing-plans.tsx`. The page renders `{PriceTable({ variant: "listing" })}` and `{PriceTable({ variant: "bundle" })}` plus one short candidate section.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/web test -- pricing`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/pricing apps/web/app/_components/pricing-plans.tsx
git commit -m "feat(web): pricing is what a listing costs"
```

---

### Task 22: /ads gains real prices

**Files:**
- Modify: `apps/web/app/ads/page.tsx` and its test

- [ ] **Step 1: Write the failing test**

```ts
it("prices the placement formats it sells", () => {
  const copy = text(AdsPage());
  expect(copy).toContain("$49");
  expect(copy).toContain("$299");
});

it("still refuses inventory it does not have", () => {
  const copy = text(AdsPage()).toLowerCase();
  expect(copy).toContain("banner");
  expect(copy).not.toMatch(/\d+x more views/);
});

it("no longer says featured placement cannot be bought", () => {
  const copy = text(AdsPage()).toLowerCase();
  expect(copy).not.toContain("no self-serve checkout");
  expect(copy).not.toContain("not self-serve yet");
  expect(copy).not.toContain("we will set it up manually");
});

it("does not claim a paid placement tops every list", () => {
  expect(text(AdsPage())).not.toContain("every list the job already qualifies for");
});

it("says a paid placement does not move the salary rankings", () => {
  expect(text(AdsPage()).toLowerCase()).toContain("salary");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- ads`
Expected: FAIL.

- [ ] **Step 3: Update the page**

Add `{PriceTable({ variant: "addons" })}` and keep the "Not offered yet" list exactly as it is — no banners, no display units, no newsletter sponsorship, no guaranteed impressions are all still true, and that list is the most valuable part of the page.

Three claims on the page go false the moment sticky and highlight are self-serve, and a fourth was always too broad. All four are rewritten:

- `FEATURED_FACTS[0]`, "Sorts to the top of every list the job already qualifies for" — narrowed to name the exception: date-ordered lists only, never the salary-ordered pages (`/highest-paying-web3-jobs` and the salary pages), because a salary ranking that can be bought is not a salary ranking.
- The FAQ answer to "Can I buy this today?": "There is no self-serve checkout for featured placement yet. Reach out through the account route below and we will set it up manually."
- The CTA copy: "There is no self-serve checkout for this yet. Create a free Nodework account so we have a way to reach you."
- In `app/post-web3-job/page.tsx` (rewritten in Task 19, listed here so it is not missed): "There is a featured placement format described on the advertising page. It is also not self-serve yet."

The existing line that featured placement "is a placement format, not a ranking bribe, and the job still has to be real" stays. It is now load-bearing rather than aspirational.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/web test -- ads`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/ads
git commit -m "feat(web): what a featured placement costs, and what it does not buy"
```

---

### Task 23: Success, cancel and manage pages

**Files:**
- Create: the three pages listed in File Structure, plus tests
- Modify: `apps/web/app/robots.ts` and its test, `apps/web/app/sitemap.ts` and its test

- [ ] **Step 1: Write the failing test**

```ts
it("keeps the checkout and manage routes out of robots", () => {
  expect([...PRIVATE_PATHS]).toEqual([
    "/api/", "/dashboard", "/profile", "/settings", "/onboarding",
    "/post-web3-job/checkout", "/post-web3-job/manage",
  ]);
});

it("keeps them out of the sitemap", () => {
  expect(STATIC_PATHS.some((path) => path.includes("/checkout"))).toBe(false);
  expect(STATIC_PATHS.some((path) => path.includes("/manage"))).toBe(false);
});

it("shows the buyer what they bought", async () => {
  const copy = text(await SuccessPage({ searchParams: { order: "order-1" } }));
  expect(copy).toContain("$299");
});

it("does not render a manage page for an unknown token", async () => {
  await expect(ManagePage({ params: { token: "nope" } })).rejects.toThrow();
});

it("shows a bundle buyer their remaining credits", async () => {
  const copy = text(await ManagePage({ params: { token: KNOWN_TOKEN } }));
  expect(copy).toContain("3 posts");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- robots sitemap checkout manage`
Expected: FAIL.

- [ ] **Step 3: Write the pages and the guards**

All three declare `export const dynamic = "force-dynamic"` and `robots: { index: false, follow: false }` in their metadata. The manage page resolves its order through `getOrderByManageToken` and calls `notFound()` when there is none. It renders the receipt, the listing link, the remaining credit count, and — for a bundle with credits left — the same listing form posting to `/api/listings/redeem` with the token in a hidden field.

Add both prefixes to `PRIVATE_PATHS` and update the test's literal array in the same commit.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/web test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/post-web3-job apps/web/app/robots.ts apps/web/app/robots.test.ts apps/web/app/sitemap.ts apps/web/app/sitemap.test.ts
git commit -m "feat(web): see the order you paid for, and spend what you bought"
```

---

### Task 24: Navigation, footer and QA templates

**Files:**
- Modify: `apps/web/app/_components/nav-data.ts`, `footer-data.ts` and its test, `site-chrome.tsx` and its test, `apps/web/qa/templates.mjs`

- [ ] **Step 1: Write the failing test**

```ts
it("routes the header CTA at the form", () => {
  expect(chromeHrefs()).toContain("/post-web3-job");
  expect(chromeHrefs()).toContain("/pricing");
});

it("lists the bundle page in the footer", () => {
  expect(footerHrefs()).toContain("/post-web3-job/bundle");
});
```

`footer-data.test.ts` holds two hardcoded route allowlists (`STATIC_PAGES` and `FOOTER_STATIC_PAGES`) and asserts that no href appears twice and that the "Other" column ends exactly on `["/login", "/login?intent=start"]`. Add `/post-web3-job/bundle` to the matching allowlist in the test file, and do not append to the end of the "Other" column.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @gaming/web test -- footer-data site-chrome`
Expected: FAIL.

- [ ] **Step 3: Update nav, footer and the QA manifest**

The header CTA is hardcoded at `site-chrome.tsx` line 65, not read from `nav-data.ts` — change both or the button keeps pointing at the old route.

Add one row per new route to `apps/web/qa/templates.mjs`. The `register` value must be read off each page's own `<main>` class in the built app, not guessed.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @gaming/web test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/_components apps/web/qa/templates.mjs
git commit -m "feat(web): the site points employers at the form"
```

---

### Task 25: Whole-repo verification

- [ ] **Step 1: Type-check and test everything**

Run: `pnpm typecheck && pnpm test`
Expected: PASS in `@gaming/web`, `@gaming/crawler`, `@gaming/shared`, `@gaming/db`.

- [ ] **Step 2: Prove migration 0010 and 0011 are safe to re-run**

```bash
pnpm --filter @gaming/db test
```
Expected: the idempotence cases from Tasks 2 and 17 pass.

- [ ] **Step 3: Seed a local D1 and walk the funnel**

```bash
cd apps/web
pnpm exec wrangler d1 migrations apply gaming-jobs --local
pnpm exec next dev -p 3000
```

Then visit `/pricing`, `/post-web3-job`, `/post-web3-job/bundle` and `/ads` and confirm each renders, prices come from the catalog, and the pay button reports that checkout is not open while `STRIPE_ENABLED` is `"false"`.

Do not run `next build` while `next dev` is running on the same app.

- [ ] **Step 4: Run the device QA harness**

Run: `pnpm --filter @gaming/web qa`
Expected: zero Critical and zero High across the new templates. Judge horizontal overflow from `documentElement.scrollWidth - documentElement.clientWidth`, never from a screenshot and never against `window.innerWidth`. Await roughly 350ms after any `.click()` before reading `aria-expanded`; React updates the DOM asynchronously. If an interaction looks dead, restart the dev server on a clean process and re-test before reporting it.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: verify the listing funnel end to end"
```

---

## Deployment notes

Not part of any task; these are the two things only the repository owner can do.

1. **The two migrations go on opposite sides of the deploy.**

   `0010_employer_listings.sql` only widens the schema, so it is applied **before** the deploy that starts selecting the new columns:
   `wrangler d1 execute gaming-jobs --remote --file packages/db/migrations/0010_employer_listings.sql`

   `0011_drop_candidate_paywall.sql` is applied **after** the deploy. It drops tables the currently-live worker still reads on every request — `lib/unlocks/quota.ts` via `/api/unlock`, `lib/unlocks/history.ts` via `/dashboard` (which is `force-dynamic`), `lib/profile/export.ts` via the GDPR export, `lib/profile/delete-account.ts` via account deletion. D1 answers a dropped table with `no such table`, which the app catches and renders as a 500 while the worker still reports `outcome: ok`. Running it first breaks all four for the whole window between migration and deploy.

   Confirm each result by asking `sqlite_master` for the table and index names rather than trusting the exit code. `wrangler d1 migrations apply --remote` does not work against this database: production's `d1_migrations` table is empty, so it restarts from `0001_init.sql` and dies on "table tenants already exists".
2. Set the `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` wrangler secrets, point a Stripe webhook endpoint at `/api/stripe/webhook`, then flip `vars.STRIPE_ENABLED` to `"true"` in `apps/web/wrangler.jsonc` and update the assertion in `wrangler.test.ts` in the same commit.

`/web3-companies/[slug]` has `revalidate = 300` and no `generateStaticParams`, so it renders against the production database on every request. A schema-widening deploy that lands before the migration returns 500 from every template that reads a new column.
