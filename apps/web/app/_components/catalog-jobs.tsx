import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";

import {
  getJobForListItem,
  listJobs,
  type JobListFilters,
  type JobListResult,
  type JobsDatabase,
} from "../../lib/jobs/queries";
import { requireTenantId } from "../../lib/tenant";

export function catalogPageNumber(value: string | undefined) {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export async function loadCatalogJobs(filters: JobListFilters) {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await requireTenantId(db);
  const result = await listJobs(db, tenantId, filters);
  const selected = await getJobForListItem(db, tenantId, result.jobs[0]);
  return { result, selected };
}

function pagerHref(path: string, page: number): string {
  return page === 1 ? path : `${path}?page=${page}`;
}

/**
 * First, last, and the current page +/- 2, deduped and sorted, with an
 * "ellipsis" marker filling any gap - so page 1 can always reach a deep page
 * (and vice versa) in one click instead of only by walking Next repeatedly.
 */
function pagerPages(current: number, total: number): (number | "ellipsis")[] {
  const kept = new Set<number>([1, total]);
  for (let page = current - 2; page <= current + 2; page += 1) {
    if (page >= 1 && page <= total) kept.add(page);
  }
  const sorted = [...kept].sort((a, b) => a - b);

  const pages: (number | "ellipsis")[] = [];
  let previous: number | undefined;
  for (const page of sorted) {
    if (previous !== undefined && page - previous > 1) pages.push("ellipsis");
    pages.push(page);
    previous = page;
  }
  return pages;
}

export function CatalogPager({
  path,
  result,
}: {
  path: string;
  result: JobListResult;
}) {
  if (result.totalPages <= 1) return null;
  return (
    <nav aria-label="Jobs pagination" className="pager">
      {result.page > 1 ? (
        <Link href={pagerHref(path, result.page - 1)}>Previous</Link>
      ) : null}
      {pagerPages(result.page, result.totalPages).map((page, index) =>
        page === "ellipsis" ? (
          <span aria-hidden="true" key={`ellipsis-${index}`}>
            &hellip;
          </span>
        ) : page === result.page ? (
          <span aria-current="page" key={page}>
            {page}
          </span>
        ) : (
          <Link href={pagerHref(path, page)} key={page}>
            {page}
          </Link>
        ),
      )}
      {result.page < result.totalPages ? (
        <Link href={pagerHref(path, result.page + 1)} rel="next">
          Next
        </Link>
      ) : null}
    </nav>
  );
}
