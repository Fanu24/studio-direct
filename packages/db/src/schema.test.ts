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

describe("0003_jobs_tenant_slug_unique.sql", () => {
  it("adds a unique tenant slug index for already-applied D1", () => {
    expect(forward).toContain("DROP INDEX IF EXISTS idx_jobs_slug");
    expect(forward).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_tenant_slug_unique");
  });
});
