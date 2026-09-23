import { slugTitle } from "@gaming/shared";

import {
  listCompanies,
  type CompanyListItem,
  type JobsDatabase,
} from "../jobs/queries";

/**
 * Path segments that live under /web3-companies as their own static routes.
 * A company whose derived slug collides with one of these would otherwise be
 * unreachable (Next resolves the static segment first), so the dynamic
 * [slug] route 404s them instead of rendering a page nobody can navigate to.
 */
export const RESERVED_COMPANY_SLUGS = ["top-growing", "tag"] as const;

const reserved: ReadonlySet<string> = new Set(RESERVED_COMPANY_SLUGS);

export function isReservedCompanySlug(slug: string): boolean {
  return reserved.has(slug.toLowerCase());
}

/**
 * Route params arrive percent-encoded ("/web3-companies/foo%2Bbar" reaches the
 * page as the literal "foo%2Bbar"), so every company slug must be decoded
 * before it is compared with a database slug. A malformed escape sequence
 * makes decodeURIComponent throw - fall back to the raw segment rather than
 * 500 the route.
 */
export function decodeCompanySlug(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * The reference indexes a TOP 100; anything past that is a long tail nobody
 * scrolls. Lives here rather than in the page module because Next's typed
 * routes reject any export from a page.tsx that is not a route hook.
 */
export const DIRECTORY_LIMIT = 100;

/**
 * The growth leaderboard's cap, matching the reference's top 20. Sorted by
 * growth rather than raw job count, this keeps /web3-companies/top-growing a
 * hiring-velocity signal instead of a second copy of the full index.
 */
export const TOP_GROWING_LIMIT = 20;

export interface CompanyDirectoryItem extends CompanyListItem {
  /** companies.logo_url (migration 0006), null for most rows. */
  logoUrl: string | null;
  /**
   * The company's most common job tag, used as its directory category. We
   * have no editorial industry column, so this is derived from real listings
   * rather than invented - null when the company has no tagged listed job.
   */
  category: string | null;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * jobs.posted_at is not one format. The import writes ISO
 * ("2026-09-01T09:00:00.000Z") for some rows and the RFC 1123 string the
 * upstream feed sends ("Fri, 13 Jun 2025 09:00:00 GMT") for the rest - in the
 * local database that split is roughly 7 rows to 1,035. String comparison
 * across the two is meaningless: every "Fri, ..." sorts above every "2026-..."
 * because a letter outranks a digit, which is why a plain
 * `posted_at >= datetime('now', '-30 days')` counts the entire legacy backlog
 * as posted today.
 *
 * This builds a SQL expression that normalises either shape to "YYYY-MM-DD"
 * so date windows and month buckets are comparable. RFC 1123 puts the day at
 * offset 6 with either one or two digits, so the month name and year offsets
 * shift by one - that is what the inner `substr(..., 7, 1) = ' '` test picks.
 *
 * The real fix is storing one format at ingest; until that happens every date
 * comparison this module makes goes through here.
 */
function postedDateSql(column: string): string {
  const shortDay = `substr(${column}, 7, 1) = ' '`;
  const monthName = `CASE WHEN ${shortDay} THEN substr(${column}, 8, 3) ELSE substr(${column}, 9, 3) END`;
  const monthNumber = MONTH_NAMES.map(
    (name, index) => `WHEN '${name}' THEN '${String(index + 1).padStart(2, "0")}'`,
  ).join(" ");

  return `CASE
    WHEN substr(${column}, 5, 1) = '-' THEN substr(${column}, 1, 10)
    ELSE (CASE WHEN ${shortDay} THEN substr(${column}, 12, 4) ELSE substr(${column}, 13, 4) END)
      || '-' || (CASE ${monthName} ${monthNumber} ELSE '00' END)
      || '-' || (CASE WHEN ${shortDay} THEN '0' || substr(${column}, 6, 1) ELSE substr(${column}, 6, 2) END)
  END`;
}

async function companyLogoMap(
  db: JobsDatabase,
  tenantId: string,
): Promise<Map<string, string>> {
  const rows = await db
    .prepare(
      `SELECT id, logo_url AS logoUrl
      FROM companies
      WHERE tenant_id = ? AND listed = 1 AND logo_url IS NOT NULL AND logo_url <> ''`,
    )
    .bind(tenantId)
    .all<{ id: string; logoUrl: string | null }>();

  const map = new Map<string, string>();
  for (const row of rows.results) {
    if (row.logoUrl) map.set(row.id, row.logoUrl);
  }
  return map;
}

/**
 * One grouped pass over job_tags, ordered so the first row seen for a company
 * is its most common tag. Reduced in JS instead of with a window function so
 * the query stays inside the SQLite subset D1 has shipped everywhere.
 */
async function companyCategoryMap(
  db: JobsDatabase,
  tenantId: string,
): Promise<Map<string, string>> {
  const rows = await db
    .prepare(
      `SELECT j.company_id AS companyId, jt.tag_slug AS slug, COUNT(*) AS count
      FROM job_tags jt
      JOIN jobs j ON j.id = jt.job_id
      WHERE j.tenant_id = ? AND j.listed = 1 AND j.confidential = 0
      GROUP BY j.company_id, jt.tag_slug
      ORDER BY j.company_id ASC, count DESC, jt.tag_slug ASC`,
    )
    .bind(tenantId)
    .all<{ companyId: string; slug: string; count: number | null }>();

  const map = new Map<string, string>();
  for (const row of rows.results) {
    if (!map.has(row.companyId)) map.set(row.companyId, row.slug);
  }
  return map;
}

/**
 * MAX(posted_at) is unusable across the two stored formats - every
 * "Wed, 8 Jul 2026 ..." string sorts above every "2026-09-01T..." one, so the
 * plain aggregate in listCompanies reports a company's oldest RFC 1123 row as
 * its newest posting. Aggregating the normalised date instead gives the
 * directory's "Last Job Posted" column a real answer.
 */
async function companyLastPostedMap(
  db: JobsDatabase,
  tenantId: string,
): Promise<Map<string, string>> {
  const rows = await db
    .prepare(
      `SELECT j.company_id AS companyId, MAX(${postedDateSql("j.posted_at")}) AS lastPostedAt
      FROM jobs j
      WHERE j.tenant_id = ? AND j.listed = 1 AND j.confidential = 0 AND j.posted_at IS NOT NULL AND j.posted_at <> ''
      GROUP BY j.company_id`,
    )
    .bind(tenantId)
    .all<{ companyId: string; lastPostedAt: string | null }>();

  const map = new Map<string, string>();
  for (const row of rows.results) {
    if (row.lastPostedAt && /^\d{4}-\d{2}-\d{2}$/.test(row.lastPostedAt)) {
      map.set(row.companyId, row.lastPostedAt);
    }
  }
  return map;
}

/**
 * The ranked company index: every listed company with its role count, logo,
 * derived category, average salary and last posting date. `category` filters
 * the index down to one facet; `limit` caps the leaderboard.
 */
export async function listCompanyDirectory(
  db: JobsDatabase,
  tenantId: string,
  options: { limit?: number; category?: string } = {},
): Promise<CompanyDirectoryItem[]> {
  const [companies, logos, categories, lastPosted] = await Promise.all([
    listCompanies(db, tenantId),
    companyLogoMap(db, tenantId),
    companyCategoryMap(db, tenantId),
    companyLastPostedMap(db, tenantId),
  ]);

  let items: CompanyDirectoryItem[] = companies.map((company) => ({
    ...company,
    lastPostedAt: lastPosted.get(company.id) ?? company.lastPostedAt,
    logoUrl: logos.get(company.id) ?? null,
    category: categories.get(company.id) ?? null,
  }));

  if (options.category) {
    items = items.filter((item) => item.category === options.category);
  }

  return typeof options.limit === "number" ? items.slice(0, options.limit) : items;
}

export interface CompanyCategoryFacet {
  slug: string;
  companyCount: number;
}

/**
 * The category chip cloud above the index - one chip per derived category,
 * most companies first. Built from the same derivation the table column uses
 * so a chip never leads to an empty page.
 */
export async function listCompanyCategories(
  db: JobsDatabase,
  tenantId: string,
  limit = 48,
): Promise<CompanyCategoryFacet[]> {
  const companies = await listCompanyDirectory(db, tenantId);
  const counts = new Map<string, number>();
  for (const company of companies) {
    if (!company.category) continue;
    counts.set(company.category, (counts.get(company.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([slug, companyCount]) => ({ slug, companyCount }))
    .sort((a, b) => b.companyCount - a.companyCount || a.slug.localeCompare(b.slug))
    .slice(0, limit);
}

export interface MonthlyPostingCount {
  /** "YYYY-MM". */
  month: string;
  count: number;
}

/**
 * Listed jobs grouped by the month they were posted, oldest first, trimmed to
 * the most recent `months` buckets - the hiring-volume history under the
 * growth leaderboard. Months with no postings are simply absent rather than
 * back-filled with a fabricated zero, and a row whose posted_at matches
 * neither known format is dropped rather than bucketed into a wrong month.
 */
export async function listMonthlyPostings(
  db: JobsDatabase,
  tenantId: string,
  months = 24,
): Promise<MonthlyPostingCount[]> {
  const rows = await db
    .prepare(
      `SELECT substr(${postedDateSql("posted_at")}, 1, 7) AS month, COUNT(*) AS count
      FROM jobs
      WHERE tenant_id = ? AND listed = 1 AND confidential = 0 AND posted_at IS NOT NULL AND posted_at <> ''
      GROUP BY month
      ORDER BY month ASC`,
    )
    .bind(tenantId)
    .all<{ month: string | null; count: number | null }>();

  const parsed = rows.results
    .filter((row): row is { month: string; count: number | null } =>
      typeof row.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(row.month),
    )
    .map((row) => ({ month: row.month, count: Number(row.count ?? 0) }));

  return months > 0 ? parsed.slice(-months) : parsed;
}

export interface CompanyGrowthRow {
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
   * `previousPeriod` is 0 - there is no baseline to divide by, not a 0% or
   * infinite rate. Never NaN/Infinity.
   */
  growthPct: number | null;
}

/**
 * Two windowed counts over the normalised posting date (last 30 days vs. the
 * 30 days before that), grouped by company, ordered by growth. This is
 * lib/jobs/queries.ts's listTopGrowingCompanies with postedDateSql applied -
 * that one compares raw posted_at strings, so with the mixed formats above it
 * scores every legacy row as new and leaves every previous period at 0,
 * which renders the whole leaderboard as "New".
 */
export async function listCompanyGrowth(
  db: JobsDatabase,
  tenantId: string,
): Promise<CompanyGrowthRow[]> {
  const posted = postedDateSql("j.posted_at");
  const rows = await db
    .prepare(
      `SELECT
        c.id,
        c.name,
        c.name_norm AS nameNorm,
        SUM(CASE WHEN ${posted} >= date('now', '-30 days') THEN 1 ELSE 0 END) AS newJobs,
        SUM(CASE
          WHEN ${posted} < date('now', '-30 days')
           AND ${posted} >= date('now', '-60 days')
          THEN 1 ELSE 0 END) AS previousPeriod
      FROM companies c
      JOIN jobs j
        ON j.company_id = c.id
        AND j.tenant_id = c.tenant_id
        AND j.listed = 1 AND j.confidential = 0
        AND j.posted_at IS NOT NULL
        AND j.posted_at <> ''
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

  return rows.results
    .map((row) => {
      const newJobs = Number(row.newJobs ?? 0);
      const previousPeriod = Number(row.previousPeriod ?? 0);
      const difference = newJobs - previousPeriod;
      return {
        id: row.id,
        name: row.name,
        slug: slugTitle(row.nameNorm),
        newJobs,
        previousPeriod,
        difference,
        growthPct:
          previousPeriod === 0 ? null : Math.round((difference / previousPeriod) * 100),
      };
    })
    // Measurable growth leads, then the companies with no prior-period
    // baseline by raw new-job volume. This is the inverse of
    // lib/jobs/queries.ts's listTopGrowingCompanies, which ranks the
    // no-baseline rows first: with a real index most companies posted nothing
    // in the previous window, so that ordering fills the entire top 20 with
    // "New" and hides every company whose rate can actually be computed.
    .sort((a, b) => {
      if (a.growthPct === null && b.growthPct === null) return b.newJobs - a.newJobs;
      if (a.growthPct === null) return 1;
      if (b.growthPct === null) return -1;
      return b.growthPct - a.growthPct || b.newJobs - a.newJobs;
    });
}

/** "2026-09" -> "Sep 2026". Returns the raw value if it isn't a YYYY-MM. */
export function monthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  const index = Number(match[2]) - 1;
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const name = names[index];
  return name ? `${name} ${match[1]}` : month;
}
