import type { Metadata } from "next";
import Link from "next/link";

import { BoardSearch, RelatedBrowseLinks, catalogMonthLabel } from "../_components/board-chrome";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { CatalogPager, catalogPageNumber, loadCatalogJobs } from "../_components/catalog-jobs";
import { JobBoard } from "../_components/job-board";
import { TagChips } from "../_components/job-row";
import { RankingsChips } from "../_components/rankings-chips";

export const revalidate = 300;

const PATH = "/top-web3-internships";
const TITLE = "Top Web3 internships";
const FILTERS = { tag: "intern", orderBy: "posted" as const };

export async function generateMetadata(): Promise<Metadata> {
  const { result } = await loadCatalogJobs(FILTERS);
  const highlights = result.jobs
    .slice(0, 3)
    .map((job) => `${job.title} at ${job.companyName}`)
    .join(", ");
  const description = `${result.total} Web3 internships on Nodework for ${catalogMonthLabel()}${
    highlights ? `, including ${highlights}.` : "."
  }`;
  return { title: TITLE, description, alternates: { canonical: PATH } };
}

type Search = Promise<{ page?: string }>;

export default async function TopWeb3InternshipsPage({
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
          Intern jobs on Nodework, sorted by most recently posted. This is a ranking of
          listed intern seats, not a redirect. Read duration, pay, and function on each
          listing.
        </p>
        <p className="count">
          <span className="jobs-num">{result.total}</span> jobs found
        </p>
        <BoardSearch remoteHref="/remote-intern-jobs" />
        <p className="muted">{catalogMonthLabel()}</p>
        <div className="chips">
          <Link className="chip" href="/intern-jobs">
            Intern jobs
          </Link>
          <Link className="chip" href="/entry-developer-jobs">
            Entry developer jobs
          </Link>
          <Link className="chip" href="/entry-non-tech-jobs">
            Entry non-tech jobs
          </Link>
        </div>
        <TagChips active="intern" />
      </header>
      <JobBoard
        emptyActions={
          <Link className="button button--secondary" href="/intern-jobs">
            Intern jobs
          </Link>
        }
        emptyMessage="No intern jobs listed right now."
        jobs={result.jobs}
        pager={<CatalogPager path={PATH} result={result} />}
        selected={selected}
      />
      <RelatedBrowseLinks tag="intern" />
      <section className="container jobs-more">
        <h2>Other rankings</h2>
        <RankingsChips exclude={PATH} />
      </section>
    </main>
  );
}
