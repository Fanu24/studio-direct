import { tagLabel } from "@gaming/shared";
import type { Metadata } from "next";
import Link from "next/link";

import { BoardSearch, RelatedBrowseLinks, catalogMonthLabel } from "../_components/board-chrome";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { CatalogPager, catalogPageNumber, loadCatalogJobs } from "../_components/catalog-jobs";
import { JobBoard } from "../_components/job-board";
import { TagChips } from "../_components/job-row";
import { RankingsChips } from "../_components/rankings-chips";
import { POPULAR_DEV_CHIPS } from "./chips";

export const revalidate = 300;

const PATH = "/most-popular-developer-jobs";
const TITLE = "Most popular developer jobs";
// "engineer" has no single-tag equivalent in this taxonomy the way "design"
// or "non-tech" do, so this matches the job_tags row when it is present and
// falls back to a title search - broader and more resilient than pinning the
// whole page to one stack tag (the old "solidity" filter dropped to zero
// whenever Solidity inventory thinned out).
const FILTERS = { tag: "engineer", orTitle: true as const };

export async function generateMetadata(): Promise<Metadata> {
  const { result } = await loadCatalogJobs(FILTERS);
  const highlights = result.jobs
    .slice(0, 3)
    .map((job) => `${job.title} at ${job.companyName}`)
    .join(", ");
  const description = `${result.total} popular developer and engineering jobs on Nodework for ${catalogMonthLabel()}${
    highlights ? `, including ${highlights}.` : "."
  }`;
  return { title: TITLE, description, alternates: { canonical: PATH } };
}

type Search = Promise<{ page?: string }>;

export default async function MostPopularDeveloperJobsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const page = catalogPageNumber((await searchParams).page);
  const { result, selected } = await loadCatalogJobs({ ...FILTERS, page });

  return (
    <main className="board-main">
      <header className="board-hero">
        <Breadcrumbs
          items={[
            { href: "/jobs", label: "Jobs" },
            { label: TITLE },
          ]}
        />
        <h1>{TITLE}</h1>
        <p className="lead">
          Engineering and developer roles across Web3 hiring, matched on the engineer tag or
          an engineer title. Use the chips below for a specific stack like Solidity, Rust, or
          Solana.
        </p>
        <p className="count">
          <span className="jobs-num">{result.total}</span> jobs found
        </p>
        <BoardSearch remoteHref="/remote-jobs" />
        <p className="muted">{catalogMonthLabel()}</p>
        <div className="chips">
          {POPULAR_DEV_CHIPS.map((tag) => (
            <Link className="chip" href={`/${tag}-jobs`} key={tag}>
              {tagLabel(tag)}
            </Link>
          ))}
        </div>
        <TagChips />
      </header>
      <JobBoard
        emptyActions={
          <Link className="button button--secondary" href="/rust-jobs">
            Rust jobs
          </Link>
        }
        emptyMessage="No engineer-tagged jobs listed right now. Try Solidity, Rust, or Solana."
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
