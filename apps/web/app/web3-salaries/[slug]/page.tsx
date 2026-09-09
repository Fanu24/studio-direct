import {
  COUNTRIES,
  REGIONS,
  SENIORITY_SLUGS,
  formatSalaryRange,
  isJobTag,
  parseSalaryPageSlug,
  tagLabel,
  type SalaryPageSlug,
} from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  BoardSearch,
  NON_TECH_SALARY_ROLES,
  RelatedBrowseLinks,
  catalogMonthLabel,
} from "../../_components/board-chrome";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { JobBoard } from "../../_components/job-board";
import { TagChips } from "../../_components/job-row";
import { JsonLd, absoluteUrl } from "../../_components/json-ld";
import {
  SalaryBarChart,
  SalarySeniorityChart,
  type SalaryChartRow,
} from "../../_components/salary-chart";
import {
  DEVELOPER_SALARY_ROLES,
  SalaryBreakdownTable,
  SalaryStatsTable,
} from "../../_components/salary-tables";
import { buildJobPostingJsonLd } from "../../../lib/jobs/jsonld";
import { buildLandingTitle } from "../../../lib/jobs/landing-meta";
import {
  getJobForListItem,
  listJobs,
  listResolvedSalaryStats,
  resolveSalaryBreakdown,
  resolveSalaryStats,
  salaryRoleStem,
  type JobDetail,
  type JobListFilters,
  type JobsDatabase,
  type SalaryRollupRow,
  type SalaryStatsRow,
} from "../../../lib/jobs/queries";
import { requireTenantId } from "../../../lib/tenant";
import { applicantsSentence, applicationVolume } from "../queries";

export const revalidate = 300;

type SalaryParams = Promise<{ slug: string }>;

const HOURS_PER_YEAR = 2080;
const JOB_POSTING_LIMIT = 10;
const NON_TECH_SET = new Set<string>(NON_TECH_SALARY_ROLES);

function requestOrigin(requestHeaders: Headers) {
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host");
  if (!host) throw new Error("Request host was not found");
  const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto === "http" ? "http" : "https";
  return `${protocol}://${host}`;
}

function salaryPageSlug(parsed: SalaryPageSlug): string {
  switch (parsed.kind) {
    case "role":
      return parsed.role;
    case "country":
      return parsed.country;
    case "region":
      return parsed.region;
    case "city":
      return parsed.city;
    case "seniority":
      return parsed.seniority;
  }
}

function article(word: string): "a" | "an" {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

/** "Solidity Developer" for a role, "Web3 jobs in Germany" for a place, "Senior Web3 jobs"
 * for a seniority level - the noun phrase every narrative sentence below is built around. */
function subjectPhrase(parsed: SalaryPageSlug, label: string): string {
  switch (parsed.kind) {
    case "role":
      return label;
    case "country":
    case "region":
    case "city":
      return `Web3 jobs in ${label}`;
    case "seniority":
      return `${label} Web3 jobs`;
  }
}

function howMuchQuestion(parsed: SalaryPageSlug, label: string, subject: string): string {
  return parsed.kind === "role"
    ? `How much does ${article(label)} ${label} make?`
    : `How much do ${subject} pay?`;
}

function averageNarrative(
  parsed: SalaryPageSlug,
  label: string,
  subject: string,
  rollup: SalaryRollupRow | null,
): string {
  if (!rollup) {
    return `Nodework does not yet have a published salary band for ${subject}. Open listings below still apply on this site once a source publishes a range.`;
  }
  const jobWord = rollup.jobCount30d === 1 ? "job" : "jobs";
  const range = `${formatSalaryRange(rollup.min, rollup.min)} to ${formatSalaryRange(rollup.max, rollup.max)}`;
  if (parsed.kind === "role") {
    return `${label}s on Nodework average ${formatSalaryRange(rollup.avg, rollup.avg)}, with listed pay ranging from ${range} across ${rollup.jobCount30d} ${jobWord} with a published band.`;
  }
  return `${subject} average ${formatSalaryRange(rollup.avg, rollup.avg)} on Nodework, with listed pay ranging from ${range} across ${rollup.jobCount30d} ${jobWord} with a published band.`;
}

/** "Solidity Developer jobs" for a role (matches the spec's literal "{role} jobs" wording);
 * `subject` already reads as a job set for every other kind ("Web3 jobs in Germany"). */
function remotePhrase(parsed: SalaryPageSlug, label: string, subject: string): string {
  return parsed.kind === "role" ? `${label} jobs` : subject;
}

function hireHeading(parsed: SalaryPageSlug, label: string): string {
  switch (parsed.kind) {
    case "role":
      return `Hiring ${article(label)} ${label}?`;
    case "seniority":
      return `Hiring ${label}-level Web3 talent?`;
    default:
      return `Hiring in ${label}?`;
  }
}

async function tenantDatabase() {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await requireTenantId(db);
  return { db, tenantId };
}

export async function generateMetadata({
  params,
}: {
  params: SalaryParams;
}): Promise<Metadata> {
  const parsed = parseSalaryPageSlug((await params).slug);
  if (!parsed) notFound();
  const slug = salaryPageSlug(parsed);
  const label = tagLabel(slug);
  const subject = subjectPhrase(parsed, label);
  const month = catalogMonthLabel();
  const title = buildLandingTitle({ headline: `${label} salary`, month, newJobs: 0 });
  return {
    title,
    description: `${subject} salary data on Nodework for ${month}, aggregated from job listings that published a pay band.`,
    // Deliberately always /web3-salaries/{slug}: /web3-non-tech-salaries/[slug] renders this
    // same component for roles that also live in SALARY_ROLES (see salary-tables.tsx IA note),
    // so both URLs point their canonical at the one page Nodework treats as authoritative.
    alternates: { canonical: `/web3-salaries/${slug}` },
  };
}

export default async function SalaryRolePage({ params }: { params: SalaryParams }) {
  const parsed = parseSalaryPageSlug((await params).slug);
  if (!parsed) notFound();

  const { db, tenantId } = await tenantDatabase();
  const slug = salaryPageSlug(parsed);
  const dimension = parsed.kind === "role" ? "role" : parsed.kind;
  const label = tagLabel(slug);
  const subject = subjectPhrase(parsed, label);
  const isRole = parsed.kind === "role";
  const stem = parsed.kind === "role" ? salaryRoleStem(parsed.role) : undefined;

  const listFilters: JobListFilters = {
    tag: stem,
    orTitle: isRole,
    locationSlug:
      parsed.kind === "country" || parsed.kind === "region" || parsed.kind === "city"
        ? slug
        : undefined,
    seniority: parsed.kind === "seniority" ? parsed.seniority : undefined,
  };

  const [rollup, jobs, remoteCount, applications] = await Promise.all([
    resolveSalaryStats(db, tenantId, dimension, slug),
    listJobs(db, tenantId, { ...listFilters, pageSize: 20 }),
    listJobs(db, tenantId, { ...listFilters, remoteOnly: true, pageSize: 1 }),
    applicationVolume(db, tenantId, {
      tag: stem,
      orTitle: isRole,
      locationSlug: listFilters.locationSlug,
      titleLike: listFilters.seniority,
    }),
  ]);
  const selected = await getJobForListItem(db, tenantId, jobs.jobs[0]);
  const details = (
    await Promise.all(
      jobs.jobs.slice(0, JOB_POSTING_LIMIT).map((job) => getJobForListItem(db, tenantId, job)),
    )
  ).filter((job): job is JobDetail => job !== null);

  const countryBreakdown = isRole
    ? await resolveSalaryBreakdown(db, tenantId, { tag: stem! }, "country")
    : [];
  const seniorityBreakdown = isRole
    ? await resolveSalaryBreakdown(db, tenantId, { tag: stem! }, "seniority")
    : [];

  let comparison: {
    heading: string;
    labelHeader: string;
    slugs: readonly string[];
    rows: SalaryStatsRow[];
    hrefFor: (s: string) => string;
  } | null = null;

  if (parsed.kind === "role") {
    const isNonTech = NON_TECH_SET.has(parsed.role);
    const list = isNonTech ? NON_TECH_SALARY_ROLES : DEVELOPER_SALARY_ROLES;
    const rows = await listResolvedSalaryStats(db, tenantId, "role", list);
    comparison = {
      heading: "Compare with other roles",
      labelHeader: "Position",
      slugs: list,
      rows,
      hrefFor: (s) => (isNonTech ? `/web3-non-tech-salaries/${s}` : `/web3-salaries/${s}`),
    };
  } else if (parsed.kind === "country") {
    const rows = await listResolvedSalaryStats(db, tenantId, "country", COUNTRIES);
    comparison = {
      heading: "Compare with other countries",
      labelHeader: "Country",
      slugs: COUNTRIES,
      rows,
      hrefFor: (s) => `/web3-salaries/${s}`,
    };
  } else if (parsed.kind === "region") {
    const rows = await listResolvedSalaryStats(db, tenantId, "region", REGIONS);
    comparison = {
      heading: "Compare with other regions",
      labelHeader: "Region",
      slugs: REGIONS,
      rows,
      hrefFor: (s) => `/web3-salaries/${s}`,
    };
  } else if (parsed.kind === "seniority") {
    const rows = await listResolvedSalaryStats(db, tenantId, "seniority", SENIORITY_SLUGS);
    comparison = {
      heading: "Compare with other seniority levels",
      labelHeader: "Seniority",
      slugs: SENIORITY_SLUGS,
      rows,
      hrefFor: (s) => `/web3-salaries/${s}`,
    };
  }

  const month = catalogMonthLabel();
  const title = buildLandingTitle({ headline: `${label} salary`, month, newJobs: 0 });
  const remotePct = jobs.total > 0 ? Math.round((remoteCount.total / jobs.total) * 100) : null;
  const hourly = rollup ? Math.round(rollup.avg / HOURS_PER_YEAR) : null;
  const hireHref = stem && isJobTag(stem) ? `/hire/${stem}` : undefined;

  const chartRow: SalaryChartRow[] = rollup
    ? [{ slug, label, avg: rollup.avg, min: rollup.min, max: rollup.max }]
    : [];
  const countryChartRows: SalaryChartRow[] = countryBreakdown.slice(0, 10).map((row) => ({
    slug: row.slug,
    avg: row.avg,
    min: row.min,
    max: row.max,
    href: `/web3-salaries/${row.slug}`,
  }));
  const seniorityPoints = SENIORITY_SLUGS.map((seniority) => {
    const row = seniorityBreakdown.find((entry) => entry.slug === seniority);
    return {
      slug: seniority,
      label: tagLabel(seniority),
      href: `/web3-salaries/${seniority}`,
      avg: row?.avg ?? null,
      max: row?.max ?? null,
    };
  });

  const origin = requestOrigin(await headers());
  const path = `/web3-salaries/${slug}`;
  const blogPostingJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description: `${subject} salary data on Nodework for ${month}.`,
    url: absoluteUrl(path),
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
            { label },
          ]}
        />
        <h1>{title}</h1>
        <p className="lead">{averageNarrative(parsed, label, subject, rollup)}</p>
        <BoardSearch remoteHref="/remote-jobs" />
        <TagChips />
        <p className="count">
          <span className="jobs-num">{jobs.total}</span> jobs found
        </p>
      </header>

      <article className="container container--content">
        <h2>{howMuchQuestion(parsed, label, subject)}</h2>
        <p>{averageNarrative(parsed, label, subject, rollup)}</p>
        <SalaryBarChart
          chartLabel={`${subject} salary range`}
          emptyMessage="No salary band published yet for this page."
          rows={chartRow}
        />

        <h2>Average yearly salary</h2>
        {rollup ? (
          <>
            <p className="salary-stat-figure">{formatSalaryRange(rollup.avg, rollup.avg)}</p>
            <p>
              The midpoint of every published band behind this page. It moves when the
              listings move, so it is a read on what is being advertised now, not a
              long-run market average.
            </p>
          </>
        ) : (
          <p className="muted">
            Not enough data yet. A listing only reaches this figure when it publishes both
            a minimum and a maximum, and nothing in this slice has done that so far.
          </p>
        )}

        {rollup && hourly != null ? (
          <>
            <h2>{isRole ? `${label} hourly rate` : `Hourly rate for ${subject}`}</h2>
            <p>
              That works out to about {formatSalaryRange(hourly, hourly)} per hour, based on a
              standard 2,080-hour work year (40 hours a week, 52 weeks a year).
            </p>
          </>
        ) : null}

        <h2>How many {remotePhrase(parsed, label, subject)} are there?</h2>
        {jobs.total > 0 ? (
          <p>
            Nodework lists {jobs.total} {remotePhrase(parsed, label, subject)} right now.
            {rollup
              ? ` ${rollup.jobCount30d} of them published both a minimum and a maximum, which is the set every figure on this page is computed from.`
              : " None of them published both a minimum and a maximum, which is why this page has no salary figure."}
          </p>
        ) : (
          <p className="muted">
            Nodework has no listed {remotePhrase(parsed, label, subject)} at the moment.
            The page stays up because the slice exists in the catalog taxonomy; it will
            fill in again the next time a matching role is imported.
          </p>
        )}

        <h2>How many applicants per {parsed.kind === "role" ? `${label} job` : "job"}?</h2>
        <p>{applicantsSentence(applications, remotePhrase(parsed, label, subject), jobs.total)}</p>

        <h2>How many {remotePhrase(parsed, label, subject)} are remote?</h2>
        {jobs.total > 0 ? (
          <p>
            {remotePct}% of the {jobs.total} currently listed {remotePhrase(parsed, label, subject)}{" "}
            on Nodework are remote or hybrid.
          </p>
        ) : (
          <p className="muted">
            Nodework does not have any listed {remotePhrase(parsed, label, subject)} right
            now, so there is no remote share to report.
          </p>
        )}

        {isRole ? (
          <>
            <h2>{label} salary by country</h2>
            <p>How {label} pay compares across the countries in Nodework&apos;s current listings.</p>
            <SalaryBarChart
              chartLabel={`${label} salary by country`}
              emptyMessage="No country breakdown available yet for this role."
              rows={countryChartRows}
            />
            <SalaryBreakdownTable
              hrefFor={(s) => `/web3-salaries/${s}`}
              labelHeader="Country"
              rows={countryBreakdown}
            />

            <h2>{label} salary by seniority</h2>
            <p>How {label} pay changes from intern to CTO in Nodework&apos;s current listings.</p>
            <SalarySeniorityChart
              emptyMessage="No seniority breakdown available yet for this role."
              points={seniorityPoints}
            />
            <SalaryBreakdownTable
              hrefFor={(s) => `/web3-salaries/${s}`}
              labelHeader="Seniority"
              rows={seniorityBreakdown}
            />
          </>
        ) : null}
      </article>

      <JobBoard
        emptyMessage="No matching jobs yet."
        jobs={jobs.jobs}
        selected={selected}
      />

      <section className="container salary-cta">
        <h2>{hireHeading(parsed, label)}</h2>
        <p>
          Nodework is a public job catalog, not a recruiting product. Post the role and it
          joins this page automatically once it is live.
        </p>
        <div className="salary-cta__actions">
          <Link className="button button--primary" href="/post-web3-job">
            Post a job
          </Link>
          {hireHref ? (
            <Link className="button button--secondary" href={hireHref}>
              See who is hiring {label}
            </Link>
          ) : null}
        </div>
      </section>

      {comparison ? (
        <section className="container jobs-more">
          <SalaryStatsTable
            heading={comparison.heading}
            hrefFor={comparison.hrefFor}
            labelHeader={comparison.labelHeader}
            rows={comparison.rows}
            slugs={comparison.slugs}
          />
        </section>
      ) : null}

      <p className="cluster" style={{ marginTop: 24 }}>
        <Link className="text-link" href="/web3-salaries">
          All salary pages
        </Link>
      </p>
      <RelatedBrowseLinks tag={isRole ? stem : undefined} />
    </main>
  );
}
