import { readFileSync } from "node:fs";

import { normalizeCompanyName } from "../../shared/src/index.ts";

export const TENANT_SLUG = "gaming";
export const TENANT_NAME = "Studio Direct";

const TENANT_ID = "tenant:gaming";
const CREATED_AT = "2026-09-02T00:00:00.000Z";

export interface SeedCompany {
  name: string;
  domain: string;
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
    career_url,
    ats_type,
    ats_slug,
    listed,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function changes(result: SeedRunResult): number {
  return result.meta?.changes ?? result.changes ?? 0;
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
