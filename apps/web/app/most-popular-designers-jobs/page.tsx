import type { Metadata } from "next";
import Link from "next/link";

import { catalogMonthLabel } from "../_components/board-chrome";
import { loadCatalogJobs } from "../_components/catalog-jobs";
import { RankingJobsPage } from "../_components/ranking-board";

export const revalidate = 300;

// Plural is the canonical spelling: it is the URL web3.career links from its
// own pages and serves at 200, so ours has to serve too. The singular
// spelling redirects here (see ../most-popular-designer-jobs/page.tsx).
const PATH = "/most-popular-designers-jobs";
const TITLE = "Most popular designer jobs";
const FILTERS = { tag: "design" };

export async function generateMetadata(): Promise<Metadata> {
  const { result } = await loadCatalogJobs(FILTERS);
  const highlights = result.jobs
    .slice(0, 3)
    .map((job) => `${job.title} at ${job.companyName}`)
    .join(", ");
  const description = `${result.total} popular design jobs on Nodework for ${catalogMonthLabel()}${
    highlights ? `, including ${highlights}.` : "."
  }`;
  return { title: TITLE, description, alternates: { canonical: PATH } };
}

type Search = Promise<{ page?: string }>;

export default async function MostPopularDesignersJobsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  return RankingJobsPage({
    emptyHref: "/design-jobs",
    emptyLabel: "Design jobs",
    emptyMessage: "No design jobs listed right now.",
    extraChips: (
      <div className="chips">
        <Link className="chip" href="/design-jobs">
          Design
        </Link>
        <Link className="chip" href="/entry-designer-jobs">
          Entry designer jobs
        </Link>
      </div>
    ),
    filters: FILTERS,
    lead: "Live design-tagged jobs. Product, brand, and motion seats share this tag when the import used it.",
    path: PATH,
    searchParams,
    title: TITLE,
  });
}
