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
  });
});
