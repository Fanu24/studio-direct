import {
  NON_TECH_SALARY_ROLES as SHARED_NON_TECH_SALARY_ROLES,
  isSalaryRole,
  landingPath,
  landingRoleFaq,
  tagLabel,
  type LandingKind,
} from "@gaming/shared";
import Link from "next/link";

import { SearchIcon } from "./icons";
import {SearchInput} from './search-input';

export const BROWSE_REGIONS = [
  { slug: "asia", label: "Asia" },
  { slug: "europe", label: "Europe" },
  { slug: "africa", label: "Africa" },
  { slug: "oceania", label: "Oceania" },
  { slug: "north-america", label: "North America" },
] as const;

/**
 * Single source of truth for which non-tech salary pages exist. Previously a
 * narrower hand-maintained copy, which left five taxonomy roles routable in the
 * footer but 404 at the page.
 */
export const NON_TECH_SALARY_ROLES = SHARED_NON_TECH_SALARY_ROLES;

export function catalogMonthLabel(date = new Date()): string {
  return date.toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Href for the "Remote" toggle in BoardSearch. Always resolved through
 * landingPath so every kind emits the one canonical URL shape (the "+" form
 * for tag combos) instead of a hand-built string that can drift from it.
 * Geo (city/country/region) and benefit landings have no combined
 * remote+facet LandingKind in the shipped URL space - parseLandingSegment
 * never emits one - so those fall through to the plain remote landing
 * rather than silently guessing an unresolvable URL.
 */
/**
 * The remote control is drawn as a switch, so it has to behave like one: show
 * which way it is set, and turn back off. It used to be a one-way link -
 * `/remote-jobs` pointed at `/remote-jobs`, with no on state in the markup or
 * the CSS - so on a remote page it still looked off and clicking it did
 * nothing. A switch that cannot be switched reads as broken, and it was.
 *
 * `active` is whether the page being viewed is already filtered to remote;
 * `href` is where the switch goes from here, which is the opposite state.
 */
export function remoteToggleState(landing?: LandingKind): {
  href: string;
  active: boolean;
} {
  if (landing?.kind === "remote") {
    // Off from a bare remote landing is the whole catalogue.
    return { href: "/jobs", active: true };
  }
  if (landing?.kind === "remote-tag") {
    // Off keeps the tags and drops only the remote part.
    return {
      href: landingPath({ kind: "tag", tag: landing.tag, tags: landing.tags }),
      active: true,
    };
  }
  return { href: remoteFilterHref(landing), active: false };
}

export function remoteFilterHref(landing?: LandingKind): string {
  if (!landing) return landingPath({ kind: "remote" });
  switch (landing.kind) {
    case "tag":
      return landingPath({ kind: "remote-tag", tag: landing.tag, tags: landing.tags });
    case "remote-tag":
    case "remote":
      return landingPath(landing);
    case "intern":
    case "entry-level":
      return landingPath({ kind: "remote-tag", tag: landing.kind, tags: [landing.kind] });
    case "benefit":
    case "city":
    case "country":
    case "region":
      return landingPath({ kind: "remote" });
  }
}

/** Benefit slugs whose SALARY_ROLES page is the specifically relevant one. */
const BENEFIT_SALARY_ROLE: Partial<Record<string, string>> = {
  "pay-in-crypto": "crypto",
};

export function salaryHrefForTag(tag?: string, benefit?: string): string {
  if (tag) {
    if (isSalaryRole(`${tag}-developer`)) return `/web3-salaries/${tag}-developer`;
    if (isSalaryRole(tag)) return `/web3-salaries/${tag}`;
  }
  const benefitRole = benefit ? BENEFIT_SALARY_ROLE[benefit] : undefined;
  if (benefitRole && isSalaryRole(benefitRole)) return `/web3-salaries/${benefitRole}`;
  return "/web3-salaries";
}

export function roleFaqItem(
  landing?: LandingKind,
  stats?: { total?: number; salaryRange?: string | null },
): {
  question: string;
  answer: string;
} {
  return landingRoleFaq(
    landing,
    typeof stats?.total === "number"
      ? { total: stats.total, salaryRange: stats.salaryRange }
      : undefined,
  );
}

export function BoardSearch({
  remoteHref,
  remoteActive = false,
  defaultQuery,
}: {
  remoteHref: string;
  remoteActive?: boolean;
  defaultQuery?: string;
}) {
  return (
    <form action="/jobs" className="search-bar" method="get">
      <label className="field">
        <span className="visually-hidden">Search</span>
        <SearchIcon className="search-bar__icon" size={18} />
        <SearchInput defaultQuery={defaultQuery} remoteActive={remoteActive}/>
      </label>
      {remoteActive?<input type="hidden" name="remote" value="1"/>:null}
      <button className="visually-hidden" type="submit">
        Search
      </button>
      <Link
        aria-checked={remoteActive}
        className={`remote-toggle${remoteActive ? " remote-toggle--on" : ""}`}
        href={remoteHref}
        role="switch"
      >
        <span aria-hidden="true" className="remote-toggle__track" />
        Remote
      </Link>
    </form>
  );
}

export function RelatedBrowseLinks({
  tag,
  benefit,
}: {
  tag?: string;
  benefit?: string;
}) {
  const salaryHref = salaryHrefForTag(tag, benefit);
  const benefitRole = !tag && benefit ? BENEFIT_SALARY_ROLE[benefit] : undefined;
  const salaryLabel = tag
    ? `${tagLabel(tag)} salaries`
    : benefitRole
      ? `${tagLabel(benefitRole)} salaries`
      : "Web3 salaries";

  return (
    <section className="container jobs-more m-reveal" data-reveal>
      <h2>Related pages</h2>
      <div className="chips">
        <Link className="chip" href={landingPath({ kind: "remote" })}>
          Remote Web3 Jobs
        </Link>
        {tag ? (
          <Link
            className="chip"
            href={landingPath({ kind: "remote-tag", tag, tags: [tag] })}
          >
            Remote {tagLabel(tag)} Jobs
          </Link>
        ) : null}
        <Link className="chip" href={salaryHref}>
          {salaryLabel}
        </Link>
        <Link className="chip" href="/web3-companies">Companies</Link>
        {BROWSE_REGIONS.map((region) => (
          <Link className="chip" href={`/web3-jobs-${region.slug}`} key={region.slug}>
            {region.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function BoardFaq({
  featured,
  items,
}: {
  featured: { question: string; answer: string };
  items: { question: string; answer: string }[];
}) {
  return (
    <section className="container jobs-more faq-accordion m-reveal" data-reveal>
      <details className="faq-item" open>
        <summary>{featured.question}</summary>
        <p>{featured.answer}</p>
      </details>
      {items.map((item) => (
        <details className="faq-item" key={item.question}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </section>
  );
}
