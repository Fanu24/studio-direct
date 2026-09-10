import { readFileSync } from "node:fs";

import { normalizeCompanyName, TENANT_NAME, TENANT_SLUG } from "@gaming/shared";

export { TENANT_NAME, TENANT_SLUG };

const TENANT_ID = "tenant:gaming";
const CREATED_AT = "2026-09-02T00:00:00.000Z";

export interface SeedCompany {
  name: string;
  domain: string;
  logo_url?: string;
  career_url: string;
  ats_type: string;
  ats_slug: string;
  listed: 1;
}

export interface SeedRunResult {
  changes?: number;
  meta?: {
    changes?: number;
  };
}

export interface SeedStatement {
  bind(...values: unknown[]): SeedStatement;
  run(): Promise<SeedRunResult>;
}

export interface SeedDatabase {
  prepare(sql: string): SeedStatement;
}

export interface SeedResult {
  tenantsInserted: number;
  companiesInserted: number;
}

export const SEED_COMPANIES = JSON.parse(
  readFileSync(new URL("../seed/companies.json", import.meta.url), "utf8"),
) as SeedCompany[];

const INSERT_TENANT = `
  INSERT OR IGNORE INTO tenants (id, slug, name)
  VALUES (?, ?, ?)
`;

const INSERT_COMPANY = `
  INSERT OR IGNORE INTO companies (
    id,
    tenant_id,
    name,
    name_norm,
    domain,
    logo_url,
    career_url,
    ats_type,
    ats_slug,
    listed,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function changes(result: SeedRunResult): number {
  return result.meta?.changes ?? result.changes ?? 0;
}

/**
 * Derive a logo URL for a seeded company. Seeded companies are real,
 * publicly known studios with a public domain, so pointing at that domain's
 * favicon/logo endpoint is not invented data - it is only used so the local
 * dev fixture exercises the logo column instead of leaving it null.
 */
function seedLogoUrl(company: SeedCompany): string {
  return company.logo_url ?? `https://logo.clearbit.com/${company.domain}`;
}

export async function seedLocal(db: SeedDatabase): Promise<SeedResult> {
  const tenantResult = await db
    .prepare(INSERT_TENANT)
    .bind(TENANT_ID, TENANT_SLUG, TENANT_NAME)
    .run();

  let companiesInserted = 0;
  for (const company of SEED_COMPANIES) {
    const nameNorm = normalizeCompanyName(company.name);
    const result = await db
      .prepare(INSERT_COMPANY)
      .bind(
        `company:${nameNorm}`,
        TENANT_ID,
        company.name,
        nameNorm,
        company.domain,
        seedLogoUrl(company),
        company.career_url,
        company.ats_type,
        company.ats_slug,
        company.listed,
        CREATED_AT,
      )
      .run();
    companiesInserted += changes(result);
  }

  return {
    tenantsInserted: changes(tenantResult),
    companiesInserted,
  };
}
