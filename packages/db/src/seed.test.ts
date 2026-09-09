import { describe, expect, it } from "vitest";
import {
  SEED_COMPANIES,
  TENANT_NAME,
  TENANT_SLUG,
  seedLocal,
  type SeedDatabase,
  type SeedRunResult,
} from "./seed.ts";

class MemoryStatement {
  private values: unknown[] = [];

  constructor(
    private readonly db: MemorySeedDatabase,
    private readonly sql: string,
  ) {}

  bind(...values: unknown[]): MemoryStatement {
    this.values = values;
    return this;
  }

  async run(): Promise<SeedRunResult> {
    if (this.sql.includes("INSERT OR IGNORE INTO tenants")) {
      const [id, slug, name] = this.values as string[];
      if (this.db.tenantSlugs.has(slug)) return { changes: 0 };
      this.db.tenantSlugs.add(slug);
      this.db.tenants.set(id, { slug, name });
      return { changes: 1 };
    }

    if (this.sql.includes("INSERT OR IGNORE INTO companies")) {
      const [id, tenantId, name, nameNorm, domain, logoUrl, careerUrl, atsType, atsSlug, listed] =
        this.values as [
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          number,
        ];
      const uniqueKey = `${tenantId}:${nameNorm}`;
      if (this.db.companyKeys.has(uniqueKey)) return { changes: 0 };
      this.db.companyKeys.add(uniqueKey);
      this.db.companies.set(id, {
        tenantId,
        name,
        nameNorm,
        domain,
        logoUrl,
        careerUrl,
        atsType,
        atsSlug,
        listed,
      });
      return { changes: 1 };
    }

    throw new Error(`Unexpected SQL: ${this.sql}`);
  }
}

class MemorySeedDatabase implements SeedDatabase {
  readonly tenantSlugs = new Set<string>();
  readonly tenants = new Map<string, { slug: string; name: string }>();
  readonly companyKeys = new Set<string>();
  readonly companies = new Map<
    string,
    {
      tenantId: string;
      name: string;
      nameNorm: string;
      domain: string;
      logoUrl: string;
      careerUrl: string;
      atsType: string;
      atsSlug: string;
      listed: number;
    }
  >();

  prepare(sql: string): MemoryStatement {
    return new MemoryStatement(this, sql);
  }
}

describe("seed", () => {
  it("uses tenant gaming and five HTTPS companies", () => {
    expect(TENANT_SLUG).toBe("nodework");
    expect(TENANT_NAME).toBe("Nodework");
    expect(SEED_COMPANIES).toHaveLength(5);
    expect(SEED_COMPANIES.every((company) => company.career_url.startsWith("https://"))).toBe(
      true,
    );
    expect(SEED_COMPANIES.every((company) => company.listed === 1)).toBe(true);
  });

  it("inserts one tenant and five companies only once", async () => {
    const db = new MemorySeedDatabase();

    expect(await seedLocal(db)).toEqual({ tenantsInserted: 1, companiesInserted: 5 });
    expect(await seedLocal(db)).toEqual({ tenantsInserted: 0, companiesInserted: 0 });

    expect(db.tenants.size).toBe(1);
    expect(db.companies.size).toBe(5);
    expect([...db.tenants.values()]).toEqual([{ slug: "nodework", name: "Nodework" }]);
  });

  it("derives a logo_url from each seeded company's domain", async () => {
    const db = new MemorySeedDatabase();
    await seedLocal(db);

    for (const company of db.companies.values()) {
      expect(company.logoUrl).toBe(`https://logo.clearbit.com/${company.domain}`);
    }
  });
});
