import { isJobTag, tagLabel } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BoardSearch, RelatedBrowseLinks } from "../../_components/board-chrome";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { CatalogPager, catalogPageNumber, loadCatalogJobs } from "../../_components/catalog-jobs";
import { JobBoard } from "../../_components/job-board";
import { TagChips } from "../../_components/job-row";
import {
  landingIndexable,
  listJobs,
  listTagLocationFacets,
  tagSalaryRange,
  type JobsDatabase,
} from "../../../lib/jobs/queries";
import { requireTenantId } from "../../../lib/tenant";
import { buildHireLocationChips, currentMonthYear, salaryRangePhrase } from "../locations";

export const revalidate = 300;

type HireSkillParams = Promise<{ skill: string }>;
type HireSkillSearch = Promise<{ page?: string }>;

async function loadHireSkill(skill: string, page: number) {
  if (!isJobTag(skill)) return null;

  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await requireTenantId(db);

  const [{ result, selected }, locationFacets, remoteResult, salary] = await Promise.all([
    loadCatalogJobs({ tag: skill, page }),
    listTagLocationFacets(db, tenantId, skill),
    listJobs(db, tenantId, { tag: skill, remoteOnly: true, pageSize: 1 }),
    tagSalaryRange(db, tenantId, skill),
  ]);

  return {
    skill,
    result,
    selected,
    locationChips: buildHireLocationChips(locationFacets, remoteResult.total),
    salary,
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: HireSkillParams;
  searchParams: HireSkillSearch;
}): Promise<Metadata> {
  const page = catalogPageNumber((await searchParams).page);
  const loaded = await loadHireSkill((await params).skill, page);
  if (!loaded) notFound();
  const label = tagLabel(loaded.skill);
  const indexable = page === 1 && landingIndexable(loaded.result.total);
  const total = loaded.result.total;
  const roleWord = total === 1 ? "role" : "roles";
  const companyPhrase = total === 1 ? "company is" : "companies are";
  const month = currentMonthYear();
  const salaryPhrase = salaryRangePhrase(loaded.salary);

  return {
    title: `Companies hiring ${label} - ${total} live ${roleWord}, ${month}`,
    description: salaryPhrase
      ? `${total} ${companyPhrase} hiring ${label} on Nodework this ${month}, with listed salaries from ${salaryPhrase}. Browse open roles and apply directly, no talent pool or recruiter search.`
      : `${total} ${companyPhrase} hiring ${label} on Nodework this ${month}. Browse open roles and apply directly, no talent pool or recruiter search.`,
    alternates: { canonical: `/hire/${loaded.skill}` },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default async function HireSkillPage({
  params,
  searchParams,
}: {
  params: HireSkillParams;
  searchParams: HireSkillSearch;
}) {
  const page = catalogPageNumber((await searchParams).page);
  const loaded = await loadHireSkill((await params).skill, page);
  if (!loaded) notFound();

  const { skill, result, selected, locationChips } = loaded;
  const label = tagLabel(skill);
  const path = `/hire/${skill}`;

  return (
    <main className="board-main">
      <header className="board-hero">
        <Breadcrumbs
          items={[
            { href: "/hire", label: "Hire" },
            { label: `Hire ${label}` },
          ]}
        />
        <h1>Companies hiring {label}</h1>
        <p className="lead">
          Companies hiring {label} on Nodework. These are imported catalog jobs, not a
          private talent pool. Candidates apply on this site.
        </p>
        <p className="count">
          <span className="jobs-num">{result.total}</span>{" "}
          {result.total === 1 ? "job" : "jobs"} found
        </p>
        <BoardSearch remoteHref={`/remote-${skill}-jobs`} />
        <TagChips active={skill} />
        <div className="chips">
          {locationChips.map((place) => (
            <Link className="chip" href={`/hire/${skill}/${place.slug}`} key={place.slug}>
              {place.label}
            </Link>
          ))}
          <Link className="chip" href={`/${skill}-jobs`}>
            {label} jobs
          </Link>
        </div>
      </header>
      <JobBoard
        emptyActions={
          <Link className="button button--secondary" href="/jobs">
            Browse all jobs
          </Link>
        }
        emptyMessage={`No ${label} jobs listed right now.`}
        jobs={result.jobs}
        pager={<CatalogPager path={path} result={result} />}
        selected={selected}
      />
      <RelatedBrowseLinks tag={skill} />
    </main>
  );
}
