import { HUB_ROLE_SLUGS } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";

import { HubLinks } from "../_components/hub-links";
import { ArrowRightIcon, SearchIcon } from "../_components/icons";
import { JobCardGrid } from "../_components/job-card";
import { LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../../lib/copy";
import {
  listJobs,
  type JobListFilters,
  type JobsDatabase,
} from "../../lib/jobs/queries";

export const metadata: Metadata = {
  title: "Remote and hybrid gaming jobs",
  description:
    "Search remote and hybrid jobs at game studios, collected from studio career pages. Filter by studio, seniority and source, and see which roles are not posted on LinkedIn.",
  alternates: { canonical: "/jobs" },
};

export const revalidate = 300;

type SearchValue = string | string[] | undefined;
type JobsSearchParams = Record<string, SearchValue>;

const SOURCE_OPTIONS = [
  { value: "", label: "Any source" },
  { value: "career_page", label: "Studio career page" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "indeed", label: "Indeed" },
] as const;

function first(value: SearchValue) {
  return Array.isArray(value) ? value[0] : value;
}

function positiveNumber(value: SearchValue) {
  const parsed = Number(first(value));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
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

function sourceLabel(value: string) {
  return SOURCE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<JobsSearchParams>;
}) {
  const params = await searchParams;
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await db
    .prepare("SELECT id FROM tenants WHERE slug = ?")
    .bind("gaming")
    .first<string>("id");

  if (!tenantId) {
    throw new Error("Gaming tenant was not found");
  }

  const filters: JobListFilters = {
    hidden: first(params.hidden) === "1",
    q: first(params.q),
    company: first(params.company),
    seniority: first(params.seniority),
    source: first(params.source),
    page: positiveNumber(params.page),
    pageSize: positiveNumber(params.pageSize),
  };
  const result = await listJobs(db, tenantId, filters);

  const activeChips = [
    filters.q ? { key: "q", label: `Search: ${filters.q}` } : null,
    filters.company ? { key: "company", label: `Studio: ${filters.company}` } : null,
    filters.seniority ? { key: "seniority", label: `Title: ${filters.seniority}` } : null,
    filters.source
      ? { key: "source", label: `Source: ${sourceLabel(filters.source)}` }
      : null,
    filters.hidden ? { key: "hidden", label: "Not posted on LinkedIn" } : null,
  ].filter((chip): chip is { key: string; label: string } => chip !== null);

  return (
    <main>
      <header className="page-header">
        <span className="kicker">The catalog</span>
        <h1>Remote and hybrid gaming jobs</h1>
        <p className="lead">
          Public, listed roles collected from studio career pages. Read the full
          description here, then apply on the studio site.
        </p>
      </header>

      <form action="/jobs" className="jobs-filters" method="get" role="search">
        <div className="jobs-filters__search">
          <label className="visually-hidden" htmlFor="jobs-q">
            Search jobs
          </label>
          <div className="jobs-filters__field">
            <SearchIcon size={18} />
            <input
              defaultValue={filters.q}
              id="jobs-q"
              name="q"
              placeholder="Gameplay engineer, Unreal, live ops"
              type="search"
            />
          </div>
          <button className="button" type="submit">
            Filter jobs
          </button>
        </div>

        <div className="jobs-filters__row">
          <label htmlFor="jobs-company">
            <span>Studio</span>
            <input
              defaultValue={filters.company}
              id="jobs-company"
              name="company"
              placeholder="Any studio"
            />
          </label>
          <label htmlFor="jobs-seniority">
            <span>Seniority in title</span>
            <input
              defaultValue={filters.seniority}
              id="jobs-seniority"
              name="seniority"
              placeholder="Senior"
            />
          </label>
          <label htmlFor="jobs-source">
            <span>Source</span>
            <select defaultValue={filters.source ?? ""} id="jobs-source" name="source">
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value || "any"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="check jobs-filters__check">
            <input
              defaultChecked={filters.hidden}
              name="hidden"
              type="checkbox"
              value="1"
            />
            <span title={LINKEDIN_EXCLUSIVITY_TOOLTIP}>Not posted on LinkedIn</span>
          </label>
        </div>
      </form>

      {activeChips.length > 0 ? (
        <div className="jobs-active">
          <span className="tag">Filters</span>
          {activeChips.map((chip) => (
            <Link className="chip chip--on" href={withoutFilter(params, chip.key)} key={chip.key}>
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

      <section aria-label="Search results" className="jobs-results">
        <div className="jobs-results__head">
          <p aria-live="polite" className="count">
            <span className="jobs-num">{result.total}</span>{" "}
            {result.total === 1 ? "job" : "jobs"}
            {result.totalPages > 1 ? ` · page ${result.page} of ${result.totalPages}` : ""}
          </p>
          <div className="jobs-results__aside">
            <span className="tag">Newest first</span>
          </div>
        </div>

        <JobCardGrid
          emptyActions={
            <>
              <Link className="button button--secondary" href="/jobs">
                Clear filters
              </Link>
              <Link className="text-link" href="/hidden-jobs">
                Jobs not on LinkedIn
                <ArrowRightIcon size={16} />
              </Link>
            </>
          }
          emptyMessage="No jobs match these filters. Try a broader search, or drop one filter."
          headingLevel="h2"
          jobs={result.jobs}
        />

        {result.totalPages > 1 ? (
          <nav aria-label="Jobs pagination" className="pager">
            {result.page > 1 ? (
              <Link href={pageHref(params, result.page - 1)}>Previous</Link>
            ) : null}
            <span>
              Page {result.page} of {result.totalPages}
            </span>
            {result.page < result.totalPages ? (
              <Link href={pageHref(params, result.page + 1)}>Next</Link>
            ) : null}
          </nav>
        ) : null}
      </section>

      <section aria-labelledby="jobs-by-role" className="jobs-more">
        <div className="jobs-more__head">
          <div>
            <h2 id="jobs-by-role">Browse by role</h2>
            <p>Every role hub lists the remote and hybrid jobs that match it.</p>
          </div>
          <Link className="text-link" href="/roles">
            All {HUB_ROLE_SLUGS.length} roles
            <ArrowRightIcon size={16} />
          </Link>
        </div>
        <HubLinks limit={9} />
      </section>
    </main>
  );
}
