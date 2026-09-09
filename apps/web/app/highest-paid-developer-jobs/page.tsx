import type { Metadata } from "next";
import Link from "next/link";

import { BoardSearch, RelatedBrowseLinks, catalogMonthLabel } from "../_components/board-chrome";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { CatalogPager, catalogPageNumber, loadCatalogJobs } from "../_components/catalog-jobs";
import { JobBoard } from "../_components/job-board";
import { TagChips } from "../_components/job-row";
import { RankingsChips } from "../_components/rankings-chips";

export const revalidate = 300;

// Singular is the canonical spelling: it is the URL web3.career links from
// its own pages and serves at 200, so ours has to serve too. The plural
// spelling redirects here (see ../highest-paid-developers-jobs/page.tsx).
const PATH = "/highest-paid-developer-jobs";
const TITLE = "Highest paid developer jobs";
const FILTERS = { hasSalary: true, orderBy: "salary" as const };

export async function generateMetadata(): Promise<Metadata> {
  const { result } = await loadCatalogJobs(FILTERS);
  const highlights = result.jobs
    .slice(0, 3)
    .map((job) => `${job.title} at ${job.companyName}`)
    .join(", ");
  const description = `${result.total} highest paid Web3 jobs on Nodework for ${catalogMonthLabel()}${
    highlights ? `, including ${highlights}.` : "."
  }`;
  return { title: TITLE, description, alternates: { canonical: PATH } };
}

type Search = Promise<{ page?: string }>;

export default async function HighestPaidDeveloperJobsPage({
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
          Listed jobs that published a salary minimum and maximum, ordered by that band.
          Roles without a published range are omitted. Salary pages remain the rollup view.
        </p>
        <p className="count">
          <span className="jobs-num">{result.total}</span> jobs found
        </p>
        <BoardSearch remoteHref="/remote-jobs" />
        <TagChips />
        <p className="muted">{catalogMonthLabel()}</p>
        <div className="chips">
          <Link className="chip" href="/web3-salaries">
            Web3 salaries
          </Link>
          <Link className="chip" href="/solidity-jobs">
            Solidity jobs
          </Link>
          <Link className="chip" href="/highest-paying-web3-jobs">
            Highest paying Web3 jobs
          </Link>
        </div>
      </header>
      <JobBoard
        emptyActions={
          <Link className="button button--secondary" href="/web3-salaries">
            Salary pages
          </Link>
        }
        emptyMessage="No jobs with a published salary band right now."
        jobs={result.jobs}
        pager={<CatalogPager path={PATH} result={result} />}
        selected={selected}
      />
      <RelatedBrowseLinks />
      <section className="container jobs-more">
        <h2>Other rankings</h2>
        <RankingsChips exclude={PATH} />
      </section>
    </main>
  );
}
