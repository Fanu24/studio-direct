import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8");

describe("0001_init.sql", () => {
  it("has spec tables and FTS5", () => {
    expect(sql).toContain("CREATE TABLE tenants");
    expect(sql).toContain("CREATE TABLE jobs");
    expect(sql).toContain("CREATE VIRTUAL TABLE jobs_fts");
    expect(sql).toContain("CREATE TABLE crawl_runs");
    expect(sql).not.toContain("company_crawl_state");
    expect(sql).not.toContain("job_source_state");
    expect(sql).toContain("CREATE UNIQUE INDEX idx_jobs_tenant_slug_unique");
    expect(sql).not.toMatch(/CREATE INDEX idx_jobs_slug ON jobs \(slug\)/);
  });
});

const forward = readFileSync(
  new URL("../migrations/0003_jobs_tenant_slug_unique.sql", import.meta.url),
  "utf8",
);

describe("0004_nodework_seo.sql", () => {
  const nodework = readFileSync(
    new URL("../migrations/0004_nodework_seo.sql", import.meta.url),
    "utf8",
  );

  it("adds catalog junctions, salary rollups, and Nodework tenant slug", () => {
    expect(nodework).toContain("salary_min");
    expect(nodework).toContain("CREATE TABLE IF NOT EXISTS tags");
    expect(nodework).toContain("CREATE TABLE IF NOT EXISTS salary_rollups");
    expect(nodework).toContain("slug = 'nodework'");
  });
});

describe("0005_job_applications.sql", () => {
  const sql = readFileSync(
    new URL("../migrations/0005_job_applications.sql", import.meta.url),
    "utf8",
  );

  it("stores on-site applications keyed by job and email", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS job_applications");
    expect(sql).toContain("idx_job_applications_job_email");
  });
});

describe("0006_company_profile_geo.sql", () => {
  const sql = readFileSync(
    new URL("../migrations/0006_company_profile_geo.sql", import.meta.url),
    "utf8",
  );

  it("adds a nullable company logo_url column", () => {
    expect(sql).toContain("ALTER TABLE companies ADD COLUMN logo_url TEXT");
  });
});
