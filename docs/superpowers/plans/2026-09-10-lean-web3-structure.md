# Lean Web3 Structure and Readable Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every page readable by fixing the heading rhythm at its root, and cut the homepage from a 13-section narrative to a web3.career-style jobs-first page, removing the last of the gaming-era vocabulary.

**Architecture:** One base CSS rule fixes the readability defect on all 122 pages at a single point. The homepage keeps its hero, board and links block and drops the rest, which deletes six components and most of the leftover copy with them. The remaining copy is rewritten in place. A migration adds the company description column the schema never had, rendered only when populated.

**Tech Stack:** Next.js 15 App Router, custom CSS (no Tailwind), Cloudflare D1, Playwright QA harness, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-10-lean-web3-structure-design.md`

## Global Constraints

- Custom CSS only. No Tailwind, no icon or motion libraries. Tokens and primitives live in `app/globals.css`; area stylesheets in `app/styles/*.css`.
- Copy honesty rules hold: companies never receive a profile when someone applies, applying happens on the company's own site, the talent pool is opt-in and off by default. Never write copy implying otherwise.
- `LINKEDIN_EXCLUSIVITY_TOOLTIP` and the other locked strings in `lib/copy.ts` are imported, never restated.
- No invented content. Company descriptions are rendered only when the column holds text; nothing generates them.
- The aurora acceptance bar still applies: zero page-level horizontal overflow and no sub-24px tap targets beyond the two documented exemptions (links inside a sentence, and `.company-card__link` whose `::after` covers the card), on Chromium, Firefox and WebKit.
- Page tests walk the returned React element tree and only recurse into `props.children`. Tested strings must be direct JSX children in `page.tsx`, not props of a child component.
- Never run `next build` while `next dev` is running on the same app.
- QA runs against a production build served by `next start -p 3100` with `BETTER_AUTH_SECRET=qa-harness-local-secret`, never against `next dev`.

**Vocabulary rules for this work.** Three different things look alike in a grep for "studio"/"game" and must not be treated the same:

1. **`Studio Direct`** is the old product name. The product is **Nodework**. Every user-visible occurrence is a bug, including the sign-in email. Replace.
2. **"studios"** as a synonym for employers is gaming-era vocabulary. The word is **companies**. Replace in user-visible copy.
3. **"game"/"NFT game item"** inside `app/what-is-web3/page.tsx` is legitimate Web3 subject matter — an NFT can be a game item. **Do not touch it.**
4. **`jobs-studio-*` CSS class names** in `app/web3-companies/` are not user-visible. Out of scope; renaming them is churn with no reader benefit.

---

### Task 1: Fix the heading rhythm at the base rule

The readability defect. Headings carry `margin: 0 0 0.5em` — no top margin — so the space above one is whatever the previous element leaves behind: 1em after a paragraph, and **zero** after a chart, a table or a plain `div`, none of which carry a bottom margin. The salary pages alternate charts and headings, which is why they measured 0px above against 16px below.

**Files:**
- Modify: `apps/web/app/globals.css:245-292`
- Test: `apps/web/qa/verify-heading-rhythm.mjs` (already committed; this task is verified by running it, not by a unit test — CSS rhythm is not reachable from the tree-walk tests)

**Interfaces:**
- Consumes: nothing
- Produces: no API. Later tasks rely on the rule being fixed before the homepage is rebuilt, so that the rebuilt page is measured against corrected typography.

- [ ] **Step 1: Record the baseline**

Build and serve, then measure. This number goes in the commit message, so capture it before changing anything.

```bash
cd apps/web
pnpm exec next build
BETTER_AUTH_SECRET=qa-harness-local-secret pnpm exec next start -p 3100 &
node qa/verify-heading-rhythm.mjs chromium | tail -20
```

Expected, from the run recorded in the spec: `59 headings judged, 36 sit closer to the text above than below.`

- [ ] **Step 2: Change the base heading rule**

In `apps/web/app/globals.css`, replace the `h1, h2, h3, h4` block:

```css
/* A heading belongs to the section it opens, not to the paragraph above it.
   With no top margin, the space above a heading was whatever the previous
   element happened to leave behind - 1em after a paragraph, and zero after a
   chart, a table or a plain div, none of which carry a bottom margin. The
   salary pages alternate charts and headings, which is why they measured 0px
   above against 16px below. */
h1,
h2,
h3,
h4 {
  margin: 1.4em 0 0.5em;
  font-weight: 600;
  color: var(--text);
  text-wrap: balance;
}

/* A heading that opens its container has nothing above to separate itself
   from, and a top margin there would push every card, panel and table cell
   out of shape. This reset is what makes the rule above safe to apply at the
   base element. */
h1:first-child,
h2:first-child,
h3:first-child,
h4:first-child {
  margin-top: 0;
}
```

- [ ] **Step 3: Loosen the h2 measure**

Still in `apps/web/app/globals.css`, `h2` carries `line-height: 1.05`, a display measure applied to section headings in running prose. Change only the line-height:

```css
h2 {
  font-size: var(--step-3);
  letter-spacing: -0.025em;
  /* 1.05 is a display measure. These are section headings in prose, and at
     32px a 1.05 measure sets the descenders against the line below. */
  line-height: 1.15;
}
```

- [ ] **Step 4: Rebuild and re-measure**

```bash
cd apps/web
pnpm exec next build
BETTER_AUTH_SECRET=qa-harness-local-secret pnpm exec next start -p 3100 &
node qa/verify-heading-rhythm.mjs chromium | tail -20
```

Expected: `0 sit closer to the text above than below.`

If any remain, they are local rules overriding the base — read the reported `parent` selector for each and fix that rule specifically. Do **not** raise `RATIO` in the instrument to make the number go away.

- [ ] **Step 5: Confirm nothing else moved**

A vertical-rhythm change can introduce overflow or push content out of a fixed box. Re-run the two sweeps that would catch it, all three engines:

```bash
cd apps/web
for e in chromium firefox webkit; do node qa/verify-overflow-sweep-round2.mjs $e | tail -2; done
node qa/verify-tap-target-residue.mjs chromium firefox webkit | tail -5
```

Expected: `overflowRows=0` on each engine, and the tap-target grouping showing only the two exempt families (`p > a` and `p.company-card__name > a.company-card__link`).

- [ ] **Step 6: Re-measure on the other two engines**

```bash
cd apps/web
node qa/verify-heading-rhythm.mjs firefox | tail -3
node qa/verify-heading-rhythm.mjs webkit | tail -3
```

Expected: zero cramped headings on both.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "fix(web): a heading belongs to the section below it

Headings carried margin: 0 0 0.5em - no top margin at all - so the space above
one was whatever the previous element left behind. After a paragraph that is
1em; after a chart, a table or a plain div, which carry no bottom margin, it is
zero. The salary pages alternate charts and headings, which is why they read
worst: 0px above against 16px below.

Measured across 21 templates: 36 of 59 judged headings sat closer to the text
above than below. Now zero, on three engines. The :first-child reset is what
makes this safe at the base rule - without it every card, panel and table cell
heading gains a margin it must not have."
```

---

### Task 2: Stop calling the product Studio Direct

The product is Nodework. `Studio Direct` survives in 13 places, and the worst is not on a page: every magic-link sign-in email says "Sign in to Studio Direct".

Six of the 13 are inside components Task 3 deletes. This task fixes the seven that survive.

**Files:**
- Modify: `apps/web/lib/auth/email.ts:24-26`
- Modify: `apps/web/app/onboarding/page.tsx:22`
- Modify: `apps/web/app/profile/page.tsx:29`
- Modify: `apps/web/app/settings/page.tsx:18`
- Test: `apps/web/lib/auth/email.test.ts`

**Interfaces:**
- Consumes: `TENANT_NAME` from `@gaming/shared` (value: `"Nodework"`), already exported alongside `TENANT_SLUG`
- Produces: nothing new

- [ ] **Step 1: Write the failing test**

Check whether `apps/web/lib/auth/email.test.ts` exists. If it does, add this case to it; if not, create the file with it. Read `lib/auth/email.ts` first to match how `sendMagicLink` is exported and what it takes.

```typescript
import { describe, expect, it, vi } from "vitest";

import { TENANT_NAME } from "@gaming/shared";

describe("the sign-in email", () => {
  it("names the product Nodework, never the old Studio Direct name", async () => {
    const sent: { subject: string; text: string; html: string }[] = [];
    const send = vi.fn(async (message: { subject: string; text: string; html: string }) => {
      sent.push(message);
    });

    await sendMagicLink({ to: "reader@example.com", url: "https://example.com/x" }, send);

    expect(sent).toHaveLength(1);
    const [message] = sent;
    for (const field of [message.subject, message.text, message.html]) {
      expect(field).toContain(TENANT_NAME);
      expect(field).not.toMatch(/Studio Direct/i);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd apps/web && pnpm exec vitest run lib/auth/email.test.ts
```

Expected: FAIL — the subject is `"Your Studio Direct sign-in link"`, so `toContain("Nodework")` fails.

- [ ] **Step 3: Fix the email**

In `apps/web/lib/auth/email.ts`, import the name rather than hard-coding it, so a future rename cannot leave the email behind again:

```typescript
import { TENANT_NAME } from "@gaming/shared";
```

and replace the three strings:

```typescript
      subject: `Your ${TENANT_NAME} sign-in link`,
      text: `Sign in to ${TENANT_NAME}: ${url}`,
      html: `<p><a href="${url}">Sign in to ${TENANT_NAME}</a></p>`,
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd apps/web && pnpm exec vitest run lib/auth/email.test.ts
```

Expected: PASS.

- [ ] **Step 5: Fix the three page descriptions**

These are `metadata.description` strings. Replace the product name and, in `settings`, the employer word at the same time:

`apps/web/app/onboarding/page.tsx:22`
```typescript
    "Add a display name, target role and remote preference to your Nodework account before you unlock an application link.",
```

`apps/web/app/profile/page.tsx:29`
```typescript
    "Your Nodework profile: location and remote preference, experience, skills from the job hubs, and a PDF CV.",
```

`apps/web/app/settings/page.tsx:18`
```typescript
    "Nodework account settings: profile visibility to verified companies, data export, and account deletion.",
```

- [ ] **Step 6: Confirm nothing user-visible still says it**

```bash
cd apps/web
grep -rn "Studio Direct" app lib --include=*.tsx --include=*.ts | grep -v "\.test\."
```

Expected: only the six occurrences inside `app/_components/home/comparison.tsx` and `app/_components/theaters/*.tsx`, which Task 3 deletes. Nothing else.

- [ ] **Step 7: Run the suite and commit**

```bash
cd "$(git rev-parse --show-toplevel)" && pnpm test 2>&1 | grep -E "Tests |failed"
git add apps/web/lib/auth/email.ts apps/web/lib/auth/email.test.ts apps/web/app/onboarding/page.tsx apps/web/app/profile/page.tsx apps/web/app/settings/page.tsx
git commit -m "fix(web): the product is called Nodework, including in the email

Every magic-link sign-in email said 'Sign in to Studio Direct' - a product name
that does not exist, in the one piece of copy that leaves the site and lands in
a stranger's inbox. Three page descriptions carried it too.

The email now imports TENANT_NAME instead of hard-coding a name, so the next
rename cannot leave it behind again, and the test asserts the old name is
absent rather than only that the new one is present."
```

---

### Task 3: Cut the homepage to four blocks

13 sections in 315 lines becomes four: hero with search, the job board, its pager, and the links block. Everything between them is narrative that web3.career does not have.

**Files:**
- Modify: `apps/web/app/page.tsx` (sections at lines 152-311, imports at 7-22, and `homeFaqJsonLd` defined locally at line 98)
- Modify: `apps/web/app/page.test.tsx`
- Modify: `apps/web/app/_components/home-mega.tsx` — **do not delete it.** `HomeMegaLinks` stays; `HomeCareerFaq`, `HomeReviews`, `ProfileBanner` and `homeCareerFaq` are exported from the same file and go.
- Modify: `apps/web/app/_components/home-mega.test.tsx` — drop the cases for the removed exports
- Delete: `apps/web/app/_components/theaters/career-pages-theater.tsx`
- Delete: `apps/web/app/_components/theaters/one-board-theater.tsx`
- Delete: `apps/web/app/_components/theaters/search-theater.tsx`
- Delete: `apps/web/app/_components/home/comparison.tsx`
- Delete: `apps/web/app/_components/home/feature-row.tsx` (only consumer is the homepage)
- Delete: `apps/web/app/styles/theaters.css` and its import in `app/layout.tsx`
- Test: `apps/web/app/page.test.tsx`, `apps/web/app/_components/home-mega.test.tsx`

**Test helpers.** `app/page.test.tsx` already defines `elements(node)` and `text(node)` at lines 57 and 65. Use `text(...)` — do not add a second flattener.

**Interfaces:**
- Consumes: the fixed base typography from Task 1
- Produces: a homepage whose only sections are `.home-hero`, the board section, and the mega-links section. Task 6 measures this page.

**What stays, and why:**

| Section | Fate |
|---|---|
| `home-hero` — h1, lead, `BoardSearch`, `TagChips` | **Stays.** This is web3.career's header row. |
| Stats band (`home-stats`) | **Folds into the hero.** Two numbers, one line; it does not need a section of its own. |
| Wedge `FeatureRow` + `CareerPagesTheater` | Delete |
| `JobBoard` + `CatalogPager` | **Stays.** This is the page. |
| Browse `FeatureRow` + `OneBoardTheater` | Delete |
| Search `FeatureRow` + `SearchTheater` | Delete |
| Salaries teaser | Delete — `HomeMegaLinks` already links there |
| Companies teaser ("The studios in the index") | Delete |
| Pricing teaser | Delete |
| `HomeMegaLinks` | **Stays.** This is the SEO links block. |
| `HomeReviews` | Delete |
| `HomeCareerFaq` | Delete — **and its JSON-LD with it** |
| `ProfileBanner` | Delete from the homepage |

- [ ] **Step 1: Write the failing test**

In `apps/web/app/page.test.tsx`, replace the assertions covering the deleted sections with one that pins the new shape. Read the existing file first for how it renders the page and walks the tree.

```tsx
it("is a jobs page, not a pitch: hero, board and links, nothing between them", async () => {
  const tree = await HomePage({ searchParams: Promise.resolve({}) });
  const rendered = text(tree);

  // The board is the page.
  expect(rendered).toContain("Web3 Jobs");

  // None of the narrative sections survive.
  expect(rendered).not.toMatch(/Jobs posted only on studio career pages/);
  expect(rendered).not.toMatch(/Browse, filter, and search all at once/);
  expect(rendered).not.toMatch(/Keyword search across the whole catalog/);
  expect(rendered).not.toMatch(/The studios in the index/);
  expect(rendered).not.toMatch(/Salary data from real jobs/);
});
```

Match how the existing cases in this file call the page — read one before writing this, since the tree walk only recurses into `props.children` and a string passed as a prop will not be found.

- [ ] **Step 2: Run it and watch it fail**

```bash
cd apps/web && pnpm exec vitest run app/page.test.tsx
```

Expected: FAIL on the first `not.toMatch` — the narrative sections are still there.

- [ ] **Step 3: Cut the sections**

In `apps/web/app/page.tsx`, delete the sections listed as "Delete" in the table above, and move the two stats into the hero `div.container` under the lead. Remove the now-unused imports at lines 7-22 (`CareerPagesTheater`, `OneBoardTheater`, `SearchTheater`, `FeatureRow`, the reviews and FAQ components, `ProfileBanner`, `PRICING_COPY`, `LINKEDIN_EXCLUSIVITY_TOOLTIP`).

Keep `data-reveal` on what remains but renumber `data-reveal-delay` so it runs 1, 2, 3 without gaps — a stale delay of 9 on the third section leaves the page visibly waiting.

- [ ] **Step 4: Remove the FAQ structured data**

Delete the `<JsonLd data={homeFaqJsonLd(listed.total)} />` call at `app/page.tsx:131` and the `homeFaqJsonLd` function, which is defined locally in the same file at line 98. Its content comes from `homeCareerFaq` in `home-mega.tsx`, which goes with it.

This is not optional tidying. Structured data must describe content the reader can see; an `FAQPage` block on a page with no FAQ is a Google structured-data violation and can earn a manual action.

- [ ] **Step 5: Delete the components and their stylesheet**

```bash
cd "$(git rev-parse --show-toplevel)"
git rm apps/web/app/_components/theaters/career-pages-theater.tsx \
       apps/web/app/_components/theaters/one-board-theater.tsx \
       apps/web/app/_components/theaters/search-theater.tsx \
       apps/web/app/_components/home/comparison.tsx \
       apps/web/app/_components/home/feature-row.tsx \
       apps/web/app/styles/theaters.css
```

Then remove the `theaters.css` import from `apps/web/app/layout.tsx`.

`app/_components/theaters/` is now empty — remove the directory.

`HomeReviews`, `HomeCareerFaq`, `ProfileBanner` and `homeCareerFaq` are **not** separate files: all four are exported from `app/_components/home-mega.tsx`, alongside `HomeMegaLinks`, which stays. Delete those four exports and whatever becomes unreachable with them from inside that file, and drop their cases from `home-mega.test.tsx`. Do not delete the file.

`ProfileBanner` leaves the homepage. Check whether anything else imports it before deleting the export:

```bash
cd apps/web && grep -rn "ProfileBanner" app --include=*.tsx | grep -v home-mega
```

If another page uses it, keep the export and only drop it from the homepage.

- [ ] **Step 6: Remove the theater keyframes**

`app/styles/motion.css` still defines `th1-*`, `th3-*` and `th6-*` keyframes for the three deleted theaters. Delete those keyframe blocks. Leave every other keyframe alone — `marquee`, `reveal`, `rise`, `fade-in`, `parallax`, `count-up`, `sheen`, `aurora-drift`, `hero-in`, `jd-in` and `t-blink` are used elsewhere.

Verify nothing references them before and after:

```bash
cd apps/web && grep -rn "th1-\|th3-\|th6-\|\.th1\|\.th3\|\.th6" app --include=*.css --include=*.tsx
```

Expected: no output.

- [ ] **Step 7: Run it and watch it pass**

```bash
cd apps/web && pnpm exec vitest run app/page.test.tsx
cd "$(git rev-parse --show-toplevel)" && pnpm typecheck && pnpm test 2>&1 | grep -E "Tests |failed"
```

Expected: PASS, typecheck clean, whole suite green. Typecheck is what catches an import you removed a component for but left behind.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(web): the homepage is a job board, not a pitch

Thirteen sections in 315 lines becomes four: hero with search, the board, its
pager, and the links block. web3.career has three; everything cut sat between
the reader and the jobs.

Deleting the three theaters and the feature rows also removes 32 of the
remaining gaming-era occurrences, because that is where the studio-career-page
story lived.

The FAQ's JSON-LD goes with the FAQ. Structured data has to describe content
the reader can see - an FAQPage block on a page with no FAQ is a violation, not
leftover markup."
```

---

### Task 4: Employers are companies, not studios

The remaining gaming-era vocabulary, in pages that survive. Read the Global Constraints vocabulary rules before starting: `app/what-is-web3/page.tsx` mentions games legitimately and must not be touched, and the `jobs-studio-*` class names are out of scope.

**Files:**
- Modify: `apps/web/app/about/page.tsx:58`
- Modify: `apps/web/app/dashboard/page.tsx:168`
- Modify: `apps/web/app/jobs/[slug]/apply/page.tsx:77`
- Modify: `apps/web/app/jobs/[slug]/unlock-form.tsx:12` (comment)
- Modify: `apps/web/app/login/page.tsx:16` (comment)
- Modify: `apps/web/app/not-found.tsx:18`
- Modify: `apps/web/app/settings/page.tsx:74`
- Modify: `apps/web/app/web3-companies/_directory.tsx:194`
- Modify: `apps/web/app/[slug]/[id]/apply/page.tsx:72`
- Modify: `apps/web/app/[slug]/[id]/job-detail-view.tsx:154,272-273`
- Test: `apps/web/app/not-found.test.tsx` and the existing apply/job-detail page tests

**Interfaces:**
- Consumes: nothing
- Produces: nothing

- [ ] **Step 1: Write the failing test**

Add to `apps/web/app/not-found.test.tsx` (create it if absent, matching a sibling page test for structure):

```tsx
it("does not call an employer a studio", async () => {
  const tree = NotFound();
  expect(renderedText(tree)).not.toMatch(/\bstudios?\b/i);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd apps/web && pnpm exec vitest run app/not-found.test.tsx
```

Expected: FAIL — the copy reads "the studio may have taken the listing down".

- [ ] **Step 3: Rewrite the copy**

Work through the file list. Substitute the employer sense of "studio" with "company", keeping the sentence natural rather than doing a blind find-and-replace. Two that need real rewriting rather than a word swap:

`apps/web/app/dashboard/page.tsx:168`
```tsx
No unlocks yet. Open a job and unlock the company&apos;s apply link.
```

`apps/web/app/[slug]/[id]/job-detail-view.tsx:272-273`
```tsx
                  This company does not post to LinkedIn - the apply link on this
                  listing reveals it and sends you straight to their own page.
```

Check each rewritten sentence against the honesty rules in Global Constraints. `apply/page.tsx` and `unlock-form.tsx` sit right next to the claim about what employers do and do not receive; do not let a reword weaken it.

- [ ] **Step 4: Run it and watch it pass**

```bash
cd apps/web && pnpm exec vitest run app/not-found.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Confirm only the legitimate uses remain**

```bash
cd apps/web
grep -rniE "\bstudios?\b" app --include=*.tsx | grep -v "\.test\." | grep -v "jobs-studio"
```

Expected: no output.

```bash
grep -rniE "\bgames?\b" app --include=*.tsx | grep -v "\.test\."
```

Expected: only `app/what-is-web3/page.tsx`, where a game item is a real example of what an NFT can be.

- [ ] **Step 6: Run the suite and commit**

```bash
cd "$(git rev-parse --show-toplevel)" && pnpm test 2>&1 | grep -E "Tests |failed"
git add -A
git commit -m "fix(web): employers are companies, not studios

The last of the gaming-era vocabulary, in the pages that survived the homepage
cut. Left alone deliberately: what-is-web3 says an NFT can be a game item,
which is the subject matter and not a leftover, and the jobs-studio-* class
names are not user-visible.

The apply and unlock copy sits next to the claim about what an employer does
and does not receive when someone applies, so each sentence was rewritten
rather than word-swapped, to keep that claim intact."
```

---

### Task 5: Give companies a description column

`companies` holds `name`, `name_norm`, `domain`, `career_url`, `ats_type`, `ats_slug`, `logo_url`, `listed` — no text column, so a company page has no body to render. This adds it. Nothing populates it, and the page shows it only when it holds text.

**Files:**
- Create: `packages/db/migrations/0009_company_description.sql`
- Modify: `apps/web/app/web3-companies/[slug]/page.tsx`
- Modify: `apps/web/lib/jobs/queries.ts` — the company query, to select the new column
- Test: `packages/db/src/migrations-apply.test.ts`, `apps/web/app/web3-companies/[slug]/page.test.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `companies.description TEXT` — nullable. The company query returns it as `description: string | null`.

- [ ] **Step 1: Write the failing migration test**

Append to `packages/db/src/migrations-apply.test.ts`:

```typescript
describe("companies carry a description", () => {
  it("accepts one, and defaults to null", () => {
    const db = applyMigrations();
    seedOneJob(db);

    const before = db
      .prepare(`SELECT description FROM companies WHERE id = 'company:c'`)
      .get() as { description: string | null };
    expect(before.description).toBeNull();

    db.prepare(`UPDATE companies SET description = ? WHERE id = 'company:c'`).run(
      "Acme builds settlement rails.",
    );
    const after = db
      .prepare(`SELECT description FROM companies WHERE id = 'company:c'`)
      .get() as { description: string | null };
    expect(after.description).toBe("Acme builds settlement rails.");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd packages/db && pnpm exec vitest run src/migrations-apply.test.ts
```

Expected: FAIL — `no such column: description`.

- [ ] **Step 3: Write the migration**

Create `packages/db/migrations/0009_company_description.sql`:

```sql
-- Company pages had no body to render: companies carried a name, a domain, ATS
-- coordinates and a logo, and no text at all.
--
-- Nothing fills this in. The web3.career API does not supply company
-- descriptions, and generating them would be exactly the fabricated content
-- this project has refused throughout. The column exists so a description can
-- be written by hand; the page renders it only when it holds text, and shows
-- the company's jobs either way.
--
-- Idempotent on purpose: production's d1_migrations table is empty, so
-- `wrangler d1 migrations apply --remote` restarts from 0001 and dies on
-- "table tenants already exists". A single migration is applied there with
-- `wrangler d1 execute --remote --file`, which has no once-only bookkeeping,
-- so every new migration must be safe to run twice.
ALTER TABLE companies ADD COLUMN description TEXT;
```

`ALTER TABLE ... ADD COLUMN` has no `IF NOT EXISTS` in SQLite. Applying this twice fails with "duplicate column name". That is a loud, harmless failure — note it in the task's report so whoever applies it to production knows to expect it on a re-run rather than treating it as breakage.

- [ ] **Step 4: Run it and watch it pass**

```bash
cd packages/db && pnpm exec vitest run src/migrations-apply.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write the failing page test**

In `apps/web/app/web3-companies/[slug]/page.test.tsx`, add both directions — a page that renders a description it has, and one that renders nothing rather than a placeholder when it has none. Read the file first for how it stubs the D1 binding.

```tsx
it("renders a description when the company has one", async () => {
  const tree = await CompanyPage({ params: Promise.resolve({ slug: "acme" }) });
  expect(renderedText(tree)).toContain("Acme builds settlement rails.");
});

it("shows no description block at all when the column is empty", async () => {
  const tree = await CompanyPage({ params: Promise.resolve({ slug: "empty-co" }) });
  const text = renderedText(tree);
  expect(text).not.toMatch(/About this company/i);
  expect(text).not.toMatch(/No description/i);
});
```

- [ ] **Step 6: Run it and watch it fail**

```bash
cd apps/web && pnpm exec vitest run "app/web3-companies/[slug]/page.test.tsx"
```

Expected: FAIL — the first case, because nothing renders a description.

- [ ] **Step 7: Select and render it**

Add `description` to the company `SELECT` in `apps/web/lib/jobs/queries.ts` and to the row type. In `apps/web/app/web3-companies/[slug]/page.tsx`, render it inside the existing header area:

```tsx
{company.description ? (
  <div className="company-profile__about">
    <h2>About this company</h2>
    <p>{company.description}</p>
  </div>
) : null}
```

No empty state, no placeholder, no "description coming soon". A company without one shows its jobs, which is the useful content.

- [ ] **Step 8: Run it and watch it pass**

```bash
cd apps/web && pnpm exec vitest run "app/web3-companies/[slug]/page.test.tsx"
cd "$(git rev-parse --show-toplevel)" && pnpm typecheck && pnpm test 2>&1 | grep -E "Tests |failed"
```

Expected: PASS, typecheck clean, suite green.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(db): companies can carry a description

The companies table had no text column at all, so a company page had a name, a
logo and a list of jobs and nothing else to say. This adds the column.

Nothing fills it in. The web3.career API does not supply company descriptions
and generating them would be the fabricated content this project has refused
throughout, so the page renders one only when it holds text - no placeholder,
no empty state - and shows the jobs either way.

Note for whoever applies it to production: d1_migrations there is empty, so
migrations apply --remote restarts from 0001 and fails. Apply this one with
d1 execute --remote --file. ADD COLUMN has no IF NOT EXISTS, so a second run
fails with 'duplicate column name' - loud, and harmless."
```

---

### Task 6: Verify the whole thing, then deploy

Deleting sections changes layout on every page that shares the chrome, and the typography change moved every heading. The previous QA run does not cover the current site.

**Files:**
- Create: `docs/qa/2026-09-10-lean-structure-qa.md`
- Modify: `docs/superpowers/specs/2026-09-10-lean-web3-structure-design.md` if any claim in it turned out wrong

**Interfaces:**
- Consumes: all previous tasks
- Produces: the QA record

- [ ] **Step 1: Build and serve a clean production build**

```bash
cd apps/web
rm -rf .next
pnpm exec next build
BETTER_AUTH_SECRET=qa-harness-local-secret pnpm exec next start -p 3100 &
```

Expected: build completes. The page count will be lower than 122 only if a route was removed — it should not be; check and explain any difference rather than accepting it.

- [ ] **Step 2: Run the full sweep on three engines**

```bash
cd apps/web
node qa/verify-heading-rhythm.mjs chromium | tail -3
node qa/verify-heading-rhythm.mjs firefox | tail -3
node qa/verify-heading-rhythm.mjs webkit | tail -3
for e in chromium firefox webkit; do node qa/verify-overflow-sweep-round2.mjs $e | tail -2; done
node qa/verify-tap-target-residue.mjs chromium firefox webkit | tail -5
node qa/verify-reduced-motion.mjs | tail -3
node qa/verify-reveal-firefox.mjs | tail -3
node qa/motion-theater-loop-check.mjs | tail -5
```

Expected: zero cramped headings, `overflowRows=0` per engine, tap targets showing only the two exempt families, no element left invisible under reduced motion, nothing stranded.

`motion-theater-loop-check.mjs` probes theaters that no longer exist — update its `PROBES` list to drop them rather than letting it report "does not exist" forever. If every probe is gone, delete the file.

- [ ] **Step 3: Write the QA record**

Write `docs/qa/2026-09-10-lean-structure-qa.md` with the before and after numbers for heading rhythm, the sweep results per engine, and anything that surprised you. Record what you did **not** test and why. Do not write a number you did not measure.

- [ ] **Step 4: Commit and push**

```bash
cd "$(git rev-parse --show-toplevel)"
git add -A && git commit -m "docs: QA for the lean structure and typography pass"
git push origin main
```

The push deploys — `.github/workflows/deploy.yml` builds on Linux and uploads. Watch it:

```bash
gh run watch
```

- [ ] **Step 5: Apply the migration to production**

The deploy does not migrate the remote database. Applying it needs the user — the schema of a live database is theirs to change. Give them the command and stop:

```
cd apps/web && CLOUDFLARE_API_TOKEN=<token> pnpm exec wrangler d1 execute gaming-jobs --remote --file ../../packages/db/migrations/0009_company_description.sql
```

Then confirm it landed, rather than trusting the exit code — the last migration reported nothing wrong and had not been applied:

```bash
cd apps/web && CLOUDFLARE_API_TOKEN=<token> pnpm exec wrangler d1 execute gaming-jobs --remote \
  --command "SELECT name FROM pragma_table_info('companies') WHERE name = 'description'"
```

Expected: one row.

- [ ] **Step 6: Verify the live site with a browser, not a status code**

```bash
cd apps/web && QA_BASE_URL=https://gaming-web.xavier-ff2.workers.dev node qa/verify-live-worker-errors.mjs 2
```

A 200 is not evidence the page rendered: the last deploy answered 200 on every route while 30 of 32 browser loads were error pages.

Keep this run small. Each page load is real D1 reads on a billed account, and the D1 row-read cost is why the site went down once already.

---

## Not in this plan, and why

**The nav and the footer are not touched.** The spec's first draft said to trim
them; checking that against the reference reversed it. The nav's five mega-menus
— Jobs, Salaries, Internships, Learn Web3, TOP Web3 Jobs — are web3.career's own
nav, built during the parity work, and the 13-column, 52-link footer is the same
wall of SEO links web3.career runs. Trimming either would move away from the
reference, not toward it. If the nav is revisited later, the one real complaint
against it is that the Jobs menu mixes job links with account and commercial
ones (Login, Create a profile, Hire, API, Advertise, Pricing, Post a job) — but
web3.career does much the same, so it is a judgement call, not a defect.

**`jobs-studio-*` class names stay.** Not user-visible; renaming them is churn.

**Company descriptions stay empty.** Task 5 adds the column. Nothing fills it.

## Notes for the executor

**Order matters.** Task 1 before Task 3: rebuilding the homepage against broken typography means measuring it twice.

**The instrument is the acceptance test, not your eye.** Three findings in this project's history were confident, wrong, and withdrawn only because something measured them. If a check reports a problem, read the reported selector and fix that rule. Never loosen the threshold to make a number go away.

**Report what you skipped.** A task report that says "done" while a step was skipped is worse than one that says which step was skipped and why. Vague phrasing in a report is a signal to go and check the file.
