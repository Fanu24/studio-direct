import { isJobTag, tagLabel } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BoardSearch, RelatedBrowseLinks } from "../../../_components/board-chrome";
import { Breadcrumbs } from "../../../_components/breadcrumbs";
import { CatalogPager, catalogPageNumber, loadCatalogJobs } from "../../../_components/catalog-jobs";
import { JobBoard } from "../../../_components/job-board";
import { TagChips } from "../../../_components/job-row";
import {
  landingIndexable,
  tagSalaryRange,
  type JobsDatabase,
} from "../../../../lib/jobs/queries";
import { requireTenantId } from "../../../../lib/tenant";
import { currentMonthYear, parseHireLocation, salaryRangePhrase } from "../../locations";

export const revalidate = 300;

type HireLocationParams = Promise<{ skill: string; location: string }>;
type HireLocationSearch = Promise<{ page?: string }>;

async function loadHireLocation(skill: string, location: string, page: number) {
  if (!isJobTag(skill)) return null;
  const place = parseHireLocation(location);
  if (!place) return null;

  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await requireTenantId(db);

  const [{ result, selected }, salary] = await Promise.all([
    loadCatalogJobs({
      tag: skill,
      page,
      remoteOnly: place.remoteOnly,
      locationSlug: place.locationSlug,
    }),
    tagSalaryRange(db, tenantId, skill),
  ]);
  return { skill, place, result, selected, salary };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: HireLocationParams;
  searchParams: HireLocationSearch;
}): Promise<Metadata> {
  const page = catalogPageNumber((await searchParams).page);
  const { skill, location } = await params;
  const loaded = await loadHireLocation(skill, location, page);
  if (!loaded) notFound();
  const label = tagLabel(loaded.skill);
  const indexable = page === 1 && landingIndexable(loaded.result.total);
  const total = loaded.result.total;
  const roleWord = total === 1 ? "role" : "roles";
  const companyPhrase = total === 1 ? "company is" : "companies are";
  const month = currentMonthYear();
  const salaryPhrase = salaryRangePhrase(loaded.salary);

  return {
    title: `Companies hiring ${label} in ${loaded.place.label} - ${total} live ${roleWord}, ${month}`,
    description: salaryPhrase
      ? `${total} ${companyPhrase} hiring ${label} in ${loaded.place.label} on Nodework this ${month}. Nodework-wide ${label} salaries run ${salaryPhrase}. Browse open roles and apply directly.`
      : `${total} ${companyPhrase} hiring ${label} in ${loaded.place.label} on Nodework this ${month}. Browse open roles and apply directly.`,
    alternates: { canonical: `/hire/${loaded.skill}/${location.trim().toLowerCase()}` },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default async function HireSkillLocationPage({
  params,
  searchParams,
}: {
  params: HireLocationParams;
  searchParams: HireLocationSearch;
}) {
  const page = catalogPageNumber((await searchParams).page);
  const { skill, location } = await params;
  const loaded = await loadHireLocation(skill, location, page);
  if (!loaded) notFound();

  const { place, result, selected } = loaded;
  const label = tagLabel(skill);
  const path = `/hire/${skill}/${location.trim().toLowerCase()}`;

  return (
    <main className="board-main">
      <header className="board-hero">
        <Breadcrumbs
          items={[
            { href: "/hire", label: "Hire" },
            { href: `/hire/${skill}`, label: `Hire ${label}` },
            { label: place.label },
          ]}
        />
        <h1>
          Companies hiring {label} in {place.label}
        </h1>
        <p className="lead">
          Companies hiring {label} in {place.label} on Nodework. Same catalog jobs as the
          public board, filtered to this location.
        </p>
        <p className="count">
          <span className="jobs-num">{result.total}</span>{" "}
          {result.total === 1 ? "job" : "jobs"} found
        </p>
        <BoardSearch
          remoteHref={place.remoteOnly ? "/remote-jobs" : `/remote-${skill}-jobs`}
        />
        <TagChips active={skill} />
        <div className="chips">
          <Link className="chip" href={`/hire/${skill}`}>
            All {label} hiring
          </Link>
          <Link className="chip" href={`/${skill}-jobs`}>
            {label} jobs
          </Link>
        </div>
      </header>
      <JobBoard
        emptyActions={
          <Link className="button button--secondary" href={`/hire/${skill}`}>
            All {label} hiring
          </Link>
        }
        emptyMessage={`No ${label} jobs in ${place.label} right now.`}
        jobs={result.jobs}
        pager={<CatalogPager path={path} result={result} />}
        selected={selected}
      />
      <RelatedBrowseLinks tag={skill} />
    </main>
  );
}
