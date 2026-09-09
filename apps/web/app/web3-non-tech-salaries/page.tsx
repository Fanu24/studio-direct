import { COUNTRIES, REGIONS, SENIORITY_SLUGS, formatSalaryRange, tagLabel } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import {
  BoardSearch,
  NON_TECH_SALARY_ROLES,
  RelatedBrowseLinks,
  catalogMonthLabel,
} from "../_components/board-chrome";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { JobBoard } from "../_components/job-board";
import { TagChips } from "../_components/job-row";
import { JsonLd, absoluteUrl } from "../_components/json-ld";
import { SalaryBarChart, SalarySeniorityChart, type SalaryChartRow } from "../_components/salary-chart";
import { SalaryStatsTable } from "../_components/salary-tables";
import { buildJobPostingJsonLd } from "../../lib/jobs/jsonld";
import { buildLandingTitle } from "../../lib/jobs/landing-meta";
import {
  getJobForListItem,
  listJobs,
  listResolvedSalaryStats,
  type JobDetail,
  type JobsDatabase,
  type SalaryStatsRow,
} from "../../lib/jobs/queries";
import { requireTenantId } from "../../lib/tenant";

export const revalidate = 300;

const PATH = "/web3-non-tech-salaries";
const LATEST_SALARIED_JOBS = 10;

function requestOrigin(requestHeaders: Headers) {
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host");
  if (!host) throw new Error("Request host was not found");
  const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto === "http" ? "http" : "https";
  return `${protocol}://${host}`;
}

async function loadData() {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await requireTenantId(db);
  const [roleRows, countryRows, regionRows, seniorityRows, latest] = await Promise.all([
    listResolvedSalaryStats(db, tenantId, "role", NON_TECH_SALARY_ROLES),
    listResolvedSalaryStats(db, tenantId, "country", COUNTRIES),
    listResolvedSalaryStats(db, tenantId, "region", REGIONS),
    listResolvedSalaryStats(db, tenantId, "seniority", SENIORITY_SLUGS),
    listJobs(db, tenantId, { hasSalary: true, pageSize: LATEST_SALARIED_JOBS }),
  ]);
  const selected = await getJobForListItem(db, tenantId, latest.jobs[0]);
  const details = (
    await Promise.all(latest.jobs.map((job) => getJobForListItem(db, tenantId, job)))
  ).filter((job): job is JobDetail => job !== null);
  return { roleRows, countryRows, regionRows, seniorityRows, latest, selected, details };
}

export async function generateMetadata(): Promise<Metadata> {
  const month = catalogMonthLabel();
  const title = buildLandingTitle({ headline: "Web3 non-tech salaries", month, newJobs: 0 });
  return {
    title,
    description: `Non-engineering Web3 salary data for ${month}: product, marketing, community, design, sales, finance, legal and recruiting pay, aggregated from Nodework listings.`,
    alternates: { canonical: PATH },
  };
}

function toChartRow(row: SalaryStatsRow, hrefFor: (slug: string) => string): SalaryChartRow | null {
  if (row.avg == null || row.min == null || row.max == null) return null;
  return { slug: row.slug, avg: row.avg, min: row.min, max: row.max, href: hrefFor(row.slug) };
}

export default async function Web3NonTechSalariesPage() {
  const { roleRows, countryRows, regionRows, seniorityRows, latest, selected, details } =
    await loadData();
  const month = catalogMonthLabel();
  const title = buildLandingTitle({ headline: "Web3 non-tech salaries", month, newJobs: 0 });

  const rowsWithData = roleRows.filter(
    (row) => row.avg != null && row.min != null && row.max != null,
  );
  const overview =
    rowsWithData.length > 0
      ? {
          avg: Math.round(rowsWithData.reduce((sum, row) => sum + row.avg!, 0) / rowsWithData.length),
          min: Math.min(...rowsWithData.map((row) => row.min!)),
          max: Math.max(...rowsWithData.map((row) => row.max!)),
          roleCount: rowsWithData.length,
        }
      : null;
  const highestPaid = rowsWithData.length
    ? rowsWithData.reduce((top, row) => (row.avg! > top.avg! ? row : top))
    : null;
  const lowestPaid = rowsWithData.length
    ? rowsWithData.reduce((bottom, row) => (row.avg! < bottom.avg! ? row : bottom))
    : null;

  const roleChartRows = [...rowsWithData]
    .sort((a, b) => b.avg! - a.avg!)
    .map((row) => toChartRow(row, (slug) => `/web3-non-tech-salaries/${slug}`))
    .filter((row): row is SalaryChartRow => row !== null);

  const countryChartRows = [...countryRows]
    .filter((row) => row.avg != null)
    .sort((a, b) => b.avg! - a.avg!)
    .slice(0, 10)
    .map((row) => toChartRow(row, (slug) => `/web3-salaries/${slug}`))
    .filter((row): row is SalaryChartRow => row !== null);

  const regionChartRows = regionRows
    .map((row) => toChartRow(row, (slug) => `/web3-salaries/${slug}`))
    .filter((row): row is SalaryChartRow => row !== null);

  const seniorityPoints = SENIORITY_SLUGS.map((slug) => {
    const row = seniorityRows.find((entry) => entry.slug === slug);
    return {
      slug,
      label: tagLabel(slug),
      href: `/web3-salaries/${slug}`,
      avg: row?.avg ?? null,
      max: row?.max ?? null,
    };
  });

  const origin = requestOrigin(await headers());
  const blogPostingJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description: `Average, minimum and maximum non-tech Web3 pay by role for ${month}.`,
    url: absoluteUrl(PATH),
    dateModified: new Date().toISOString(),
    author: { "@type": "Organization", name: "Nodework" },
    publisher: { "@type": "Organization", name: "Nodework" },
  };

  return (
    <main className="board-main">
      <JsonLd data={blogPostingJsonLd} />
      {details.map((job) => (
        <JsonLd data={buildJobPostingJsonLd(job, origin)} key={job.id} />
      ))}
      <header className="board-hero">
        <Breadcrumbs
          items={[
            { href: "/jobs", label: "Jobs" },
            { href: "/web3-salaries", label: "Web3 salaries" },
            { label: "Non-tech" },
          ]}
        />
        <h1>{title}</h1>
        <p className="lead">
          Pay bands for product, go to market, design, and operations roles, aggregated from
          listed jobs that published a minimum and a maximum.
        </p>
        <BoardSearch remoteHref="/remote-jobs" />
        <TagChips />
      </header>

      <section className="container">
        <h2>Average non-tech Web3 salary on Nodework</h2>
        {overview ? (
          <>
            <p className="salary-stat-figure">{formatSalaryRange(overview.avg, overview.avg)}</p>
            <p>
              That is the average of the {overview.roleCount} non-tech roles below with a
              published salary band right now, spanning{" "}
              {formatSalaryRange(overview.min, overview.max)} across the whole set.
            </p>
            <SalaryBarChart chartLabel="Highest paid non-tech roles" rows={roleChartRows} />
            <div className="salary-callouts">
              <div className="salary-callout">
                <span className="salary-callout__kicker">Highest paid</span>
                <p>
                  <Link href={`/web3-non-tech-salaries/${highestPaid!.slug}`}>
                    {tagLabel(highestPaid!.slug)}
                  </Link>{" "}
                  averages {formatSalaryRange(highestPaid!.avg, highestPaid!.avg)}, the top
                  published band among non-tech Web3 roles on Nodework right now.
                </p>
              </div>
              <div className="salary-callout">
                <span className="salary-callout__kicker">Lowest paid</span>
                <p>
                  <Link href={`/web3-non-tech-salaries/${lowestPaid!.slug}`}>
                    {tagLabel(lowestPaid!.slug)}
                  </Link>{" "}
                  averages {formatSalaryRange(lowestPaid!.avg, lowestPaid!.avg)}, the lowest
                  published band among the roles below.
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="muted">
            No non-tech role has a published minimum and maximum yet. The table below still
            lists every role - open one to see its current listings.
          </p>
        )}

        <SalaryStatsTable
          hrefFor={(slug) => `/web3-non-tech-salaries/${slug}`}
          labelHeader="Position"
          rows={roleRows}
          slugs={NON_TECH_SALARY_ROLES}
        />

        <h2>Salary by seniority</h2>
        <p>
          Nodework-wide pay by seniority level, from intern to CTO - not limited to non-tech
          roles, since seniority bands are not tracked separately per role type.
        </p>
        <SalarySeniorityChart points={seniorityPoints} />
        <SalaryStatsTable
          hrefFor={(slug) => `/web3-salaries/${slug}`}
          labelHeader="Seniority"
          rows={seniorityRows}
          slugs={SENIORITY_SLUGS}
        />

        <h2>Salary by region</h2>
        <p>Nodework-wide regional pay bands across every listed role.</p>
        <SalaryBarChart
          chartLabel="Salary by region"
          emptyMessage="No region has a published salary band yet."
          rows={regionChartRows}
        />
        <SalaryStatsTable
          hrefFor={(slug) => `/web3-salaries/${slug}`}
          labelHeader="Region"
          rows={regionRows}
          slugs={REGIONS}
        />

        <h2>Salary by country</h2>
        <p>The ten highest-paying countries Nodework-wide, then the full country list.</p>
        <SalaryBarChart
          chartLabel="Highest paying countries"
          emptyMessage="No country has a published salary band yet."
          rows={countryChartRows}
        />
        <SalaryStatsTable
          hrefFor={(slug) => `/web3-salaries/${slug}`}
          labelHeader="Country"
          rows={countryRows}
          slugs={COUNTRIES}
        />

        <h2>Latest jobs with a published salary</h2>
      </section>
      <JobBoard
        emptyMessage="No jobs with a published salary band yet."
        jobs={latest.jobs}
        selected={selected}
      />
      <section className="container">
        <p className="cluster" style={{ marginTop: 24 }}>
          <Link className="text-link" href="/non-tech-jobs">
            Non-tech jobs
          </Link>
          <Link className="text-link" href="/web3-salaries">
            All salary pages
          </Link>
        </p>
      </section>
      <RelatedBrowseLinks tag="non-tech" />
    </main>
  );
}
