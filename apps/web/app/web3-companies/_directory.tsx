import { formatSalaryRange, tagLabel } from "@gaming/shared";
import Link from "next/link";

import { formatPosted } from "../_components/job-card";
import { absoluteUrl } from "../_components/json-ld";
import { TABLE_HEADING_STYLE } from "../_components/table-heading";
import type { CompanyDirectoryItem } from "../../lib/companies/queries";

export function companyHref(slug: string): string {
  return `/web3-companies/${slug}`;
}

/** "A" / "A and B" / "A, B and C" - never an Oxford comma, never a bare list. */
export function joinNatural(items: readonly string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function companyListJsonLd(
  name: string,
  companies: readonly CompanyDirectoryItem[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: companies.length,
    itemListElement: companies.map((company, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Organization",
        name: company.name,
        url: absoluteUrl(companyHref(company.slug)),
        ...(company.logoUrl ? { logo: company.logoUrl } : {}),
      },
    })),
  };
}

/**
 * The ranked company table shared by /web3-companies and the per-category
 * /web3-companies/tag/[tag] view. Exported as a plain function and called as
 * `{CompanyDirectoryTable(...)}` from the pages so its output lands directly
 * in the returned element tree - the page tests walk `props.children` only
 * and cannot see inside a child component.
 *
 * Each row's company name is an `h2` (see TABLE_HEADING_STYLE) so the page
 * outline lists the companies in the directory, matching the reference
 * company directory, which marks every row's name as a heading too.
 */
export function CompanyDirectoryTable({
  companies,
  emptyMessage,
}: {
  companies: readonly CompanyDirectoryItem[];
  emptyMessage: string;
}) {
  if (companies.length === 0) {
    return (
      <div className="empty">
        <p>{emptyMessage}</p>
        <div className="cluster">
          <Link className="button button--secondary" href="/jobs">
            Browse all jobs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="jobs-company-table-wrap">
      <table className="salary-table jobs-company-table">
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Logo</th>
            <th scope="col">Company Name</th>
            <th scope="col">Category</th>
            <th scope="col">Jobs Count</th>
            <th scope="col">Average Yearly Salary</th>
            <th scope="col">Last Job Posted</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company, index) => {
            const posted = formatPosted(company.lastPostedAt);
            return (
              <tr key={company.id}>
                <td className="mono">{index + 1}</td>
                <td>
                  <span aria-hidden="true" className="jobs-studio-mark jobs-studio-mark--sm">
                    {company.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" className="jobs-studio-logo" src={company.logoUrl} />
                    ) : (
                      company.name.trim().charAt(0).toUpperCase()
                    )}
                  </span>
                </td>
                <td>
                  <h2 style={TABLE_HEADING_STYLE}>
                    <Link
                      className="jobs-company-table__name"
                      href={companyHref(company.slug)}
                    >
                      {company.name}
                    </Link>
                  </h2>
                </td>
                <td>
                  {company.category ? (
                    <Link className="chip" href={`/web3-companies/tag/${company.category}`}>
                      {tagLabel(company.category)}
                    </Link>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
                <td className="mono">
                  {company.jobCount === 0 ? (
                    <span className="muted">No listed roles right now</span>
                  ) : (
                    `${company.jobCount} ${company.jobCount === 1 ? "role" : "roles"}`
                  )}
                </td>
                <td className="mono">
                  {company.avgSalary != null ? (
                    formatSalaryRange(company.avgSalary, company.avgSalary)
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
                <td>{posted ?? <span className="muted">-</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The category facet cloud above the table. Same reasoning as
 * CompanyDirectoryTable: called as a plain function so the chips are visible
 * to the page tests' element walk.
 */
export function CompanyCategoryChips({
  categories,
  active,
}: {
  categories: readonly { slug: string; companyCount: number }[];
  active?: string;
}) {
  if (categories.length === 0) return null;
  return (
    <div className="chips">
      <Link className={`chip${active ? "" : " chip--on"}`} href="/web3-companies">
        All categories
      </Link>
      {categories.map((category) => (
        <Link
          className={`chip${active === category.slug ? " chip--on" : ""}`}
          href={`/web3-companies/tag/${category.slug}`}
          key={category.slug}
        >
          {tagLabel(category.slug)}
        </Link>
      ))}
    </div>
  );
}
