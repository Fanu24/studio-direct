# Aurora Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the visual layer of `apps/web` in a modern web3 register — aurora-lit marketing surfaces, terminal-clean data surfaces, fluid motion — across all 17 templates, verified on 3 browser engines and 6 viewports.

**Architecture:** One token layer in `globals.css` plus one motion layer in `motion.css`, both written once in Task 1 and read-only afterwards. A `data-surface` attribute on `<body>` switches between the two registers. Six implementation lanes then redesign their own templates against that system, each owning a disjoint set of files so no two lanes can conflict. A four-dimension QA pass measures the result against a production build.

**Tech Stack:** Next.js 15 App Router, React 19, custom CSS (no Tailwind, no motion library), OpenNext on Cloudflare Workers, vitest, Playwright (new devDependency, QA only).

**Spec:** `docs/superpowers/specs/2026-09-09-aurora-redesign-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **Branch:** `redesign/aurora`. Baseline commit `2ed77e7`.
- **No new runtime dependencies.** Playwright is a devDependency and is used only by QA. No Tailwind, no motion library, no icon library, no UI kit.
- **`:root` is declared only in `app/globals.css`.** No other stylesheet declares a custom property. All stylesheets are imported from `app/layout.tsx` and nowhere else.
- **`@keyframes` are declared only in `app/styles/motion.css`.**
- **No `backdrop-filter` anywhere.**
- **`--violet: #7C5CFF` appears only inside gradient definitions** — never as text, border, or interactive colour.
- **Button specificity:** the base selector is `.button`, never `button.button`. Modifiers sit at the same specificity as the base.
- **Every element rendering digits gets `font-variant-numeric: tabular-nums`.**
- **Locked copy is imported, never retyped:** `HOMEPAGE_CLAIM`, `LINKEDIN_EXCLUSIVITY_TOOLTIP`, `PRICING_COPY`, the login strings, the hidden-jobs H1, and all of `lib/legal/copy.ts`.
- **Honesty rules:** no invented KPIs, no "Trusted by", testimonials labelled as example voices, no UI implying a studio receives a profile when someone applies.
- **Tree-walk trap:** page tests recurse only into `props.children`. If a redesign moves a tested string into a subcomponent, either call the component as a plain function (`{JobCard({ job })}`) so its output lands in the tree, or update the test deliberately and report it. Never silently delete an assertion.
- **Two runtime traps that unit tests cannot see.** `next dev` never receives `SITE_URL` (it lives in wrangler vars), so public routes must degrade to a relative path rather than throw on it. Route params arrive percent-encoded — `/remote+solidity-jobs` reaches the route as the literal `remote%2Bsolidity-jobs` — so any `decodeURIComponent` already present in route parsing stays, in its try/catch. Verify routing and env changes with curl against a running server, never with vitest alone.
- **Green gates for every task:** `pnpm --filter @gaming/web test`, `pnpm --filter @gaming/web typecheck`.
- **Commit at the end of every task.** Message prefix `feat(web):` for lanes, `chore(web):` for tooling.

---

### Task 1: The design system (phase 0)

**Model:** Fable 5.1. This task sets the aesthetic ceiling for every task after it.

**Files:**
- Modify: `apps/web/app/globals.css` (full rewrite of the token block and primitives)
- Create: `apps/web/app/styles/motion.css`
- Modify: `apps/web/app/layout.tsx` (register attribute, stylesheet imports)
- Modify: `apps/web/app/_components/site-chrome.tsx` (header, nav, mobile menu, footer shell)
- Modify: `apps/web/app/styles/footer.css`, `apps/web/app/styles/salary.css` (strip `:root`, imports move to layout)
- Modify: `apps/web/app/_components/nav-links.tsx`, `mobile-menu.tsx`, `nav-account.tsx`, `nav-mega.tsx`
- Test: `apps/web/app/_components/site-chrome.test.tsx`

**Interfaces:**
- Produces, for every later task: the token names in spec §1.2 and §1.4; the primitive classes in spec §1.6 (`.container`, `.stack`, `.panel`, `.hairline`, `.button` + modifiers, `.chip`, `.badge`, `.field`, `.table`, `.table__num`); the motion classes in spec §1.7 (`.m-reveal`, `.m-parallax`, `.m-marquee`, `.m-count`, `.m-lift`, `.m-sheen`); and the `data-surface` contract.
- Consumes: nothing.

- [ ] **Step 1: Find every component-level stylesheet import**

```bash
cd "apps/web" && grep -rn 'import ".*\.css"' app/ --include=*.tsx | grep -v 'app/layout.tsx'
```

Expected: at least `footer.css` (in `site-chrome.tsx`) and `salary.css`. Each one found must be removed from the component and added to `layout.tsx`.

- [ ] **Step 2: Write the token layer**

Replace the `:root` block in `globals.css` with the palette, layout tokens and type scale exactly as written in spec §1.2 and §1.4. Add `--aurora` from §1.3. Keep `color-scheme: dark`.

- [ ] **Step 3: Write the primitives**

In `globals.css`, below the tokens, write every primitive listed in spec §1.6: `.container`, `.stack`, `.panel`, `.hairline`, `.button` with `--primary`/`--ghost`/`--quiet`, `.chip` with `--active`, `.badge` with `--honest`, `.field` with `__label`/`__input`/`__error`, `.table` with `__num`.

The button base is `.button` alone. Writing `button.button` outranks every `.button--*` modifier and silently paints all secondary buttons in the primary colour — this has already happened once in this codebase.

```css
.button { /* base: layout, radius, transition, focus */ }
.button--primary { background: var(--accent); color: var(--accent-ink); }
.button--ghost   { background: transparent; border: 1px solid var(--line-strong); }
.button--quiet   { background: transparent; border: 0; color: var(--dim); }
.table__num      { font-variant-numeric: tabular-nums; text-align: right; }
```

- [ ] **Step 4: Write the two registers**

The register is a class on each page's outermost element, not an attribute on `<body>`. The root layout never learns the pathname, so the page declares its own register — no middleware, no `usePathname`, no client component, no hydration flash.

```css
.surface--stage {
  --section: clamp(88px, 10vw, 152px);
  --dur-reveal: var(--dur-long);
  --reveal-d: 24px;
}
.surface--stage::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: var(--aurora);
}
.surface--data {
  --section: clamp(48px, 5vw, 72px);
  --dur-reveal: var(--dur-short);
  --reveal-d: 8px;
}
.surface--stage :is(h1, h2) { font-family: var(--font-display); letter-spacing: -0.035em; }
.surface--data  :is(h1, h2) { font-family: var(--font-sans); font-weight: 600; }
```

`<body>` keeps the flat `--bg` ground. The aurora rides on the fixed pseudo-element above, so it covers the viewport even though the class sits on a page-level container.

Each lane applies the correct class to its own pages in phase 1. Stage and data membership is the table in spec §1.5.

- [ ] **Step 5: Write `motion.css`**

Create `apps/web/app/styles/motion.css` containing the duration and easing tokens, the six primitives, the `@supports` guards and the reduced-motion block exactly as specified in spec §1.7. Import it from `layout.tsx` immediately after `globals.css`.

- [ ] **Step 6: Move the 34 keyframes**

```bash
cd "apps/web" && grep -rn "@keyframes" app/globals.css app/styles/*.css
```

Every keyframe outside `motion.css` is either moved into `motion.css` or deleted if unused. Re-run the grep; it must return matches only from `motion.css`.

- [ ] **Step 7: Redesign the site chrome**

`site-chrome.tsx` and its nav components: header, primary nav, mega menu, mobile menu, account menu, footer. Use only the primitives from Step 2 and the motion classes from Step 5. The mobile menu toggle must set `aria-expanded` and must be operable by keyboard.

- [ ] **Step 8: Verify the token layer has exactly one definition**

```bash
cd "apps/web" && pnpm exec next build && grep -rlo -- "--accent:" .next/static/css/*.css | head
```

Then for each emitted CSS file: `grep -bo -- "--accent: *#[0-9a-f]*" <file>` must return exactly one byte offset.

- [ ] **Step 9: Run the gates**

```bash
pnpm --filter @gaming/web test && pnpm --filter @gaming/web typecheck
```

Expected: PASS. `site-chrome.test.tsx` may need updating if nav markup moved; update it deliberately and note it.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat(web): aurora design system, tokens, motion and chrome"
```

---

### Tasks 2-7: The six lanes (phase 1)

**Model:** Haiku 4.5. All six run in parallel. Each lane owns the files listed for it in spec §2 and **must not edit any file outside that list**. `globals.css`, `motion.css`, `layout.tsx` and `site-chrome.tsx` are read-only for every lane.

Each lane follows the same five steps. The lane's own template list and file list come from the table in spec §2.

- [ ] **Step 1: Read the system before writing anything**

```bash
cd "apps/web" && sed -n '1,200p' app/globals.css && cat app/styles/motion.css
```

The lane implements with these tokens and these classes. A lane that needs something the system does not have **reports it and works around it**; it does not add a token, a keyframe, or a dependency.

- [ ] **Step 2: Redesign each template in the lane**

For every template: rebuild the page's section structure and its stylesheet against the new system.

The lane sets its own register. Every page in the lane gets `className="surface surface--stage"` or `className="surface surface--data"` on its outermost element, per the membership table in spec §1.5. Lane 1 is stage. Lanes 2, 3, 4 and 6 are data, except `learn-web3`, `what-is-web3` and `crypto-events` in lane 4, which are stage. Lane 5 is entirely stage.

Stage-register templates get: display type at `--step-4`/`--step-5`, generous `--section` rhythm, `.m-reveal` on section entry, `.m-lift` on cards, at most one `.m-sheen` per page.

Data-register templates get: flat surfaces, `.hairline` dividers, `.table__num` on every figure, `.m-reveal` at the short duration, and no decorative motion on anything in the path of search, filtering or pagination.

- [ ] **Step 3: Check the tested strings still live in the walked tree**

```bash
cd "apps/web" && pnpm exec vitest run <the lane's page.test.tsx files>
```

If an assertion fails because content moved into a subcomponent, fix it by calling the component as a plain function — `{JobCard({ job })}` — not by deleting the assertion.

- [ ] **Step 4: Run the gates**

```bash
pnpm --filter @gaming/web test && pnpm --filter @gaming/web typecheck
```

- [ ] **Step 5: Commit**

```bash
git add <only the lane's own files> && git commit -m "feat(web): aurora redesign, lane <n> <name>"
```

**Task 2 — Lane 1 · Stage:** home.
**Task 3 — Lane 2 · Board:** `/jobs` catalog, job detail, hidden-jobs.
**Task 4 — Lane 3 · Directory:** companies index and detail, rankings, hubs.
**Task 5 — Lane 4 · Data:** salaries index, detail, non-tech, comparison, learn, crypto-events.
**Task 6 — Lane 5 · Funnel:** pricing, hire, post-a-job, ads, api, login, onboarding, legal, about, faq.
**Task 7 — Lane 6 · Account:** dashboard, profile, settings, 404.

---

### Task 8: The QA harness

**Model:** Sonnet 5. Runs in parallel with the lanes — it does not read their output, only builds the instrument.

**Files:**
- Modify: `apps/web/package.json` (Playwright devDependency, `qa` script)
- Create: `apps/web/qa/harness.mjs`, `apps/web/qa/templates.mjs`, `apps/web/qa/run.mjs`

**Interfaces:**
- Produces: `runMatrix({ dimension })` writing one JSON result file per dimension to `apps/web/qa/out/<dimension>.json`, each row `{ template, url, engine, viewport, checks: {...}, evidence: {...} }`.

- [ ] **Step 1: Install Playwright**

```bash
cd "apps/web" && pnpm add -D @playwright/test && pnpm exec playwright install chromium firefox webkit
```

- [ ] **Step 2: Enumerate the 17 templates with a real URL each**

`templates.mjs` exports an array of `{ id, register, url }`. Dynamic routes need a real instance from the local D1, not a placeholder — pick one existing slug per dynamic route with `pnpm exec wrangler d1 execute gaming-jobs --local --command "select slug from jobs limit 1"` and the equivalent for companies and salary slugs.

- [ ] **Step 3: Build against a production build, on its own port**

```bash
cd "apps/web" && pnpm exec next build && pnpm exec next start -p 3100
```

Never `next dev`. Dev timings are meaningless — `/about` measured 0.12s dev against 0.008s production.

- [ ] **Step 4: Write the measurement primitives**

Overflow must be measured as `documentElement.scrollWidth - documentElement.clientWidth`, never against `window.innerWidth`. State reads after a click must await ~350ms.

```js
export async function overflowPx(page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth - d.clientWidth;   // clientWidth is the layout viewport
  });
}
export async function settle(page) { await page.waitForTimeout(350); }
```

- [ ] **Step 5: Verify the instrument on a known-bad fixture**

Build a throwaway page with an element 510px wider than the viewport, run the harness at 390px, and confirm it reports ~510 and not 0. An instrument that reports 0 here is measuring `innerWidth` and is wrong.

- [ ] **Step 6: Commit**

```bash
git add apps/web/qa apps/web/package.json && git commit -m "chore(web): Playwright QA harness, 3 engines x 6 viewports"
```

---

### Tasks 9-12: The QA pass (phase 2)

**Model:** Sonnet 5. Four agents, one per dimension, all against the production build on `:3100`. Matrix: 17 templates × 6 viewports × 3 engines.

Each dimension writes `docs/qa/2026-09-09-aurora-qa-<dimension>.md`.

**The rule that governs all four:** no finding enters a report without having been reproduced by hand, with a root cause identified in the code and a single point of intervention. Of 13 visual candidates raised by the previous review, 12 were rejected with evidence. Report the rejections too.

Before reporting any interaction as broken, restart the server and re-test on a clean process.

- [ ] **Task 9 — Layout.** Horizontal overflow, clipped text, tap targets under 24px, reflow integrity, contrast in both registers. A narrow screenshot crops and does not reflow; judge from device metrics only. An element past the right edge is normal when an ancestor clips or scrolls it — attribute per-element overflow only when the page itself overflows.

- [ ] **Task 10 — Interaction.** Every filter, accordion, carousel, menu toggle, pagination control and form clicked with real events, state read back after `settle()`. Search on `/jobs` must return rows. Unlock gating must not leak an apply URL.

- [ ] **Task 11 — Accessibility.** Contrast, keyboard focus visible on every interactive element, tab order, landmarks, alt text, ARIA, skip link.

- [ ] **Task 12 — Motion and performance.** `prefers-reduced-motion` honoured with everything still visible; scroll-driven reveal verified on WebKit and Firefox as *static and readable*, never invisible; page transitions degrade to plain navigation; LCP and TTFB per template against the baseline in `docs/qa/2026-09-09-frontend-qa-report.md`.

---

### Task 13: Fixes and re-QA (phase 3)

**Model:** Haiku 4.5 for the fixes, Sonnet 5 for the re-run.

- [ ] **Step 1:** Group confirmed findings by owning lane. Findings in shared files go to a single agent, run alone.
- [ ] **Step 2:** One fix agent per affected lane, same file-ownership rule as phase 1.
- [ ] **Step 3:** Gates: `pnpm -r test`, `pnpm -r typecheck`, `pnpm --filter @gaming/web build`.
- [ ] **Step 4:** Re-run Tasks 9-12 on the rebuilt production bundle.
- [ ] **Step 5:** Merge the four dimension reports into `docs/qa/2026-09-09-aurora-qa-report.md` with the summary table, the confirmed findings, and the rejected candidates with their evidence.
- [ ] **Step 6:** Commit.

**Acceptance:** zero Critical, zero High, suite green, typecheck clean, build succeeds.
