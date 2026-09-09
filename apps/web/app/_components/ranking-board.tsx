import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { BoardSearch, RelatedBrowseLinks, catalogMonthLabel } from "./board-chrome";
import { Breadcrumbs } from "./breadcrumbs";
import { CatalogPager, catalogPageNumber, loadCatalogJobs } from "./catalog-jobs";
import { JobBoard } from "./job-board";
import { TagChips } from "./job-row";
import { RankingsChips } from "./rankings-chips";
import type { JobListFilters } from "../../lib/jobs/queries";

export { catalogPageNumber };

export async function RankingJobsPage({
  title,
  path,
  lead,
  emptyMessage,
  emptyHref,
  emptyLabel,
  filters,
  countLabel,
  extraChips,
  searchParams,
  ranked = false,
}: {
  title: string;
  path: string;
  lead: string;
  emptyMessage: string;
  emptyHref: string;
  emptyLabel: string;
  filters: JobListFilters;
  countLabel?: string;
  extraChips?: ReactNode;
  searchParams: Promise<{ page?: string }>;
  /**
   * True only when `filters` actually orders the slice by a ranked metric
   * (currently `orderBy: "salary"`). Every caller of this component shares
   * the same JobBoard, but not every one of them is a ranking: the
   * "most popular" and "top web3 jobs" pages fall back to the catalog's
   * default order (featured, then most recently posted), which is a
   * recency feed, not a ranking - a rank number there would be a false
   * claim about the data. Leave this false for those callers.
   */
  ranked?: boolean;
}) {
  const page = catalogPageNumber((await searchParams).page);
  const { result, selected } = await loadCatalogJobs({ ...filters, page });
  const rankOffset = ranked ? (result.page - 1) * result.pageSize : undefined;

  return (
    <main className="surface surface--data board-main">
      <header className="board-hero">
        <Breadcrumbs items={[{ href: "/jobs", label: "Jobs" }, { label: title }]} />
        <h1>{title}</h1>
        <p className="lead">{lead}</p>
        <p className="count">
          <span className="jobs-num">{result.total.toLocaleString("en-US")}</span>{" "}
          {countLabel ?? "jobs found"}
        </p>
        <BoardSearch remoteHref="/remote-jobs" />
        <TagChips />
        <p className="muted">{catalogMonthLabel()}</p>
        {extraChips}
      </header>
      <JobBoard
        emptyActions={
          <Link className="button button--secondary" href={emptyHref}>
            {emptyLabel}
          </Link>
        }
        emptyMessage={emptyMessage}
        jobs={result.jobs}
        pager={<CatalogPager path={path} result={result} />}
        rankOffset={rankOffset}
        selected={selected}
      />
      <RelatedBrowseLinks tag={filters.tag} />
      <section className="container jobs-more">
        <h2>Other rankings</h2>
        <RankingsChips exclude={path} />
      </section>
    </main>
  );
}

export function rankingMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
  };
}
