import { landingPath } from "@gaming/shared";
import type { Metadata } from "next";
import Link from "next/link";

import { BoardSearch, RelatedBrowseLinks, catalogMonthLabel } from "../_components/board-chrome";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { CatalogPager, catalogPageNumber, loadCatalogJobs } from "../_components/catalog-jobs";
import { JobBoard } from "../_components/job-board";
import { TagChips } from "../_components/job-row";

export const revalidate = 300;

const PATH = "/entry-developer-jobs";
const TITLE = "Entry developer jobs";
// Both facets required, unlike /intern-jobs (any category) or
// /entry-level-jobs (any category) - this is what makes the page a real
// intersection instead of a duplicate of either.
const FILTERS = { tags: ["dev", "entry-level"] };
const REMOTE_HREF = landingPath({ kind: "remote-tag", tag: "dev", tags: FILTERS.tags });

export async function generateMetadata(): Promise<Metadata> {
  const { result } = await loadCatalogJobs(FILTERS);
  const highlights = result.jobs
    .slice(0, 3)
    .map((job) => `${job.title} at ${job.companyName}`)
    .join(", ");
  const description = `${result.total} entry-level developer jobs on Nodework for ${catalogMonthLabel()}${
    highlights ? `, including ${highlights}.` : "."
  }`;
  return { title: TITLE, description, alternates: { canonical: PATH } };
}

type Search = Promise<{ page?: string }>;

export default async function EntryDeveloperJobsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const page = catalogPageNumber((await searchParams).page);
  const { result, selected } = await loadCatalogJobs({ ...FILTERS, page });

  return (
    <main className="surface surface--data board-main">
      <header className="board-hero">
        <Breadcrumbs
          items={[
            { href: "/jobs", label: "Jobs" },
            { label: TITLE },
          ]}
        />
        <h1>{TITLE}</h1>
        <p className="lead">
          Developer roles on Nodework tagged both dev and entry-level, so this stays a
          genuine intersection rather than a copy of intern jobs or entry-level jobs. Browse
          those two pages for the wider developer or entry-level pool.
        </p>
        <p className="count">
          <span className="jobs-num">{result.total}</span> jobs found
        </p>
        <BoardSearch remoteHref={REMOTE_HREF} />
        <p className="muted">{catalogMonthLabel()}</p>
        <div className="chips">
          <Link className="chip" href="/intern-jobs">
            Intern jobs
          </Link>
          <Link className="chip" href="/entry-level-jobs">
            Entry level jobs
          </Link>
          <Link className="chip" href="/most-popular-developer-jobs">
            Most popular developer jobs
          </Link>
        </div>
        <TagChips active={FILTERS.tags} />
      </header>
      <JobBoard
        emptyActions={
          <Link className="button button--secondary" href="/entry-level-jobs">
            Entry level jobs
          </Link>
        }
        emptyMessage="No jobs are tagged both dev and entry-level right now. Try entry-level jobs or intern jobs instead."
        jobs={result.jobs}
        pager={<CatalogPager path={PATH} result={result} />}
        selected={selected}
      />
      <RelatedBrowseLinks />
    </main>
  );
}
