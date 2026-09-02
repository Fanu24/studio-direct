# Studio Direct frontend design spec (Lancer-style marketing + product UI)

Date: 2026-09-02. Source brief: `docs/frontend-fable-51-brief.md` (the brief wins on every conflict).
This spec adds the concrete design system, page inventory, copy, and file ownership used to build it.

## 1. Design read and dials

Reading this as: redesign (overhaul of visuals, preserve IA and locked copy) of a premium dark SaaS marketing site
for game-industry talent, with a Lancer-style cinematic product-video landing, leaning toward custom CSS on the
existing Next.js 15 app with Outfit + IBM Plex Mono and the zinc + muted gold identity.

Dials: DESIGN_VARIANCE 7, MOTION_INTENSITY 7, VISUAL_DENSITY 4. Theme: dark only, locked (`color-scheme: dark`).

Signature element: the product's own honest badge ("Not on LinkedIn") and the product theaters. Every theater is a
mini version of the real UI (job cards, gold badge, search, unlock), framed like a studio monitor with a mono
caption bar that names the real page it depicts. The hero headline uses one display treatment: the closing phrase
set in gold. Nothing else on the page competes with those two moves.

## 2. Tokens (all in `apps/web/app/globals.css`)

Color (dark only):

| token | value | use |
| --- | --- | --- |
| `--bg` | `#14161c` | page canvas |
| `--bg-deep` | `#0f1116` | full-bleed bands, theater stage |
| `--bg-elev` | `#1b1e26` | panels, cards, inputs |
| `--bg-hover` | `#232733` | hover fill |
| `--line` | `#2b2f3b` | hairlines |
| `--line-strong` | `#3b4150` | focused / hovered hairlines |
| `--text` | `#eceae4` | body text (bone) |
| `--muted` | `#9b978c` | secondary text |
| `--dim` | `#6d6a62` | tertiary text, captions |
| `--accent` | `#c4a35a` | gold, the only accent |
| `--accent-soft` | `rgb(196 163 90 / 0.14)` | gold tint fills |
| `--accent-line` | `rgb(196 163 90 / 0.35)` | gold hairlines |
| `--accent-ink` | `#16140f` | text on gold |
| `--ok` | `#7d9a72` | success |
| `--danger` | `#d46a6a` | errors |

Type: Outfit (sans, 400/500/600/700) and IBM Plex Mono (400/500). Scale (clamp, desktop max):
display `4.4rem`, page h1 `3.4rem`, section h2 `2.5rem`, h3 `1.3rem`, body `1.02rem/1.6`, small `0.88rem`,
mono label `0.74rem` with `letter-spacing: 0.06em`. Headings: weight 700, tracking `-0.04em`, `text-wrap: balance`.
Paragraph max width `60ch`, `text-wrap: pretty`. Numbers use mono with `tabular-nums`.

Shape rule (locked): buttons and chips are full pills; cards, panels and inputs are `12px`; theater frames and hero
panels are `20px`. Nothing else.

Spacing: sections `clamp(72px, 9vw, 128px)` vertical; container `1200px` for marketing, `1120px` for content pages,
`24px` gutters (`16px` under 900px). Z scale: nav 40, mobile menu 50, grain 60, skip link 80.

Motion (all under `prefers-reduced-motion: no-preference`; reduced motion = static, instant):
hero stagger on load, `[data-reveal]` scroll reveals (IntersectionObserver, opacity + 16px translate,
`cubic-bezier(0.16, 1, 0.3, 1)`, 0.7s), marquee loops (pause on hover and focus), theater loops (8-12s),
button hover `translateY(-1px)`, active `scale(0.98)`. Only `transform` and `opacity` animate.

## 3. Components (`apps/web/app/_components/`)

| file | kind | responsibility |
| --- | --- | --- |
| `site-chrome.tsx` | server | shell: skip link, sticky nav, footer with browse / account / company columns and popular roles |
| `nav-account.tsx` | client | "Sign in" pill for guests; "Dashboard" pill + "Sign out" for sessions (`authClient.useSession`) |
| `mobile-menu.tsx` | client | menu button + panel under 900px, closes on route change |
| `reveal-observer.tsx` | client | adds `is-in` to `[data-reveal]` elements, rescans on pathname change |
| `marquee.tsx` | server | seamless loop wrapper (duplicated track, `aria-hidden` copy) |
| `product-video.tsx` | client | cinematic frame: caption bar, play/pause control, poster / playing / paused states |
| `theaters/*.tsx` + `app/styles/theaters.css` | server | six CSS-animated product theaters (see section 5) |
| `job-card.tsx` | server | the one job card used everywhere (`JobCard`, `JobCardGrid`) |
| `page-header.tsx` | server | content-page header: breadcrumb slot, kicker, h1, lead |
| `breadcrumbs.tsx` | server | breadcrumb nav + BreadcrumbList JSON-LD |
| `json-ld.tsx` | server | safe `<script type="application/ld+json">` |
| `icons.tsx` | server | tiny geometric glyph set (play, pause, arrow, arrow-up-right, check, search, menu, close, lock) |
| `hub-links.tsx` | server | role hub link grid (18 hubs) |
| `account-shell.tsx` | server | authenticated layout: header + tabs Dashboard / Profile / Settings |
| `pricing-plans.tsx` | server | plan cards (Free, monthly, yearly) with checkout forms only when Stripe is on |

## 4. Homepage (`app/page.tsx`, server, still calls `listJobs(db, tenantId, { hidden: true, pageSize: 8 })`)

Order and copy (locked strings imported, never retyped):

1. Hero (asymmetric split, text left, theater right). Kicker `Remote and hybrid gaming jobs`.
   H1 `Gaming jobs, straight from the studio.` (last phrase gold). Paragraph = `HOMEPAGE_CLAIM`.
   Form `action="/jobs" method="get"` with `input name="q"` (placeholder `Gameplay engineer, Unreal, live ops`)
   and submit `Search jobs`. Secondary link `Jobs not on LinkedIn` to `/hidden-jobs`.
   Right: `ProductVideo` with the `CareerPagesTheater`, caption `studio career pages, indexed`.
2. Studio ticker: caption `Studios in the index` (never "Trusted by"), names from D1 (`listCompanies`),
   each linking to `/companies/[slug]`. One `Marquee`.
3. Feature rows (five, kicker + h2 + body + theater):
   - text left / theater right, `NotOnLinkedInTheater`: kicker `The honest badge`,
     h2 `Not on LinkedIn means we checked.`, body `After each successful index we compare a studio's own listing
     against LinkedIn. When we cannot find the role there, the badge goes on. When we are not sure, it stays off.`
     Mono caption under the body = `LINKEDIN_EXCLUSIVITY_TOOLTIP`.
   - theater left / text right, `OneBoardTheater`: kicker `Career pages first`,
     h2 `One board for the roles studios post on their own sites.`, body `We read studio career pages and their
     applicant tracking boards, keep the remote and hybrid roles, and list each one with its full description.`
   - full-bleed band on `--bg-deep`, `SearchTheater` wide under the copy: kicker `Search and filters`,
     h2 `Find the role in seconds, not tabs.`, body `Full-text search across titles and descriptions. Filter by
     studio, seniority, source, and roles not posted on LinkedIn.`
   - two-column pair (copy above theater in each column):
     `UnlockTheater`: kicker `Apply on the studio site`, h2 `Unlock the studio's apply link.`,
     body `Five free unlocks per week, counted Monday to Sunday UTC. Every application happens on the studio's own
     site, never through us.`
     `DigestTheater`: kicker `Hidden digest`, h2 `New roles not on LinkedIn, in your inbox.`,
     body `A short email when the index finds roles that are not on LinkedIn. Part of the paid plan once billing
     is live.` Frame tag `Paid plan, not live yet`.
4. Comparison, h2 `The LinkedIn-only hunt, next to Studio Direct.` Two columns.
   Without: big figure = live studio count, label `studio career pages to check by hand`, list:
   `Check LinkedIn and miss career-page-only roles` / `Open every studio board by hand` /
   `No signal which listing was absent from LinkedIn`.
   With: big figure `1`, label `board of remote and hybrid gaming roles`, list:
   `One board built from studio career pages` / `Honest Not on LinkedIn badge from the last successful index` /
   `5 free unlocks per UTC week, apply on the studio site`.
5. Testimonial marquee, h2 `What this feels like in practice`, label `Example voices, illustrative until we publish
   real user quotes.` Six cards, each tagged `Example voice`, quote max 3 lines, name + role.
6. Pricing teaser, h2 `Simple pricing, when billing goes live.`, sentence = `PRICING_COPY.billingNotLive` or
   `billingLive`, two compact cards `PRICING_COPY.monthly` / `PRICING_COPY.yearly`, link `See pricing`.
7. Latest jobs not on LinkedIn: h2 `Latest jobs not on LinkedIn`, mono count, `JobCard` grid rendered by calling
   `JobCard({ job })` directly so the title stays in the element tree the tests walk, link
   `View all jobs not on LinkedIn`.
8. Closing: line `{listed} remote and hybrid gaming roles indexed, {hidden} of them not on LinkedIn.`
   (live numbers) + primary `Browse jobs` + secondary `Sign in`.

Eyebrows: hero and the five feature kickers (brief requires them). No kicker on comparison, testimonials, pricing,
latest jobs or closing.

## 5. Theaters (`app/_components/theaters/`, styles in `app/styles/theaters.css`)

Shared stage primitives (`.t-*` classes): `.t-window` (mini browser window with a URL line), `.t-card` (mini job
card: title, studio, meta, badge slot), `.t-badge` (gold pill), `.t-input`, `.t-chip`, `.t-cursor`, `.t-button`,
`.t-list`, `.t-mail`. Every theater is a server component with an `id` prefix for its keyframes (`th1-` ... `th6-`).
Rest state (no animation) must look like a finished poster frame. Loops 8-12s.

| # | component | what it shows |
| --- | --- | --- |
| 1 | `CareerPagesTheater` | three studio URL chips light up in turn and a card slides from each into the Studio Direct column |
| 2 | `NotOnLinkedInTheater` | a card, a mono index line types `index pass, linkedin.com, 0 matches`, the badge stamps onto the card |
| 3 | `SearchTheater` (wide) | `Gameplay` is typed into search, five cards filter down to one, the count updates |
| 4 | `UnlockTheater` | cursor presses `Unlock application link`, quota chip goes from 5 to 4, an `Open on the studio site` pill appears with a masked URL |
| 5 | `DigestTheater` | mail-style card `Hidden today`, three rows slide in, each with the badge |
| 6 | `OneBoardTheater` | hub header `Remote Gameplay Programmer jobs`, filter chips toggle, list reflows with cards from different studios |

Never show a real apply URL. No Lancer assets. No stock photos.

## 6. Other pages (same chrome, same primitives)

| route | H1 | title tag | notes |
| --- | --- | --- | --- |
| `/jobs` | Remote and hybrid gaming jobs | Remote and hybrid gaming jobs, Studio Direct | filters as an instrument panel (all field names kept: q, company, seniority, source, hidden, page), active filter chips, count, 2-col card grid, pager, role hub links, empty state |
| `/jobs/[slug]` | job title | `{title} at {company}`, Studio Direct | breadcrumb + BreadcrumbList, badge, meta chips, 2-col: description + sticky apply panel with `UnlockApplyForm`, related hubs, more at studio |
| `/hidden-jobs` | Jobs not posted on LinkedIn | keep | intro with badge meaning, card grid, how the badge works |
| `/[hub]`, `/skills/[slug]` | keep | keep | `PageHeader`, card grid, related links, other roles |
| `/companies/[slug]` | Remote jobs at {name} | keep | studio header, count, card grid |
| `/companies` (new) | Studios in the index | Game studios in the index, Studio Direct | `listCompanies` with job counts |
| `/roles` (new) | Gaming jobs by role | Remote gaming jobs by role, Studio Direct | 18 hub cards linking to `/remote-{slug}-jobs` and `/skills/{slug}` |
| `/about` (new) | How Studio Direct works | How Studio Direct works, Studio Direct | sources, badge meaning (tooltip + terms strings), unlocks, what we do not do, FAQ (FAQPage JSON-LD) |
| `/pricing` | `PRICING_COPY.title` | keep | Free / monthly / yearly plan cards, checkout forms only when Stripe is on, FAQ with FAQPage JSON-LD, no "100%" |
| `/login` | Sign in to Studio Direct | Sign in, Studio Direct | split: brand panel + form card, all tested sentences unchanged |
| `/onboarding` | Finish your profile | keep private | single card form, `display name` / `target role` lowercase in copy, no checkboxes |
| `/profile` | Your profile | keep private | `AccountShell`, completeness ring with `{n}%`, sections Location, Experience, Skills, CV; all field names kept |
| `/settings` | Settings | keep private | `AccountShell`, talent pool card (`talent_pool_opt_in`, value "1", off by default), data card (raw `<a href="/api/account/export">`, delete form), placeholders Email digest / Job alerts marked `Not available yet` |
| `/dashboard` (new) | Hi {name} or Your dashboard | keep private | `AccountShell`, tiles: unlocks this week (`countUnlocksThisWeek`, 5 free, or unlimited when paid), profile completeness, plan status, recent unlocks (`listRecentUnlocks`), latest jobs not on LinkedIn, placeholders Saved jobs / Hidden digest marked `Not available yet` |
| `not-found.tsx` | This page does not exist. | Page not found, Studio Direct | links to jobs, hidden jobs, home |
| `robots.ts` | | | allow all, sitemap from `SITE_URL` when set |
| `icon.svg` | | | gold ring mark |

Title tags use the pattern `{page} | Studio Direct` via the layout title template. Authenticated pages are private
(`robots: noindex`), never marketing landings.

## 7. Copy voice and hard bans

Plain, specific, sentence case, active voice. No em dashes or en dashes anywhere (use commas or periods).
No "Trusted by", "100%", "Clerk", "Resend", "auto-apply", "AI cover letter", "real-time LinkedIn", employer or
recruiter search UI, fake KPIs, fake logos. Placeholders for unbuilt features say `Not available yet` or
`Paid plan, not live yet`, never pretend to work. Testimonials are labeled `Example voice`.

## 8. Test constraints (tree walk, not a browser)

Tests read the returned React element tree and only recurse into `props.children`. Therefore on `/`:
the hero `form` (first `form` in the tree, `action="/jobs"`, `method="get"`) and `input name="q"` live directly
in `page.tsx`; `HOMEPAGE_CLAIM` is a direct text child in `page.tsx`; job cards are produced by calling
`JobCard({ job })` as a function so the mocked title is in the tree. Settings must keep a raw `<a>` for export.
Login keeps label/input/button as children of `LoginForm`. Every other tested string listed in the brief stays.

## 9. File ownership for parallel work

CSS files (all pre-imported in `layout.tsx`): `globals.css` and `styles/home.css` (foundation, homepage),
`styles/theaters.css` (theaters), `styles/jobs.css` (jobs, hidden, hubs, skills, companies, roles),
`styles/job-detail.css` (job page), `styles/pricing.css` (pricing, about, not-found), `styles/account.css`
(login, onboarding, profile, settings, dashboard). Class names in each area use that area's prefix
(`jobs-`, `jd-`, `price-`, `about-`, `acct-`, `dash-`) so files never collide. Nobody edits another area's files.

Library additions (with tests): `lib/jobs/queries.ts#listCompanies`, `lib/unlocks/history.ts`
(`countUnlocksThisWeek`, `listRecentUnlocks`, `loadSubscriptionStatus`).

## 10. Done when

`pnpm --filter @gaming/web test` and `typecheck` pass, `next build` compiles every route, screenshots at 1440 and
390 show no horizontal overflow, theaters play and pause, reduced motion shows static posters, every visible string
passes the bans above, and `/` reads as a peer of lancer.app in density and rhythm without copying its assets.

## 11. As built (2026-09-03)

Differences from the plan above, all deliberate:

- Page titles use the layout template `%s | Studio Direct`, so page metadata carries the short name only
  (`/about` is titled "How it works" while its h1 stays "How Studio Direct works").
- Open Graph and Twitter cards: the root layout declares only type, siteName, locale and the image, so Next fills
  the title and description from each page. `apps/web/public/og.png` (1200x630) is the shared preview image.
- Scroll reveals are gated on `@media (scripting: enabled)`. An inline script that added a class to `<html>` caused
  a React hydration mismatch and was removed.
- Theaters pause when their frame leaves the viewport, through an IntersectionObserver in `product-video.tsx`.
- The hero theater lists studio career-page domains without role counts. Per-studio counts there would be invented
  numbers standing next to real studio names.
- Buttons: the base rule is `.button` alone. The earlier `.button, button.button` compound outranked every
  `.button--*` modifier and silently made secondary buttons gold.
- `lib/jobs/queries.ts` gained `listCompanies`; `lib/unlocks/history.ts` is new (`countUnlocksThisWeek`,
  `listRecentUnlocks`, `loadSubscriptionStatus`). Both are covered by tests.
- New public routes `/companies`, `/roles`, `/about` were added to `app/sitemap.ts` and to the public revalidated
  paths in `lib/cache.ts`, each with a test.

### Apply URL and JSON-LD (resolved)

`buildJobPostingJsonLd` used to publish the studio apply URL as `directApply.target`, so the gated link was
readable in the page source without an unlock. Two independent reviews flagged it against the brief rule that
`apply_url` never reaches anonymous HTML. It now emits `directApply: false`, which is what Google's JobPosting
spec actually expects there (a boolean, not an ApplyAction), so no rich result is lost. `url` still points at the
Studio Direct job page. A production build serves the job page with zero occurrences of the apply URL, and both
`lib/jobs/jsonld.test.ts` and the job page test now assert its absence.
