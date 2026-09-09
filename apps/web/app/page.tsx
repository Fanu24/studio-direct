import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { headers } from "next/headers";

import { BoardSearch, remoteFilterHref } from "./_components/board-chrome";
import { CatalogPager, catalogPageNumber } from "./_components/catalog-jobs";
import {
  HomeCareerFaq,
  HomeMegaLinks,
  HomeReviews,
  ProfileBanner,
  homeCareerFaq,
} from "./_components/home-mega";
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

function homeFaqJsonLd(jobCount: number) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: homeCareerFaq(jobCount).map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
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
    <main className="board-main">
      <JsonLd data={homeSiteJsonLd()} />
      <JsonLd data={homeFaqJsonLd(listed.total)} />
      {jobDetails
        .filter((job): job is JobDetail => job !== null)
        .map((job) => (
          <JsonLd data={buildJobPostingJsonLd(job, origin)} key={job.id} />
        ))}
      <section className="board-hero board-hero--home">
        <h1>Web3 Jobs</h1>
        <p className="lead">{homepageSummary(listed.total, companyCount)}</p>
        <BoardSearch remoteHref={remoteFilterHref()} />
        <TagChips />
        <ProfileBanner />
      </section>
      <JobBoard
        emptyMessage="No jobs imported yet. Connect WEB3_CAREER_API_TOKEN and run the crawler."
        details={jobDetails}
        jobs={listed.jobs}
        pickedId={query.job ?? null}
        pager={<CatalogPager path="/" result={listed} />}
        selected={selected}
      />
      <HomeMegaLinks />
      <HomeReviews />
      <HomeCareerFaq jobCount={listed.total} />
    </main>
  );
}
