import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

// Vite's resolver does not yet know `node:sqlite` as a builtin, so a static import fails
// to load. Requiring it at runtime bypasses the resolver.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => DatabaseSyncLike;
};

type DatabaseSyncLike = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
  };
};

/**
 * Behavioural cover for the migration set. The other suite in this package asserts on the
 * *text* of each file, which cannot catch a statement that is syntactically valid but
 * illegal against the objects it touches.
 *
 * That is exactly how the jobs_fts triggers broke: they removed the stale index row with
 * FTS5's special "delete" command, which only exists for external-content and contentless
 * tables. jobs_fts owns its content, so every UPDATE and DELETE on `jobs` failed with the
 * opaque message "SQL logic error" — and only on the second pass over a listing, so a
 * fresh import looked healthy while re-ingest and close-stale were both broken.
 */

const migrationsDir = fileURLToPath(new URL("../migrations", import.meta.url));

function applyMigrations(): DatabaseSyncLike {
  const db = new DatabaseSync(":memory:");
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of files) {
    db.exec(readFileSync(`${migrationsDir}/${name}`, "utf8"));
  }
  return db;
}

function seedOneJob(db: DatabaseSyncLike): void {
  db.exec(`
    -- 0004 already seeds the real 'nodework' tenant, so this fixture uses its own slug.
    INSERT INTO tenants (id, slug, name) VALUES ('tenant:t', 'fixture', 'Fixture');
    INSERT INTO companies (id, tenant_id, name, name_norm, listed, created_at)
      VALUES ('company:c', 'tenant:t', 'Acme', 'acme', 1, '2026-09-01T00:00:00.000Z');
    INSERT INTO jobs (
      id, tenant_id, company_id, canonical_key, title, title_norm, slug, location, remote,
      description_html, apply_url, exclusivity, seen_on_indeed, posted_at, listed,
      created_at, updated_at
    ) VALUES (
      'job:1', 'tenant:t', 'company:c', 'web3_career:1', 'Solidity Engineer',
      'solidity engineer', 'solidity-engineer-acme-1', 'Remote', 'remote',
      '<p>Build contracts.</p>', 'https://example.com/apply', 'unknown', 0,
      '2026-09-01T00:00:00.000Z', 1, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'
    );
  `);
}

describe("the migration set, applied in order", () => {
  let db: DatabaseSyncLike;

  beforeEach(() => {
    db = applyMigrations();
    seedOneJob(db);
  });

  it("indexes an inserted job for full-text search", () => {
    const row = db
      .prepare(`SELECT company_name FROM jobs_fts WHERE jobs_fts MATCH 'solidity'`)
      .get() as { company_name: string } | undefined;

    expect(row?.company_name).toBe("Acme");
  });

  // The crawler's re-ingest path. This is the statement that used to raise.
  it("lets a job be updated, and reindexes it", () => {
    expect(() =>
      db.prepare(`UPDATE jobs SET title = ? WHERE id = 'job:1'`).run("Rust Engineer"),
    ).not.toThrow();

    const stale = db.prepare(`SELECT rowid FROM jobs_fts WHERE jobs_fts MATCH 'solidity'`).get();
    const fresh = db.prepare(`SELECT rowid FROM jobs_fts WHERE jobs_fts MATCH 'rust'`).get();
    expect(stale).toBeUndefined();
    expect(fresh).toBeDefined();
  });

  // close-stale sets listed = 0, which is an UPDATE and hit the same failure.
  it("lets a listing be closed", () => {
    expect(() =>
      db.prepare(`UPDATE jobs SET listed = 0 WHERE id = 'job:1'`).run(),
    ).not.toThrow();

    const row = db.prepare(`SELECT listed FROM jobs WHERE id = 'job:1'`).get() as {
      listed: number;
    };
    expect(row.listed).toBe(0);
  });

  it("lets a job be deleted, and drops it from the index", () => {
    expect(() => db.prepare(`DELETE FROM jobs WHERE id = 'job:1'`).run()).not.toThrow();

    const row = db.prepare(`SELECT rowid FROM jobs_fts WHERE jobs_fts MATCH 'solidity'`).get();
    expect(row).toBeUndefined();
  });

  // The suite above runs against a fresh database, where 0001_init.sql already installs the
  // correct triggers — so it would pass with or without 0007. This is the test for what
  // 0007 actually claims: repairing a database that already ran the broken version.
  it("0007 repairs a database that still carries the broken triggers", () => {
    db.exec(`
      DROP TRIGGER jobs_fts_au;
      CREATE TRIGGER jobs_fts_au AFTER UPDATE ON jobs BEGIN
        INSERT INTO jobs_fts (jobs_fts, rowid, title, description, company_name)
        VALUES ('delete', OLD.rowid, OLD.title, OLD.description_html, '');
        INSERT INTO jobs_fts (rowid, title, description, company_name)
        VALUES (NEW.rowid, NEW.title, NEW.description_html, '');
      END;
    `);

    expect(() =>
      db.prepare(`UPDATE jobs SET listed = 0 WHERE id = 'job:1'`).run(),
    ).toThrow(/SQL logic error/);

    db.exec(readFileSync(`${migrationsDir}/0007_fix_jobs_fts_triggers.sql`, "utf8"));

    expect(() =>
      db.prepare(`UPDATE jobs SET listed = 0 WHERE id = 'job:1'`).run(),
    ).not.toThrow();
  });

  it("re-upserts a job through the crawler's ON CONFLICT path", () => {
    const upsert = db.prepare(`
      INSERT INTO jobs (
        id, tenant_id, company_id, canonical_key, title, title_norm, slug, location, remote,
        description_html, apply_url, salary_min, salary_max, source, external_id,
        exclusivity, seen_on_indeed, posted_at, listed, created_at, updated_at
      ) VALUES (
        'job:1', 'tenant:t', 'company:c', 'web3_career:1', ?, 'solidity engineer',
        'solidity-engineer-acme-1', 'Remote', 'remote', '<p>x</p>',
        'https://example.com/apply', ?, ?, 'web3_career_api', '1', 'unknown', 0,
        '2026-09-01T00:00:00.000Z', 1, '2026-09-01T00:00:00.000Z', '2026-09-02T00:00:00.000Z'
      )
      ON CONFLICT (tenant_id, canonical_key) DO UPDATE SET
        title = excluded.title,
        salary_min = excluded.salary_min,
        salary_max = excluded.salary_max
    `);

    expect(() => upsert.run("Senior Solidity Engineer", 120000, 240000)).not.toThrow();

    const row = db.prepare(`SELECT title, salary_min FROM jobs WHERE id = 'job:1'`).get() as {
      title: string;
      salary_min: number;
    };
    expect(row).toMatchObject({ title: "Senior Solidity Engineer", salary_min: 120000 });
  });
});

/**
 * The tag and location lookups are the whole programmatic-SEO surface, and on the first
 * day in production they read 16.2 million rows across 1,283 queries - about 12,600 rows
 * each, three times D1's free-tier daily cap. Once that cap is hit every DB-backed page
 * returns a 500 while the worker still reports outcome: ok.
 *
 * Asserting that 0008 declares two indexes would prove nothing: the composite primary keys
 * these tables already carry *look* like they cover the same columns. What has to be true
 * is that the planner seeks instead of scanning, so that is what these assert - the same
 * reason this file exists rather than the one that reads migration text.
 */
describe("tag and location lookups do not scan", () => {
  type Planned = { detail: string };

  /**
   * DatabaseSyncLike declares only `run` and `get` on a prepared statement,
   * because nothing else in this file needed rows back. Widening the database
   * type with an intersection does not work: `prepare` then has two
   * signatures and the call resolves to the first, which still has no `all`.
   * Cast the statement instead of the database.
   */
  function planFor(db: DatabaseSyncLike, sql: string): string {
    const statement = db.prepare(`EXPLAIN QUERY PLAN ${sql}`) as unknown as {
      all(...params: unknown[]): Planned[];
    };
    return statement
      .all()
      .map((row) => row.detail)
      .join(" | ");
  }

  let db: DatabaseSyncLike;

  beforeEach(() => {
    db = applyMigrations();
    seedOneJob(db);
    db.exec(`
      INSERT INTO job_tags (job_id, tag_slug) VALUES ('job:1', 'solidity');
      INSERT INTO locations (slug, kind, label) VALUES ('berlin', 'city', 'Berlin');
      INSERT INTO job_locations (job_id, location_slug) VALUES ('job:1', 'berlin');
    `);
  });

  it("seeks job_tags by tag_slug rather than scanning it", () => {
    const plan = planFor(
      db,
      `SELECT j.id FROM job_tags jt JOIN jobs j ON j.id = jt.job_id
       WHERE jt.tag_slug = 'solidity' AND j.listed = 1`,
    );

    expect(plan).toContain("idx_job_tags_tag");
    expect(plan).not.toMatch(/SCAN (job_tags|jt)\b/);
  });

  it("seeks job_locations by location_slug rather than scanning it", () => {
    const plan = planFor(
      db,
      `SELECT j.id FROM job_locations jl JOIN jobs j ON j.id = jl.job_id
       WHERE jl.location_slug = 'berlin' AND j.listed = 1`,
    );

    expect(plan).toContain("idx_job_locations_location");
    expect(plan).not.toMatch(/SCAN (job_locations|jl)\b/);
  });

  it("still answers the other direction, which the primary keys already covered", () => {
    const plan = planFor(db, `SELECT tag_slug FROM job_tags WHERE job_id = 'job:1'`);
    expect(plan).not.toMatch(/SCAN /);
  });
});
