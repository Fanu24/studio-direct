import {
  jobHubSlugs,
  slugTitle,
  type HubRoleSlug,
} from "@gaming/shared";

export interface JobListFilters {
  hidden?: boolean;
  q?: string;
  company?: string;
  companyId?: string;
  seniority?: string;
  source?: string;
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
}

export interface JobListItem {
  id: string;
  slug: string;
  title: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  location: string | null;
  remote: string;
  salaryText: string | null;
  exclusivity: string;
  postedAt: string | null;
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
  title: string;
  companyName: string;
  companySlug: string;
  location: string | null;
  remote: string;
  descriptionHtml: string;
  applyUrl: string;
  salaryText: string | null;
  exclusivity: string;
  postedAt: string | null;
}

export interface CompanyHub {
  id: string;
  name: string;
  slug: string;
}

export interface SitemapEntries {
  jobSlugs: string[];
  companySlugs: string[];
}

const DEFAULT_PAGE_SIZE = 20;
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

export async function getJobBySlug(
  db: JobsDatabase,
  tenantId: string,
  slug: string,
): Promise<JobDetail | null> {
  const row = await db
    .prepare(
      `SELECT
        j.id,
        j.slug,
        j.title,
        c.name AS companyName,
        c.name_norm AS companyNameNorm,
        j.location,
        j.remote,
        j.description_html AS descriptionHtml,
        j.apply_url AS applyUrl,
        j.salary_text AS salaryText,
        j.exclusivity,
        j.posted_at AS postedAt
      FROM jobs j
      JOIN companies c ON c.id = j.company_id AND c.tenant_id = j.tenant_id
      WHERE j.tenant_id = ?
        AND j.slug = ?
        AND j.listed = 1
        AND c.listed = 1
      LIMIT 1`,
    )
    .bind(tenantId, slug)
    .first<JobDetail & { companyNameNorm: string }>();

  if (!row) return null;
  const { companyNameNorm, ...job } = row;
  return { ...job, companySlug: slugTitle(companyNameNorm) };
}

export async function getCompanyBySlug(
  db: JobsDatabase,
  tenantId: string,
  slug: string,
): Promise<CompanyHub | null> {
  if (slugTitle(slug) !== slug) return null;

  const company = await db
    .prepare(
      `SELECT id, name, name_norm AS nameNorm
      FROM companies
      WHERE tenant_id = ? AND name_norm = ? AND listed = 1
      LIMIT 1`,
    )
    .bind(tenantId, slug)
    .first<{ id: string; name: string; nameNorm: string }>();
  return company
    ? { id: company.id, name: company.name, slug: slugTitle(company.nameNorm) }
    : null;
}

export async function listSitemapEntries(
  db: JobsDatabase,
  tenantSlug: string,
): Promise<SitemapEntries> {
  const jobs = await db
    .prepare(
      `SELECT j.slug
      FROM jobs j
      JOIN tenants t ON t.id = j.tenant_id
      JOIN companies c ON c.id = j.company_id AND c.tenant_id = j.tenant_id
      WHERE t.slug = ?
        AND j.listed = 1
        AND c.listed = 1
        AND j.remote IN ('remote', 'hybrid')
      ORDER BY j.slug`,
    )
    .bind(tenantSlug)
    .all<{ slug: string }>();

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

  return {
    jobSlugs: jobs.results.map(({ slug }) => slug),
    companySlugs: companies.results.map(({ nameNorm }) => slugTitle(nameNorm)),
  };
}

export async function listJobs(
  db: JobsDatabase,
  tenantId: string,
  filters: JobListFilters,
): Promise<JobListResult> {
  const page = positiveInteger(filters.page, 1);
  const pageSize = positiveInteger(filters.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const joins: string[] = [];
  const joinBindings: unknown[] = [];
  const conditions = [
    "j.tenant_id = ?",
    "j.listed = 1",
    "c.listed = 1",
    "j.remote IN ('remote', 'hybrid')",
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

  const fromSql = `
    FROM jobs j
    JOIN companies c ON c.id = j.company_id AND c.tenant_id = j.tenant_id
    ${joins.join("\n")}
    WHERE ${conditions.join("\n      AND ")}
  `;
  const bindings = [...joinBindings, ...whereBindings];

  const count = await db
    .prepare(`SELECT COUNT(DISTINCT j.id) AS total ${fromSql}`)
    .bind(...bindings)
    .first<number>("total");
  const total = Number(count ?? 0);

  const rows = await db
    .prepare(
      `SELECT DISTINCT
        j.id,
        j.slug,
        j.title,
        j.company_id AS companyId,
        c.name AS companyName,
        c.name_norm AS companyNameNorm,
        j.location,
        j.remote,
        j.salary_text AS salaryText,
        j.exclusivity,
        j.posted_at AS postedAt
      ${fromSql}
      ORDER BY j.posted_at DESC, j.id ASC
      LIMIT ? OFFSET ?`,
    )
    .bind(...bindings, pageSize, (page - 1) * pageSize)
    .all<JobListItem & { companyNameNorm: string }>();

  return {
    jobs: rows.results.map(({ companyNameNorm, ...job }) => ({
      ...job,
      companySlug: slugTitle(companyNameNorm),
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
  hub: HubRoleSlug,
): Promise<JobListResult> {
  const pageSize = MAX_PAGE_SIZE;
  const q = hub.replaceAll("-", " ");
  const firstPage = await listJobs(db, tenantId, { pageSize, q });
  const jobs = [...firstPage.jobs];

  for (let page = 2; page <= firstPage.totalPages; page += 1) {
    const result = await listJobs(db, tenantId, { page, pageSize, q });
    jobs.push(...result.jobs);
  }

  const matchingJobs = jobs.filter((job) => jobHubSlugs(job.title).includes(hub));
  return {
    jobs: matchingJobs,
    page: 1,
    pageSize: matchingJobs.length,
    total: matchingJobs.length,
    totalPages: matchingJobs.length === 0 ? 0 : 1,
  };
}
