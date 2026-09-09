import type { Metadata } from "next";
import Link from "next/link";

import { catalogMonthLabel } from "../_components/board-chrome";
import { loadCatalogJobs } from "../_components/catalog-jobs";
import { RankingJobsPage } from "../_components/ranking-board";

export const revalidate = 300;

const PATH = "/highest-paid-designers-jobs";
const TITLE = "Highest paid designer jobs";
const FILTERS = { tag: "design", hasSalary: true, orderBy: "salary" as const };

export async function generateMetadata(): Promise<Metadata> {
  const { result } = await loadCatalogJobs(FILTERS);
  const highlights = result.jobs
    .slice(0, 3)
    .map((job) => `${job.title} at ${job.companyName}`)
    .join(", ");
  const description = `${result.total} highest paid design jobs on Nodework for ${catalogMonthLabel()}${
    highlights ? `, including ${highlights}.` : "."
  }`;
  return { title: TITLE, description, alternates: { canonical: PATH } };
}

type Search = Promise<{ page?: string }>;

export default async function HighestPaidDesignersJobsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  return RankingJobsPage({
    emptyHref: "/design-jobs",
    emptyLabel: "Design jobs",
    emptyMessage: "No design jobs with a published salary band right now.",
    extraChips: (
      <div className="chips">
        <Link className="chip" href="/design-jobs">
          Design jobs
        </Link>
        <Link className="chip" href="/web3-salaries/design">
          Design salaries
        </Link>
      </div>
    ),
    filters: FILTERS,
    lead: "Design listings that published a salary minimum and maximum, ordered by that band.",
    path: PATH,
    searchParams,
    title: TITLE,
  });
}
