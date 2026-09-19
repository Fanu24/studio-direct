import { SENIORITY_SLUGS, tagLabel } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";

import {
  BoardFaq,
  BoardSearch,
  RelatedBrowseLinks,
  catalogMonthLabel,
  remoteFilterHref,
  roleFaqItem,
} from "../_components/board-chrome";
import { JobBoard } from "../_components/job-board";
import { TagChips } from "../_components/job-row";
import { JsonLd } from "../_components/json-ld";
import { LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../../lib/copy";
import { buildLandingDescription, buildLandingTitle } from "../../lib/jobs/landing-meta";
import {
  countNewJobs,
  getJobsForListItems,
  listJobs,
  type JobListFilters,
  type JobsDatabase,
} from "../../lib/jobs/queries";
import { requireTenantId } from "../../lib/tenant";

// Read live D1 data at request time; builds must not depend on a local database.
export const dynamic = "force-dynamic";

type SearchValue = string | string[] | undefined;
type JobsSearchParams = Record<string, SearchValue>;

function first(value: SearchValue) {
  return Array.isArray(value) ? value[0] : value;
}

function positiveNumber(value: SearchValue) {
  const parsed = Number(first(value));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

/**
 * Cached per request on its primitive arguments, so generateMetadata and the
 * page component - which resolve the same searchParams independently - only
 * pay for listJobs/getJobForListItem/countNewJobs once instead of twice.
 */
const loadJobsData = cache(
  async (
    q: string | undefined,
    company: string | undefined,
    seniority: string | undefined,
    tag: string | undefined,
    remoteOnly: boolean,
    source: string | undefined,
    hidden: boolean,
    page: number | undefined,
    pageSize: number | undefined,
  ) => {
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
    const tenantId = await requireTenantId(db);
    const filters: JobListFilters = {
      q,
      company,
      seniority,
      tag,
      remoteOnly,
      source,
      hidden,
      page,
      pageSize,
    };
    const result = await listJobs(db, tenantId, filters);
    // One query for every row's detail, not one per row: the board needs them all to
    // switch panes without navigating, and `selected` is just the first of them.
    const details = await getJobsForListItems(db, tenantId, result.jobs);
    const selected = details[0] ?? null;
    const newJobs = await countNewJobs(db, tenantId, filters, 24);
    return { filters, result, selected, details, newJobs };
  },
);

function loadJobs(params: JobsSearchParams) {
  return loadJobsData(
    first(params.q),
    first(params.company),
    first(params.seniority),
    first(params.tag),
    first(params.remote) === "1",
    first(params.source),
    first(params.hidden) === "1",
    positiveNumber(params.page),
    positiveNumber(params.pageSize),
  );
}

/** Seniority chips: the fixed, enumerable facet - unlike company, which is open-ended and
 * only ever shown as an already-active, removable chip in the filter ribbon below. */
const SENIORITY_OPTIONS = SENIORITY_SLUGS.map((slug) => ({ slug, label: tagLabel(slug) }));

/**
 * Toggle one query param on `/jobs`, preserving every other filter and dropping `page`
 * (a changed filter invalidates whatever page you were on). Selecting the same value
 * again clears it, so every filter chip in the bar also acts as its own "off" switch.
 */
function toggleFilterHref(searchParams: JobsSearchParams, key: string, value: string): string {
  const params = new URLSearchParams();
  const isActive = first(searchParams[key]) === value;

  for (const [k, v] of Object.entries(searchParams)) {
    if (k === "page" || k === key || v === undefined) continue;
    for (const item of Array.isArray(v) ? v : [v]) params.append(k, item);
  }
  if (!isActive) params.set(key, value);

  const query = params.toString();
  return query ? `/jobs?${query}` : "/jobs";
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<JobsSearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const page = positiveNumber(params.page) ?? 1;
  const { result, newJobs } = await loadJobs(params);
  const month = catalogMonthLabel();
  const title = buildLandingTitle({ headline: "Web3 Jobs", month, newJobs });
  const description = buildLandingDescription({
    topic: "web3, blockchain and crypto jobs",
    month,
    total: result.total,
    salaryRange: null,
    jobs: result.jobs,
  });
  return {
    title,
    description,
    alternates: { canonical: "/jobs" },
    robots:
      page > 1 ? { index: false, follow: true } : { index: true, follow: true },
  };
}

function pageHref(searchParams: JobsSearchParams, page: number) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "page" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      params.append(key, item);
    }
  }

  params.set("page", String(page));
  return `/jobs?${params.toString()}`;
}

/**
 * Prefix a row links to in order to select itself: the current filters and page kept,
 * any previous selection dropped, ready for the job id to be appended.
 */
function selectPrefix(searchParams: JobsSearchParams, page: number) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "page" || key === "job" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      params.append(key, item);
    }
  }

  params.set("page", String(page));
  return `/jobs?${params.toString()}&job=`;
}

/** Href for the current search with one filter dropped, so each chip can remove itself. */
function withoutFilter(searchParams: JobsSearchParams, drop: string) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === drop || key === "page" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      params.append(key, item);
    }
  }

  const query = params.toString();
  return query ? `/jobs?${query}` : "/jobs";
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<JobsSearchParams>;
}) {
  const params = await searchParams;
  const { filters, result, selected, details } = await loadJobs(params);
  const featured = roleFaqItem(undefined, { total: result.total });

  const activeChips = [
    filters.q ? { key: "q", label: `Search: ${filters.q}` } : null,
    filters.company ? { key: "company", label: `Company: ${filters.company}` } : null,
    filters.seniority ? { key: "seniority", label: `Title: ${tagLabel(filters.seniority)}` } : null,
    filters.tag ? { key: "tag", label: `Tag: ${filters.tag}` } : null,
    filters.remoteOnly ? { key: "remote", label: "Remote" } : null,
    filters.source ? { key: "source", label: "Direct from career pages" } : null,
    filters.hidden ? { key: "hidden", label: "Not on LinkedIn" } : null,
  ].filter((chip): chip is { key: string; label: string } => chip !== null);

  return (
    <main className="surface surface--data board-main">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: featured.question,
              acceptedAnswer: { "@type": "Answer", text: featured.answer },
            },
          ],
        }}
      />
      <header className="board-hero">
        <h1>Web3 Jobs</h1>
        <p className="lead">{catalogMonthLabel()}</p>
        <p className="count">
          <span className="jobs-num">{result.total.toLocaleString("en-US")}</span>{" "}
          {result.total === 1 ? "job found" : "jobs found"}
        </p>
        <BoardSearch defaultQuery={filters.q} remoteActive={filters.remoteOnly} remoteHref={toggleFilterHref(params,'remote','1')} />
        <div
          aria-label="Filter by seniority, source or LinkedIn visibility"
          className="jobs-chip-track"
          role="group"
        >
          {SENIORITY_OPTIONS.map((option) => (
            <Link
              className={`chip${filters.seniority === option.slug ? " chip--active" : ""}`}
              href={toggleFilterHref(params, "seniority", option.slug)}
              key={option.slug}
            >
              {option.label}
            </Link>
          ))}
          <span aria-hidden="true" className="jobs-chip-track__sep" />
          <Link
            className={`chip${filters.source === "career_page" ? " chip--active" : ""}`}
            href={toggleFilterHref(params, "source", "career_page")}
          >
            Direct from career pages
          </Link>
          <Link
            className={`chip${filters.hidden ? " chip--active" : ""}`}
            href={toggleFilterHref(params, "hidden", "1")}
            title={LINKEDIN_EXCLUSIVITY_TOOLTIP}
          >
            Not on LinkedIn
          </Link>
        </div>
        <TagChips active={filters.tag} />
      </header>

      {activeChips.length > 0 ? (
        <div className="jobs-active">
          <span className="tag">
            Filters
            <span className="count jobs-active__count">
              {result.total.toLocaleString("en-US")} match
            </span>
          </span>
          {activeChips.map((chip) => (
            <Link className="chip chip--active" href={withoutFilter(params, chip.key)} key={chip.key}>
              {chip.label}
              <span aria-hidden="true">×</span>
              <span className="visually-hidden">Remove this filter</span>
            </Link>
          ))}
          <Link className="jobs-active__clear" href="/jobs">
            Clear filters
          </Link>
        </div>
      ) : null}

      <JobBoard
        emptyActions={
          <Link className="button button--ghost" href="/jobs">
            Clear all filters
          </Link>
        }
        emptyMessage="Nothing matches this search yet. Try a broader keyword, drop a filter above, or clear them all to see the full board."
        jobs={result.jobs}
        pager={
          result.totalPages > 1 ? (
            <nav aria-label="Jobs pagination" className="pager">
              {result.page > 1 ? (
                <Link href={pageHref(params, result.page - 1)}>Previous</Link>
              ) : null}
              <span aria-current="page">
                Page {result.page} of {result.totalPages}
              </span>
              {result.page < result.totalPages ? (
                <Link href={pageHref(params, result.page + 1)} rel="next">
                  Next
                </Link>
              ) : null}
            </nav>
          ) : null
        }
        details={details}
        pickedId={first(params.job) ?? null}
        selectHref={selectPrefix(params, result.page)}
        selected={selected}
      />
      <BoardFaq featured={featured} items={[]} />
      <RelatedBrowseLinks />
    </main>
  );
}
