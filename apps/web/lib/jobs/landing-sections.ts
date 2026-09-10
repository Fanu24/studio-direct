import {
  REGIONS,
  landingPath,
  landingTitle,
  relatedLandings,
  type LandingKind,
} from "@gaming/shared";

/**
 * Pure builders for the two landing sections the SEO spec asks for and the
 * route did not have: the per-slice stats block ("unique stats - count and
 * salary range from the rollups") and the 5-10 contextual internal links.
 *
 * Deliberately free of React, Next and D1 so both are unit-testable from
 * plain data; apps/web/app/[slug]/page.tsx renders the returned rows inline
 * (page tests only walk props.children, so the markup has to live there).
 */

export interface LandingStat {
  label: string;
  value: string;
  /** One short honest sentence saying exactly what the number counts. */
  hint: string;
}

export interface LandingStatInput {
  /** Slice-wide listing count, not the page's row count. */
  total: number;
  /** Slice-wide listings posted in the last 7 days. */
  newThisWeek: number;
  /** Formatted band from the salary rollup for this slice, when one exists. */
  salaryRange?: string | null;
  /** Formatted average from the same rollup. */
  averageSalary?: string | null;
  /** How many priced roles the rollup was computed from, over 30 days. */
  pricedRoles30d?: number | null;
  /** The rows actually rendered on this page. */
  jobs: readonly { companyName: string }[];
}

function countDistinctCompanies(jobs: readonly { companyName: string }[]): number {
  const names = new Set<string>();
  for (const job of jobs) {
    const name = job.companyName?.trim();
    if (name) names.add(name.toLowerCase());
  }
  return names.size;
}

/**
 * Always exactly four cells - the .about-stats grid is a four-column track,
 * so a fifth would orphan itself on its own row.
 */
export function buildLandingStats(input: LandingStatInput): LandingStat[] {
  const companies = countDistinctCompanies(input.jobs);
  const shown = input.jobs.length;

  return [
    {
      label: "Open roles",
      value: input.total.toLocaleString("en-US"),
      hint:
        input.total === 1
          ? "Listing in this slice of the catalog right now."
          : "Listings in this slice of the catalog right now.",
    },
    {
      label: "Posted this week",
      value: input.newThisWeek.toLocaleString("en-US"),
      hint:
        input.newThisWeek === 0
          ? "Nothing new landed in this slice over the last seven days."
          : "Added to this slice over the last seven days.",
    },
    {
      label: "Salary range",
      value: input.salaryRange ?? "Not published",
      hint: input.salaryRange
        ? `Rollup band${
            input.averageSalary ? `, averaging ${input.averageSalary}` : ""
          }, from ${(input.pricedRoles30d ?? 0).toLocaleString("en-US")} priced roles in the last 30 days.`
        : "No salary rollup covers this slice yet. Listings without a published band still appear in the table.",
    },
    {
      label: "Companies on this page",
      value: companies.toLocaleString("en-US"),
      hint:
        shown === 0
          ? "Nothing is listed on this page of the table."
          : `Distinct employers across the ${shown.toLocaleString("en-US")} ${
              shown === 1 ? "listing" : "listings"
            } shown below.`,
    },
  ];
}

export interface LandingLink {
  href: string;
  label: string;
}

export interface LandingLinkExtras {
  /** Salary page most relevant to this landing. */
  salaryHref: string;
  salaryLabel: string;
}

const REGION_FILL: LandingKind[] = REGIONS.map((region) => ({ kind: "region", region }));

const MIN_LINKS = 9;
const MAX_LINKS = 10;

/**
 * The spec asks every landing for 5-10 related internal links. The generic
 * chip row that used to sit here was identical on all ~380 URLs; this one
 * starts from relatedLandings(), which is contextual (a combo links its
 * component facets, a city links its country and region), then tops up with
 * the salary page, the company index and region hubs until the block is
 * worth crawling.
 */
export function buildLandingRelatedLinks(
  landing: LandingKind,
  extras: LandingLinkExtras,
): LandingLink[] {
  const self = landingPath(landing);
  const seen = new Set<string>([self]);
  const links: LandingLink[] = [];

  const push = (link: LandingLink) => {
    if (links.length >= MAX_LINKS || seen.has(link.href)) return;
    seen.add(link.href);
    links.push(link);
  };

  for (const related of relatedLandings(landing)) {
    push({ href: landingPath(related), label: landingTitle(related) });
  }

  push({ href: extras.salaryHref, label: extras.salaryLabel });
  push({ href: "/web3-companies", label: "Companies hiring in Web3" });

  for (const region of REGION_FILL) {
    if (links.length >= MIN_LINKS) break;
    push({ href: landingPath(region), label: landingTitle(region) });
  }

  return links;
}
