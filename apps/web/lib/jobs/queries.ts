import {
  averageSalary,
  isCitySlug,
  isCountrySlug,
  isRegionSlug,
  SENIORITY_SLUGS,
  slugTitle,
  type LandingKind,
  shouldIndexLanding,
} from "@gaming/shared";

export interface JobListFilters {
  hidden?: boolean;
  q?: string;
  company?: string;
  companyId?: string;
  tag?: string;
  /**
   * Two or more job-tag slugs to AND together (combo landing pages like
   * /dev+remote-jobs). At length <= 1 this is equivalent to `tag` and emits
   * the exact same single, unaliased join `tag` does - use either, not both.
   */
  tags?: string[];
  remoteOnly?: boolean;
  locationSlug?: string;
  benefit?: string;
  seniority?: string;
  source?: string;
  hasSalary?: boolean;
  orderBy?: "posted" | "salary";
  /** With `tag`, also match titles that contain the tag stem (salary role pages). */
  orTitle?: boolean;
  page?: number;
  pageSize?: number;
}

export interface JobsDatabase {
  prepare(query: string): JobsStatement;
}

export interface JobsStatement {
  bind(...values: unknown[]): JobsStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface JobListItem {
  id: string;
  slug: string;
  externalId: string | null;
  title: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  companyLogoUrl?: string | null;
  location: string | null;
  remote: string;
  salaryText: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  highlight: number;
  highlightColor?: string | null;
  featuredUntil: string | null;
  exclusivity: string;
  postedAt: string | null;
  tags: string[];
}

export interface JobListResult {
  jobs: JobListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface JobDetail {
  id: string;
  slug: string;
  externalId: string | null;
  title: string;
  companyName: string;
  companySlug: string;
  companyLogoUrl?: string | null;
  location: string | null;
  remote: string;
  descriptionHtml: string;
  salaryText: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  highlight: number;
  highlightColor?: string | null;
  exclusivity: string;
  postedAt: string | null;
  tags: string[];
}

export interface CompanyHub {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  description: string | null;
}

export interface SitemapJob {
  slug: string;
  externalId: string | null;
}

export interface SitemapEntries {
  jobs: SitemapJob[];
  companySlugs: string[];
  tagSlugs: string[];
  geoSlugs: string[];
  salarySlugs: string[];
  benefitSlugs: string[];
}

export interface SalaryRollupRow {
  dimension: string;
  slug: string;
  avg: number;
  min: number;
  max: number;
  jobCount30d: number;
}

export interface SalaryStatsRow {
  dimension: string;
  slug: string;
  avg: number | null;
  min: number | null;
  max: number | null;
  jobCount30d: number;
}

const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 100;

function positiveInteger(value: number | undefined, fallback: number, maximum?: number) {
  if (!Number.isFinite(value) || value === undefined) return fallback;
  const normalized = Math.max(1, Math.floor(value));
  return maximum === undefined ? normalized : Math.min(normalized, maximum);
}

function containsPattern(value: string) {
  return `%${value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

function ftsQuery(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term.replaceAll('"', '""')}"`)
    .join(" ");
}

/** solidity-developer → solidity; product-manager stays product-manager. */
export function salaryRoleStem(role: string): string {
  return role.endsWith("-developer") ? role.slice(0, -"-developer".length) : role;
}

export function emptySalaryStats(dimension: string, slug: string): SalaryStatsRow {
  return { dimension, slug, avg: null, min: null, max: null, jobCount30d: 0 };
}

export function jobPublicHref(job: {
  slug: string;
  externalId: string | null;
}): string {
  if (job.externalId) {
    const suffix = `-${job.externalId}`;
    const base = job.slug.endsWith(suffix)
      ? job.slug.slice(0, -suffix.length)
      : job.slug;
    return `/${base}/${encodeURIComponent(job.externalId)}`;
  }
  return `/jobs/${job.slug}`;
}

export function jobApplyHref(job: {
  slug: string;
  externalId: string | null;
}): string {
  return `${jobPublicHref(job)}/apply`;
}

function mapTags(tagCsv: string | null | undefined): string[] {
  if (!tagCsv) return [];
  return tagCsv.split(",").map((tag) => tag.trim()).filter(Boolean);
}

export async function getJobBySlug(
  db: JobsDatabase,
  tenantId: string,
  slug: string,
): Promise<JobDetail | null> {
  return loadJob(db, tenantId, "j.slug = ?", [slug]);
}

export async function getJobByExternalId(
  db: JobsDatabase,
  tenantId: string,
  externalId: string,
): Promise<JobDetail | null> {
  return loadJob(db, tenantId, "j.external_id = ?", [externalId]);
}

export async function getJobForListItem(
  db: JobsDatabase,
  tenantId: string,
  job: Pick<JobListItem, "slug" | "externalId"> | undefined,
): Promise<JobDetail | null> {
  if (!job) return null;
  if (job.externalId) return getJobByExternalId(db, tenantId, job.externalId);
  return getJobBySlug(db, tenantId, job.slug);
}

type JobDetailRow = JobDetail & { companyNameNorm: string; tagCsv: string | null };

/** Shared SELECT for loadJob/loadJobs - a `where` fragment is ANDed on. */
function jobDetailQuery(where: string): string {
  return `SELECT
      j.id,
      j.slug,
      j.external_id AS externalId,
      j.title,
      c.name AS companyName,
      c.name_norm AS companyNameNorm,
      CASE WHEN j.source='manual' THEN j.listing_logo_url ELSE c.logo_url END AS companyLogoUrl,
      j.location,
      j.remote,
      j.description_html AS descriptionHtml,
      j.salary_text AS salaryText,
      j.salary_min AS salaryMin,
      j.salary_max AS salaryMax,
      j.highlight,
      j.highlight_color AS highlightColor,
      j.exclusivity,
      j.posted_at AS postedAt,
      (SELECT GROUP_CONCAT(tag_slug, ',') FROM job_tags WHERE job_id = j.id) AS tagCsv
    FROM jobs j
    JOIN companies c ON c.id = j.company_id AND c.tenant_id = j.tenant_id
    WHERE j.tenant_id = ?
      AND ${where}
      AND j.listed = 1 AND (j.expires_at IS NULL OR julianday(j.expires_at)>julianday('now'))
      AND c.listed = 1`;
}

function mapJobDetailRow(row: JobDetailRow): JobDetail {
  const { companyNameNorm, tagCsv, ...job } = row;
  return {
    ...job,
    companySlug: slugTitle(companyNameNorm),
    tags: mapTags(tagCsv),
  };
}

async function loadJob(
  db: JobsDatabase,
  tenantId: string,
  where: string,
  extra: unknown[],
): Promise<JobDetail | null> {
  const row = await db
    .prepare(`${jobDetailQuery(where)}\n      LIMIT 1`)
    .bind(tenantId, ...extra)
    .first<JobDetailRow>();

  return row ? mapJobDetailRow(row) : null;
}

async function loadJobs(
  db: JobsDatabase,
  tenantId: string,
  where: string,
  extra: unknown[],
): Promise<JobDetail[]> {
  const rows = await db
    .prepare(jobDetailQuery(where))
    .bind(tenantId, ...extra)
    .all<JobDetailRow>();

  return rows.results.map(mapJobDetailRow);
}

/**
 * Bulk variant of getJobForListItem: one SELECT ... IN (...) instead of one
 * round trip per job. Returns details in the same order as `jobs`, with
 * `null` in positions that could not be resolved - page.tsx relies on
 * jobDetails[0] being the featured job, so a reordering here is a silent
 * content bug, not just a perf regression.
 */
export async function getJobsForListItems(
  db: JobsDatabase,
  tenantId: string,
  jobs: Pick<JobListItem, "slug" | "externalId">[],
): Promise<(JobDetail | null)[]> {
  if (jobs.length === 0) return [];
  const slugs = [...new Set(jobs.map((job) => job.slug))];
  const rows: JobDetail[] = [];
  // D1 limits bound parameters; keep this valid for API callers requesting 100 jobs.
  for (let start = 0; start < slugs.length; start += 80) {
    const group = slugs.slice(start, start + 80);
    rows.push(...await loadJobs(db, tenantId,
      `j.slug IN (${group.map(() => "?").join(", ")})`, group));
  }
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  return jobs.map((job) => bySlug.get(job.slug) ?? null);
}

export async function getCompanyBySlug(
  db: JobsDatabase,
  tenantId: string,
  slug: string,
): Promise<CompanyHub | null> {
  if (slugTitle(slug) !== slug) return null;

  const company = await db
    .prepare(
      `SELECT id, name, name_norm AS nameNorm, domain, description
      FROM companies
      WHERE tenant_id = ? AND name_norm = ? AND listed = 1
      LIMIT 1`,
    )
    .bind(tenantId, slug)
    .first<{
      id: string;
      name: string;
      nameNorm: string;
      domain: string | null;
      description: string | null;
    }>();
  return company
    ? {
        id: company.id,
        name: company.name,
        slug: slugTitle(company.nameNorm),
        domain: company.domain ?? null,
        description: company.description ?? null,
      }
    : null;
}

export async function listSitemapEntries(
  db: JobsDatabase,
  tenantSlug: string,
): Promise<SitemapEntries> {
  const jobs = await db
    .prepare(
      `SELECT j.slug, j.external_id AS externalId
      FROM jobs j
      JOIN tenants t ON t.id = j.tenant_id
      JOIN companies c ON c.id = j.company_id AND c.tenant_id = j.tenant_id
      WHERE t.slug = ?
        AND j.listed = 1 AND (j.expires_at IS NULL OR julianday(j.expires_at)>julianday('now'))
        AND c.listed = 1
      ORDER BY j.slug`,
    )
    .bind(tenantSlug)
    .all<{ slug: string; externalId: string | null }>();

  const companies = await db
    .prepare(
      `SELECT c.name_norm AS nameNorm
      FROM companies c
      JOIN tenants t ON t.id = c.tenant_id
      WHERE t.slug = ? AND c.listed = 1
      ORDER BY c.name_norm`,
    )
    .bind(tenantSlug)
    .all<{ nameNorm: string }>();

  const tags = await db
    .prepare(
      `SELECT jt.tag_slug AS slug, COUNT(*) AS total
      FROM job_tags jt
      JOIN jobs j ON j.id = jt.job_id
      JOIN tenants t ON t.id = j.tenant_id
      WHERE t.slug = ? AND j.listed = 1 AND (j.expires_at IS NULL OR julianday(j.expires_at)>julianday('now'))
      GROUP BY jt.tag_slug
      HAVING total >= 5`,
    )
    .bind(tenantSlug)
    .all<{ slug: string }>();

  const geo = await db
    .prepare(
      `SELECT jl.location_slug AS slug, COUNT(*) AS total
      FROM job_locations jl
      JOIN jobs j ON j.id = jl.job_id
      JOIN tenants t ON t.id = j.tenant_id
      WHERE t.slug = ? AND j.listed = 1 AND (j.expires_at IS NULL OR julianday(j.expires_at)>julianday('now'))
      GROUP BY jl.location_slug
      HAVING total >= 5`,
    )
    .bind(tenantSlug)
    .all<{ slug: string }>();

  const salaries = await db
    .prepare(
      `SELECT DISTINCT slug FROM salary_rollups WHERE job_count_30d >= 5 AND dimension IN ('role','country','region','city','seniority') ORDER BY slug`,
    )
    .all<{ slug: string }>();

  const benefits = await db
    .prepare(
      `SELECT jb.benefit_slug AS slug, COUNT(*) AS total
      FROM job_benefits jb
      JOIN jobs j ON j.id = jb.job_id
      JOIN tenants t ON t.id = j.tenant_id
      WHERE t.slug = ? AND j.listed = 1 AND (j.expires_at IS NULL OR julianday(j.expires_at)>julianday('now'))
      GROUP BY jb.benefit_slug
      HAVING total >= 5`,
    )
    .bind(tenantSlug)
    .all<{ slug: string }>();

  return {
    jobs: jobs.results.map((row) => ({
      slug: row.slug,
      externalId: row.externalId,
    })),
    companySlugs: companies.results.map(({ nameNorm }) => slugTitle(nameNorm)),
    tagSlugs: tags.results.map((row) => row.slug),
    geoSlugs: geo.results.map((row) => row.slug),
    salarySlugs: salaries.results.map((row) => row.slug),
    benefitSlugs: benefits.results.map((row) => row.slug),
  };
}

// Geo facets never combine with a tag/remote facet in the shipped URL shape
// (parseLandingSegment rejects /berlin+solidity-jobs by design), so
// LandingKind's city/country/region variants never carry a tag - there is
// nothing to compound here as long as that contract holds.
function landingFilters(landing: LandingKind): JobListFilters {
  switch (landing.kind) {
    case "tag":
      return landing.tags.length > 1
        ? { tags: landing.tags }
        : { tag: landing.tag };
    case "remote":
      return { remoteOnly: true };
    case "remote-tag":
      return landing.tags.length > 1
        ? { tags: landing.tags, remoteOnly: true }
        : { tag: landing.tag, remoteOnly: true };
    case "city":
    case "country":
    case "region":
      return {
        locationSlug:
          landing.kind === "city"
            ? landing.city
            : landing.kind === "country"
              ? landing.country
              : landing.region,
      };
    case "benefit":
      return { benefit: landing.benefit };
    case "intern":
      return { tag: "intern" };
    case "entry-level":
      return { tag: "entry-level" };
  }
}

export async function listLandingJobs(
  db: JobsDatabase,
  tenantId: string,
  landing: LandingKind,
  page = 1,
): Promise<JobListResult> {
  return listJobs(db, tenantId, { ...landingFilters(landing), page });
}

export function landingIndexable(total: number): boolean {
  return shouldIndexLanding(total);
}

/**
 * Shared WHERE/JOIN builder for listJobs and countNewJobs so both stay in
 * sync as filters grow. The single-tag branch (`filters.tag`, or
 * `filters.tags` at length <= 1) emits the exact same unaliased
 * `JOIN job_tags jt ...` this always has - unchanged from before `tags`
 * existed. Only `filters.tags` at length > 1 adds anything new: one aliased
 * `job_tags` join per tag (jt0, jt1, ...), ANDed together.
 */
function buildJobsWhere(
  tenantId: string,
  filters: JobListFilters,
): { fromSql: string; bindings: unknown[] } {
  const joins: string[] = [];
  const joinBindings: unknown[] = [];
  const conditions = [
    "j.tenant_id = ?",
    "j.listed = 1 AND (j.expires_at IS NULL OR julianday(j.expires_at)>julianday('now'))",
    "c.listed = 1",
  ];
  const whereBindings: unknown[] = [tenantId];

  const search = filters.q ? ftsQuery(filters.q) : "";
  if (search) {
    joins.push("JOIN jobs_fts f ON f.rowid = j.rowid");
    conditions.push("jobs_fts MATCH ?");
    whereBindings.push(search);
  }

  if (filters.source?.trim()) {
    joins.push("JOIN job_sightings s ON s.job_id = j.id AND s.source = ?");
    joinBindings.push(filters.source.trim());
  }

  if (filters.hidden) {
    conditions.push("j.exclusivity = 'hidden_from_linkedin'");
  }

  if (filters.remoteOnly) {
    conditions.push("j.remote = 'remote'");
  }

  const multiTags = (filters.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
  const singleTag = filters.tag?.trim() || (multiTags.length === 1 ? multiTags[0] : undefined);

  if (singleTag) {
    if (filters.orTitle) {
      conditions.push(`(
        EXISTS (SELECT 1 FROM job_tags jt WHERE jt.job_id = j.id AND jt.tag_slug = ?)
        OR LOWER(j.title) LIKE LOWER(?) ESCAPE '\\'
      )`);
      whereBindings.push(singleTag, containsPattern(singleTag.replaceAll("-", " ")));
    } else {
      joins.push("JOIN job_tags jt ON jt.job_id = j.id AND jt.tag_slug = ?");
      joinBindings.push(singleTag);
    }
  } else if (multiTags.length > 1) {
    multiTags.forEach((tag, index) => {
      joins.push(
        `JOIN job_tags jt${index} ON jt${index}.job_id = j.id AND jt${index}.tag_slug = ?`,
      );
      joinBindings.push(tag);
    });
  }

  if (filters.locationSlug?.trim()) {
    joins.push(
      "JOIN job_locations jl ON jl.job_id = j.id AND jl.location_slug = ?",
    );
    joinBindings.push(filters.locationSlug.trim());
  }

  if (filters.benefit?.trim()) {
    joins.push(
      "JOIN job_benefits jb ON jb.job_id = j.id AND jb.benefit_slug = ?",
    );
    joinBindings.push(filters.benefit.trim());
  }

  if (filters.company?.trim()) {
    conditions.push("LOWER(c.name) LIKE LOWER(?) ESCAPE '\\'");
    whereBindings.push(containsPattern(filters.company.trim()));
  }

  if (filters.companyId?.trim()) {
    conditions.push("j.company_id = ?");
    whereBindings.push(filters.companyId.trim());
  }

  if (filters.seniority?.trim()) {
    conditions.push("LOWER(j.title) LIKE LOWER(?) ESCAPE '\\'");
    whereBindings.push(containsPattern(filters.seniority.trim()));
  }

  if (filters.hasSalary) {
    conditions.push("j.salary_min IS NOT NULL AND j.salary_max IS NOT NULL");
  }

  const fromSql = `
    FROM jobs j
    JOIN companies c ON c.id = j.company_id AND c.tenant_id = j.tenant_id
    ${joins.join("\n")}
    WHERE ${conditions.join("\n      AND ")}
  `;
  return { fromSql, bindings: [...joinBindings, ...whereBindings] };
}

export async function listJobs(
  db: JobsDatabase,
  tenantId: string,
  filters: JobListFilters,
): Promise<JobListResult> {
  const page = positiveInteger(filters.page, 1);
  const pageSize = positiveInteger(filters.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const { fromSql, bindings } = buildJobsWhere(tenantId, filters);

  const count = await db
    .prepare(`SELECT COUNT(DISTINCT j.id) AS total ${fromSql}`)
    .bind(...bindings)
    .first<number>("total");
  const total = Number(count ?? 0);

  const orderSql =
    filters.orderBy === "salary"
      ? `ORDER BY
        j.salary_max DESC,
        j.salary_min DESC,
        j.posted_at DESC,
        j.id ASC`
      : `ORDER BY
        CASE WHEN julianday(j.featured_until) > julianday('now') THEN 0 ELSE 1 END,
        j.posted_at DESC,
        j.id ASC`;

  const rows = await db
    .prepare(
      `SELECT DISTINCT
        j.id,
        j.slug,
        j.external_id AS externalId,
        j.title,
        j.company_id AS companyId,
        c.name AS companyName,
        c.name_norm AS companyNameNorm,
        CASE WHEN j.source='manual' THEN j.listing_logo_url ELSE c.logo_url END AS companyLogoUrl,
        j.location,
        j.remote,
        j.salary_text AS salaryText,
        j.salary_min AS salaryMin,
        j.salary_max AS salaryMax,
        j.highlight,
      j.highlight_color AS highlightColor,
        j.featured_until AS featuredUntil,
        j.exclusivity,
        j.posted_at AS postedAt,
        (SELECT GROUP_CONCAT(tag_slug, ',') FROM job_tags WHERE job_id = j.id) AS tagCsv
      ${fromSql}
      ${orderSql}
      LIMIT ? OFFSET ?`,
    )
    .bind(...bindings, pageSize, (page - 1) * pageSize)
    .all<JobListItem & { companyNameNorm: string; tagCsv: string | null }>();

  return {
    jobs: rows.results.map(({ companyNameNorm, tagCsv, ...job }) => ({
      ...job,
      companySlug: slugTitle(companyNameNorm),
      tags: mapTags(tagCsv),
    })),
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

export async function listHubJobs(
  db: JobsDatabase,
  tenantId: string,
  hub: string,
): Promise<JobListResult> {
  return listJobs(db, tenantId, { tag: hub, pageSize: MAX_PAGE_SIZE });
}

export interface CompanyListItem {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  jobCount: number;
  /** Most recent posted_at among this company's listed jobs, or null with none. */
  lastPostedAt: string | null;
  /** Average of the "company" salary_rollups dimension; null until that rollup runs. */
  avgSalary: number | null;
}

export async function countHiringCompanies(
  db: JobsDatabase,
  tenantId: string,
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(DISTINCT c.id) AS total
      FROM companies c
      JOIN jobs j
        ON j.company_id = c.id
        AND j.tenant_id = c.tenant_id
        AND j.listed = 1 AND (j.expires_at IS NULL OR julianday(j.expires_at)>julianday('now'))
      WHERE c.tenant_id = ? AND c.listed = 1`,
    )
    .bind(tenantId)
    .first<{ total: number | null }>();
  return Number(row?.total ?? 0);
}

export async function listCompanies(
  db: JobsDatabase,
  tenantId: string,
): Promise<CompanyListItem[]> {
  const rows = await db
    .prepare(
      `SELECT
        c.id,
        c.name,
        c.name_norm AS nameNorm,
        c.domain AS domain,
        COUNT(j.id) AS jobCount,
        MAX(j.posted_at) AS lastPostedAt
      FROM companies c
      LEFT JOIN jobs j
        ON j.company_id = c.id
        AND j.tenant_id = c.tenant_id
        AND j.listed = 1 AND (j.expires_at IS NULL OR julianday(j.expires_at)>julianday('now'))
      WHERE c.tenant_id = ? AND c.listed = 1
      GROUP BY c.id, c.name, c.name_norm, c.domain
      ORDER BY jobCount DESC, c.name ASC`,
    )
    .bind(tenantId)
    .all<{
      id: string;
      name: string;
      nameNorm: string;
      domain: string | null;
      jobCount: number | null;
      lastPostedAt: string | null;
    }>();

  // salary_rollups is empty until the crawler's rollup job runs - this
  // degrades every avgSalary to null rather than erroring or NaN-ing.
  const companyRollups = await listSalaryRollups(db, "company");
  const avgBySlug = new Map(companyRollups.map((row) => [row.slug, row.avg]));

  return rows.results.map((row) => {
    const slug = slugTitle(row.nameNorm);
    return {
      id: row.id,
      name: row.name,
      slug,
      domain: row.domain ?? null,
      jobCount: Number(row.jobCount ?? 0),
      lastPostedAt: row.lastPostedAt ?? null,
      avgSalary: avgBySlug.get(slug) ?? null,
    };
  });
}

export interface CompanyGrowthItem {
  id: string;
  name: string;
  slug: string;
  /** Listed jobs posted in the last 30 days. */
  newJobs: number;
  /** Listed jobs posted 30-60 days ago. */
  previousPeriod: number;
  difference: number;
  /**
   * Percent change vs. the previous period, rounded. `null` when
   * `previousPeriod` is 0 - there is no baseline to divide by, not a 0%
   * or infinite rate. Never NaN/Infinity.
   */
  growthPct: number | null;
}

/**
 * Two windowed COUNT(*)s over jobs.posted_at (last 30 days vs. the 30 days
 * before that), grouped by company, ordered by growth. Companies with zero
 * jobs in both windows are excluded rather than shown as a 0/0 tie.
 */
export async function listTopGrowingCompanies(
  db: JobsDatabase,
  tenantId: string,
): Promise<CompanyGrowthItem[]> {
  const rows = await db
    .prepare(
      `SELECT
        c.id,
        c.name,
        c.name_norm AS nameNorm,
        SUM(CASE WHEN j.posted_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END) AS newJobs,
        SUM(CASE
          WHEN j.posted_at < datetime('now', '-30 days')
           AND j.posted_at >= datetime('now', '-60 days')
          THEN 1 ELSE 0 END) AS previousPeriod
      FROM companies c
      JOIN jobs j
        ON j.company_id = c.id
        AND j.tenant_id = c.tenant_id
        AND j.listed = 1 AND (j.expires_at IS NULL OR julianday(j.expires_at)>julianday('now'))
        AND j.posted_at IS NOT NULL
      WHERE c.tenant_id = ? AND c.listed = 1
      GROUP BY c.id, c.name, c.name_norm
      HAVING newJobs > 0 OR previousPeriod > 0`,
    )
    .bind(tenantId)
    .all<{
      id: string;
      name: string;
      nameNorm: string;
      newJobs: number | null;
      previousPeriod: number | null;
    }>();

  const items = rows.results.map((row) => {
    const newJobs = Number(row.newJobs ?? 0);
    const previousPeriod = Number(row.previousPeriod ?? 0);
    const difference = newJobs - previousPeriod;
    const growthPct =
      previousPeriod === 0 ? null : Math.round((difference / previousPeriod) * 100);
    return {
      id: row.id,
      name: row.name,
      slug: slugTitle(row.nameNorm),
      newJobs,
      previousPeriod,
      difference,
      growthPct,
    };
  });

  // Companies with no prior-period baseline (growthPct null) have no
  // comparable rate - rank them by raw new-job volume ahead of companies
  // whose growth we can actually measure, then sort measured growth desc.
  return items.sort((a, b) => {
    if (a.growthPct === null && b.growthPct === null) return b.newJobs - a.newJobs;
    if (a.growthPct === null) return -1;
    if (b.growthPct === null) return 1;
    return b.growthPct - a.growthPct;
  });
}

/**
 * Job counts per location_slug, restricted to slugs of the requested
 * taxonomy kind (job_locations itself carries no kind column).
 */
export async function listLocationJobCounts(
  db: JobsDatabase,
  tenantId: string,
  kind: "city" | "country" | "region",
): Promise<{ slug: string; jobCount: number }[]> {
  const rows = await db
    .prepare(
      `SELECT jl.location_slug AS slug, COUNT(DISTINCT j.id) AS jobCount
      FROM job_locations jl
      JOIN jobs j ON j.id = jl.job_id
      JOIN companies c ON c.id = j.company_id AND c.tenant_id = j.tenant_id
      WHERE j.tenant_id = ? AND j.listed = 1 AND (j.expires_at IS NULL OR julianday(j.expires_at)>julianday('now')) AND c.listed = 1
      GROUP BY jl.location_slug
      ORDER BY jobCount DESC, jl.location_slug ASC`,
    )
    .bind(tenantId)
    .all<{ slug: string; jobCount: number | null }>();

  const isKind =
    kind === "city" ? isCitySlug : kind === "country" ? isCountrySlug : isRegionSlug;

  return rows.results
    .filter((row) => isKind(row.slug))
    .map((row) => ({ slug: row.slug, jobCount: Number(row.jobCount ?? 0) }));
}

/** listJobs' filters, plus a posted-in-the-last-N-hours cutoff. */
export async function countNewJobs(
  db: JobsDatabase,
  tenantId: string,
  filters: JobListFilters,
  sinceHours: number,
): Promise<number> {
  const { fromSql, bindings } = buildJobsWhere(tenantId, filters);
  const row = await db
    .prepare(
      `SELECT COUNT(DISTINCT j.id) AS total
      ${fromSql}
        AND j.posted_at >= datetime('now', ? || ' hours')`,
    )
    .bind(...bindings, -Math.abs(sinceHours))
    .first<number>("total");
  return Number(row ?? 0);
}

/** Top job_tags for one company's listed jobs, most common first. */
export async function listCompanyTopTags(
  db: JobsDatabase,
  companyId: string,
  limit = 12,
): Promise<{ slug: string; count: number }[]> {
  const rows = await db
    .prepare(
      `SELECT jt.tag_slug AS slug, COUNT(*) AS count
      FROM job_tags jt
      JOIN jobs j ON j.id = jt.job_id
      WHERE j.company_id = ? AND j.listed = 1 AND (j.expires_at IS NULL OR julianday(j.expires_at)>julianday('now'))
      GROUP BY jt.tag_slug
      ORDER BY count DESC, jt.tag_slug ASC
      LIMIT ?`,
    )
    .bind(companyId, limit)
    .all<{ slug: string; count: number | null }>();
  return rows.results.map((row) => ({ slug: row.slug, count: Number(row.count ?? 0) }));
}

/** Distinct job_locations for one company's listed jobs. */
export async function listCompanyLocations(
  db: JobsDatabase,
  companyId: string,
): Promise<{ slug: string; count: number }[]> {
  const rows = await db
    .prepare(
      `SELECT jl.location_slug AS slug, COUNT(*) AS count
      FROM job_locations jl
      JOIN jobs j ON j.id = jl.job_id
      WHERE j.company_id = ? AND j.listed = 1 AND (j.expires_at IS NULL OR julianday(j.expires_at)>julianday('now'))
      GROUP BY jl.location_slug
      ORDER BY count DESC, jl.location_slug ASC`,
    )
    .bind(companyId)
    .all<{ slug: string; count: number | null }>();
  return rows.results.map((row) => ({ slug: row.slug, count: Number(row.count ?? 0) }));
}

/**
 * Per-location job counts for one tag, mirroring liveAggregateLocations but
 * keyed by tag instead of dimension - the hire pages' location facet.
 */
export async function listTagLocationFacets(
  db: JobsDatabase,
  tenantId: string,
  tag: string,
): Promise<{ slug: string; jobCount: number }[]> {
  const rows = await db
    .prepare(
      `SELECT jl.location_slug AS slug, COUNT(DISTINCT j.id) AS jobCount
      FROM jobs j
      JOIN companies c ON c.id = j.company_id AND c.tenant_id = j.tenant_id
      JOIN job_tags jt ON jt.job_id = j.id AND jt.tag_slug = ?
      JOIN job_locations jl ON jl.job_id = j.id
      WHERE j.tenant_id = ?
        AND j.listed = 1 AND (j.expires_at IS NULL OR julianday(j.expires_at)>julianday('now'))
        AND c.listed = 1
      GROUP BY jl.location_slug
      ORDER BY jobCount DESC, jl.location_slug ASC`,
    )
    .bind(tag, tenantId)
    .all<{ slug: string; jobCount: number | null }>();
  return rows.results.map((row) => ({ slug: row.slug, jobCount: Number(row.jobCount ?? 0) }));
}

/** MIN/MAX salary band for one tag's salaried listed jobs, for the hire pages. */
export async function tagSalaryRange(
  db: JobsDatabase,
  tenantId: string,
  tag: string,
): Promise<{ min: number | null; max: number | null; count: number }> {
  const row = await db
    .prepare(
      `SELECT
        MIN(j.salary_min) AS min,
        MAX(j.salary_max) AS max,
        COUNT(*) AS count
      FROM jobs j
      JOIN companies c ON c.id = j.company_id AND c.tenant_id = j.tenant_id
      JOIN job_tags jt ON jt.job_id = j.id AND jt.tag_slug = ?
      WHERE j.tenant_id = ?
        AND j.listed = 1 AND (j.expires_at IS NULL OR julianday(j.expires_at)>julianday('now'))
        AND c.listed = 1
        AND j.salary_min IS NOT NULL
        AND j.salary_max IS NOT NULL`,
    )
    .bind(tag, tenantId)
    .first<{ min: number | null; max: number | null; count: number | null }>();
  return {
    min: row?.min ?? null,
    max: row?.max ?? null,
    count: Number(row?.count ?? 0),
  };
}

export async function listSalaryRollups(
  db: JobsDatabase,
  dimension?: string,
): Promise<SalaryRollupRow[]> {
  const sql = dimension
    ? `SELECT dimension, slug, avg, min, max, job_count_30d AS jobCount30d
       FROM salary_rollups WHERE dimension = ? ORDER BY avg DESC`
    : `SELECT dimension, slug, avg, min, max, job_count_30d AS jobCount30d
       FROM salary_rollups ORDER BY dimension, avg DESC`;
  const statement = db.prepare(sql);
  const rows = dimension
    ? await statement.bind(dimension).all<SalaryRollupRow>()
    : await statement.all<SalaryRollupRow>();
  return rows.results;
}

/**
 * Raw salary_rollups lookup. The table (and this function) are dimension-
 * agnostic - "role", "country", "region", "seniority", "city" and "company"
 * all just key on (dimension, slug), so city/company work exactly like the
 * others already. Returns null cleanly when the rollup hasn't been computed
 * for that (dimension, slug) yet.
 */
export async function getSalaryRollup(
  db: JobsDatabase,
  dimension: string,
  slug: string,
): Promise<SalaryRollupRow | null> {
  return db
    .prepare(
      `SELECT dimension, slug, avg, min, max, job_count_30d AS jobCount30d
       FROM salary_rollups WHERE dimension = ? AND slug = ? LIMIT 1`,
    )
    .bind(dimension, slug)
    .first<SalaryRollupRow>();
}

/** @deprecated Use salaryRoleStem. solidity-developer → solidity. */
export function salaryRoleTag(role: string): string {
  return salaryRoleStem(role);
}

function jobMatchesRole(
  title: string,
  tags: string[],
  role: string,
): boolean {
  const stem = salaryRoleStem(role);
  if (tags.includes(stem) || tags.includes(role)) return true;
  return title.toLowerCase().includes(stem.replaceAll("-", " "));
}

type SalariedJobRow = {
  min: number | null;
  max: number | null;
  title: string;
  tagCsv: string | null;
};

async function listSalariedJobs(
  db: JobsDatabase,
  tenantId: string,
): Promise<SalariedJobRow[]> {
  const rows = await db
    .prepare(
      `SELECT
        j.salary_min AS min,
        j.salary_max AS max,
        j.title,
        (SELECT GROUP_CONCAT(tag_slug, ',') FROM job_tags WHERE job_id = j.id) AS tagCsv
      FROM jobs j
      JOIN companies c ON c.id = j.company_id AND c.tenant_id = j.tenant_id
      WHERE j.tenant_id = ?
        AND j.listed = 1 AND (j.expires_at IS NULL OR julianday(j.expires_at)>julianday('now'))
        AND c.listed = 1
        AND j.salary_min IS NOT NULL
        AND j.salary_max IS NOT NULL`,
    )
    .bind(tenantId)
    .all<SalariedJobRow>();
  return rows.results;
}

function statsFromRows(
  dimension: string,
  slug: string,
  rows: readonly { min: number | null; max: number | null }[],
): SalaryStatsRow | null {
  const stats = averageSalary(rows);
  if (!stats) return null;
  return {
    dimension,
    slug,
    avg: stats.avg,
    min: stats.min,
    max: stats.max,
    jobCount30d: rows.filter((row) => row.min != null && row.max != null).length,
  };
}

async function liveAggregateRoles(
  db: JobsDatabase,
  tenantId: string,
  slugs: readonly string[],
): Promise<Map<string, SalaryStatsRow>> {
  const jobs = await listSalariedJobs(db, tenantId);
  const map = new Map<string, SalaryStatsRow>();
  for (const role of slugs) {
    const matched = jobs.filter((job) =>
      jobMatchesRole(job.title, mapTags(job.tagCsv), role),
    );
    const stats = statsFromRows("role", role, matched);
    if (stats) map.set(role, stats);
  }
  return map;
}

async function liveAggregateSeniority(
  db: JobsDatabase,
  tenantId: string,
  slugs: readonly string[],
): Promise<Map<string, SalaryStatsRow>> {
  const jobs = await listSalariedJobs(db, tenantId);
  const map = new Map<string, SalaryStatsRow>();
  for (const slug of slugs) {
    const needle = slug.replaceAll("-", " ");
    const matched = jobs.filter((job) => job.title.toLowerCase().includes(needle));
    const stats = statsFromRows("seniority", slug, matched);
    if (stats) map.set(slug, stats);
  }
  return map;
}

async function liveAggregateLocations(
  db: JobsDatabase,
  tenantId: string,
  dimension: string,
  slugs: readonly string[],
): Promise<Map<string, SalaryStatsRow>> {
  const map = new Map<string, SalaryStatsRow>();
  if (slugs.length === 0) return map;
  const placeholders = slugs.map(() => "?").join(", ");
  const rows = await db
    .prepare(
      `SELECT
        jl.location_slug AS slug,
        AVG((j.salary_min + j.salary_max) / 2.0) AS avg,
        MIN(j.salary_min) AS min,
        MAX(j.salary_max) AS max,
        COUNT(*) AS jobCount30d
      FROM jobs j
      JOIN companies c ON c.id = j.company_id AND c.tenant_id = j.tenant_id
      JOIN job_locations jl ON jl.job_id = j.id
      WHERE j.tenant_id = ?
        AND j.listed = 1 AND (j.expires_at IS NULL OR julianday(j.expires_at)>julianday('now'))
        AND c.listed = 1
        AND j.salary_min IS NOT NULL
        AND j.salary_max IS NOT NULL
        AND jl.location_slug IN (${placeholders})
      GROUP BY jl.location_slug`,
    )
    .bind(tenantId, ...slugs)
    .all<{
      slug: string;
      avg: number | null;
      min: number | null;
      max: number | null;
      jobCount30d: number | null;
    }>();

  for (const row of rows.results) {
    const count = Number(row.jobCount30d ?? 0);
    if (count === 0 || row.avg == null || row.min == null || row.max == null) continue;
    map.set(row.slug, {
      dimension,
      slug: row.slug,
      avg: Math.round(Number(row.avg)),
      min: Number(row.min),
      max: Number(row.max),
      jobCount30d: count,
    });
  }
  return map;
}

async function liveAggregateMany(
  db: JobsDatabase,
  tenantId: string,
  dimension: string,
  slugs: readonly string[],
): Promise<Map<string, SalaryStatsRow>> {
  if (slugs.length === 0) return new Map();
  if (dimension === "role") return liveAggregateRoles(db, tenantId, slugs);
  if (dimension === "seniority") return liveAggregateSeniority(db, tenantId, slugs);
  return liveAggregateLocations(db, tenantId, dimension, slugs);
}

function asStatsRow(row: SalaryRollupRow | SalaryStatsRow): SalaryStatsRow {
  return {
    dimension: row.dimension,
    slug: row.slug,
    avg: row.avg,
    min: row.min,
    max: row.max,
    jobCount30d: row.jobCount30d,
  };
}

/** Rollups first, then live aggregation for any taxonomy slug still missing. */
export async function listResolvedSalaryStats(
  db: JobsDatabase,
  tenantId: string,
  dimension: string,
  slugs: readonly string[],
): Promise<SalaryStatsRow[]> {
  const stored = await listSalaryRollups(db, dimension);
  const storedBySlug = new Map(stored.map((row) => [row.slug, asStatsRow(row)]));
  const missing = slugs.filter((slug) => !storedBySlug.has(slug));
  const live = await liveAggregateMany(db, tenantId, dimension, missing);
  return slugs.map(
    (slug) => storedBySlug.get(slug) ?? live.get(slug) ?? emptySalaryStats(dimension, slug),
  );
}

export async function resolveSalaryStats(
  db: JobsDatabase,
  tenantId: string,
  dimension: string,
  slug: string,
): Promise<SalaryRollupRow | null> {
  const [row] = await listResolvedSalaryStats(db, tenantId, dimension, [slug]);
  if (!row || row.jobCount30d === 0 || row.avg == null || row.min == null || row.max == null) {
    return null;
  }
  return {
    dimension: row.dimension,
    slug: row.slug,
    avg: row.avg,
    min: row.min,
    max: row.max,
    jobCount30d: row.jobCount30d,
  };
}

export interface SalaryBreakdownRow {
  slug: string;
  min: number;
  avg: number;
  max: number;
  count: number;
}

async function salariedJobsForTag(
  db: JobsDatabase,
  tenantId: string,
  tag: string,
): Promise<{ min: number; max: number; title: string; locationSlugs: string[] }[]> {
  const rows = await db
    .prepare(
      `SELECT
        j.salary_min AS min,
        j.salary_max AS max,
        j.title,
        (SELECT GROUP_CONCAT(location_slug, ',') FROM job_locations WHERE job_id = j.id) AS locationCsv
      FROM jobs j
      JOIN companies c ON c.id = j.company_id AND c.tenant_id = j.tenant_id
      JOIN job_tags jt ON jt.job_id = j.id AND jt.tag_slug = ?
      WHERE j.tenant_id = ?
        AND j.listed = 1 AND (j.expires_at IS NULL OR julianday(j.expires_at)>julianday('now'))
        AND c.listed = 1
        AND j.salary_min IS NOT NULL
        AND j.salary_max IS NOT NULL`,
    )
    .bind(tag, tenantId)
    .all<{ min: number; max: number; title: string; locationCsv: string | null }>();
  return rows.results.map((row) => ({
    min: row.min,
    max: row.max,
    title: row.title,
    locationSlugs: mapTags(row.locationCsv),
  }));
}

/**
 * Live salary breakdown for one tag, bucketed by country or seniority - the
 * per-tag salary table on the hire/salary pages. With 0 salaried rows
 * locally (the current reality) this returns [] rather than throwing or
 * producing NaN buckets.
 */
export async function resolveSalaryBreakdown(
  db: JobsDatabase,
  tenantId: string,
  filter: { tag: string },
  by: "country" | "seniority",
): Promise<SalaryBreakdownRow[]> {
  const jobs = await salariedJobsForTag(db, tenantId, filter.tag);
  if (jobs.length === 0) return [];

  const buckets = new Map<string, { min: number; max: number }[]>();
  const addTo = (slug: string, job: { min: number; max: number }) => {
    const bucket = buckets.get(slug);
    if (bucket) bucket.push(job);
    else buckets.set(slug, [job]);
  };

  if (by === "seniority") {
    for (const job of jobs) {
      const title = job.title.toLowerCase();
      for (const seniority of SENIORITY_SLUGS) {
        if (title.includes(seniority.replaceAll("-", " "))) addTo(seniority, job);
      }
    }
  } else {
    for (const job of jobs) {
      for (const slug of job.locationSlugs) {
        if (isCountrySlug(slug)) addTo(slug, job);
      }
    }
  }

  const results: SalaryBreakdownRow[] = [];
  for (const [slug, rows] of buckets) {
    const stats = averageSalary(rows);
    if (!stats) continue;
    results.push({ slug, min: stats.min, avg: stats.avg, max: stats.max, count: rows.length });
  }
  return results.sort((a, b) => b.avg - a.avg);
}
