import { createRequire } from "node:module";
import { beforeEach, describe, expect, it } from "vitest";

import { listJobs, type JobsDatabase } from "./queries";

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
  },
) {
  database
    .prepare(
      `INSERT INTO jobs (
        id, tenant_id, company_id, title, slug, location, remote, salary_text,
        exclusivity, posted_at, listed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      job.id,
      job.tenantId ?? "gaming",
      job.companyId,
      job.title,
      job.id,
      "London",
      job.remote,
      null,
      job.exclusivity ?? "unknown",
      job.postedAt ?? "2026-09-01T00:00:00Z",
      job.listed ?? 1,
    );

  database
    .prepare(
      "INSERT INTO jobs_fts(rowid, title, description, company_name) SELECT rowid, title, ?, (SELECT name FROM companies WHERE id = company_id) FROM jobs WHERE id = ?",
    )
    .run(`${job.title} game development`, job.id);
}

describe("listJobs", () => {
  let sqlite: MemoryDatabase;
  let db: JobsDatabase;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE companies (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        listed INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE jobs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        location TEXT,
        remote TEXT NOT NULL,
        salary_text TEXT,
        exclusivity TEXT NOT NULL DEFAULT 'unknown',
        posted_at TEXT,
        listed INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE job_sightings (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        source TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE jobs_fts USING fts5 (
        title, description, company_name
      );
      INSERT INTO companies VALUES
        ('studio-a', 'gaming', 'Alpha Studio', 1),
        ('studio-b', 'gaming', 'Beta Forge', 1),
        ('studio-other', 'other', 'Other Studio', 1);
    `);
    db = createD1(sqlite);
  });

  it("defaults to listed remote and hybrid jobs for the tenant", async () => {
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

    expect(result.jobs.map((job) => job.id)).toEqual(["hybrid", "remote"]);
    expect(result.total).toBe(2);
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
});
