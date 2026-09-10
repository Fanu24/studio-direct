import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { headers } from "next/headers";

import { BoardSearch, remoteFilterHref } from "./_components/board-chrome";
import { CatalogPager, catalogPageNumber } from "./_components/catalog-jobs";
import { HomeMegaLinks } from "./_components/home-mega";
import { JobBoard } from "./_components/job-board";
import { TagChips } from "./_components/job-row";
import { JsonLd, absoluteUrl } from "./_components/json-ld";
import { homepageSummary } from "../lib/copy";
import { buildJobPostingJsonLd } from "../lib/jobs/jsonld";
import {
  countHiringCompanies,
  getJobsForListItems,
  listJobs,
  type JobDetail,
  type JobsDatabase,
} from "../lib/jobs/queries";
import { requireTenantId } from "../lib/tenant";

export const revalidate = 300;
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await requireTenantId(db);
  const [listed, companyCount] = await Promise.all([
    listJobs(db, tenantId, { pageSize: 1 }),
    countHiringCompanies(db, tenantId),
  ]);

  return {
    title: {
      absolute: "Nodework: Web3, blockchain and crypto jobs",
    },
    description: homepageSummary(listed.total, companyCount),
    alternates: { canonical: "/" },
  };
}

function requestOrigin(requestHeaders: Headers) {
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host");

  if (!host) {
    throw new Error("Request host was not found");
  }

  const forwardedProto = requestHeaders
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const protocol = forwardedProto === "http" ? "http" : "https";

  return `${protocol}://${host}`;
}

function homeSiteJsonLd() {
  const origin = absoluteUrl("/");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Nodework",
        url: origin,
      },
      {
        "@type": "WebSite",
        name: "Nodework",
        url: origin,
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${absoluteUrl("/jobs")}?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; job?: string }>;
}) {
  const query = await searchParams;
  const page = catalogPageNumber(query.page);
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await requireTenantId(db);
  const [listed, companyCount] = await Promise.all([
    listJobs(db, tenantId, { pageSize: 20, page }),
    countHiringCompanies(db, tenantId),
  ]);
  const jobDetails = await getJobsForListItems(db, tenantId, listed.jobs);
  const selected = jobDetails[0] ?? null;
  const origin = requestOrigin(await headers());

  return (
    <main className="surface surface--stage home-main">
      <JsonLd data={homeSiteJsonLd()} />
      {jobDetails
        .filter((job): job is JobDetail => job !== null)
        .map((job) => (
          <JsonLd data={buildJobPostingJsonLd(job, origin)} key={job.id} />
        ))}
      <section className="home-hero m-reveal m-reveal--now m-sheen" data-reveal>
        <div className="container">
          <h1 className="display display--sm">Web3 Jobs</h1>
          <p className="lead m-reveal m-reveal--now" data-reveal data-reveal-delay="1">
            {homepageSummary(listed.total, companyCount)}
          </p>
          {/* Stats band folded into the hero: two numbers, one line, not a
              section of its own. Reveals with the lead line above it. */}
          <div className="stats-grid m-reveal m-reveal--now" data-reveal data-reveal-delay="1">
            {listed.total > 0 ? (
              <div className="stat">
                <div className="stat__value m-count" data-reveal>
                  <span>{listed.total.toLocaleString("en-US")}</span>
                </div>
                <div className="stat__label">live Web3 jobs</div>
              </div>
            ) : null}
            {companyCount > 0 ? (
              <div className="stat">
                <div className="stat__value m-count" data-reveal>
                  <span>{companyCount.toLocaleString("en-US")}</span>
                </div>
                <div className="stat__label">hiring companies</div>
              </div>
            ) : null}
          </div>
          <div className="home-hero__search m-reveal m-reveal--now" data-reveal data-reveal-delay="2">
            <BoardSearch remoteHref={remoteFilterHref()} />
          </div>
          <div className="m-reveal m-reveal--now" data-reveal data-reveal-delay="3">
            <TagChips />
          </div>
        </div>
      </section>

      <div className="home-sections">
        {/* Job board: this is the page, per web3.career's own header row. */}
        <section className="home-section m-reveal" data-reveal data-reveal-delay="1">
          <div className="container">
            <JobBoard
              emptyMessage="No roles are listed right now. New ones appear here as soon as we index them."
              details={jobDetails}
              jobs={listed.jobs}
              pickedId={query.job ?? null}
              pager={<CatalogPager path="/" result={listed} />}
              selected={selected}
            />
          </div>
        </section>

        {/* Mega links: the SEO links block. */}
        <section className="home-section m-reveal" data-reveal data-reveal-delay="2">
          <HomeMegaLinks />
        </section>
      </div>
    </main>
  );
}
