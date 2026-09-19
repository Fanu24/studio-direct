import {
  COUNTRIES,
  REGIONS,
  SALARY_ROLES,
  SENIORITY_SLUGS,
  formatSalaryRange,
  tagLabel,
} from "@gaming/shared";
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
import { DEVELOPER_SALARY_ROLES, SalaryStatsTable } from "../_components/salary-tables";
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

// Read live D1 data at request time; builds must not depend on a local database.
export const dynamic = "force-dynamic";

const PATH = "/web3-salaries";
const DEV_ROLE_SET = new Set<string>(DEVELOPER_SALARY_ROLES);
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
    listResolvedSalaryStats(db, tenantId, "role", SALARY_ROLES),
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
  const title = buildLandingTitle({ headline: "Web3 salaries", month, newJobs: 0 });
  return {
    title,
    description: `Web3 salary data for ${month}: average, minimum and maximum pay by role, seniority, country and region, aggregated from Nodework job listings that published a band.`,
    alternates: { canonical: PATH },
  };
}

function toChartRow(row: SalaryStatsRow, hrefFor: (slug: string) => string): SalaryChartRow | null {
  if (row.avg == null || row.min == null || row.max == null) return null;
  return { slug: row.slug, avg: row.avg, min: row.min, max: row.max, href: hrefFor(row.slug) };
}

export default async function SalariesHubPage() {
  const { roleRows, countryRows, regionRows, seniorityRows, latest, selected, details } =
    await loadData();
  const month = catalogMonthLabel();
  const title = buildLandingTitle({ headline: "Web3 salaries", month, newJobs: 0 });

  const devRows = roleRows.filter(
    (row) => DEV_ROLE_SET.has(row.slug) && row.avg != null && row.min != null && row.max != null,
  );
  const overview =
    devRows.length > 0
      ? {
          avg: Math.round(devRows.reduce((sum, row) => sum + row.avg!, 0) / devRows.length),
          min: Math.min(...devRows.map((row) => row.min!)),
          max: Math.max(...devRows.map((row) => row.max!)),
          roleCount: devRows.length,
        }
      : null;
  const highestPaid = devRows.length
    ? devRows.reduce((top, row) => (row.avg! > top.avg! ? row : top))
    : null;
  const lowestPaid = devRows.length
    ? devRows.reduce((bottom, row) => (row.avg! < bottom.avg! ? row : bottom))
    : null;

  const roleChartRows = [...devRows]
    .sort((a, b) => b.avg! - a.avg!)
    .slice(0, 8)
    .map((row) => toChartRow(row, (slug) => `/web3-salaries/${slug}`))
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
    description: `Average, minimum and maximum Web3 pay by role, seniority, country and region for ${month}.`,
    url: absoluteUrl(PATH),
    dateModified: new Date().toISOString(),
    author: { "@type": "Organization", name: "Nodework" },
    publisher: { "@type": "Organization", name: "Nodework" },
  };

  return (
    <main className="surface surface--data">
      <JsonLd data={blogPostingJsonLd} />
      {details.map((job) => (
        <JsonLd data={buildJobPostingJsonLd(job, origin)} key={job.id} />
      ))}
      <div className="container">
        <header className="page-header">
          <Breadcrumbs items={[{ href: "/jobs", label: "Jobs" }, { label: "Web3 salaries" }]} />
          <h1>{title}</h1>
          <p className="lead">
            Compensation ranges from Nodework listings that published both a minimum and a
            maximum. Roles without a published band still appear in the job catalog.
          </p>
        </header>
        <BoardSearch remoteHref="/remote-jobs" />
        <TagChips />
      </div>

      <section className="container">
        <h2>Average Web3 salary on Nodework</h2>
        {overview ? (
          <>
            <div className="stat">
              <span className="stat__value">
                <span className="m-count" data-reveal>
                  <span>{formatSalaryRange(overview.avg, overview.avg)}</span>
                </span>
              </span>
              <span className="stat__label">Average developer salary</span>
            </div>
            <p>
              That is the average of the {overview.roleCount} engineering roles below with a
              published salary band right now, spanning{" "}
              {formatSalaryRange(overview.min, overview.max)} across the whole set.
            </p>
            <SalaryBarChart chartLabel="Highest paid Web3 roles" rows={roleChartRows} />
            <div className="grid grid--2 salary-callouts">
              <div className="panel panel--tight panel--accent m-reveal" data-reveal>
                <span className="kicker">Highest paid</span>
                <p>
                  <Link href={`/web3-salaries/${highestPaid!.slug}`}>
                    {tagLabel(highestPaid!.slug)}
                  </Link>{" "}
                  averages {formatSalaryRange(highestPaid!.avg, highestPaid!.avg)}, the top
                  published band among Web3 engineering roles on Nodework right now.
                </p>
              </div>
              <div
                className="panel panel--tight panel--cool m-reveal"
                data-reveal
                data-reveal-delay="1"
              >
                <span className="kicker kicker--cool">Lowest paid</span>
                <p>
                  <Link href={`/web3-salaries/${lowestPaid!.slug}`}>
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
            No role on this hub has a published minimum and maximum yet. The tables below still
            list every role - open one to see its current listings.
          </p>
        )}

        <SalaryStatsTable
          heading="By role"
          hrefFor={(slug) => `/web3-salaries/${slug}`}
          labelHeader="Position"
          rows={roleRows}
          slugs={DEVELOPER_SALARY_ROLES}
        />
        <SalaryStatsTable
          heading="By non-tech"
          hrefFor={(slug) => `/web3-non-tech-salaries/${slug}`}
          labelHeader="Position"
          rows={roleRows}
          slugs={NON_TECH_SALARY_ROLES}
        />

        <h2>Salary by seniority</h2>
        <p>
          Pay by seniority level, from intern to CTO, across every Web3 role listed on
          Nodework.
        </p>
        <SalarySeniorityChart points={seniorityPoints} />
        <SalaryStatsTable
          hrefFor={(slug) => `/web3-salaries/${slug}`}
          labelHeader="Seniority"
          rows={seniorityRows}
          slugs={SENIORITY_SLUGS}
        />

        <h2>Salary by region</h2>
        <p>Regional pay bands across every role and country in the catalog.</p>
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
        <p>The ten highest-paying countries by average band, then the full country list.</p>
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
        <p className="cluster" style={{ marginTop: 28 }}>
          <Link className="text-link" href="/web3-non-tech-salaries">
            Non-tech salaries
          </Link>
          <Link className="text-link" href="/highest-paying-web3-jobs">
            Highest paying jobs
          </Link>
          <Link className="text-link" href="/web3-salaries/solana-vs-ethereum">
            Solana vs Ethereum salary
          </Link>
          <Link className="text-link" href="/web3-cities">
            Top Web3 cities
          </Link>
          <Link className="text-link" href="/what-is-web3">
            What is Web3
          </Link>
        </p>
      </section>
      <RelatedBrowseLinks />
    </main>
  );
}
