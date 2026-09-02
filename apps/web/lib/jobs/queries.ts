export interface JobListFilters {
  hidden?: boolean;
  q?: string;
  company?: string;
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
  first<T = unknown>(column: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

export interface JobListItem {
  id: string;
  slug: string;
  title: string;
  companyId: string;
  companyName: string;
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
    .all<JobListItem>();

  return {
    jobs: rows.results,
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}
