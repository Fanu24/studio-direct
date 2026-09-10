import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { headers } from "next/headers";

import { BoardSearch, remoteFilterHref } from "./_components/board-chrome";
import { CatalogPager, catalogPageNumber } from "./_components/catalog-jobs";
import { HomeMegaLinks } from "./_components/home-mega";
import { JobBoard } from "./_components/job-board";
import { TagChips } from "./_components/job-row";
import { JsonLd, absoluteUrl } from "./_components/json-ld";
import { LINKEDIN_EXCLUSIVITY_TOOLTIP, homepageSummary } from "../lib/copy";
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
          {/* Title, count, search. Nothing else above the jobs: the board has
              to be on screen when the page arrives, and every line here costs
              rows. The counts used to be said twice - once in a lead sentence
              and again in a two-number band - so they are said once now. */}
          <h1 className="display display--sm">Web3 Jobs</h1>
          <p className="home-hero__count">
            <strong>{listed.total.toLocaleString("en-US")}</strong>{" "}
            {listed.total === 1 ? "live Web3 job" : "live Web3 jobs"}
            {companyCount > 0 ? (
              <>
                {" at "}
                <strong>{companyCount.toLocaleString("en-US")}</strong>{" "}
                {companyCount === 1 ? "hiring company" : "hiring companies"}
              </>
            ) : null}
          </p>
          <div className="home-hero__search">
            <BoardSearch remoteHref={remoteFilterHref()} />
          </div>
          {/* The tag chips narrow the board, so they belong next to the search
              that does the same job - not under the results they filter. The
              compact set plus "Show more" keeps this to one or two rows, which
              is what the jobs can afford above the fold. */}
          <TagChips />
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
            {/* The only visible (non-title-attribute) home for what the "Not on
                LinkedIn" badge means - a title= tooltip is invisible on touch.
                It sits under the board rather than over it: it explains a badge
                in the rows, and above them it was 51px between the search and
                the first job. */}
            <p className="small muted">{LINKEDIN_EXCLUSIVITY_TOOLTIP}</p>
          </div>
        </section>

        <section className="home-section m-reveal" data-reveal data-reveal-delay="2">
          <HomeMegaLinks />
        </section>
      </div>
    </main>
  );
}
