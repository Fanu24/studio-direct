import { formatSalaryRange } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { cache } from "react";

import { BoardSearch, RelatedBrowseLinks, catalogMonthLabel } from "../_components/board-chrome";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { JobBoard } from "../_components/job-board";
import { TagChips } from "../_components/job-row";
import { JsonLd, absoluteUrl } from "../_components/json-ld";
import { buildJobPostingJsonLd } from "../../lib/jobs/jsonld";
import { buildLandingTitle } from "../../lib/jobs/landing-meta";
import {
  countNewJobs,
  getJobForListItem,
  listJobs,
  type JobDetail,
  type JobsDatabase,
} from "../../lib/jobs/queries";
import { requireTenantId } from "../../lib/tenant";

export const revalidate = 300;

const PATH = "/highest-paying-web3-jobs";
const JOB_POSTING_LIMIT = 10;

function requestOrigin(requestHeaders: Headers) {
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host");
  if (!host) throw new Error("Request host was not found");
  const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto === "http" ? "http" : "https";
  return `${protocol}://${host}`;
}

/** cache() dedupes this per request - generateMetadata and the page component both need
 * it, and it now runs two queries (the listing plus countNewJobs) instead of one. */
const loadData = cache(async () => {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await requireTenantId(db);
  const filters = { hasSalary: true } as const;
  const [listed, newJobs] = await Promise.all([
    listJobs(db, tenantId, { ...filters, orderBy: "salary", pageSize: 40 }),
    countNewJobs(db, tenantId, filters, 24),
  ]);
  const selected = await getJobForListItem(db, tenantId, listed.jobs[0]);
  const details = (
    await Promise.all(
      listed.jobs.slice(0, JOB_POSTING_LIMIT).map((job) => getJobForListItem(db, tenantId, job)),
    )
  ).filter((job): job is JobDetail => job !== null);
  return { listed, newJobs, selected, details };
});

export async function generateMetadata(): Promise<Metadata> {
  const { newJobs } = await loadData();
  const month = catalogMonthLabel();
  const title = buildLandingTitle({ headline: "Highest paying Web3 jobs", month, newJobs });
  return {
    title,
    description: `Web3 jobs on Nodework sorted by published maximum salary for ${month}. Listings without a pay band are omitted.`,
    alternates: { canonical: PATH },
  };
}

export default async function HighestPayingWeb3JobsPage() {
  const { listed, newJobs, selected, details } = await loadData();
  const month = catalogMonthLabel();
  const title = buildLandingTitle({ headline: "Highest paying Web3 jobs", month, newJobs });
  const top = listed.jobs[0] ?? null;
  const topSalary = top ? top.salaryText ?? formatSalaryRange(top.salaryMin, top.salaryMax) : null;

  const origin = requestOrigin(await headers());
  const blogPostingJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description: `The Web3 jobs on Nodework with the highest published maximum salary for ${month}.`,
    url: absoluteUrl(PATH),
    dateModified: new Date().toISOString(),
    author: { "@type": "Organization", name: "Nodework" },
    publisher: { "@type": "Organization", name: "Nodework" },
  };

  return (
    <main className="surface surface--data board-main">
      <JsonLd data={blogPostingJsonLd} />
      {details.map((job) => (
        <JsonLd data={buildJobPostingJsonLd(job, origin)} key={job.id} />
      ))}
      <header className="board-hero">
        <Breadcrumbs
          items={[
            { href: "/jobs", label: "Jobs" },
            { href: "/web3-salaries", label: "Web3 salaries" },
            { label: "Highest paying jobs" },
          ]}
        />
        <h1>{title}</h1>
        <p className="lead">
          Roles that published a salary band, ordered by the top of that band. A high range
          is not an offer. Read the listing for equity, location, and seniority.
        </p>
        {top && topSalary ? (
          <p className="lead">
            The highest published salary right now is {topSalary} for {top.title} at{" "}
            {top.companyName}.
          </p>
        ) : null}
        <BoardSearch remoteHref="/remote-jobs" />
        <TagChips />
        <p className="count">
          <span className="jobs-num">{listed.total}</span> jobs found
        </p>
      </header>
      <JobBoard
        emptyMessage="No jobs with a published salary band yet."
        jobs={listed.jobs}
        selected={selected}
      />
      <section className="container">
        <p className="cluster" style={{ marginTop: 24 }}>
          <Link className="text-link" href="/web3-salaries">
            Salary tables
          </Link>
        </p>
      </section>
      <RelatedBrowseLinks />
    </main>
  );
}
