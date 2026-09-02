import { createRequire } from "node:module";
import { beforeEach, describe, expect, it } from "vitest";

import { canUnlock, isPaidSubscription, unlockJob } from "./quota";
import { isoWeekId } from "./week";

interface MemoryDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
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
        async run() {
          database.prepare(query).run(...bindings);
          return { success: true };
        },
      };
    },
  };
}

describe("isoWeekId", () => {
  it("returns UTC ISO week as YYYY-Www", () => {
    expect(isoWeekId(new Date("2026-09-02T15:00:00.000Z"))).toBe("2026-W36");
  });

  it("starts a new ISO week at Monday 00:00 UTC", () => {
    expect(isoWeekId(new Date("2026-09-06T23:59:59.999Z"))).toBe("2026-W36");
    expect(isoWeekId(new Date("2026-09-07T00:00:00.000Z"))).toBe("2026-W37");
  });

  it("uses the ISO week-year when it differs from the calendar year", () => {
    expect(isoWeekId(new Date("2025-12-29T00:00:00.000Z"))).toBe("2026-W01");
  });
});

describe("canUnlock", () => {
  it("allows the 5th distinct job and blocks the 6th", () => {
    expect(
      canUnlock({ isPaid: false, existingUnlockSameJob: false, countThisWeek: 4 }),
    ).toBe(true);
    expect(
      canUnlock({ isPaid: false, existingUnlockSameJob: false, countThisWeek: 5 }),
    ).toBe(false);
  });

  it("does not consume quota for the same job in the same week", () => {
    expect(
      canUnlock({ isPaid: false, existingUnlockSameJob: true, countThisWeek: 5 }),
    ).toBe(true);
  });

  it("resets when the next ISO week has no unlocks yet", () => {
    expect(
      canUnlock({ isPaid: false, existingUnlockSameJob: false, countThisWeek: 0 }),
    ).toBe(true);
  });

  it("is unlimited when the subscription is paid", () => {
    expect(
      canUnlock({ isPaid: true, existingUnlockSameJob: false, countThisWeek: 5 }),
    ).toBe(true);
  });
});

describe("isPaidSubscription", () => {
  const now = new Date("2026-09-02T12:00:00.000Z");

  it("is paid only when stripe_status is active and period_end is in the future", () => {
    expect(
      isPaidSubscription(
        { stripe_status: "active", period_end: "2026-10-01T00:00:00.000Z" },
        now,
      ),
    ).toBe(true);
  });

  it("is not paid when status is inactive or the period has ended", () => {
    expect(
      isPaidSubscription(
        { stripe_status: "canceled", period_end: "2026-10-01T00:00:00.000Z" },
        now,
      ),
    ).toBe(false);
    expect(
      isPaidSubscription(
        { stripe_status: "active", period_end: "2026-09-01T00:00:00.000Z" },
        now,
      ),
    ).toBe(false);
    expect(isPaidSubscription(null, now)).toBe(false);
  });
});

describe("unlockJob", () => {
  const now = new Date("2026-09-02T12:00:00.000Z");
  const applyUrl = "https://studio.example/careers/secret-apply";
  let sqlite: MemoryDatabase;
  let db: ReturnType<typeof createD1>;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE jobs (
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
    `);
    db = createD1(sqlite);
  });

  function insertJob(id: string, listed = 1) {
    sqlite
      .prepare("INSERT INTO jobs (id, apply_url, listed) VALUES (?, ?, ?)")
      .run(id, applyUrl, listed);
  }

  function insertUnlock(jobId: string, weekId = "2026-W36") {
    sqlite
      .prepare(
        "INSERT INTO unlocks (id, user_id, job_id, week_id, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        `${jobId}-${weekId}`,
        "user-1",
        jobId,
        weekId,
        "2026-09-01T00:00:00.000Z",
      );
  }

  async function bodyOf(response: Response) {
    return {
      status: response.status,
      location: response.headers.get("location"),
      json: await response.json(),
    };
  }

  it("returns applyUrl JSON for the 5th distinct job and 402 quota for the 6th", async () => {
    for (const id of ["job-1", "job-2", "job-3", "job-4", "job-5", "job-6"]) {
      insertJob(id);
    }
    for (const id of ["job-1", "job-2", "job-3", "job-4"]) {
      insertUnlock(id);
    }

    const fifth = await bodyOf(
      await unlockJob(db, { userId: "user-1", jobId: "job-5", now }),
    );
    expect(fifth.status).toBe(200);
    expect(fifth.location).toBeNull();
    expect(fifth.json).toEqual({ applyUrl });

    const sixth = await bodyOf(
      await unlockJob(db, { userId: "user-1", jobId: "job-6", now }),
    );
    expect(sixth.status).toBe(402);
    expect(sixth.location).toBeNull();
    expect(sixth.json).toEqual({ code: "quota" });
    expect(JSON.stringify(sixth.json)).not.toContain(applyUrl);
  });

  it("does not consume quota when unlocking the same job in the same ISO week", async () => {
    for (const id of ["job-1", "job-2", "job-3", "job-4", "job-5"]) {
      insertJob(id);
      insertUnlock(id);
    }

    const again = await bodyOf(
      await unlockJob(db, { userId: "user-1", jobId: "job-1", now }),
    );
    expect(again.status).toBe(200);
    expect(again.json).toEqual({ applyUrl });
  });

  it("resets the free quota in the next UTC ISO week", async () => {
    insertJob("job-1");
    insertJob("job-next");
    for (const id of ["a", "b", "c", "d", "e"]) {
      insertJob(id);
      insertUnlock(id, "2026-W36");
    }

    const nextWeek = await bodyOf(
      await unlockJob(db, {
        userId: "user-1",
        jobId: "job-next",
        now: new Date("2026-09-07T00:00:00.000Z"),
      }),
    );
    expect(nextWeek.status).toBe(200);
    expect(nextWeek.json).toEqual({ applyUrl });
  });

  it("allows unlimited unlocks when stripe_status is active and period_end is in the future", async () => {
    for (const id of ["job-1", "job-2", "job-3", "job-4", "job-5", "job-6"]) {
      insertJob(id);
    }
    for (const id of ["job-1", "job-2", "job-3", "job-4", "job-5"]) {
      insertUnlock(id);
    }
    sqlite
      .prepare(
        "INSERT INTO subscriptions (user_id, stripe_status, period_end) VALUES (?, ?, ?)",
      )
      .run("user-1", "active", "2026-10-01T00:00:00.000Z");

    const sixth = await bodyOf(
      await unlockJob(db, { userId: "user-1", jobId: "job-6", now }),
    );
    expect(sixth.status).toBe(200);
    expect(sixth.json).toEqual({ applyUrl });
  });
});
