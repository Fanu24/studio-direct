import { createRequire } from "node:module";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isoWeekId } from "../unlocks/week";
import {
  defaultTalentPoolOptIn,
  loadTalentPoolOptIn,
  parseTalentPoolOptIn,
  setTalentPoolOptIn,
  TALENT_POOL_CONSENT_KIND,
} from "./talent-pool";

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

function createD1(database: MemoryDatabase) {
  return {
    prepare(query: string) {
      let bindings: unknown[] = [];

      return {
        bind(...values: unknown[]) {
          bindings = values;
          return this;
        },
        async first<T>(column?: string) {
          const row = database.prepare(query).get(...bindings) as
            | Record<string, T>
            | undefined;
          if (!row) return null;
          return column ? (row[column] ?? null) : (row as T);
        },
        async all<T>() {
          const results = database.prepare(query).all(...bindings) as T[];
          return { results };
        },
        async run() {
          const result = database.prepare(query).run(...bindings) as {
            changes?: number | bigint;
          };
          return { success: true, meta: { changes: Number(result.changes ?? 0) } };
        },
      };
    },
  };
}

function schema(extra = "") {
  return `
    CREATE TABLE profiles (
      user_id TEXT PRIMARY KEY,
      completeness INTEGER NOT NULL DEFAULT 0,
      talent_pool_opt_in INTEGER NOT NULL DEFAULT 0,
      talent_pool_opt_in_at TEXT,
      talent_pool_opt_out_at TEXT
    );
    CREATE TABLE consent_events (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    ${extra}
  `;
}

function consentRows(sqlite: MemoryDatabase) {
  return sqlite
    .prepare(
      "SELECT user_id, kind, value, created_at FROM consent_events ORDER BY created_at, id",
    )
    .all() as {
      user_id: string;
      kind: string;
      value: string;
      created_at: string;
    }[];
}

describe("defaultTalentPoolOptIn", () => {
  it("is 0 so new profiles stay out of the talent pool", () => {
    expect(defaultTalentPoolOptIn()).toBe(0);
  });
});

describe("parseTalentPoolOptIn", () => {
  it("treats a missing checkbox as the default off value", () => {
    expect(parseTalentPoolOptIn(new FormData())).toBe(0);
    const off = new FormData();
    off.set("talent_pool_opt_in", "0");
    expect(parseTalentPoolOptIn(off)).toBe(0);
  });

  it("accepts a checked talent-pool checkbox", () => {
    const form = new FormData();
    form.set("talent_pool_opt_in", "1");
    expect(parseTalentPoolOptIn(form)).toBe(1);
  });
});

describe("talent pool store", () => {
  let sqlite: MemoryDatabase;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(schema());
  });

  it("loads missing and defaulted rows as 0", async () => {
    const db = createD1(sqlite);
    await expect(loadTalentPoolOptIn(db, "missing")).resolves.toBe(0);

    sqlite.prepare("INSERT INTO profiles (user_id) VALUES (?)").run("user-1");
    await expect(loadTalentPoolOptIn(db, "user-1")).resolves.toBe(0);
  });

  it("opts in, stamps the profile, and writes a consent_events row", async () => {
    const db = createD1(sqlite);
    const now = new Date("2026-09-02T12:00:00.000Z");
    vi.spyOn(crypto, "randomUUID").mockReturnValue("consent-1");

    const result = await setTalentPoolOptIn(db, "user-1", 1, now);
    const profile = sqlite
      .prepare(
        "SELECT talent_pool_opt_in, talent_pool_opt_in_at, talent_pool_opt_out_at FROM profiles WHERE user_id = ?",
      )
      .get("user-1") as {
        talent_pool_opt_in: number;
        talent_pool_opt_in_at: string | null;
        talent_pool_opt_out_at: string | null;
      };

    expect(result).toEqual({ changed: true, value: 1 });
    expect(profile.talent_pool_opt_in).toBe(1);
    expect(profile.talent_pool_opt_in_at).toBe(now.toISOString());
    expect(profile.talent_pool_opt_out_at).toBeNull();
    expect(consentRows(sqlite)).toEqual([
      {
        user_id: "user-1",
        kind: TALENT_POOL_CONSENT_KIND,
        value: "1",
        created_at: now.toISOString(),
      },
    ]);
  });

  it("opts out and writes a consent_events row only when the value changes", async () => {
    const db = createD1(sqlite);
    const inAt = new Date("2026-09-02T12:00:00.000Z");
    const outAt = new Date("2026-09-03T08:00:00.000Z");
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("consent-1")
      .mockReturnValueOnce("consent-2")
      .mockReturnValueOnce("consent-3");

    await setTalentPoolOptIn(db, "user-1", 1, inAt);
    const repeat = await setTalentPoolOptIn(db, "user-1", 1, outAt);
    const optedOut = await setTalentPoolOptIn(db, "user-1", 0, outAt);
    const profile = sqlite
      .prepare(
        "SELECT talent_pool_opt_in, talent_pool_opt_in_at, talent_pool_opt_out_at FROM profiles WHERE user_id = ?",
      )
      .get("user-1") as {
        talent_pool_opt_in: number;
        talent_pool_opt_in_at: string | null;
        talent_pool_opt_out_at: string | null;
      };

    expect(repeat).toEqual({ changed: false, value: 1 });
    expect(optedOut).toEqual({ changed: true, value: 0 });
    expect(profile.talent_pool_opt_in).toBe(0);
    expect(profile.talent_pool_opt_in_at).toBe(inAt.toISOString());
    expect(profile.talent_pool_opt_out_at).toBe(outAt.toISOString());
    expect(consentRows(sqlite)).toEqual([
      {
        user_id: "user-1",
        kind: TALENT_POOL_CONSENT_KIND,
        value: "1",
        created_at: inAt.toISOString(),
      },
      {
        user_id: "user-1",
        kind: TALENT_POOL_CONSENT_KIND,
        value: "0",
        created_at: outAt.toISOString(),
      },
    ]);
  });
});

describe("unlock does not opt into the talent pool", () => {
  it("leaves talent_pool_opt_in at 0 and writes no consent row", async () => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      ${schema(`
        CREATE TABLE jobs (
 listing_logo_url TEXT, highlight_color TEXT, expires_at TEXT,
          id TEXT PRIMARY KEY,
          apply_url TEXT NOT NULL,
          listed INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE unlocks (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          job_id TEXT NOT NULL,
          week_id TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX idx_unlocks_user_job_week ON unlocks (user_id, job_id, week_id);
        CREATE TABLE subscriptions (
          user_id TEXT PRIMARY KEY,
          stripe_status TEXT,
          period_end TEXT
        );
      `)}
      INSERT INTO profiles (user_id) VALUES ('user-1');
      INSERT INTO jobs (id, apply_url, listed) VALUES ('job-1', 'https://studio.example/apply', 1);
    `);

    const { unlockJob } = await import("../unlocks/quota");
    const response = await unlockJob(createD1(sqlite), {
      userId: "user-1",
      jobId: "job-1",
      now: new Date("2026-09-02T12:00:00.000Z"),
    });
    const profile = sqlite
      .prepare("SELECT talent_pool_opt_in FROM profiles WHERE user_id = ?")
      .get("user-1") as { talent_pool_opt_in: number };
    const unlock = sqlite
      .prepare("SELECT job_id, week_id FROM unlocks WHERE user_id = ?")
      .get("user-1") as { job_id: string; week_id: string };

    expect(response.status).toBe(200);
    expect(unlock).toEqual({
      job_id: "job-1",
      week_id: isoWeekId(new Date("2026-09-02T12:00:00.000Z")),
    });
    expect(profile.talent_pool_opt_in).toBe(0);
    expect(consentRows(sqlite)).toEqual([]);
  });
});
