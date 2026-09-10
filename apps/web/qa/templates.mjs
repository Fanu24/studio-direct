// apps/web/qa/templates.mjs
//
// The 17-vs-21 discrepancy (read this before editing the array below)
// ---------------------------------------------------------------------
// docs/superpowers/specs/2026-09-09-aurora-redesign-design.md section 4.1
// says "17 templates". The same document's own section 2 table ("The 17
// templates, in 6 lanes") lists lane rows whose comma-separated template
// names add up to 21, not 17, once "companies index + detail" is read as
// two templates (an index page and a profile page are never the same
// visual template) and once "hubs" is expanded to the three named
// sub-templates the lane 3 owned-files list actually implies (hub/landing,
// roles/cities directory, company tag).
//
// This file enumerates 21 rows, one per genuinely distinct visual
// template, verified against the built app rather than guessed from the
// spec prose:
//   - every row's `register` below was read off the page's own root
//     `<main className="surface surface--{stage|data} ...">` (or the
//     shared wrapper component it renders through - AccountShell,
//     ArticleLayout, RankingJobsPage/ranking-board.tsx), not assumed.
//   - several routes that LOOK like separate templates turned out to be
//     redirect shims to a template already in this list, and are called
//     out below rather than counted twice:
//       * /companies, /companies/[slug]            -> permanentRedirect to
//                                                      /web3-companies(/:slug)
//       * /skills/[slug]                            -> redirect to /:slug-jobs
//                                                      (hub/landing) or notFound
//       * /top-growing-web3-companies                -> permanentRedirect to
//                                                      /web3-companies/top-growing
//       * /highest-paid-developers-jobs,
//         /most-popular-designer-jobs                -> permanentRedirect to their
//                                                      canonical ranking sibling
//       * /hidden-jobs                                -> permanentRedirect to
//                                                      /remote-jobs (hub/landing).
//         This one predates the Aurora branch entirely - it was already a
//         redirect shim on the pre-redesign baseline commit (2ed77e7). It is
//         kept as its own row because the task names it explicitly and
//         because a QA agent hitting it needs to know it will land on the
//         hub/landing template, not on a dedicated "hidden jobs" page.
//   - dozens of routes (/top-web3-jobs, /highest-paid-developer-jobs,
//     /most-popular-developer-jobs, /entry-*-jobs, /top-web3-internships,
//     ...) all render through the same RankingJobsPage/JobBoard scaffold
//     with `surface surface--data board-main` and only swap header copy +
//     filters. They collapse to the single "rankings" row.
//   - /hire, /post-web3-job, /ads, /web3-jobs-api, /about all render
//     `surface surface--stage marketing <name>` through the same
//     marketing-section blocks and collapse to "funnel-seller-page".
//   - /terms and /privacy both render `surface surface--stage legal-page`
//     and collapse to "legal-long-form".
//   - /dashboard, /profile, /settings all render through the shared
//     `AccountShell` component and collapse to "account".
//   - /web3-non-tech-salaries(/:slug) render through the identical
//     component shape as /web3-salaries(/:slug) (same `surface--data`
//     header/table markup) and are treated as the same "salaries-index" /
//     "salary-detail" templates with different data, not new templates.
//
// So: 21 real templates, not 17. That is reported rather than forced,
// per the task's own instruction ("if you end up with a different count
// than 17, say so and justify it").
//
// Dynamic route data
// -------------------
// Every {dynamic: true} row's slug was pulled from the local D1
// (apps/web/.wrangler/state/v3/d1) with:
//   pnpm exec wrangler d1 execute gaming-jobs --local --command "..."
// and then verified with a live curl against `next start -p 3100`
// (never invented, never a placeholder). See qa/README.md for the exact
// queries and verification commands.
//
// Route params arrive percent-encoded (SITE_URL/decodeURIComponent trap,
// design spec 4.5): the combo landing below is listed exactly as a
// browser address bar would show it, "/remote+solidity-jobs" - Playwright's
// page.goto() sends this URL as-is over HTTP, matching what a real browser
// does, so no manual encoding is applied here.

/** @typedef {{ id: string, register: "stage" | "data", url: string, dynamic: boolean, note?: string }} Template */

/** @type {Template[]} */
export const templates = [
  {
    id: "home",
    register: "stage",
    url: "/",
    dynamic: false,
  },
  {
    id: "jobs-catalog",
    register: "data",
    url: "/jobs",
    dynamic: false,
  },
  {
    id: "job-detail",
    register: "data",
    url: "/jobs/senior-gameplay-engineer-riot-games",
    dynamic: true,
    note:
      "Real listed job with no external_id, so it resolves through the " +
      "/jobs/:slug branch of jobPublicHref rather than the /:slug/:id " +
      "branch (see lib/jobs/queries.ts jobPublicHref). Both branches render " +
      "the same job-detail-view.tsx component; this is one visual template.",
  },
  {
    id: "hidden-jobs",
    register: "data",
    url: "/hidden-jobs",
    dynamic: false,
    note:
      "308 permanentRedirect to /remote-jobs (pre-existing on baseline " +
      "commit 2ed77e7, not an Aurora regression). page.goto() follows the " +
      "redirect, so this row measures the hub-landing template's render at " +
      "the /remote-jobs URL. Flag to the coordinator: there is no longer a " +
      "standalone hidden-jobs page to QA as its own template.",
  },
  {
    id: "companies-index",
    register: "data",
    url: "/web3-companies",
    dynamic: false,
  },
  {
    id: "company-detail",
    register: "data",
    url: "/web3-companies/riot",
    dynamic: true,
    note:
      "Company slug is slugTitle(name_norm), not slugTitle(name) - " +
      "companies.name_norm for Riot Games is stored as \"riot\", not " +
      "\"riot games\" (see lib/companies/queries.ts, packages/shared/src/normalize.ts). " +
      "Verified 200 by curl against the running production build, not just " +
      "derived from the formula.",
  },
  {
    id: "company-tag",
    register: "data",
    url: "/web3-companies/tag/blockchain",
    dynamic: true,
    note: "\"blockchain\" is a FEATURED_TAG_CHIPS / JOB_TAGS entry, verified 200.",
  },
  {
    id: "rankings",
    register: "data",
    url: "/top-web3-jobs",
    dynamic: false,
    note:
      "Representative of ~13 routes on the same RankingJobsPage/JobBoard " +
      "scaffold: /highest-paid-developer-jobs, /highest-paying-web3-jobs, " +
      "/most-popular-developer-jobs, /most-popular-designers-jobs, " +
      "/most-popular-non-tech-jobs, /highest-paid-designers-jobs, " +
      "/highest-paid-non-tech-jobs, /entry-designer-jobs, " +
      "/entry-developer-jobs, /entry-non-tech-jobs, /top-web3-internships, " +
      "/web3-companies/top-growing. All verified 200.",
  },
  {
    id: "hub-landing",
    register: "data",
    url: "/remote+solidity-jobs",
    dynamic: true,
    note:
      "Combo landing via the [slug] catch-all + parseLandingSegment. " +
      "\"remote\" and \"solidity\" are both valid facets (solidity is a " +
      "JOB_TAGS entry). Listed exactly as a browser address bar would show " +
      "it, per the task's percent-encoding note - Playwright sends this " +
      "literally; the route itself receives it as \"remote%2Bsolidity-jobs\" " +
      "and decodes it in landing-canonical.ts / parseLandingSegment. " +
      "Verified 200 (not a redirect - only the non-canonical facet order, " +
      "e.g. /solidity+remote-jobs, 308s).",
  },
  {
    id: "roles-cities-directory",
    register: "data",
    url: "/roles",
    dynamic: false,
    note:
      "/web3-cities renders the same directory-listing shape " +
      "(surface surface--data, no board-main) and is treated as the same " +
      "template with different data. /skills/[slug] is NOT this template - " +
      "it is a redirect-or-404 shim (see top of file).",
  },
  {
    id: "salaries-index",
    register: "data",
    url: "/web3-salaries",
    dynamic: false,
    note: "/web3-non-tech-salaries is the same template with different data.",
  },
  {
    id: "salary-detail",
    register: "data",
    url: "/web3-salaries/backend-developer",
    dynamic: true,
    note:
      "Real dimension=\"role\" slug from salary_rollups. " +
      "/web3-non-tech-salaries/:slug is the same template with different data.",
  },
  {
    id: "salary-comparison",
    register: "data",
    url: "/web3-salaries/solana-vs-ethereum",
    dynamic: false,
  },
  {
    id: "learn-hub",
    register: "stage",
    url: "/learn-web3",
    dynamic: false,
    note:
      "Renders through ArticleLayout with the default surface=\"stage\" " +
      "(app/_components/article-layout.tsx). /learn-web3/[category] (e.g. " +
      "/learn-web3/all) adds a ResourceGrid inside the same ArticleLayout " +
      "shell and is treated as the same template, not a new one.",
  },
  {
    id: "editorial-article",
    register: "stage",
    url: "/what-is-web3",
    dynamic: false,
    note:
      "Also renders through ArticleLayout (surface=\"stage\" default), same " +
      "as learn-hub, but with plain long-form prose instead of a resource " +
      "grid - this is the judgment call the task asked to flag: the two " +
      "templates share a wrapper component and differ only in body shape. " +
      "/faq also renders through ArticleLayout and is grouped here rather " +
      "than given its own row.",
  },
  {
    id: "pricing",
    register: "stage",
    url: "/pricing",
    dynamic: false,
    note: "Own modifier class (`surface--stage price`), not shared with any other page.",
  },
  {
    id: "funnel-seller-page",
    register: "stage",
    url: "/post-web3-job",
    dynamic: false,
    note:
      "Representative of the `surface surface--stage marketing <name>` " +
      "family: /hire, /ads, /web3-jobs-api, /about all use the same " +
      "marketing-section block structure. /hire/[skill] and " +
      "/hire/[skill]/[location] (e.g. /hire/solidity/remote, verified 200) " +
      "reuse board-hero/board-main instead and are a listing variant of " +
      "this same funnel lane rather than a 22nd template.",
  },
  {
    id: "auth",
    register: "stage",
    url: "/login",
    dynamic: false,
    note:
      "/onboarding shares the `surface--stage auth auth-onboard` wrapper " +
      "(auth-onboard is a modifier of the same auth template) but is " +
      "session-gated - see the account note below.",
  },
  {
    id: "legal-long-form",
    register: "stage",
    url: "/terms",
    dynamic: false,
    note: "/privacy renders the identical `surface--stage legal-page` template.",
  },
  {
    id: "account",
    register: "data",
    url: "/dashboard",
    dynamic: false,
    note:
      "IMPORTANT: session-gated via AccountShell (also covers /profile, " +
      "/settings, and /onboarding under the auth template above). In this " +
      "environment BETTER_AUTH_SECRET is unset; without it these routes " +
      "500 for every visitor, authenticated or not (BetterAuthError: " +
      "\"You are using the default secret\"). With BETTER_AUTH_SECRET set " +
      "on the server process, an anonymous request instead 307s to /login - " +
      "that is what this harness will actually observe and record, since it " +
      "has no seeded session cookie. See qa/README.md for the exact env var " +
      "and for why the harness does not attempt to fabricate a better-auth " +
      "session (out of scope: it would mean writing into the `session` / " +
      "`account` D1 tables with a token that matches better-auth's own " +
      "signing, which is app-internals territory, not harness territory).",
  },
  {
    id: "404",
    register: "data",
    url: "/this-page-does-not-exist-qa-fixture",
    dynamic: false,
  },
];

export default templates;
