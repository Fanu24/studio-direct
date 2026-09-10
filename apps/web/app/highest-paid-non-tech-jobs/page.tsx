import type { Metadata } from "next";
import Link from "next/link";

import { catalogMonthLabel } from "../_components/board-chrome";
import { loadCatalogJobs } from "../_components/catalog-jobs";
import { RankingJobsPage } from "../_components/ranking-board";

export const revalidate = 300;

const PATH = "/highest-paid-non-tech-jobs";
const TITLE = "Highest paid non-tech jobs";
const FILTERS = { tag: "non-tech", hasSalary: true, orderBy: "salary" as const };

export async function generateMetadata(): Promise<Metadata> {
  const { result } = await loadCatalogJobs(FILTERS);
  const highlights = result.jobs
    .slice(0, 3)
    .map((job) => `${job.title} at ${job.companyName}`)
    .join(", ");
  const description = `${result.total} highest paid non-tech jobs on Nodework for ${catalogMonthLabel()}${
    highlights ? `, including ${highlights}.` : "."
  }`;
  return { title: TITLE, description, alternates: { canonical: PATH } };
}

type Search = Promise<{ page?: string }>;

export default async function HighestPaidNonTechJobsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  return RankingJobsPage({
      emptyHref: "/web3-non-tech-salaries",
      emptyLabel: "Non-tech salaries",
      emptyMessage: "No non-tech jobs with a published salary band right now.",
      extraChips: (
        <div className="chips">
          <Link className="chip" href="/web3-non-tech-salaries">
            Non-tech salaries
          </Link>
          <Link className="chip" href="/marketing-jobs">
            Marketing jobs
          </Link>
        </div>
      ),
      filters: FILTERS,
      lead: "Non-tech listings that published a salary minimum and maximum, ordered by that band.",
      path: PATH,
      ranked: true,
      searchParams,
      title: TITLE,
    });
}
