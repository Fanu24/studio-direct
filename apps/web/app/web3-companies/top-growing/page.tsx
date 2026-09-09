import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";

import { companyHref, joinNatural } from "../_directory";
import { catalogMonthLabel } from "../../_components/board-chrome";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { ArrowRightIcon } from "../../_components/icons";
import { JsonLd, absoluteUrl } from "../../_components/json-ld";
import { TABLE_HEADING_STYLE } from "../../_components/table-heading";
import {
  listCompanyGrowth,
  listMonthlyPostings,
  monthLabel,
  TOP_GROWING_LIMIT,
  type CompanyGrowthRow,
  type MonthlyPostingCount,
} from "../../../lib/companies/queries";
import type { JobsDatabase } from "../../../lib/jobs/queries";
import { requireTenantId } from "../../../lib/tenant";

export const revalidate = 300;

/** Two years of history, the same window the reference's trend chart covers. */
const TREND_MONTHS = 24;

function growthLabel(company: CompanyGrowthRow): string {
  if (company.growthPct === null) return "New";
  return `${company.growthPct > 0 ? "+" : ""}${company.growthPct}%`;
}

/**
 * Cached per request so generateMetadata and the page component - which both
 * need the same ranked list - only pay for listCompanyGrowth once instead
 * of twice.
 */
const loadGrowth = cache(
  async (): Promise<{ companies: CompanyGrowthRow[]; trend: MonthlyPostingCount[] }> => {
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
    const tenantId = await requireTenantId(db);
    const companies = (await listCompanyGrowth(db, tenantId)).slice(0, TOP_GROWING_LIMIT);
    const trend = await listMonthlyPostings(db, tenantId, TREND_MONTHS);
    return { companies, trend };
  },
);

export async function generateMetadata(): Promise<Metadata> {
  const { companies } = await loadGrowth();
  const month = catalogMonthLabel();
  const movers = companies.slice(0, 4).map((company) => company.name);
  const title = `Top ${TOP_GROWING_LIMIT} Growing Web3 Companies - ${month}`;
  const description =
    movers.length > 0
      ? `Web3 employers ranked by month-over-month hiring velocity for ${month}. ${joinNatural(movers)} posted the most new roles right now.`
      : `Web3 employers ranked by month-over-month hiring velocity for ${month}.`;
  return {
    title,
    description,
    alternates: { canonical: "/web3-companies/top-growing" },
  };
}

export default async function TopGrowingWeb3CompaniesPage() {
  const { companies, trend } = await loadGrowth();
  const movers = companies.slice(0, 3).map((company) => company.name);
  const trendMax = trend.reduce((max, row) => Math.max(max, row.count), 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Web3 companies ranked by hiring velocity",
    numberOfItems: companies.length,
    itemListElement: companies.map((company, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Organization",
        name: company.name,
        url: absoluteUrl(companyHref(company.slug)),
      },
    })),
  };

  return (
    <main className="board-main">
      <JsonLd data={jsonLd} />
      <header className="board-hero">
        <Breadcrumbs
          items={[
            { href: "/web3-companies", label: "Web3 companies" },
            { label: "Top growing" },
          ]}
        />
        <h1>
          Top {TOP_GROWING_LIMIT} Growing Web3 and Crypto Companies in {catalogMonthLabel()}
        </h1>
        <p className="lead">
          {movers.length > 0
            ? `${joinNatural(movers)} posted the most new roles in the last 30 days compared with the 30 days before that. `
            : "No company has posted enough new roles in the last 30 days to rank yet. "}
          Ranked by month-over-month hiring velocity, not by total job count or funding raised.
        </p>
        <p className="count">
          <span className="jobs-num">{companies.length}</span>{" "}
          {companies.length === 1 ? "company" : "companies"} with hiring activity in the last 60
          days
        </p>
      </header>

      <div className="jobs-table-wrap">
        <table className="salary-table jobs-growth-table">
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Company Name</th>
              <th scope="col">New Jobs</th>
              <th scope="col">Previous Period</th>
              <th scope="col">Difference</th>
              <th scope="col">Growth %</th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 ? (
              <tr>
                <td colSpan={6}>No companies have posted new jobs in the last 60 days.</td>
              </tr>
            ) : (
              companies.map((company, index) => (
                <tr key={company.id}>
                  <td className="mono">{index + 1}</td>
                  <td>
                    <h2 style={TABLE_HEADING_STYLE}>
                      <Link href={companyHref(company.slug)}>{company.name}</Link>
                    </h2>
                  </td>
                  <td className="mono">{company.newJobs}</td>
                  <td className="mono">{company.previousPeriod}</td>
                  <td className="mono">
                    {company.difference > 0 ? "+" : ""}
                    {company.difference}
                  </td>
                  <td className="mono">{growthLabel(company)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <section aria-labelledby="hiring-volume" className="jobs-more">
        <h2 id="hiring-volume">Roles posted per month</h2>
        <p>
          The whole index, not just the movers above: how many listed roles carry a posting
          date in each of the last {TREND_MONTHS} months. It is the baseline the growth column
          is measured against.
        </p>
        {trend.length === 0 ? (
          <p className="muted">No listing carries a posting date yet.</p>
        ) : (
          <ol
            aria-label="Listed roles posted per month"
            style={{ display: "grid", gap: "6px", listStyle: "none", margin: 0, padding: 0 }}
          >
            {trend.map((row) => (
              <li
                key={row.month}
                style={{ alignItems: "center", display: "flex", gap: "12px" }}
              >
                <span
                  className="mono small muted"
                  style={{ flex: "0 0 auto", width: "72px" }}
                >
                  {monthLabel(row.month)}
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    background: "var(--accent)",
                    borderRadius: "var(--radius-pill)",
                    height: "8px",
                    width: `${trendMax > 0 ? Math.max(1, Math.round((row.count / trendMax) * 100)) : 1}%`,
                  }}
                />
                <span className="mono small">{row.count}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="growth-note" className="jobs-more">
        <div className="jobs-more__head">
          <div>
            <h2 id="growth-note">How this ranking works</h2>
            <p>
              New jobs counts listed roles posted in the last 30 days. Previous period counts the
              30 days before that. A company with nothing in the previous period shows as New
              rather than a fabricated percentage.
            </p>
          </div>
          <Link className="text-link" href="/web3-companies">
            See every company
            <ArrowRightIcon size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
