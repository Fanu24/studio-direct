import {landingSearchState} from '../../lib/jobs/search-state';
import {
  formatSalaryRange,
  isSalaryRole,
  landingFaq,
  landingHeadline,
  landingPath,
  landingTitle,
  parseLandingSegment,
  tagLabel,
  type LandingKind,
} from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import { CatalogPager } from "../_components/catalog-jobs";
import {
  BoardFaq,
  BoardSearch,
  catalogMonthLabel,
  remoteToggleState,
  roleFaqItem,
  salaryHrefForTag,
} from "../_components/board-chrome";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { JobBoard } from "../_components/job-board";
import { TagChips } from "../_components/job-row";
import { JsonLd } from "../_components/json-ld";
import { buildJobPostingJsonLd } from "../../lib/jobs/jsonld";
import { landingComboRedirect } from "../../lib/jobs/landing-canonical";
import { buildLandingDescription, buildLandingTitle } from "../../lib/jobs/landing-meta";
import {
  buildLandingRelatedLinks,
  buildLandingStats,
} from "../../lib/jobs/landing-sections";
import {
  countNewJobs,
  getJobForListItem,
  getSalaryRollup,
  landingIndexable,
  listLandingJobs,
  type JobDetail,
  type JobListFilters,
  type JobsDatabase,
  type SalaryRollupRow,
} from "../../lib/jobs/queries";
import { requireTenantId } from "../../lib/tenant";

// Read live D1 data at request time; builds must not depend on a local database.
export const dynamic = "force-dynamic";

type LandingParams = Promise<{ slug: string }>;
type LandingSearch = Promise<{ page?: string }>;

function pageNumber(value: string | undefined) {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function requestOrigin(requestHeaders: Headers) {
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host");
  if (!host) throw new Error("Request host was not found");
  const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto === "http" ? "http" : "https";
  return `${protocol}://${host}`;
}

function featuredTag(landing: ReturnType<typeof parseLandingSegment>) {
  if (!landing) return undefined;
  if (landing.kind === "tag" || landing.kind === "remote-tag") return landing.tag;
  if (landing.kind === "intern") return "intern";
  if (landing.kind === "entry-level") return "entry-level";
  if (landing.kind === "benefit") return landing.benefit;
  return undefined;
}

/**
 * Mirrors queries.ts's private landingFilters (listLandingJobs already
 * applies it) so countNewJobs - which needs its own filters argument - can
 * reuse the exact same WHERE-shape without that internal helper being
 * exported. Keep in sync with listLandingJobs's mapping if it ever changes.
 */
function landingCountFilters(landing: LandingKind): JobListFilters {
  switch (landing.kind) {
    case "tag":
      return landing.tags.length > 1 ? { tags: landing.tags } : { tag: landing.tag };
    case "remote":
      return { remoteOnly: true };
    case "remote-tag":
      return landing.tags.length > 1
        ? { tags: landing.tags, remoteOnly: true }
        : { tag: landing.tag, remoteOnly: true };
    case "city":
    case "country":
    case "region":
      return {
        locationSlug:
          landing.kind === "city"
            ? landing.city
            : landing.kind === "country"
              ? landing.country
              : landing.region,
      };
    case "benefit":
      return { benefit: landing.benefit };
    case "intern":
      return { tag: "intern" };
    case "entry-level":
      return { tag: "entry-level" };
  }
}

/**
 * Cached per request (by segment + page, both primitives) so generateMetadata
 * and the page component - which both need the same landing data - only pay
 * for the listing query, the per-row description fetch and the rollup/new-
 * jobs lookups once instead of twice.
 */
const loadLanding = cache(async (segment: string, page: number) => {
  const landing = parseLandingSegment(segment);
  if (!landing) return null;
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await requireTenantId(db);
  const result = await listLandingJobs(db, tenantId, landing, page);

  // One JobPosting block per rendered row needs each row's full description,
  // which the list query doesn't carry - fetch them in parallel rather than
  // sequentially, same lookup already used below for `selected`.
  const rawDetails = await Promise.all(
    result.jobs.map((job) => getJobForListItem(db, tenantId, job)),
  );
  const selected = rawDetails[0] ?? null;
  const details = rawDetails.filter((detail): detail is JobDetail => detail !== null);

  let rollup: SalaryRollupRow | null = null;
  // A dev+senior combo must not silently show the single-tag "dev-developer"
  // rollup for a slice that's actually narrower than that.
  if (landing.kind === "tag" && landing.tags.length === 1) {
    const role = `${landing.tag}-developer`;
    if (isSalaryRole(role)) {
      rollup = await getSalaryRollup(db, "role", role);
    }
  } else if (landing.kind === "country") {
    rollup = await getSalaryRollup(db, "country", landing.country);
  } else if (landing.kind === "region") {
    rollup = await getSalaryRollup(db, "region", landing.region);
  } else if (landing.kind === "city") {
    rollup = await getSalaryRollup(db, "city", landing.city);
  }

  // 24h drives the "(N New)" title suffix; 168h is the stats block's
  // "posted this week" cell. Two counts, one WHERE-shape.
  const countFilters = landingCountFilters(landing);
  const [newJobs, newThisWeek] = await Promise.all([
    countNewJobs(db, tenantId, countFilters, 24),
    countNewJobs(db, tenantId, countFilters, 24 * 7),
  ]);

  return { landing, result, rollup, selected, details, newJobs, newThisWeek };
});

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: LandingParams;
  searchParams: LandingSearch;
}): Promise<Metadata> {
  const page = pageNumber((await searchParams).page);
  const loaded = await loadLanding((await params).slug, page);
  if (!loaded) notFound();
  const { landing, result, rollup, newJobs } = loaded;
  const month = catalogMonthLabel();
  const salaryRange = rollup ? formatSalaryRange(rollup.min, rollup.max) : null;
  const title = buildLandingTitle({
    headline: landingHeadline(landing),
    month,
    newJobs,
  });
  const description = buildLandingDescription({
    topic: landingTitle(landing).toLowerCase(),
    month,
    total: result.total,
    salaryRange,
    jobs: result.jobs,
  });
  const indexable = page === 1 && landingIndexable(result.total);
  return {
    title,
    description,
    alternates: { canonical: landingPath(landing) },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default async function LandingPage({
  params,
  searchParams,
}: {
  params: LandingParams;
  searchParams: LandingSearch;
}) {
  const page = pageNumber((await searchParams).page);
  const segment = (await params).slug;

  // A combo URL written in the other facet order is the same slice: send it
  // to the one canonical spelling before doing any work, so the two orders
  // never both return 200. Page number rides along.
  const canonical = landingComboRedirect(segment);
  if (canonical) permanentRedirect(page > 1 ? `${canonical}?page=${page}` : canonical);

  const loaded = await loadLanding(segment, page);
  if (!loaded) notFound();

  const { landing, result, rollup, selected, details, newThisWeek } = loaded;
  const headline = landingHeadline(landing);
  const salaryRange = rollup ? formatSalaryRange(rollup.min, rollup.max) : null;
  const featured = roleFaqItem(landing, { total: result.total, salaryRange });
  const faq = landingFaq(landing, result.total, salaryRange);
  const path = landingPath(landing);
  const tag = featuredTag(landing);
  const benefit = landing.kind === "benefit" ? landing.benefit : undefined;
  const chipTags =
    landing.kind === "tag" || landing.kind === "remote-tag"
      ? landing.tags
      : tag
        ? [tag]
        : [];
  const chipRemote = landing.kind === "remote" || landing.kind === "remote-tag";
  const origin = requestOrigin(await headers());
  const jobPostings = details.map((job) => buildJobPostingJsonLd(job, origin));
  const stats = buildLandingStats({
    total: result.total,
    newThisWeek,
    salaryRange,
    averageSalary: rollup ? formatSalaryRange(rollup.avg, rollup.avg) : null,
    pricedRoles30d: rollup?.jobCount30d ?? null,
    jobs: result.jobs,
  });
  // A benefit landing's "tag" is the benefit slug, which is not a salary
  // role - hand salaryHrefForTag the benefit instead so it resolves through
  // its own mapping rather than looking up a role that does not exist.
  const salaryTag = landing.kind === "benefit" ? undefined : tag;
  const relatedLinks = buildLandingRelatedLinks(landing, {
    salaryHref: salaryHrefForTag(salaryTag, benefit),
    salaryLabel: salaryTag ? `${tagLabel(salaryTag)} salaries` : "Web3 salaries",
  });

  return (
    <main className="surface surface--data board-main">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [featured, ...faq].map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }}
      />
      {jobPostings.map((posting, index) => (
        <JsonLd data={posting} key={`jobposting-${index}`} />
      ))}
      <header className="board-hero">
        <Breadcrumbs
          items={[
            { href: "/jobs", label: "Jobs" },
            { label: headline },
          ]}
        />
        <h1>{headline}</h1>
        <p className="lead">
          {headline} pulled from the live Nodework catalog and refreshed for{" "}
          {catalogMonthLabel()}. Filter by tag below, or search the full board for something
          more specific.
        </p>
        <p className="count">
          <span className="jobs-num">{result.total.toLocaleString("en-US")}</span>{" "}
          {result.total === 1 ? "job found" : "jobs found"}
        </p>
        <BoardSearch
          filters={landingSearchState(landing)}
          remoteActive={remoteToggleState(landing).active}
          remoteHref={remoteToggleState(landing).href}
        />
        <TagChips active={chipTags} remote={chipRemote} filters={landingSearchState(landing)} />
      </header>
      <JobBoard
        emptyActions={
          <Link className="button button--secondary" href="/jobs">
            Browse all jobs
          </Link>
        }
        emptyMessage={`No ${landingTitle(landing).toLowerCase()} listed right now.`}
        jobs={result.jobs}
        pager={<CatalogPager path={path} result={result} />}
        selected={selected}
      />
      <section className="container jobs-more m-reveal" data-reveal>
        <div className="jobs-more__head">
          <div>
            <h2>{headline} by the numbers</h2>
            <p className="muted">
              Counted from the listed catalog for {catalogMonthLabel()}. Salary figures come
              from the rollup for this slice, not from the rows on screen.
            </p>
          </div>
        </div>
        <dl className="about-stats">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>
                <span className="about-stats__value">{stat.value}</span>
                <span>{stat.hint}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <BoardFaq featured={featured} items={faq} />
      <section className="container jobs-more m-reveal" data-reveal>
        <h2>Related pages</h2>
        <div className="cluster">
          {relatedLinks.map((link) => (
            <Link className="chip" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
