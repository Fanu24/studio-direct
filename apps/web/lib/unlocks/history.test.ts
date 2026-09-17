import { createRequire } from "node:module";
import { beforeEach, describe, expect, it } from "vitest";

import {
  countUnlocksThisWeek,
  listRecentUnlocks,
  loadSubscriptionStatus,
} from "./history";

interface MemoryDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...values: unknown[]): unknown;
    all(...values: unknown[]): unknown[];
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
          return { results: database.prepare(query).all(...bindings) as T[] };
        },
      };
    },
  };
}

describe("unlock history", () => {
  const now = new Date("2026-09-02T12:00:00.000Z");
  let sqlite: MemoryDatabase;
  let db: ReturnType<typeof createD1>;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );
      CREATE TABLE jobs (
 listing_logo_url TEXT, highlight_color TEXT, expires_at TEXT,
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        slug TEXT NOT NULL,
        title TEXT NOT NULL
      );
      CREATE TABLE unlocks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        week_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE subscriptions (
        user_id TEXT PRIMARY KEY,
        stripe_status TEXT,
        period_end TEXT
      );
      INSERT INTO companies (id, name) VALUES ('riot', 'Riot Games'), ('dream', 'Dream Games');
      INSERT INTO jobs (id, company_id, slug, title) VALUES
        ('job-1', 'riot', 'riot-games-senior-gameplay-engineer', 'Senior Gameplay Engineer'),
        ('job-2', 'dream', 'dream-games-live-ops-designer', 'Live Ops Designer'),
        ('job-3', 'riot', 'riot-games-technical-artist', 'Technical Artist');
    `);
    db = createD1(sqlite);
  });

  function insertUnlock(
    id: string,
    jobId: string,
    createdAt: string,
    weekId = "2026-W36",
    userId = "user-1",
  ) {
    sqlite
      .prepare(
        "INSERT INTO unlocks (id, user_id, job_id, week_id, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(id, userId, jobId, weekId, createdAt);
  }

  describe("countUnlocksThisWeek", () => {
    it("counts only the current UTC ISO week for the given user", async () => {
      insertUnlock("u1", "job-1", "2026-09-01T09:00:00.000Z");
      insertUnlock("u2", "job-2", "2026-09-02T09:00:00.000Z");
      insertUnlock("u3", "job-3", "2026-08-25T09:00:00.000Z", "2026-W35");
      insertUnlock("u4", "job-1", "2026-09-02T10:00:00.000Z", "2026-W36", "user-2");

      expect(await countUnlocksThisWeek(db, "user-1", now)).toBe(2);
      expect(await countUnlocksThisWeek(db, "user-2", now)).toBe(1);
    });

    it("is zero when the user has no unlocks this week", async () => {
      insertUnlock("u1", "job-1", "2026-08-25T09:00:00.000Z", "2026-W35");

      expect(await countUnlocksThisWeek(db, "user-1", now)).toBe(0);
      expect(
        await countUnlocksThisWeek(db, "user-1", new Date("2026-08-26T00:00:00.000Z")),
      ).toBe(1);
    });
  });

  describe("listRecentUnlocks", () => {
    it("joins jobs and companies, newest first, and respects the limit", async () => {
      insertUnlock("u1", "job-1", "2026-09-01T09:00:00.000Z");
      insertUnlock("u2", "job-2", "2026-09-02T09:00:00.000Z");
      insertUnlock("u3", "job-3", "2026-08-25T09:00:00.000Z", "2026-W35");

      const recent = await listRecentUnlocks(db, "user-1", 5);

      expect(recent).toEqual([
        {
          jobId: "job-2",
          slug: "dream-games-live-ops-designer",
          title: "Live Ops Designer",
          companyName: "Dream Games",
          unlockedAt: "2026-09-02T09:00:00.000Z",
        },
        {
          jobId: "job-1",
          slug: "riot-games-senior-gameplay-engineer",
          title: "Senior Gameplay Engineer",
          companyName: "Riot Games",
          unlockedAt: "2026-09-01T09:00:00.000Z",
        },
        {
          jobId: "job-3",
          slug: "riot-games-technical-artist",
          title: "Technical Artist",
          companyName: "Riot Games",
          unlockedAt: "2026-08-25T09:00:00.000Z",
        },
      ]);

      const limited = await listRecentUnlocks(db, "user-1", 2);
      expect(limited.map((row) => row.jobId)).toEqual(["job-2", "job-1"]);
    });

    it("lists a job once with its latest unlock time when it was unlocked in two weeks", async () => {
      insertUnlock("u1", "job-1", "2026-08-25T09:00:00.000Z", "2026-W35");
      insertUnlock("u2", "job-1", "2026-09-01T09:00:00.000Z", "2026-W36");

      const recent = await listRecentUnlocks(db, "user-1");

      expect(recent).toHaveLength(1);
      expect(recent[0]?.unlockedAt).toBe("2026-09-01T09:00:00.000Z");
    });

    it("ignores other users and returns an empty list when nothing was unlocked", async () => {
      insertUnlock("u1", "job-1", "2026-09-01T09:00:00.000Z", "2026-W36", "user-2");

      expect(await listRecentUnlocks(db, "user-1")).toEqual([]);
    });

    it("returns an empty list when the database shape has no all()", async () => {
      const firstOnly = {
        prepare: (query: string) => {
          const statement = db.prepare(query);
          return {
            bind: (...values: unknown[]) => {
              statement.bind(...values);
              return { first: statement.first.bind(statement) };
            },
          };
        },
      };

      expect(await listRecentUnlocks(firstOnly, "user-1")).toEqual([]);
    });
  });

  describe("loadSubscriptionStatus", () => {
    it("is paid with the period end when stripe_status is active and period_end is ahead", async () => {
      sqlite
        .prepare(
          "INSERT INTO subscriptions (user_id, stripe_status, period_end) VALUES (?, ?, ?)",
        )
        .run("user-1", "active", "2026-10-01T00:00:00.000Z");

      expect(await loadSubscriptionStatus(db, "user-1", now)).toEqual({
        paid: true,
        periodEnd: "2026-10-01T00:00:00.000Z",
      });
    });

    it("is free without a period end when the subscription is missing, canceled or expired", async () => {
      expect(await loadSubscriptionStatus(db, "user-1", now)).toEqual({
        paid: false,
        periodEnd: null,
      });

      sqlite
        .prepare(
          "INSERT INTO subscriptions (user_id, stripe_status, period_end) VALUES (?, ?, ?)",
        )
        .run("user-2", "canceled", "2026-10-01T00:00:00.000Z");
      expect(await loadSubscriptionStatus(db, "user-2", now)).toEqual({
        paid: false,
        periodEnd: null,
      });

      sqlite
        .prepare(
          "INSERT INTO subscriptions (user_id, stripe_status, period_end) VALUES (?, ?, ?)",
        )
        .run("user-3", "active", "2026-09-01T00:00:00.000Z");
      expect(await loadSubscriptionStatus(db, "user-3", now)).toEqual({
        paid: false,
        periodEnd: null,
      });
    });
  });
});
