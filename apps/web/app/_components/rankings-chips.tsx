import Link from "next/link";

export interface RankingLink {
  href: string;
  label: string;
}

/**
 * The canonical ranking pages, each curl-verified 200 - not 308 - against the
 * running dev server before landing here.
 *
 * Three entries used to point at a spelling that only exists as a redirect:
 * "/highest-paid-developers-jobs" (plural) now redirects to the singular
 * "/highest-paid-developer-jobs", "/most-popular-designer-jobs" (singular)
 * redirects to the plural "/most-popular-designers-jobs", and
 * "/top-growing-web3-companies" redirects to "/web3-companies/top-growing".
 * The reference serves the same two ranking spellings we now link, and it has
 * no /top-growing-web3-companies URL at all. Linking the redirect source cost
 * a hop on every navigation and also broke `exclude` below, since the ranking
 * pages pass their canonical path.
 *
 * If a future taxonomy pass renames or removes one of these routes, re-verify
 * before adding or keeping it here - this list has no other guard against
 * drifting from the live route table.
 */
export const RANKING_LINKS: readonly RankingLink[] = [
  { href: "/top-web3-jobs", label: "Top Web3 jobs" },
  { href: "/highest-paying-web3-jobs", label: "Highest paying Web3 jobs" },
  { href: "/highest-paid-developer-jobs", label: "Highest paid developers" },
  { href: "/highest-paid-designers-jobs", label: "Highest paid designers" },
  { href: "/highest-paid-non-tech-jobs", label: "Highest paid non-tech" },
  { href: "/most-popular-developer-jobs", label: "Most popular developer jobs" },
  { href: "/most-popular-designers-jobs", label: "Most popular designer jobs" },
  { href: "/most-popular-non-tech-jobs", label: "Most popular non-tech jobs" },
  { href: "/web3-companies/top-growing", label: "Top growing Web3 companies" },
  { href: "/top-web3-internships", label: "Top Web3 internships" },
];

/**
 * Shared "Other rankings" block. `exclude` drops the page's own URL out of
 * its own list so a ranking page never links to itself.
 */
export function RankingsChips({ exclude }: { exclude?: string }) {
  const links = RANKING_LINKS.filter((link) => link.href !== exclude);
  if (links.length === 0) return null;

  return (
    <nav aria-label="Other rankings" className="cluster m-reveal" data-reveal>
      {links.map((link) => (
        <Link className="chip" href={link.href} key={link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
