import { isJobTag, isNonTechSalaryRole, isSalaryRole } from "@gaming/shared";

import {
  listJobs,
  tagSalaryRange,
  type JobListItem,
  type JobsDatabase,
} from "./queries";

/**
 * Tail sections of a job detail page: the "more {role} jobs" table, the studio's other
 * roles, and the salary line for the role. Lives outside queries.ts (shared, owned by
 * nobody) so the job page can grow its own reads without touching the shared module.
 */

export const RELATED_JOBS_LIMIT = 8;
export const COMPANY_JOBS_LIMIT = 4;

/**
 * Tags that describe the shape of the listing rather than the craft. A page whose only
 * other tag is "dev" still gets a related block, but a role tag always wins the heading.
 */
const COARSE_TAGS = new Set([
  "dev",
  "non-tech",
  "remote",
  "web3",
  "crypto",
  "full-time",
  "part-time",
  "contract",
  "intern",
  "entry-level",
  "junior",
  "senior",
  "lead",
]);

/**
 * The tag the tail sections are built around. Seniority words are salary roles in their own
 * right ("senior", "lead"), so the coarse list is subtracted *before* the role preference -
 * otherwise a Senior Solidity Engineer would headline its tail with "Senior jobs".
 */
export function pickPrimaryTag(tags: readonly string[]): string | null {
  const usable = tags.map((tag) => tag.trim()).filter(Boolean);
  const specific = usable.filter((tag) => !COARSE_TAGS.has(tag));
  const role = specific.find(
    (tag) => isSalaryRole(tag) || isSalaryRole(`${tag}-developer`) || isNonTechSalaryRole(tag),
  );
  return role ?? specific[0] ?? usable[0] ?? null;
}

/** `/web3-salaries/{slug}` when the tag has a salary page, otherwise null (no dead link). */
export function jobDetailSalaryHref(tag: string): string | null {
  if (isSalaryRole(`${tag}-developer`)) return `/web3-salaries/${tag}-developer`;
  if (isSalaryRole(tag) || isNonTechSalaryRole(tag)) return `/web3-salaries/${tag}`;
  return null;
}

/** `/hire/{tag}` exists for every job tag and 404s for anything else. */
export function jobDetailHireHref(tag: string): string | null {
  return isJobTag(tag) ? `/hire/${tag}` : null;
}

export interface JobDetailSalary {
  min: number | null;
  max: number | null;
  count: number;
}

export interface JobDetailSections {
  primaryTag: string | null;
  relatedJobs: JobListItem[];
  companyJobs: JobListItem[];
  salary: JobDetailSalary | null;
}

export const EMPTY_JOB_DETAIL_SECTIONS: JobDetailSections = {
  primaryTag: null,
  relatedJobs: [],
  companyJobs: [],
  salary: null,
};

export async function loadJobDetailSections(
  db: JobsDatabase,
  tenantId: string,
  job: { id: string; companyName: string; tags: readonly string[] },
): Promise<JobDetailSections> {
  const primaryTag = pickPrimaryTag(job.tags);

  const [related, company, salary] = await Promise.all([
    primaryTag
      ? listJobs(db, tenantId, { tag: primaryTag, pageSize: RELATED_JOBS_LIMIT + 1 })
      : null,
    job.companyName
      ? listJobs(db, tenantId, { company: job.companyName, pageSize: COMPANY_JOBS_LIMIT + 1 })
      : null,
    primaryTag ? tagSalaryRange(db, tenantId, primaryTag) : null,
  ]);

  const others = (items: JobListItem[] | undefined) =>
    (items ?? []).filter((item) => item.id !== job.id);

  return {
    primaryTag,
    relatedJobs: others(related?.jobs).slice(0, RELATED_JOBS_LIMIT),
    companyJobs: others(company?.jobs).slice(0, COMPANY_JOBS_LIMIT),
    salary: salary && salary.count > 0 && salary.min != null && salary.max != null
      ? salary
      : null,
  };
}
