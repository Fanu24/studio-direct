import { createRequire } from "node:module";
import { beforeEach, describe, expect, it } from "vitest";

import {
  parseApplyInput,
  safeNextPath,
  submitJobApplication,
  type ApplyDatabase,
} from "./apply";

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

function createDb(): { sqlite: MemoryDatabase; db: ApplyDatabase } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE jobs (
 listing_logo_url TEXT, highlight_color TEXT, expires_at TEXT,
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      listed INTEGER NOT NULL
    );
    CREATE TABLE employer_listings(job_id TEXT,apply_mode TEXT,closed_at TEXT,expires_at TEXT);
    INSERT INTO employer_listings VALUES('job-1','internal',NULL,'2099-01-01');
    CREATE TABLE job_applications (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      profile_url TEXT,
      note TEXT,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX idx_job_applications_job_email
      ON job_applications (job_id, email);
  `);
  sqlite.prepare(
    "INSERT INTO jobs (id, tenant_id, listed) VALUES (?, ?, 1)",
  ).run("job-1", "tenant-gaming");

  return {
    sqlite,
    db: {
      prepare(query: string) {
        let bindings: unknown[] = [];
        const bound = {
          async first<T>(column?: string) {
            const row = sqlite.prepare(query).get(...bindings) as
              | Record<string, T>
              | undefined;
            if (!row) return null;
            return column ? (row[column] ?? null) : (row as T);
          },
          async run() {
            return sqlite.prepare(query).run(...bindings);
          },
        };
        return {
          bind(...values: unknown[]) {
            bindings = values;
            return bound;
          },
        };
      },
    },
  };
}

const valid = {
  tenantId: "tenant-gaming",
  jobId: "job-1",
  name: "Ada Lovelace",
  email: "Ada@Example.com",
  profileUrl: "https://ada.example",
  note: "I ship Solidity.",
  honeypot: "",
};

describe("submitJobApplication", () => {
  let sqlite: MemoryDatabase;
  let db: ApplyDatabase;

  beforeEach(() => {
    ({ sqlite, db } = createDb());
  });

  it("stores the application on Nodework and normalizes email", async () => {
    const result = await submitJobApplication(db, parseApplyInput(valid));
    const row = sqlite
      .prepare("SELECT email, name FROM job_applications")
      .get() as { email: string; name: string };

    expect(result).toEqual({ ok: true, duplicate: false });
    expect(row).toEqual({ email: "ada@example.com", name: "Ada Lovelace" });
  });

  it("treats a second submit from the same email as success without a second row", async () => {
    await submitJobApplication(db, parseApplyInput(valid));
    const again = await submitJobApplication(db, parseApplyInput(valid));
    const count = sqlite
      .prepare("SELECT COUNT(*) AS n FROM job_applications")
      .get() as { n: number };

    expect(again).toEqual({ ok: true, duplicate: true });
    expect(count.n).toBe(1);
  });

  it("drops honeypot spam without inserting", async () => {
    const result = await submitJobApplication(
      db,
      parseApplyInput({ ...valid, honeypot: "https://spam.example" }),
    );
    const count = sqlite
      .prepare("SELECT COUNT(*) AS n FROM job_applications")
      .get() as { n: number };

    expect(result).toEqual({ ok: true, duplicate: false });
    expect(count.n).toBe(0);
  });
});

describe("safeNextPath", () => {
  it("rejects off-site redirects", () => {
    expect(safeNextPath("/solidity-jobs/apply")).toBe("/solidity-jobs/apply");
    expect(safeNextPath("https://web3.career/x")).toBe("/jobs");
    expect(safeNextPath("//web3.career")).toBe("/jobs");
  });
});
