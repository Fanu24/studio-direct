import type { Metadata } from "next";
import Link from "next/link";

import { catalogMonthLabel } from "../_components/board-chrome";
import { loadCatalogJobs } from "../_components/catalog-jobs";
import { RankingJobsPage } from "../_components/ranking-board";

export const revalidate = 300;

const PATH = "/most-popular-non-tech-jobs";
const TITLE = "Most popular non-tech jobs";
const FILTERS = { tag: "non-tech" };

export async function generateMetadata(): Promise<Metadata> {
  const { result } = await loadCatalogJobs(FILTERS);
  const highlights = result.jobs
    .slice(0, 3)
    .map((job) => `${job.title} at ${job.companyName}`)
    .join(", ");
  const description = `${result.total} popular non-tech Web3 jobs on Nodework for ${catalogMonthLabel()}${
    highlights ? `, including ${highlights}.` : "."
  }`;
  return { title: TITLE, description, alternates: { canonical: PATH } };
}

type Search = Promise<{ page?: string }>;

export default async function MostPopularNonTechJobsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  return RankingJobsPage({
    emptyHref: "/marketing-jobs",
    emptyLabel: "Marketing jobs",
    emptyMessage: "No non-tech jobs listed right now.",
    extraChips: (
      <div className="chips">
        <Link className="chip" href="/marketing-jobs">
          Marketing
        </Link>
        <Link className="chip" href="/community-manager-jobs">
          Community manager
        </Link>
        <Link className="chip" href="/sales-jobs">
          Sales
        </Link>
      </div>
    ),
    filters: FILTERS,
    lead: "Non-tech inventory tagged on Nodework. Use the chips for marketing, community, and sales slices.",
    path: PATH,
    searchParams,
    title: TITLE,
  });
}
