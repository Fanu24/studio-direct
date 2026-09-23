import {
  publicSalaryStats,
  annualUsdSalarySql,
  SCRAPED_SALARY_SQL,
  isCitySlug,
  slugTitle,
  SALARY_ROLES,
  COUNTRIES,
  REGIONS,
  SENIORITY_SLUGS,
} from "@gaming/shared";

export type RollupDimension = "role" | "country" | "seniority" | "region" | "city" | "company";

export type RollupRow = {
  dimension: RollupDimension;
  slug: string;
  avg: number;
  min: number;
  max: number;
  jobCount30d: number;
};

type SalaryRow = {
  min: number | null;
  max: number | null;
  title: string;
  location: string | null;
  tags: string | null;
  locations: string | null;
  companyNameNorm: string | null;
};

/**
 * Same shape as @gaming/shared's buildSalaryRollup, extended to also cover
 * the "city" and "company" dimensions (buildSalaryRollup's own dimension
 * union is narrower and lives in a package this crawler does not own).
 */
export function buildRollupRow(
  dimension: RollupDimension,
  slug: string,
  rows: readonly { min: number | null; max: number | null }[],
): RollupRow | null {
  const stats = publicSalaryStats(rows);
  if (!stats) return null;
  return {
    dimension,
    slug,
    avg: stats.avg,
    min: stats.min,
    max: stats.max,
    jobCount30d: stats.count,
  };
}

/** Distinct city slugs actually present among the given (salaried) job rows. */
export function citiesWithJobs(rows: readonly SalaryRow[]): string[] {
  const cities = new Set<string>();
  for (const row of rows) {
    for (const token of (row.locations ?? "").split(/\s+/).filter(Boolean)) {
      if (isCitySlug(token)) cities.add(token);
    }
  }
  return [...cities];
}

/** Distinct company name_norm values actually present among the given (salaried) job rows. */
export function companiesWithJobs(rows: readonly SalaryRow[]): string[] {
  const companies = new Set<string>();
  for (const row of rows) {
    if (row.companyNameNorm) companies.add(row.companyNameNorm);
  }
  return [...companies];
}

export function salaryRoleStem(role: string): string {
  return role.endsWith("-developer") ? role.slice(0, -"-developer".length) : role;
}

export function matchesRole(title: string, tags: string | null, role: string): boolean {
  const stem = salaryRoleStem(role);
  const tagList = (tags ?? "").split(/\s+/).filter(Boolean);
  if (tagList.includes(stem) || tagList.includes(role)) return true;
  const hay = `${title} ${tags ?? ""}`.toLowerCase().replaceAll("-", " ");
  return hay.includes(stem.replaceAll("-", " "));
}

/** Match a country/region slug via job_locations, falling back to location text. */
export function locationMatchesSlug(
  location: string | null,
  locationSlugs: string | null,
  slug: string,
): boolean {
  const tokens = (locationSlugs ?? "").toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (tokens.includes(slug)) return true;
  return (location ?? "").toLowerCase().includes(slug.replaceAll("-", " "));
}

export async function rebuildSalaryRollups(
  db: D1Database,
  nowIso: string,
): Promise<number> {
  const { results } = await db
    .prepare(
      `SELECT
        ${annualUsdSalarySql('min')} AS min,
        ${annualUsdSalarySql('max')} AS max,
        j.title,
        j.location,
        c.name_norm AS companyNameNorm,
        GROUP_CONCAT(t.tag_slug, ' ') AS tags,
        GROUP_CONCAT(jl.location_slug, ' ') AS locations
      FROM jobs j
      JOIN companies c ON c.id = j.company_id AND c.tenant_id=j.tenant_id AND c.listed=1
      LEFT JOIN job_tags t ON t.job_id = j.id
      LEFT JOIN job_locations jl ON jl.job_id = j.id
      WHERE j.listed = 1 AND j.confidential = 0 AND (j.expires_at IS NULL OR julianday(j.expires_at)>julianday(?))
        AND ${SCRAPED_SALARY_SQL}
      GROUP BY j.id`,
    )
    .bind(nowIso)
    .all<SalaryRow>();

  const statements = [db.prepare(`DELETE FROM salary_rollups`)];
  let written = 0;

  const write = async (
    dimension: RollupDimension,
    slug: string,
    rows: SalaryRow[],
  ) => {
    const rollup = buildRollupRow(dimension, slug, rows);
    if (!rollup) return;
    statements.push(db
      .prepare(
        `INSERT INTO salary_rollups
          (dimension, slug, avg, min, max, job_count_30d, computed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        rollup.dimension,
        rollup.slug,
        rollup.avg,
        rollup.min,
        rollup.max,
        rollup.jobCount30d,
        nowIso,
      ));
    written += 1;
  };

  for (const role of SALARY_ROLES) {
    await write(
      "role",
      role,
      results.filter((row) => matchesRole(row.title, row.tags, role)),
    );
  }

  for (const country of COUNTRIES) {
    await write(
      "country",
      country,
      results.filter((row) => locationMatchesSlug(row.location, row.locations, country)),
    );
  }

  for (const region of REGIONS) {
    await write(
      "region",
      region,
      results.filter((row) => locationMatchesSlug(row.location, row.locations, region)),
    );
  }

  for (const seniority of SENIORITY_SLUGS) {
    await write(
      "seniority",
      seniority,
      results.filter((row) => row.title.toLowerCase().includes(seniority)),
    );
  }

  for (const city of citiesWithJobs(results)) {
    await write(
      "city",
      city,
      results.filter((row) => locationMatchesSlug(row.location, row.locations, city)),
    );
  }

  for (const companyNameNorm of companiesWithJobs(results)) {
    await write(
      "company",
      slugTitle(companyNameNorm),
      results.filter((row) => row.companyNameNorm === companyNameNorm),
    );
  }

  await db.batch(statements);
  return written;
}
