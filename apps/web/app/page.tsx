import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { headers } from "next/headers";

import { BoardSearch, remoteFilterHref } from "./_components/board-chrome";
import { CatalogPager, catalogPageNumber } from "./_components/catalog-jobs";
import { CareerPagesTheater } from "./_components/theaters/career-pages-theater";
import { OneBoardTheater } from "./_components/theaters/one-board-theater";
import { SearchTheater } from "./_components/theaters/search-theater";
import { FeatureRow } from "./_components/home/feature-row";
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
import { LINKEDIN_EXCLUSIVITY_TOOLTIP, homepageSummary } from "../lib/copy";
import { PRICING_COPY } from "../lib/legal/copy";
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
    <main className="surface surface--stage home-main">
      <JsonLd data={homeSiteJsonLd()} />
      <JsonLd data={homeFaqJsonLd(listed.total)} />
      {jobDetails
        .filter((job): job is JobDetail => job !== null)
        .map((job) => (
          <JsonLd data={buildJobPostingJsonLd(job, origin)} key={job.id} />
        ))}
      <section className="home-hero m-reveal m-sheen" data-reveal>
        <div className="container">
          <h1 className="display display--sm">Web3 Jobs</h1>
          <p className="lead m-reveal" data-reveal data-reveal-delay="1">
            {homepageSummary(listed.total, companyCount)}
          </p>
          <div className="home-hero__search m-reveal" data-reveal data-reveal-delay="2">
            <BoardSearch remoteHref={remoteFilterHref()} />
          </div>
          <div className="m-reveal" data-reveal data-reveal-delay="3">
            <TagChips />
          </div>
        </div>
      </section>

      <div className="home-sections">
        {/* Stats band */}
        <section className="home-section home-stats m-reveal" data-reveal data-reveal-delay="1">
          <div className="container">
            <div className="stats-grid">
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
          </div>
        </section>

        {/* Wedge section: jobs from career pages, not on LinkedIn */}
        <section className="home-section m-reveal" data-reveal data-reveal-delay="2">
          <div className="container">
            <FeatureRow
              kicker="The differentiator"
              title="Jobs posted only on studio career pages"
              theater={<CareerPagesTheater />}
              caption="Roles scraped from studio career pages"
              videoTitle="Jobs from studio career pages"
              reverse={true}
            >
              <p>
                Studios post roles on their own career pages first. We index those
                pages directly, then check each role against LinkedIn. Where it does
                not turn up, the listing carries a{" "}
                <span className="badge badge--honest">Not on LinkedIn</span> badge.
              </p>
              <p className="muted">{LINKEDIN_EXCLUSIVITY_TOOLTIP}</p>
              <p className="text-link">
                <a href="/hidden-jobs">See the roles we did not find on LinkedIn</a>
              </p>
            </FeatureRow>
          </div>
        </section>

        {/* Job board */}
        <section className="home-section m-reveal" data-reveal data-reveal-delay="3">
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

        {/* Browse feature */}
        <section className="home-section m-reveal" data-reveal data-reveal-delay="4">
          <div className="container">
            <FeatureRow
              kicker="Discovery"
              title="Browse, filter, and search all at once"
              theater={<OneBoardTheater />}
              caption="Browsing and filtering jobs"
              videoTitle="Browse and filter jobs"
            >
              <p>
                Every filter combination is its own URL. Remote plus Rust plus junior is a page you can bookmark, send to a friend, and open next week. No account required.
              </p>
            </FeatureRow>
          </div>
        </section>

        {/* Search feature */}
        <section className="home-section m-reveal" data-reveal data-reveal-delay="5">
          <div className="container">
            <FeatureRow
              kicker="Searchable"
              title="Keyword search across the whole catalog"
              theater={<SearchTheater />}
              caption="Searching the jobs board"
              videoTitle="Search jobs by keyword"
              reverse={true}
            >
              <p>
                Search any phrase. Studios, skills, titles, locations. Results update as you type.
              </p>
            </FeatureRow>
          </div>
        </section>

        {/* Salaries teaser */}
        <section className="home-section m-reveal" data-reveal data-reveal-delay="6">
          <div className="container">
            <div className="teaser">
              <h2>Salary data from real jobs</h2>
              <p>
                When studios post salary bands, we index them. Filter by role, region, and seniority to see what Web3 companies are paying.
              </p>
              <a className="button button--primary m-lift" href="/web3-salaries">
                Explore salary bands
              </a>
            </div>
          </div>
        </section>

        {/* Companies teaser */}
        <section className="home-section m-reveal" data-reveal data-reveal-delay="7">
          <div className="container">
            <div className="teaser">
              <h2>The studios in the index</h2>
              <p>
                See which studios are hiring and rank them by headcount, the roles they post most, and how much they paid in their last job ads.
              </p>
              <a className="button button--primary m-lift" href="/web3-companies">
                Explore companies
              </a>
            </div>
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="home-section m-reveal" data-reveal data-reveal-delay="8">
          <div className="container">
            <div className="teaser teaser--notice">
              <h2>{PRICING_COPY.title}</h2>
              <p>{PRICING_COPY.billingNotLive}</p>
            </div>
          </div>
        </section>

        {/* Mega links */}
        <section className="home-section m-reveal" data-reveal data-reveal-delay="9">
          <HomeMegaLinks />
        </section>

        {/* Reviews */}
        <section className="home-section m-reveal" data-reveal data-reveal-delay="10">
          <HomeReviews />
        </section>

        {/* FAQ */}
        <section className="home-section m-reveal" data-reveal data-reveal-delay="11">
          <HomeCareerFaq jobCount={listed.total} />
        </section>

        {/* Profile banner */}
        <section className="home-section m-reveal" data-reveal data-reveal-delay="12">
          <div className="container">
            <ProfileBanner />
          </div>
        </section>
      </div>
    </main>
  );
}
