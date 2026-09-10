import type { Metadata } from "next";
import Link from "next/link";

import { catalogMonthLabel } from "../_components/board-chrome";
import { loadCatalogJobs } from "../_components/catalog-jobs";
import { RankingJobsPage } from "../_components/ranking-board";

export const revalidate = 300;

const PATH = "/top-web3-jobs";
const TITLE = "Top Web3 jobs";
const FILTERS = {};

export async function generateMetadata(): Promise<Metadata> {
  const { result } = await loadCatalogJobs(FILTERS);
  const highlights = result.jobs
    .slice(0, 3)
    .map((job) => `${job.title} at ${job.companyName}`)
    .join(", ");
  const description = `${result.total} live Web3 jobs on Nodework for ${catalogMonthLabel()}${
    highlights ? `, including ${highlights}.` : "."
  }`;
  return { title: TITLE, description, alternates: { canonical: PATH } };
}

type Search = Promise<{ page?: string }>;

export default async function TopWeb3JobsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  return RankingJobsPage({
    emptyHref: "/jobs",
    emptyLabel: "All jobs",
    emptyMessage: "No jobs listed right now.",
    extraChips: (
      <div className="chips">
        <Link className="chip" href="/highest-paying-web3-jobs">
          Highest paying Web3 jobs
        </Link>
        <Link className="chip" href="/most-popular-developer-jobs">
          Most popular developer jobs
        </Link>
      </div>
    ),
    filters: FILTERS,
    lead: "Live catalog ordered by recency. Featured and highlighted roles sit first when the import marked them.",
    path: PATH,
    searchParams,
    title: TITLE,
  });
}
