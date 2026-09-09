import type { JobsDatabase } from "../../lib/jobs/queries";

/**
 * Application volume for the job set behind one salary page.
 *
 * The reference IA carries an "how many applicants per {X} job" section on
 * every salary page. Nodework can answer it honestly - Apply is on-site, so
 * `job_applications` is the real number - but the shared query module
 * (lib/jobs/queries.ts) is not owned by this slice, so the SQL lives here
 * beside the only page that needs it.
 *
 * The tag predicate deliberately mirrors `buildJobsWhere`'s `orTitle` branch
 * for salary role pages (tag row OR title contains the stem) so the denominator
 * matches the job count the same page prints above it. Pages with no tag stem
 * (country, region, seniority) pass `locationSlug`/`titleLike` instead.
 */
export type ApplicationVolume = {
  /** Applications recorded against jobs in this set. */
  applications: number;
  /** Distinct listed jobs in this set that have at least one application. */
  jobsWithApplications: number;
};

export type ApplicationScope = {
  /** Salary role stem, matched against job_tags and (optionally) the title. */
  tag?: string;
  /** Also match titles containing the tag stem, as the role pages' list does. */
  orTitle?: boolean;
  /** City, country or region slug. */
  locationSlug?: string;
  /** Seniority word matched against the job title, as listJobs does. */
  titleLike?: string;
};

function likeContains(value: string): string {
  const escaped = value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
  return `%${escaped}%`;
}

export async function applicationVolume(
  db: JobsDatabase,
  tenantId: string,
  scope: ApplicationScope,
): Promise<ApplicationVolume> {
  const conditions = [
    "a.tenant_id = ?",
    "j.tenant_id = ?",
    "j.listed = 1",
    "c.listed = 1",
  ];
  const bindings: unknown[] = [tenantId, tenantId];

  if (scope.tag) {
    if (scope.orTitle) {
      conditions.push(`(
        EXISTS (SELECT 1 FROM job_tags jt WHERE jt.job_id = j.id AND jt.tag_slug = ?)
        OR LOWER(j.title) LIKE LOWER(?) ESCAPE '\\'
      )`);
      bindings.push(scope.tag, likeContains(scope.tag.replaceAll("-", " ")));
    } else {
      conditions.push(
        "EXISTS (SELECT 1 FROM job_tags jt WHERE jt.job_id = j.id AND jt.tag_slug = ?)",
      );
      bindings.push(scope.tag);
    }
  }

  if (scope.locationSlug) {
    conditions.push(
      "EXISTS (SELECT 1 FROM job_locations jl WHERE jl.job_id = j.id AND jl.location_slug = ?)",
    );
    bindings.push(scope.locationSlug);
  }

  if (scope.titleLike) {
    conditions.push("LOWER(j.title) LIKE LOWER(?) ESCAPE '\\'");
    bindings.push(likeContains(scope.titleLike));
  }

  const row = await db
    .prepare(
      `SELECT COUNT(*) AS applications, COUNT(DISTINCT a.job_id) AS jobsWithApplications
       FROM job_applications a
       JOIN jobs j ON j.id = a.job_id
       JOIN companies c ON c.id = j.company_id AND c.tenant_id = j.tenant_id
       WHERE ${conditions.join("\n         AND ")}`,
    )
    .bind(...bindings)
    .first<{ applications: number | null; jobsWithApplications: number | null }>();

  return {
    applications: Number(row?.applications ?? 0),
    jobsWithApplications: Number(row?.jobsWithApplications ?? 0),
  };
}

/**
 * The sentence under "How many applicants per {X} job?". A job board that
 * imports its catalog starts with no applications at all, so the zero case
 * has to read as "nobody has applied through this site yet", never as an
 * average of zero dressed up as a statistic.
 */
export function applicantsSentence(
  volume: ApplicationVolume,
  subject: string,
  totalJobs: number,
): string {
  if (volume.applications === 0) {
    return `No one has applied to ${subject} through Nodework yet, so there is no applicants-per-job figure to publish. Applications submitted on this site are the only ones we count; we cannot see what a company receives elsewhere.`;
  }
  const perJob = totalJobs > 0 ? volume.applications / totalJobs : volume.applications;
  const rounded = perJob >= 10 ? Math.round(perJob) : Math.round(perJob * 10) / 10;
  const applicationWord = volume.applications === 1 ? "application" : "applications";
  const jobWord = volume.jobsWithApplications === 1 ? "job" : "jobs";
  return `Nodework has recorded ${volume.applications} ${applicationWord} on ${subject}, spread across ${volume.jobsWithApplications} ${jobWord}, which averages ${rounded} per listed role. That counts applications submitted on this site only, not what a company receives through its own careers page.`;
}
