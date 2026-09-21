import { createRequire } from "node:module";
import { beforeEach, describe, expect, it } from "vitest";

import {
  countHiringCompanies,
  countNewJobs,
  getCompanyBySlug,
  getJobBySlug,
  getSalaryRollup,
  listCompanies,
  listCompanyLocations,
  listCompanyTopTags,
  listHubJobs,
  listJobs,
  listLandingJobs,
  listLocationJobCounts,
  listResolvedSalaryStats,
  listSitemapEntries,
  listTagLocationFacets,
  listTopGrowingCompanies,
  resolveSalaryBreakdown,
  resolveSalaryStats,
  salaryRoleStem,
  tagSalaryRange,
  type JobsDatabase,
} from "./queries";

interface MemoryDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...values: unknown[]): unknown[];
    get(...values: unknown[]): unknown;
    run(...values: unknown[]): unknown;
  };
}

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => MemoryDatabase;
};

function createD1(database: MemoryDatabase): JobsDatabase {
  return {
    prepare(query: string) {
      let bindings: unknown[] = [];

      return {
        bind(...values: unknown[]) {
          bindings = values;
          return this;
        },
        async all<T>() {
          const results = database.prepare(query).all(...bindings) as T[];
          return { success: true, results, meta: {} };
        },
        async first<T>(column?: string) {
          const row = database.prepare(query).get(...bindings) as
            | Record<string, T>
            | undefined;
          if (!row) return null;
          return column ? (row[column] ?? null) : (row as T);
        },
      };
    },
  } as unknown as JobsDatabase;
}

function insertJob(
  database: MemoryDatabase,
  job: {
    id: string;
    tenantId?: string;
    companyId: string;
    title: string;
    remote: string;
    listed?: number;
    exclusivity?: string;
    postedAt?: string;
    description?: string;
    location?: string;
    salaryMin?: number | null;
    salaryMax?: number | null;
  },
) {
  database
    .prepare(
      `INSERT INTO jobs (
        id, tenant_id, company_id, title, slug, location, remote, salary_text,
        salary_min, salary_max, exclusivity, posted_at, listed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      job.id,
      job.tenantId ?? "gaming",
      job.companyId,
      job.title,
      job.id,
      job.location ?? "London",
      job.remote,
      null,
      job.salaryMin ?? null,
      job.salaryMax ?? null,
      job.exclusivity ?? "unknown",
      job.postedAt ?? "2026-09-01T00:00:00Z",
      job.listed ?? 1,
    );

  database
    .prepare(
      "INSERT INTO jobs_fts(rowid, title, description, company_name) SELECT rowid, title, ?, (SELECT name FROM companies WHERE id = company_id) FROM jobs WHERE id = ?",
    )
    .run(job.description ?? `${job.title} game development`, job.id);
}

describe("listJobs", () => {
  let sqlite: MemoryDatabase;
  let db: JobsDatabase;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE tenants (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL
      );
      CREATE TABLE companies (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        name_norm TEXT NOT NULL,
        domain TEXT,
        logo_url TEXT,
        description TEXT,
        listed INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE jobs (
 listing_logo_url TEXT, highlight_color TEXT, expires_at TEXT,
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        location TEXT,
        remote TEXT NOT NULL,
        description_html TEXT NOT NULL DEFAULT '',
        apply_url TEXT NOT NULL DEFAULT '',
        salary_text TEXT,
        salary_min INTEGER,
        salary_max INTEGER,
        source TEXT NOT NULL DEFAULT 'career_page',
        external_id TEXT,
        featured_until TEXT,
        highlight INTEGER NOT NULL DEFAULT 0,
        exclusivity TEXT NOT NULL DEFAULT 'unknown',
        posted_at TEXT,
        listed INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE job_tags (
        job_id TEXT NOT NULL,
        tag_slug TEXT NOT NULL
      );
      CREATE TABLE job_locations (
        job_id TEXT NOT NULL,
        location_slug TEXT NOT NULL
      );
      CREATE TABLE job_benefits (
        job_id TEXT NOT NULL,
        benefit_slug TEXT NOT NULL
      );
      CREATE TABLE salary_rollups (
        dimension TEXT NOT NULL,
        slug TEXT NOT NULL,
        avg INTEGER NOT NULL,
        min INTEGER NOT NULL,
        max INTEGER NOT NULL,
        job_count_30d INTEGER NOT NULL,
        computed_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE job_sightings (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        source TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE jobs_fts USING fts5 (
        title, description, company_name
      );
      INSERT INTO tenants VALUES ('gaming', 'gaming'), ('other', 'other');
      INSERT INTO companies (id, tenant_id, name, name_norm, listed) VALUES
        ('studio-a', 'gaming', 'Alpha Studio', 'alpha', 1),
        ('studio-b', 'gaming', 'Beta Forge', 'betaforge', 1),
        ('studio-other', 'other', 'Other Studio', 'other', 1);
    `);
    db = createD1(sqlite);
  });

  it("defaults to listed jobs for the tenant including onsite", async () => {
    insertJob(sqlite, {
      id: "remote",
      companyId: "studio-a",
      title: "Remote Artist",
      remote: "remote",
    });
    insertJob(sqlite, {
      id: "hybrid",
      companyId: "studio-b",
      title: "Hybrid Engineer",
      remote: "hybrid",
    });
    insertJob(sqlite, {
      id: "onsite",
      companyId: "studio-a",
      title: "Onsite Designer",
      remote: "onsite",
    });
    insertJob(sqlite, {
      id: "unlisted",
      companyId: "studio-a",
      title: "Closed Producer",
      remote: "remote",
      listed: 0,
    });
    insertJob(sqlite, {
      id: "other-tenant",
      tenantId: "other",
      companyId: "studio-other",
      title: "Other Engineer",
      remote: "remote",
    });

    const result = await listJobs(db, "gaming", {});

    expect(result.jobs.map((job) => job.id)).toEqual(["hybrid", "onsite", "remote"]);
    expect(result.total).toBe(3);
  });

  it("returns only confirmed hidden-from-LinkedIn jobs when hidden is enabled", async () => {
    insertJob(sqlite, {
      id: "hidden",
      companyId: "studio-a",
      title: "Hidden Role",
      remote: "remote",
      exclusivity: "hidden_from_linkedin",
    });
    insertJob(sqlite, {
      id: "unknown",
      companyId: "studio-a",
      title: "Unknown Role",
      remote: "remote",
      exclusivity: "unknown",
    });
    insertJob(sqlite, {
      id: "linkedin",
      companyId: "studio-a",
      title: "LinkedIn Role",
      remote: "remote",
      exclusivity: "seen_on_linkedin",
    });

    const result = await listJobs(db, "gaming", { hidden: true });

    expect(result.jobs.map((job) => job.id)).toEqual(["hidden"]);
  });

  it("combines FTS, company, seniority, and sighting source filters", async () => {
    insertJob(sqlite, {
      id: "match",
      companyId: "studio-a",
      title: "Senior Gameplay Engineer",
      remote: "remote",
    });
    insertJob(sqlite, {
      id: "wrong-source",
      companyId: "studio-a",
      title: "Senior Gameplay Programmer",
      remote: "remote",
    });
    insertJob(sqlite, {
      id: "wrong-company",
      companyId: "studio-b",
      title: "Senior Gameplay Engineer",
      remote: "remote",
    });
    sqlite.exec(`
      INSERT INTO job_sightings VALUES ('s1', 'match', 'career_page');
      INSERT INTO job_sightings VALUES ('s2', 'match', 'career_page');
      INSERT INTO job_sightings VALUES ('s3', 'wrong-source', 'linkedin');
      INSERT INTO job_sightings VALUES ('s4', 'wrong-company', 'career_page');
    `);

    const result = await listJobs(db, "gaming", {
      q: "gameplay",
      company: "Alpha",
      seniority: "Senior",
      source: "career_page",
    });

    expect(result.jobs.map((job) => job.id)).toEqual(["match"]);
    expect(result.total).toBe(1);
  });

  it("filters company hub jobs by exact company id", async () => {
    insertJob(sqlite, {
      id: "alpha",
      companyId: "studio-a",
      title: "Gameplay Programmer",
      remote: "remote",
    });
    insertJob(sqlite, {
      id: "beta",
      companyId: "studio-b",
      title: "Tools Programmer",
      remote: "remote",
    });

    const result = await listJobs(db, "gaming", { companyId: "studio-a" });

    expect(result.jobs.map((job) => job.id)).toEqual(["alpha"]);
  });

  it("uses job_tags for hub membership", async () => {
    insertJob(sqlite, {
      id: "description-only",
      companyId: "studio-a",
      title: "Software Engineer",
      description: "Build gameplay systems with Unity.",
      remote: "remote",
    });
    insertJob(sqlite, {
      id: "title-match",
      companyId: "studio-a",
      title: "Unity Software Engineer",
      description: "Build proprietary engine systems.",
      remote: "remote",
    });
    sqlite.exec(`INSERT INTO job_tags VALUES ('title-match', 'unity')`);

    const result = await listHubJobs(db, "gaming", "unity");

    expect(result.jobs.map((job) => job.id)).toEqual(["title-match"]);
  });

  it("ANDs across every tag when filters.tags has more than one entry", async () => {
    insertJob(sqlite, { id: "both", companyId: "studio-a", title: "Both", remote: "remote" });
    insertJob(sqlite, { id: "solidity-only", companyId: "studio-a", title: "Solidity Only", remote: "remote" });
    insertJob(sqlite, { id: "remote-only", companyId: "studio-a", title: "Remote Only", remote: "remote" });
    sqlite.exec(`
      INSERT INTO job_tags VALUES
        ('both', 'solidity'), ('both', 'remote-friendly'),
        ('solidity-only', 'solidity'),
        ('remote-only', 'remote-friendly');
    `);

    const result = await listJobs(db, "gaming", {
      tags: ["solidity", "remote-friendly"],
    });

    expect(result.jobs.map((job) => job.id)).toEqual(["both"]);
    expect(result.total).toBe(1);
  });

  it("treats a single-entry tags array exactly like `tag`", async () => {
    insertJob(sqlite, { id: "tagged", companyId: "studio-a", title: "Tagged", remote: "remote" });
    insertJob(sqlite, { id: "untagged", companyId: "studio-a", title: "Untagged", remote: "remote" });
    sqlite.exec(`INSERT INTO job_tags VALUES ('tagged', 'solidity')`);

    const viaTag = await listJobs(db, "gaming", { tag: "solidity" });
    const viaTags = await listJobs(db, "gaming", { tags: ["solidity"] });

    expect(viaTags.jobs.map((job) => job.id)).toEqual(viaTag.jobs.map((job) => job.id));
    expect(viaTags.jobs.map((job) => job.id)).toEqual(["tagged"]);
  });

  it("populates companyLogoUrl from the company row", async () => {
    sqlite.exec(
      "UPDATE companies SET logo_url = 'https://cdn.example.com/alpha.png' WHERE id = 'studio-a'",
    );
    insertJob(sqlite, { id: "logo-job", companyId: "studio-a", title: "Logo Job", remote: "remote" });

    const result = await listJobs(db, "gaming", {});

    expect(result.jobs[0]?.companyLogoUrl).toBe("https://cdn.example.com/alpha.png");
  });

  it("filters landing jobs for a combo tag landing (AND across facets), matching a single-tag landing at length 1", async () => {
    insertJob(sqlite, { id: "both", companyId: "studio-a", title: "Both", remote: "remote" });
    insertJob(sqlite, { id: "dev-only", companyId: "studio-a", title: "Dev Only", remote: "remote" });
    sqlite.exec(`
      INSERT INTO job_tags VALUES
        ('both', 'dev'), ('both', 'solidity'),
        ('dev-only', 'dev');
    `);

    const combo = await listLandingJobs(db, "gaming", {
      kind: "tag",
      tag: "dev",
      tags: ["dev", "solidity"],
    });
    expect(combo.jobs.map((job) => job.id)).toEqual(["both"]);

    const single = await listLandingJobs(db, "gaming", {
      kind: "tag",
      tag: "dev",
      tags: ["dev"],
    });
    expect(single.jobs.map((job) => job.id).sort()).toEqual(["both", "dev-only"]);
  });

  it("counts only jobs posted within the cutoff, on top of the normal filters", async () => {
    insertJob(sqlite, {
      id: "fresh",
      companyId: "studio-a",
      title: "Fresh",
      remote: "remote",
      postedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    });
    insertJob(sqlite, {
      id: "stale",
      companyId: "studio-a",
      title: "Stale",
      remote: "remote",
      postedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    });

    await expect(countNewJobs(db, "gaming", {}, 24)).resolves.toBe(1);
    await expect(countNewJobs(db, "gaming", {}, 24 * 30)).resolves.toBe(2);
  });

  it("counts job_locations restricted to the requested taxonomy kind", async () => {
    insertJob(sqlite, { id: "berlin-job", companyId: "studio-a", title: "Berlin", remote: "onsite" });
    insertJob(sqlite, { id: "london-job", companyId: "studio-a", title: "London", remote: "onsite" });
    insertJob(sqlite, { id: "germany-job", companyId: "studio-a", title: "Germany", remote: "onsite" });
    sqlite.exec(`
      INSERT INTO job_locations VALUES
        ('berlin-job', 'berlin'),
        ('london-job', 'berlin'),
        ('germany-job', 'germany');
    `);

    await expect(listLocationJobCounts(db, "gaming", "city")).resolves.toEqual([
      { slug: "berlin", jobCount: 2 },
    ]);
    await expect(listLocationJobCounts(db, "gaming", "country")).resolves.toEqual([
      { slug: "germany", jobCount: 1 },
    ]);
    await expect(listLocationJobCounts(db, "gaming", "region")).resolves.toEqual([]);
  });

  it("paginates results and reports page metadata", async () => {
    for (let index = 1; index <= 5; index += 1) {
      insertJob(sqlite, {
        id: `job-${index}`,
        companyId: "studio-a",
        title: `Engineer ${index}`,
        remote: "remote",
        postedAt: `2026-09-0${index}T00:00:00Z`,
      });
    }

    const result = await listJobs(db, "gaming", { page: 2, pageSize: 2 });

    expect(result.jobs.map((job) => job.id)).toEqual(["job-3", "job-2"]);
    expect(result).toMatchObject({
      page: 2,
      pageSize: 2,
      total: 5,
      totalPages: 3,
    });
  });

  it("loads a listed job by tenant and slug with its full description", async () => {
    insertJob(sqlite, {
      id: "job-detail",
      companyId: "studio-a",
      title: "Lead Level Designer",
      remote: "hybrid",
      exclusivity: "hidden_from_linkedin",
    });
    sqlite
      .prepare(
        "UPDATE jobs SET slug = ?, description_html = ?, apply_url = ? WHERE id = ?",
      )
      .run(
        "lead-level-designer",
        "<p>Design every mission and encounter.</p>",
        "https://alpha.example/jobs/lead-level-designer",
        "job-detail",
      );

    const job = await getJobBySlug(db, "gaming", "lead-level-designer");

    expect(job).toMatchObject({
      id: "job-detail",
      slug: "lead-level-designer",
      title: "Lead Level Designer",
      companyName: "Alpha Studio",
      companySlug: "alpha",
      location: "London",
      remote: "hybrid",
      descriptionHtml: "<p>Design every mission and encounter.</p>",
      salaryText: null,
      exclusivity: "hidden_from_linkedin",
      postedAt: "2026-09-01T00:00:00Z",
    });
    expect(job).not.toHaveProperty("applyUrl");
  });

  it("resolves two company-prefixed slugs for the same title", async () => {
    insertJob(sqlite, {
      id: "moonshot-job",
      companyId: "studio-a",
      title: "Senior Software Engineer",
      remote: "remote",
    });
    insertJob(sqlite, {
      id: "pixelforge-job",
      companyId: "studio-b",
      title: "Senior Software Engineer",
      remote: "hybrid",
    });
    sqlite
      .prepare("UPDATE jobs SET slug = ? WHERE id = ?")
      .run("alpha-senior-software-engineer", "moonshot-job");
    sqlite
      .prepare("UPDATE jobs SET slug = ? WHERE id = ?")
      .run("betaforge-senior-software-engineer", "pixelforge-job");

    await expect(
      getJobBySlug(db, "gaming", "alpha-senior-software-engineer"),
    ).resolves.toMatchObject({
      id: "moonshot-job",
      slug: "alpha-senior-software-engineer",
      companyName: "Alpha Studio",
    });
    await expect(
      getJobBySlug(db, "gaming", "betaforge-senior-software-engineer"),
    ).resolves.toMatchObject({
      id: "pixelforge-job",
      slug: "betaforge-senior-software-engineer",
      companyName: "Beta Forge",
    });
  });

  it("loads onsite listed jobs by slug", async () => {
    insertJob(sqlite, {
      id: "unknown-detail",
      companyId: "studio-a",
      title: "Unknown Role",
      remote: "unknown",
    });
    insertJob(sqlite, {
      id: "onsite-detail",
      companyId: "studio-a",
      title: "Onsite Role",
      remote: "onsite",
    });
    sqlite.exec(`
      UPDATE jobs SET slug = 'unknown-role' WHERE id = 'unknown-detail';
      UPDATE jobs SET slug = 'onsite-role' WHERE id = 'onsite-detail';
    `);

    await expect(getJobBySlug(db, "gaming", "unknown-role")).resolves.toMatchObject({
      remote: "unknown",
    });
    await expect(getJobBySlug(db, "gaming", "onsite-role")).resolves.toMatchObject({
      id: "onsite-detail",
      remote: "onsite",
    });
  });

  it("does not load unlisted jobs or jobs from another tenant", async () => {
    insertJob(sqlite, {
      id: "unlisted-detail",
      companyId: "studio-a",
      title: "Closed Role",
      remote: "remote",
      listed: 0,
    });
    insertJob(sqlite, {
      id: "other-detail",
      tenantId: "other",
      companyId: "studio-other",
      title: "Other Role",
      remote: "remote",
    });

    await expect(getJobBySlug(db, "gaming", "unlisted-detail")).resolves.toBeNull();
    await expect(getJobBySlug(db, "gaming", "other-detail")).resolves.toBeNull();
  });

  it("loads only listed companies by a slug derived from name_norm", async () => {
    sqlite.exec(
      "INSERT INTO companies (id, tenant_id, name, name_norm, listed) VALUES ('hidden', 'gaming', 'Hidden Studio', 'hidden', 0)",
    );

    await expect(getCompanyBySlug(db, "gaming", "beta-forge")).resolves.toBeNull();
    await expect(getCompanyBySlug(db, "gaming", "betaforge")).resolves.toEqual({
      id: "studio-b",
      name: "Beta Forge",
      slug: "betaforge",
      domain: null,
      description: null,
    });
    await expect(getCompanyBySlug(db, "gaming", "hidden")).resolves.toBeNull();
    await expect(getCompanyBySlug(db, "gaming", "other")).resolves.toBeNull();
  });

  it("returns every listed job slug at listed companies for the sitemap", async () => {
    sqlite.exec(
      "INSERT INTO companies (id, tenant_id, name, name_norm, listed) VALUES ('studio-hidden', 'gaming', 'Hidden Studio', 'hiddenstudio', 0)",
    );
    insertJob(sqlite, {
      id: "public-job",
      companyId: "studio-a",
      title: "Remote Engineer",
      remote: "remote",
    });
    insertJob(sqlite, {
      id: "onsite-job",
      companyId: "studio-b",
      title: "Onsite Engineer",
      remote: "onsite",
    });
    insertJob(sqlite, {
      id: "hybrid-job",
      companyId: "studio-a",
      title: "Hybrid Engineer",
      remote: "hybrid",
    });
    insertJob(sqlite, {
      id: "unlisted-job",
      companyId: "studio-a",
      title: "Closed Engineer",
      remote: "remote",
      listed: 0,
    });
    insertJob(sqlite, {
      id: "unlisted-company-job",
      companyId: "studio-hidden",
      title: "Hidden Company Engineer",
      remote: "remote",
    });

    insertJob(sqlite, {
      id: "unknown-job",
      companyId: "studio-a",
      title: "Unknown Engineer",
      remote: "unknown",
    });

    await expect(listSitemapEntries(db, "gaming")).resolves.toMatchObject({
      jobs: expect.arrayContaining([
        expect.objectContaining({ slug: "hybrid-job" }),
        expect.objectContaining({ slug: "public-job" }),
        expect.objectContaining({ slug: "onsite-job" }),
      ]),
      companySlugs: ["alpha", "betaforge"],
      tagSlugs: [],
      geoSlugs: [],
      salarySlugs: [],
      benefitSlugs: [],
    });
  });

  it("quality-gates tag, geo, benefit, and salary sitemap slugs at five jobs", async () => {
    for (let i = 0; i < 5; i += 1) {
      insertJob(sqlite, {
        id: `solidity-${i}`,
        companyId: "studio-a",
        title: `Solidity ${i}`,
        remote: "remote",
        salaryMin: 80000, salaryMax:120000,
      });
      sqlite.exec(`
        INSERT INTO job_tags VALUES ('solidity-${i}', 'solidity');
        INSERT INTO job_locations VALUES ('solidity-${i}', 'berlin');
        INSERT INTO job_benefits VALUES ('solidity-${i}', 'pay-in-crypto');
      `);
    }
    insertJob(sqlite, {
      id: "thin-tag",
      companyId: "studio-a",
      title: "Thin",
      remote: "remote",
    });
    sqlite.exec(`
      INSERT INTO job_tags VALUES ('thin-tag', 'rust');
      INSERT INTO job_locations VALUES ('thin-tag', 'london');
      INSERT INTO job_benefits VALUES ('thin-tag', 'pto');
      INSERT INTO salary_rollups VALUES
        ('role', 'solidity-developer', 120000, 80000, 180000, 5, '2026-09-01'),
        ('company', 'alpha', 120000, 80000, 180000, 6, '2026-09-01'),
        ('role', 'thin-role', 90000, 70000, 110000, 4, '2026-09-01');
    `);

    await expect(listSitemapEntries(db, "gaming")).resolves.toMatchObject({
      tagSlugs: ["solidity"],
      geoSlugs: ["berlin"],
      benefitSlugs: ["pay-in-crypto"],
      salarySlugs: ["berlin", "solidity-developer"],
    });
  });
});

describe("listCompanies", () => {
  let sqlite: MemoryDatabase;
  let db: JobsDatabase;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE companies (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        name_norm TEXT NOT NULL,
        domain TEXT,
        logo_url TEXT,
        description TEXT,
        listed INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE jobs (
 listing_logo_url TEXT, highlight_color TEXT, expires_at TEXT,
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        location TEXT,
        remote TEXT NOT NULL,
        description_html TEXT NOT NULL DEFAULT '',
        apply_url TEXT NOT NULL DEFAULT '',
        salary_text TEXT,
        salary_min INTEGER,
        salary_max INTEGER,
        source TEXT NOT NULL DEFAULT 'career_page',
        external_id TEXT,
        featured_until TEXT,
        highlight INTEGER NOT NULL DEFAULT 0,
        exclusivity TEXT NOT NULL DEFAULT 'unknown',
        posted_at TEXT,
        listed INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE job_tags (
        job_id TEXT NOT NULL,
        tag_slug TEXT NOT NULL
      );
      CREATE TABLE job_locations (
        job_id TEXT NOT NULL,
        location_slug TEXT NOT NULL
      );
      CREATE TABLE salary_rollups (
        dimension TEXT NOT NULL,
        slug TEXT NOT NULL,
        avg INTEGER NOT NULL,
        min INTEGER NOT NULL,
        max INTEGER NOT NULL,
        job_count_30d INTEGER NOT NULL,
        computed_at TEXT NOT NULL DEFAULT ''
      );
      CREATE VIRTUAL TABLE jobs_fts USING fts5 (
        title, description, company_name
      );
      INSERT INTO companies (id, tenant_id, name, name_norm, listed) VALUES
        ('studio-a', 'gaming', 'Alpha Studio', 'alpha', 1),
        ('studio-b', 'gaming', 'Beta Forge', 'betaforge', 1),
        ('studio-c', 'gaming', 'Closed Studio', 'closed', 0),
        ('studio-other', 'other', 'Other Studio', 'other', 1);
    `);
    db = createD1(sqlite);
  });

  it("lists listed companies for the tenant with listed job counts", async () => {
    insertJob(sqlite, { id: "a1", companyId: "studio-a", title: "Artist", remote: "remote" });
    insertJob(sqlite, { id: "a2", companyId: "studio-a", title: "Onsite", remote: "onsite" });
    insertJob(sqlite, {
      id: "a3",
      companyId: "studio-a",
      title: "Closed",
      remote: "remote",
      listed: 0,
    });
    insertJob(sqlite, { id: "b1", companyId: "studio-b", title: "Engineer", remote: "hybrid" });
    insertJob(sqlite, { id: "b2", companyId: "studio-b", title: "Producer", remote: "remote" });
    insertJob(sqlite, {
      id: "o1",
      tenantId: "other",
      companyId: "studio-other",
      title: "Other",
      remote: "remote",
    });

    const companies = await listCompanies(db, "gaming");

    expect(companies).toEqual([
      {
        id: "studio-a",
        name: "Alpha Studio",
        slug: "alpha",
        domain: null,
        jobCount: 2,
        lastPostedAt: "2026-09-01T00:00:00Z",
        avgSalary: null,
      },
      {
        id: "studio-b",
        name: "Beta Forge",
        slug: "betaforge",
        domain: null,
        jobCount: 2,
        lastPostedAt: "2026-09-01T00:00:00Z",
        avgSalary: null,
      },
    ]);
  });

  it("keeps studios with zero listed jobs so the index stays visible", async () => {
    const companies = await listCompanies(db, "gaming");

    expect(companies.map((company) => [company.slug, company.jobCount, company.lastPostedAt])).toEqual([
      ["alpha", 0, null],
      ["betaforge", 0, null],
    ]);
  });

  it("does not display stale stored company salaries without live salary data", async () => {
    insertJob(sqlite, { id: "a1", companyId: "studio-a", title: "Artist", remote: "remote" });
    sqlite.exec(
      `INSERT INTO salary_rollups VALUES ('company', 'alpha', 150000, 120000, 180000, 1, '2026-09-01')`,
    );

    const companies = await listCompanies(db, "gaming");

    expect(companies.find((c) => c.slug === "alpha")?.avgSalary).toBeNull();
    expect(companies.find((c) => c.slug === "betaforge")?.avgSalary).toBeNull();
  });

  it("counts distinct listed companies that currently have listed jobs", async () => {
    insertJob(sqlite, { id: "a1", companyId: "studio-a", title: "Artist", remote: "remote" });
    insertJob(sqlite, { id: "b1", companyId: "studio-b", title: "Engineer", remote: "hybrid" });
    insertJob(sqlite, {
      id: "a3",
      companyId: "studio-a",
      title: "Closed",
      remote: "remote",
      listed: 0,
    });

    await expect(countHiringCompanies(db, "gaming")).resolves.toBe(2);
  });

  it("lists top tags and locations for one company", async () => {
    insertJob(sqlite, { id: "a1", companyId: "studio-a", title: "Solidity Engineer", remote: "remote" });
    insertJob(sqlite, { id: "a2", companyId: "studio-a", title: "Rust Engineer", remote: "remote" });
    insertJob(sqlite, { id: "b1", companyId: "studio-b", title: "Other", remote: "remote" });
    sqlite.exec(`
      INSERT INTO job_tags VALUES ('a1', 'solidity'), ('a2', 'solidity'), ('a2', 'rust'), ('b1', 'solidity');
      INSERT INTO job_locations VALUES ('a1', 'berlin'), ('a2', 'berlin'), ('a2', 'london');
    `);

    await expect(listCompanyTopTags(db, "studio-a")).resolves.toEqual([
      { slug: "solidity", count: 2 },
      { slug: "rust", count: 1 },
    ]);
    await expect(listCompanyLocations(db, "studio-a")).resolves.toEqual([
      { slug: "berlin", count: 2 },
      { slug: "london", count: 1 },
    ]);
  });

  it("returns an empty tag/location facet for a company with no listed jobs", async () => {
    await expect(listCompanyTopTags(db, "studio-c")).resolves.toEqual([]);
    await expect(listCompanyLocations(db, "studio-c")).resolves.toEqual([]);
  });
});

describe("listTopGrowingCompanies", () => {
  let sqlite: MemoryDatabase;
  let db: JobsDatabase;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE companies (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        name_norm TEXT NOT NULL,
        domain TEXT,
        logo_url TEXT,
        description TEXT,
        listed INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE jobs (
 listing_logo_url TEXT, highlight_color TEXT, expires_at TEXT,
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        location TEXT,
        remote TEXT NOT NULL,
        description_html TEXT NOT NULL DEFAULT '',
        apply_url TEXT NOT NULL DEFAULT '',
        salary_text TEXT,
        salary_min INTEGER,
        salary_max INTEGER,
        source TEXT NOT NULL DEFAULT 'career_page',
        external_id TEXT,
        featured_until TEXT,
        highlight INTEGER NOT NULL DEFAULT 0,
        exclusivity TEXT NOT NULL DEFAULT 'unknown',
        posted_at TEXT,
        listed INTEGER NOT NULL DEFAULT 1
      );
      CREATE VIRTUAL TABLE jobs_fts USING fts5 (
        title, description, company_name
      );
      INSERT INTO companies (id, tenant_id, name, name_norm, listed) VALUES
        ('studio-a', 'gaming', 'Alpha Studio', 'alpha', 1),
        ('studio-b', 'gaming', 'Beta Forge', 'betaforge', 1);
    `);
    db = createD1(sqlite);
  });

  function daysAgo(days: number): string {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }

  it("computes growth from windowed posted_at counts without dividing by zero", async () => {
    // studio-a: 3 jobs in the last 30 days, 1 in the 30-60 day window before that.
    insertJob(sqlite, { id: "a1", companyId: "studio-a", title: "A1", remote: "remote", postedAt: daysAgo(5) });
    insertJob(sqlite, { id: "a2", companyId: "studio-a", title: "A2", remote: "remote", postedAt: daysAgo(10) });
    insertJob(sqlite, { id: "a3", companyId: "studio-a", title: "A3", remote: "remote", postedAt: daysAgo(15) });
    insertJob(sqlite, { id: "a4", companyId: "studio-a", title: "A4", remote: "remote", postedAt: daysAgo(45) });
    // studio-b: 2 jobs in the last 30 days, 0 in the prior window - no baseline to divide by.
    insertJob(sqlite, { id: "b1", companyId: "studio-b", title: "B1", remote: "remote", postedAt: daysAgo(2) });
    insertJob(sqlite, { id: "b2", companyId: "studio-b", title: "B2", remote: "remote", postedAt: daysAgo(3) });

    const growth = await listTopGrowingCompanies(db, "gaming");

    expect(growth).toEqual([
      {
        id: "studio-b",
        name: "Beta Forge",
        slug: "betaforge",
        newJobs: 2,
        previousPeriod: 0,
        difference: 2,
        growthPct: null,
      },
      {
        id: "studio-a",
        name: "Alpha Studio",
        slug: "alpha",
        newJobs: 3,
        previousPeriod: 1,
        difference: 2,
        growthPct: 200,
      },
    ]);
    for (const row of growth) {
      expect(Number.isNaN(row.growthPct)).toBe(false);
    }
  });

  it("returns an empty array against the real empty tables", async () => {
    await expect(listTopGrowingCompanies(db, "gaming")).resolves.toEqual([]);
  });
});

describe("salary filters and stats", () => {
  let sqlite: MemoryDatabase;
  let db: JobsDatabase;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE tenants (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL
      );
      CREATE TABLE companies (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        name_norm TEXT NOT NULL,
        domain TEXT,
        logo_url TEXT,
        description TEXT,
        listed INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE jobs (
 listing_logo_url TEXT, highlight_color TEXT, expires_at TEXT,
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        location TEXT,
        remote TEXT NOT NULL,
        description_html TEXT NOT NULL DEFAULT '',
        apply_url TEXT NOT NULL DEFAULT '',
        salary_text TEXT,
        salary_min INTEGER,
        salary_max INTEGER,
        source TEXT NOT NULL DEFAULT 'career_page',
        external_id TEXT,
        featured_until TEXT,
        highlight INTEGER NOT NULL DEFAULT 0,
        exclusivity TEXT NOT NULL DEFAULT 'unknown',
        posted_at TEXT,
        listed INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE job_tags (
        job_id TEXT NOT NULL,
        tag_slug TEXT NOT NULL
      );
      CREATE TABLE job_locations (
        job_id TEXT NOT NULL,
        location_slug TEXT NOT NULL
      );
      CREATE TABLE job_benefits (
        job_id TEXT NOT NULL,
        benefit_slug TEXT NOT NULL
      );
      CREATE TABLE salary_rollups (
        dimension TEXT NOT NULL,
        slug TEXT NOT NULL,
        avg INTEGER NOT NULL,
        min INTEGER NOT NULL,
        max INTEGER NOT NULL,
        job_count_30d INTEGER NOT NULL,
        computed_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE job_sightings (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        source TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE jobs_fts USING fts5 (
        title, description, company_name
      );
      INSERT INTO tenants VALUES ('gaming', 'gaming'), ('other', 'other');
      INSERT INTO companies (id, tenant_id, name, name_norm, listed) VALUES
        ('studio-a', 'gaming', 'Alpha Studio', 'alpha', 1),
        ('studio-b', 'gaming', 'Beta Forge', 'betaforge', 1);
    `);
    db = createD1(sqlite);
  });

  it("maps salary role stems without stripping non-developer suffixes", () => {
    expect(salaryRoleStem("solidity-developer")).toBe("solidity");
    expect(salaryRoleStem("product-manager")).toBe("product-manager");
  });

  it("filters listed jobs by location_slug so geo salary pages stay scoped", async () => {
    insertJob(sqlite, {
      id: "berlin",
      companyId: "studio-a",
      title: "Berlin Engineer",
      remote: "onsite",
    });
    insertJob(sqlite, {
      id: "london",
      companyId: "studio-a",
      title: "London Engineer",
      remote: "onsite",
    });
    sqlite.exec(`
      INSERT INTO job_locations VALUES ('berlin', 'berlin');
      INSERT INTO job_locations VALUES ('london', 'london');
    `);

    const result = await listJobs(db, "gaming", { locationSlug: "berlin" });

    expect(result.jobs.map((job) => job.id)).toEqual(["berlin"]);
    expect(result.total).toBe(1);
  });

  it("orders by salary_max and keeps only jobs with a published band", async () => {
    insertJob(sqlite, {
      id: "low",
      companyId: "studio-a",
      title: "Low",
      remote: "remote",
      salaryMin: 80000,
      salaryMax: 100000,
      postedAt: "2026-09-03T00:00:00Z",
    });
    insertJob(sqlite, {
      id: "high",
      companyId: "studio-a",
      title: "High",
      remote: "remote",
      salaryMin: 140000,
      salaryMax: 200000,
      postedAt: "2026-09-01T00:00:00Z",
    });
    insertJob(sqlite, {
      id: "none",
      companyId: "studio-a",
      title: "None",
      remote: "remote",
    });

    const result = await listJobs(db, "gaming", {
      hasSalary: true,
      orderBy: "salary",
    });

    expect(result.jobs.map((job) => job.id)).toEqual(["high", "low"]);
  });

  it("matches a salary role by tag or title when orTitle is set", async () => {
    insertJob(sqlite, {
      id: "tagged",
      companyId: "studio-a",
      title: "Protocol Engineer",
      remote: "remote",
    });
    insertJob(sqlite, {
      id: "titled",
      companyId: "studio-a",
      title: "Solidity Engineer",
      remote: "remote",
    });
    insertJob(sqlite, {
      id: "other",
      companyId: "studio-a",
      title: "Rust Engineer",
      remote: "remote",
    });
    sqlite.exec(`INSERT INTO job_tags VALUES ('tagged', 'solidity')`);

    const taggedOnly = await listJobs(db, "gaming", { tag: "solidity" });
    const either = await listJobs(db, "gaming", { tag: "solidity", orTitle: true });

    expect(taggedOnly.jobs.map((job) => job.id)).toEqual(["tagged"]);
    expect(either.jobs.map((job) => job.id).sort()).toEqual(["tagged", "titled"]);
  });

  it("ignores stale stored rollups when live vacancies change", async () => {
    insertJob(sqlite, {
      id: "live",
      companyId: "studio-a",
      title: "Solidity Engineer",
      remote: "remote",
      salaryMin: 100000,
      salaryMax: 120000,
    });
    sqlite.exec(`
      INSERT INTO job_tags VALUES ('live', 'solidity');
      INSERT INTO salary_rollups VALUES
        ('role', 'solidity-developer', 180000, 150000, 210000, 9, '2026-09-01');
    `);

    await expect(
      resolveSalaryStats(db, "gaming", "role", "solidity-developer"),
    ).resolves.toMatchObject({
      avg: 110000,
      min: 100000,
      max: 120000,
      jobCount30d: 1,
    });
  });

  it("aggregates missing city stats from job_locations", async () => {
    insertJob(sqlite, {
      id: "berlin-pay",
      companyId: "studio-a",
      title: "Berlin Engineer",
      remote: "onsite",
      salaryMin: 90000,
      salaryMax: 110000,
    });
    sqlite.exec(`INSERT INTO job_locations VALUES ('berlin-pay', 'berlin')`);

    await expect(resolveSalaryStats(db, "gaming", "city", "berlin")).resolves.toEqual({
      dimension: "city",
      slug: "berlin",
      avg: 100000,
      min: 90000,
      max: 110000,
      jobCount30d: 1,
    });
  });

  it("aggregates missing role stats from tags or title", async () => {
    insertJob(sqlite, {
      id: "titled",
      companyId: "studio-a",
      title: "Solidity Engineer",
      remote: "remote",
      salaryMin: 80000,
      salaryMax: 120000,
    });
    insertJob(sqlite, {
      id: "tagged",
      companyId: "studio-a",
      title: "Protocol Engineer",
      remote: "remote",
      salaryMin: 100000,
      salaryMax: 140000,
    });
    sqlite.exec(`INSERT INTO job_tags VALUES ('tagged', 'solidity')`);

    await expect(
      resolveSalaryStats(db, "gaming", "role", "solidity-developer"),
    ).resolves.toEqual({
      dimension: "role",
      slug: "solidity-developer",
      avg: 110000,
      min: 80000,
      max: 140000,
      jobCount30d: 2,
    });
  });

  it("fills every requested taxonomy slug when rollups are empty", async () => {
    const rows = await listResolvedSalaryStats(db, "gaming", "country", [
      "germany",
      "united-states",
    ]);

    expect(rows).toEqual([
      {
        dimension: "country",
        slug: "germany",
        avg: null,
        min: null,
        max: null,
        jobCount30d: 0,
      },
      {
        dimension: "country",
        slug: "united-states",
        avg: null,
        min: null,
        max: null,
        jobCount30d: 0,
      },
    ]);
  });
});

describe("hire facets, salary breakdown, and getSalaryRollup dimensions", () => {
  let sqlite: MemoryDatabase;
  let db: JobsDatabase;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE tenants (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL
      );
      CREATE TABLE companies (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        name_norm TEXT NOT NULL,
        domain TEXT,
        logo_url TEXT,
        description TEXT,
        listed INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE jobs (
 listing_logo_url TEXT, highlight_color TEXT, expires_at TEXT,
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        location TEXT,
        remote TEXT NOT NULL,
        description_html TEXT NOT NULL DEFAULT '',
        apply_url TEXT NOT NULL DEFAULT '',
        salary_text TEXT,
        salary_min INTEGER,
        salary_max INTEGER,
        source TEXT NOT NULL DEFAULT 'career_page',
        external_id TEXT,
        featured_until TEXT,
        highlight INTEGER NOT NULL DEFAULT 0,
        exclusivity TEXT NOT NULL DEFAULT 'unknown',
        posted_at TEXT,
        listed INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE job_tags (
        job_id TEXT NOT NULL,
        tag_slug TEXT NOT NULL
      );
      CREATE TABLE job_locations (
        job_id TEXT NOT NULL,
        location_slug TEXT NOT NULL
      );
      CREATE TABLE salary_rollups (
        dimension TEXT NOT NULL,
        slug TEXT NOT NULL,
        avg INTEGER NOT NULL,
        min INTEGER NOT NULL,
        max INTEGER NOT NULL,
        job_count_30d INTEGER NOT NULL,
        computed_at TEXT NOT NULL DEFAULT ''
      );
      CREATE VIRTUAL TABLE jobs_fts USING fts5 (
        title, description, company_name
      );
      INSERT INTO tenants VALUES ('gaming', 'gaming');
      INSERT INTO companies (id, tenant_id, name, name_norm, listed) VALUES
        ('studio-a', 'gaming', 'Alpha Studio', 'alpha', 1);
    `);
    db = createD1(sqlite);
  });

  it("builds a per-tag location facet and MIN/MAX salary range for the hire pages", async () => {
    insertJob(sqlite, {
      id: "berlin-sol",
      companyId: "studio-a",
      title: "Solidity Engineer",
      remote: "onsite",
      salaryMin: 90000,
      salaryMax: 120000,
    });
    insertJob(sqlite, {
      id: "london-sol",
      companyId: "studio-a",
      title: "Solidity Engineer",
      remote: "onsite",
      salaryMin: 100000,
      salaryMax: 140000,
    });
    insertJob(sqlite, {
      id: "berlin-rust",
      companyId: "studio-a",
      title: "Rust Engineer",
      remote: "onsite",
    });
    sqlite.exec(`
      INSERT INTO job_tags VALUES ('berlin-sol', 'solidity'), ('london-sol', 'solidity'), ('berlin-rust', 'rust');
      INSERT INTO job_locations VALUES ('berlin-sol', 'berlin'), ('london-sol', 'london'), ('berlin-rust', 'berlin');
    `);

    await expect(listTagLocationFacets(db, "gaming", "solidity")).resolves.toEqual([
      { slug: "berlin", jobCount: 1 },
      { slug: "london", jobCount: 1 },
    ]);
    await expect(tagSalaryRange(db, "gaming", "solidity")).resolves.toEqual({
      min: 90000,
      max: 140000,
      count: 2,
    });
  });

  it("returns an empty facet and a zero-count range for a tag with no matching jobs", async () => {
    await expect(listTagLocationFacets(db, "gaming", "solidity")).resolves.toEqual([]);
    await expect(tagSalaryRange(db, "gaming", "solidity")).resolves.toEqual({
      min: null,
      max: null,
      count: 0,
    });
  });

  it("breaks down salary by country and by seniority for one tag", async () => {
    insertJob(sqlite, {
      id: "de-senior",
      companyId: "studio-a",
      title: "Senior Solidity Engineer",
      remote: "onsite",
      salaryMin: 120000,
      salaryMax: 160000,
    });
    insertJob(sqlite, {
      id: "de-junior",
      companyId: "studio-a",
      title: "Junior Solidity Engineer",
      remote: "onsite",
      salaryMin: 60000,
      salaryMax: 80000,
    });
    insertJob(sqlite, {
      id: "us-senior",
      companyId: "studio-a",
      title: "Senior Solidity Engineer",
      remote: "onsite",
      salaryMin: 140000,
      salaryMax: 200000,
    });
    sqlite.exec(`
      INSERT INTO job_tags VALUES ('de-senior', 'solidity'), ('de-junior', 'solidity'), ('us-senior', 'solidity');
      INSERT INTO job_locations VALUES
        ('de-senior', 'germany'), ('de-junior', 'germany'), ('us-senior', 'united-states');
    `);

    const byCountry = await resolveSalaryBreakdown(db, "gaming", { tag: "solidity" }, "country");
    expect(byCountry).toEqual([
      { slug: "united-states", min: 140000, avg: 170000, max: 200000, count: 1 },
      { slug: "germany", min: 60000, avg: 105000, max: 160000, count: 2 },
    ]);

    const bySeniority = await resolveSalaryBreakdown(db, "gaming", { tag: "solidity" }, "seniority");
    expect(bySeniority.map((row) => row.slug).sort()).toEqual(["junior", "senior"]);
  });

  it("returns an empty breakdown when there are no salaried jobs for the tag", async () => {
    insertJob(sqlite, { id: "no-salary", companyId: "studio-a", title: "Solidity Engineer", remote: "remote" });
    sqlite.exec(`INSERT INTO job_tags VALUES ('no-salary', 'solidity')`);

    await expect(
      resolveSalaryBreakdown(db, "gaming", { tag: "solidity" }, "country"),
    ).resolves.toEqual([]);
  });

  it("reads getSalaryRollup for the city and company dimensions, and returns null cleanly when absent", async () => {
    sqlite.exec(`
      INSERT INTO salary_rollups VALUES
        ('city', 'berlin', 110000, 90000, 130000, 4, '2026-09-01'),
        ('company', 'alpha', 150000, 120000, 180000, 2, '2026-09-01');
    `);

    await expect(getSalaryRollup(db, "city", "berlin")).resolves.toMatchObject({
      dimension: "city",
      slug: "berlin",
      avg: 110000,
    });
    await expect(getSalaryRollup(db, "company", "alpha")).resolves.toMatchObject({
      dimension: "company",
      slug: "alpha",
      avg: 150000,
    });
    await expect(getSalaryRollup(db, "city", "london")).resolves.toBeNull();
    await expect(getSalaryRollup(db, "company", "betaforge")).resolves.toBeNull();
  });

  it("returns sane empty results from every new query against the real empty tables", async () => {
    await expect(listTagLocationFacets(db, "gaming", "solidity")).resolves.toEqual([]);
    await expect(tagSalaryRange(db, "gaming", "solidity")).resolves.toEqual({
      min: null,
      max: null,
      count: 0,
    });
    await expect(resolveSalaryBreakdown(db, "gaming", { tag: "solidity" }, "country")).resolves.toEqual([]);
    await expect(listCompanyTopTags(db, "studio-a")).resolves.toEqual([]);
    await expect(listCompanyLocations(db, "studio-a")).resolves.toEqual([]);
    await expect(getSalaryRollup(db, "city", "berlin")).resolves.toBeNull();
    await expect(getSalaryRollup(db, "company", "alpha")).resolves.toBeNull();
    await expect(countNewJobs(db, "gaming", {}, 24)).resolves.toBe(0);
    await expect(listLocationJobCounts(db, "gaming", "city")).resolves.toEqual([]);
  });
});
