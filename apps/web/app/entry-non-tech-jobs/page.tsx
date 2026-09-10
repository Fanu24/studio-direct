import { landingPath } from "@gaming/shared";
import type { Metadata } from "next";
import Link from "next/link";

import { BoardSearch, RelatedBrowseLinks, catalogMonthLabel } from "../_components/board-chrome";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { CatalogPager, catalogPageNumber, loadCatalogJobs } from "../_components/catalog-jobs";
import { JobBoard } from "../_components/job-board";
import { TagChips } from "../_components/job-row";

export const revalidate = 300;

const PATH = "/entry-non-tech-jobs";
const TITLE = "Entry non-tech jobs";
// Both facets required, unlike /intern-jobs (any category) or
// /entry-level-jobs (any category) - this is what makes the page a real
// intersection instead of a duplicate of either.
const FILTERS = { tags: ["non-tech", "entry-level"] };
const REMOTE_HREF = landingPath({ kind: "remote-tag", tag: "non-tech", tags: FILTERS.tags });

export async function generateMetadata(): Promise<Metadata> {
  const { result } = await loadCatalogJobs(FILTERS);
  const highlights = result.jobs
    .slice(0, 3)
    .map((job) => `${job.title} at ${job.companyName}`)
    .join(", ");
  const description = `${result.total} entry-level non-tech jobs on Nodework for ${catalogMonthLabel()}${
    highlights ? `, including ${highlights}.` : "."
  }`;
  return { title: TITLE, description, alternates: { canonical: PATH } };
}

type Search = Promise<{ page?: string }>;

export default async function EntryNonTechJobsPage({
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
          Non-tech roles on Nodework tagged both non-tech and entry-level, including
          internships in community, operations, and marketing when the import used both
          tags. For the wider non-tech or entry-level pool, use those pages instead.
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
          <Link className="chip" href="/non-tech-jobs">
            Non-tech jobs
          </Link>
          <Link className="chip" href="/entry-level-jobs">
            Entry level jobs
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
        emptyMessage="No jobs are tagged both non-tech and entry-level right now. Try entry-level jobs or intern jobs instead."
        jobs={result.jobs}
        pager={<CatalogPager path={PATH} result={result} />}
        selected={selected}
      />
      <RelatedBrowseLinks />
    </main>
  );
}
