import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";

import { LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../../lib/copy";
import {
  listJobs,
  type JobListFilters,
  type JobsDatabase,
} from "../../lib/jobs/queries";

export const metadata: Metadata = {
  title: "Remote and hybrid gaming jobs | Studio Direct",
  description: "Browse listed remote and hybrid jobs from gaming studio career pages.",
};

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

  return (
    <main>
      <header>
        <Link href="/">Studio Direct</Link>
        <h1>Remote and hybrid gaming jobs</h1>
        <p>Public, listed roles collected from studio career pages.</p>
      </header>

      <form action="/jobs" method="get">
        <label>
          Search
          <input defaultValue={filters.q} name="q" placeholder="Gameplay engineer" />
        </label>
        <label>
          Company
          <input defaultValue={filters.company} name="company" />
        </label>
        <label>
          Seniority in title
          <input defaultValue={filters.seniority} name="seniority" placeholder="Senior" />
        </label>
        <label>
          Source
          <select defaultValue={filters.source ?? ""} name="source">
            <option value="">Any source</option>
            <option value="career_page">Studio career page</option>
            <option value="linkedin">LinkedIn</option>
            <option value="indeed">Indeed</option>
          </select>
        </label>
        <label>
          <input
            defaultChecked={filters.hidden}
            name="hidden"
            type="checkbox"
            value="1"
          />
          Not posted on LinkedIn
        </label>
        <button type="submit">Filter jobs</button>
      </form>

      <p aria-live="polite">
        {result.total} {result.total === 1 ? "job" : "jobs"}
      </p>

      {result.jobs.length === 0 ? (
        <p>No jobs match these filters.</p>
      ) : (
        <ul>
          {result.jobs.map((job) => (
            <li key={job.id}>
              <article>
                <h2>
                  <Link href={`/jobs/${job.slug}`}>{job.title}</Link>
                </h2>
                <p>
                  {job.companyName} · {job.remote}
                  {job.location ? ` · ${job.location}` : ""}
                </p>
                {job.salaryText ? <p>{job.salaryText}</p> : null}
                {job.exclusivity === "hidden_from_linkedin" ? (
                  <p title={LINKEDIN_EXCLUSIVITY_TOOLTIP}>Not posted on LinkedIn</p>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      )}

      {result.totalPages > 1 ? (
        <nav aria-label="Jobs pagination">
          {result.page > 1 ? <Link href={pageHref(params, result.page - 1)}>Previous</Link> : null}
          <span>
            Page {result.page} of {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={pageHref(params, result.page + 1)}>Next</Link>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}
