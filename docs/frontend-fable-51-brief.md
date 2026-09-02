# Studio Direct — frontend brief for Claude Code (Fable 5.1)

**Who this is for:** Claude Code, model `claude-fable-5-1` (`/model` → Claude Fable 5.1). Do the visual/UX pass. Do not redesign the product, crawler, or billing policy.

**North-star reference:** [https://lancer.app/](https://lancer.app/)  
Copy the **layout, motion, video-feature rhythm, and marketing density**. Do **not** copy Lancer’s brand, colors, logos, videos, testimonials, or Upwork-agent copy. Studio Direct is a gaming job board, not an auto-apply bot.

**Live demo (current, too thin):** https://gaming-web.xavier-ff2.workers.dev

---

## 0. Design read (do this first)

Reading this as: **premium dark SaaS marketing site for game-industry talent**, with a **Lancer-style cinematic landing** (hero → social-proof ticker → feature rows each with a looping product video → vs comparison → testimonial marquee → pricing teaser → live job strip), leaning toward **custom CSS on the existing Next.js app**, not a Tailwind/shadcn purple template.

Dials: `DESIGN_VARIANCE: 7` · `MOTION_INTENSITY: 7` · `VISUAL_DENSITY: 4`

One-liner the founder should feel: *“This is a real product landing, then the jobs.”*

---

## 1. Product in one page

**Studio Direct** is an English gaming job board (AAA / indie, not iGaming). Tenant slug `gaming`. Remote worldwide.

**Wedge:** listings taken from **studio career pages**, including roles that are **not posted on LinkedIn**. The honest badge is the product, not a scrape-everything aggregator.

**What the site already does (keep working):**

| Surface | Behavior |
| --- | --- |
| `/` | Claim + search form `GET /jobs` (`input name="q"`) + latest **hidden** jobs (`listJobs(..., { hidden: true, pageSize: 8 })`) |
| `/jobs` | Remote/hybrid catalog, FTS search, filters (company, seniority, source including Indeed, hidden) |
| `/jobs/[slug]` | Full JD public, JSON-LD, honest badge, unlock to reveal apply URL |
| `/hidden-jobs` | Confirmed not-on-LinkedIn list |
| `/companies/[slug]`, `/[hub]`, `/skills/[slug]` | SEO hubs |
| `/login` | Magic link + Google + Turnstile |
| Unlock | 5 distinct jobs per UTC ISO week, then paywall |
| `/pricing` | €9 / month, €59 / year. Stripe **off** until ~300 real career-page jobs |
| `/profile`, `/onboarding`, `/settings` | Completeness, CV PDF on R2, talent-pool checkbox default off, export/delete |
| `/terms`, `/privacy` | Locked legal copy |

**What it is not (do not add UI that implies this):**

- Auto-apply, AI cover letters, Upwork/LinkedIn outreach
- Employer portal, paid CV search
- Real-time LinkedIn
- “Trusted by Riot / Epic” (we only have demo seed rows)
- Fake conversion stats

**Data reality on the demo:** 5 seeded jobs. LinkedIn/Indeed crawlers exist in code and are **not deployed**. Indeed is a filter option with zero rows. Do not fake Indeed/LinkedIn inventory in the UI.

---

## 2. Locked copy (never change the string)

Import from `apps/web/lib/copy.ts` and `apps/web/lib/legal/copy.ts`. Do not rewrite.

```
HOMEPAGE_CLAIM
  "Jobs from studio career pages, including roles not posted on LinkedIn."

LINKEDIN_EXCLUSIVITY_TOOLTIP
  "We did not find this role on LinkedIn in our last successful index."
```

Pricing strings: `PRICING_COPY` (`€9 / month`, `€59 / year`, billing-not-live sentence).  
Login strings: “Sign in to Studio Direct”, “Send a magic link”, resend sentence, “Continue with Google”.  
Hidden page H1: “Jobs not posted on LinkedIn”.  
Profile tests look for “Experience”, “Skills”, “20%”.  
Never put `apply_url` in HTML for anonymous users.  
Never mention Clerk or Resend.  
Never claim “100%” on legal/pricing pages.

UI language: **English**. No em dashes in customer-facing copy (use commas or periods).

---

## 3. Visual target: Lancer, translated to this product

Open [lancer.app](https://lancer.app/) and match these **patterns**:

1. **Full-bleed dark canvas** with a soft gradient / grain overlay, not a centered grey column of unstyled HTML.
2. **Sticky nav:** wordmark left, few links, high-contrast pill CTA right (“Sign in” or “Browse jobs”).
3. **Huge hero headline** (one idea), subcopy, primary + secondary CTA. Search can live in the hero as the primary control.
4. **Logo / name ticker** under the hero (marquee). For us: “Studios in the index” using only companies that actually exist in D1 (Riot Games, Dream Games, Epic Games, Scopely, Roblox on the demo). Caption must **not** say “Trusted by”.
5. **Feature sections, one per viewport:** left copy (kicker + h2 + 2–3 lines) / right **video player**. Alternate sides. Each block has a Play control like Lancer even if the clip autoplays muted.
6. **Vs comparison:** two columns, Without vs With, one big number each. Honest metrics only (see §5).
7. **Testimonial marquee** (cards sliding). Structure yes; claims must be clearly **illustrative** until we have real users (e.g. a small “Example voice” label). No invented revenue, no fake logos of agencies.
8. **Closing stat or strip** + final CTA.
9. **Then** the real product: latest hidden jobs + search (tests require these on `/`).

### Videos (mandatory, Lancer-like)

Lancer’s landing is a **product-video site**. Studio Direct must feel the same.

Build a reusable `ProductVideo` (or equivalent) used 4–6 times on `/`:

- Rounded cinematic frame, inner shadow, optional thin gold edge
- 16:9 or 4:3 product window, never a raw `<video>` dumped on the page
- Big Play overlay; click toggles pause. Default: **muted, loop, playsInline, autoplay** when `prefers-reduced-motion: no-preference`
- Poster frame so it does not flash empty
- Respect `prefers-reduced-motion: reduce`: static poster, no autoplay

**Clip content (do not use Lancer files, stock robots, or Unsplash people):**

We have no real screen recordings yet. Ship **in-browser product theaters**: HTML/CSS/JS animations that look like a screen recording of **this** UI (job cards, gold “Not on LinkedIn” badge, search, unlock). Loop 8–12s. Optional later: swap the theater for an MP4 in `apps/web/public/demo/` without changing the chrome.

Suggested six theaters (map 1:1 to feature rows):

| # | Title on page | What the “video” shows |
| --- | --- | --- |
| 1 | Career pages first | Cards appearing from studio career URLs, not a LinkedIn feed |
| 2 | Not on LinkedIn | Badge lighting up on a role after an index pass |
| 3 | Search the board | Typing “Gameplay” and filtering to one role |
| 4 | Unlock to apply | Unlock control, quota 5 / week, then studio apply URL (never show a live secret URL) |
| 5 | Hidden digest | Simple mail-style UI “hidden today” (paid later; Stripe still off) |
| 6 | One board | Hub / remote gameplay programmer style list |

Do **not** download or embed assets from lancer.app (copyright).

### What not to look like

- Inter + slate + AI purple + three equal feature cards
- Generic glassmorphism everywhere
- 1995 unstyled system font pages (current complaint)
- A pixel clone of Lancer with “Studio Direct” pasted on

Keep identity: zinc `#14161c`, muted gold `#c4a35a`, Outfit + IBM Plex Mono already in `apps/web/app/layout.tsx`. You may intensify contrast, hero type size, and motion. You may add **one** display treatment. Do not switch to Lancer red/black as the brand.

---

## 4. Homepage anatomy (required order)

Keep `apps/web/app/page.tsx` a server component that still calls `listJobs` as today. Split marketing into client components if needed for video/ticker.

```
SiteChrome (nav + footer)
└─ main
   1. Hero
      - kicker (mono, gold)
      - h1 (not only repeating the brand; a real promise)
      - HOMEPAGE_CLAIM must still appear in the tree (tests)
      - form method="get" action="/jobs" with input name="q"
      - secondary link to /hidden-jobs
   2. Studio ticker (demo companies only)
   3. Feature + ProductVideo rows (4–6)
   4. Comparison: LinkedIn-only hunt vs Studio Direct
   5. Testimonial marquee (illustrative, labeled)
   6. Pricing teaser → /pricing (no fake “checkout live”)
   7. Latest jobs not on LinkedIn  ← existing list, restyle cards
      tests: job title from listJobs mock must still appear
   8. Footer (already in SiteChrome)
```

Hero h1 may stay “Studio Direct” or become a longer promise, but **do not remove** the claim paragraph.

---

## 5. Honest comparison copy (suggested, editable)

Without inventing KPIs we do not have:

**Without Studio Direct**

- Check LinkedIn and miss career-page-only roles
- Open 40 studio boards by hand
- No signal which listing was absent from LinkedIn

**With Studio Direct**

- One board of remote/hybrid gaming roles from career pages
- Honest “Not on LinkedIn” when the last successful index did not find the role
- 5 free unlocks per UTC week; apply on the studio site, not here

Do not show `$12.02 per meeting` style fake economics. Do not show “2,884 conversations while they were sleeping” unless we have a real counter.

If you need a closing stat, use something true on the demo: **number of listed jobs from `listJobs` total**, or omit the number and use a line of copy.

---

## 6. Other pages (same system, not a second landing)

Apply the same chrome, type, buttons, cards, forms:

- `/jobs` — filters as a dense instrument panel, not a 1995 GET form. Keep all field `name`s.
- `/jobs/[slug]` — cinematic job hero, badge, unlock as primary CTA
- `/pricing` — two large plan cards like a SaaS pricing section; keep `PRICING_COPY`; checkout buttons only when Stripe is on
- `/login` — keep all tested sentences
- `/hidden-jobs`, hubs, companies — job cards from `JobHubList`
- `/profile`, `/onboarding`, `/settings` — same forms, less marketing

Do not turn authenticated pages into Lancer-style video landings.

---

## 7. Stack and files

**Repo:** `c:\Users\dotat\Desktop\Saas JOBS`  
**App:** `apps/web` — Next.js 15 App Router, React 19, OpenNext on Cloudflare Workers, Vitest. **No Tailwind today.** Prefer extending `apps/web/app/globals.css` + components. Adding Tailwind is allowed only if `pnpm --filter @gaming/web test` and `pnpm --filter @gaming/web typecheck` still pass and OpenNext still builds.

**Touch freely:**

- `apps/web/app/globals.css`
- `apps/web/app/layout.tsx` (keep font variables)
- `apps/web/app/_components/*` (add `product-video.tsx`, `site-chrome.tsx`, etc.)
- `apps/web/app/page.tsx` and other `app/**/page.tsx` for classNames / sections
- `apps/web/public/` for posters / optional mp4

**Do not:**

- Change `apps/web/lib/copy.ts` locked strings
- Change exclusivity / unlock / Stripe / auth logic
- Deploy `gaming-crawler` or flip `STRIPE_ENABLED`
- Put secrets in the repo
- Force-push, amend shared history, or skip tests
- Add auto-apply, AI writing, or recruiter search UI

Windows note: native `opennextjs-cloudflare build` may hit `EPERM` on symlinks. You do not need to deploy. Run unit tests.

---

## 8. Tests you must keep green

```bash
pnpm --filter @gaming/web test
pnpm --filter @gaming/web typecheck
```

Homepage tests walk the React tree (not Playwright):

- `listJobs` called with `{ hidden: true, pageSize: 8 }`
- Page text contains the mocked job title
- Page text contains exact `HOMEPAGE_CLAIM`
- There is a `form` with `action="/jobs"` `method="get"`
- There is an `input` with `name="q"`

So: extra marketing nodes are fine. Removing the form, renaming `q`, or dropping the claim is not.

Other pages: assert English copy listed in §2. Job detail must still not include apply URL in the tree.

---

## 9. Quality bar

Done when:

- `/` feels like a **peer of lancer.app** in density and video rhythm (not a clone, not a docs site)
- Feature rows have working video theaters with play/pause
- Motion is cinematic but pauses for `prefers-reduced-motion`
- Desktop (~1440) and mobile (~390): ticker and videos do not overflow; nav can collapse to wordmark + CTA
- Job cards, badge, search, unlock still look like the same product
- No stock photography of headsets / neon cities / purple meshes
- No Lancer assets
- Tests green

---

## 10. Suggested Claude Code start

```text
claude --model claude-fable-5-1
```

Then: read this file, open https://lancer.app/ and the live demo, implement homepage marketing + ProductVideo first, then restyle `/jobs`, job detail, `/pricing`, `/login`. Do not start with a new Next app. Stay in `apps/web`.
