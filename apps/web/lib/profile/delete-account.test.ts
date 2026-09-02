import { createRequire } from "node:module";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteAccount } from "./delete-account";

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

function createD1(database: MemoryDatabase, log?: string[]) {
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
          const match = query.match(/^\s*DELETE\s+FROM\s+(\w+)/i);
          if (log && match) log.push(`sql:${match[1]}`);
          const result = database.prepare(query).run(...bindings) as {
            changes?: number | bigint;
          };
          return { success: true, meta: { changes: Number(result.changes ?? 0) } };
        },
      };
    },
  };
}

function seed(sqlite: MemoryDatabase) {
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE tenants (
      id TEXT PRIMARY KEY NOT NULL,
      slug TEXT NOT NULL
    );
    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      tenant_id TEXT NOT NULL REFERENCES tenants (id),
      name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE profiles (
      user_id TEXT PRIMARY KEY NOT NULL REFERENCES users (id),
      completeness INTEGER NOT NULL DEFAULT 0,
      talent_pool_opt_in INTEGER NOT NULL DEFAULT 0,
      cv_r2_key TEXT
    );
    CREATE TABLE experience_entries (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users (id),
      company TEXT NOT NULL,
      title TEXT NOT NULL
    );
    CREATE TABLE profile_skills (
      user_id TEXT NOT NULL REFERENCES users (id),
      skill TEXT NOT NULL,
      PRIMARY KEY (user_id, skill)
    );
    CREATE TABLE unlocks (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users (id),
      job_id TEXT NOT NULL,
      week_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE consent_events (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users (id),
      kind TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE subscriptions (
      user_id TEXT PRIMARY KEY NOT NULL REFERENCES users (id),
      stripe_status TEXT
    );
    CREATE TABLE session (
      id TEXT PRIMARY KEY NOT NULL,
      expires_at TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE
    );
    CREATE TABLE account (
      id TEXT PRIMARY KEY NOT NULL,
      issuer TEXT NOT NULL,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO tenants (id, slug) VALUES ('tenant-1', 'gaming');
    INSERT INTO users (id, tenant_id, name, email, created_at)
    VALUES
      ('user-1', 'tenant-1', 'Ada', 'ada@example.com', '2026-01-01T00:00:00.000Z'),
      ('user-2', 'tenant-1', 'Other', 'other@example.com', '2026-01-01T00:00:00.000Z');
    INSERT INTO profiles (user_id, cv_r2_key)
    VALUES
      ('user-1', 'cv/user-1/current.pdf'),
      ('user-2', 'cv/user-2/keep.pdf');
    INSERT INTO experience_entries (id, user_id, company, title)
    VALUES
      ('exp-1', 'user-1', 'Alpha Studio', 'Gameplay Programmer'),
      ('exp-2', 'user-2', 'Other Studio', 'Producer');
    INSERT INTO profile_skills (user_id, skill)
    VALUES ('user-1', 'gameplay-programmer'), ('user-2', 'producer');
    INSERT INTO unlocks (id, user_id, job_id, week_id, created_at)
    VALUES
      ('unlock-1', 'user-1', 'job-1', '2026-W36', '2026-09-02T12:00:00.000Z'),
      ('unlock-2', 'user-2', 'job-9', '2026-W36', '2026-09-02T12:00:00.000Z');
    INSERT INTO consent_events (id, user_id, kind, value, created_at)
    VALUES
      ('consent-1', 'user-1', 'talent_pool', '0', '2026-09-02T12:00:00.000Z'),
      ('consent-2', 'user-2', 'talent_pool', '1', '2026-09-02T12:00:00.000Z');
    INSERT INTO subscriptions (user_id, stripe_status)
    VALUES ('user-1', 'active'), ('user-2', 'canceled');
    INSERT INTO session (id, expires_at, token, created_at, updated_at, user_id)
    VALUES
      ('sess-1', '2099-01-01T00:00:00.000Z', 'token-1', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'user-1'),
      ('sess-2', '2099-01-01T00:00:00.000Z', 'token-2', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'user-2');
    INSERT INTO account (id, issuer, account_id, provider_id, user_id, created_at, updated_at)
    VALUES
      ('acct-1', 'https://accounts.google.com', 'google-1', 'google', 'user-1', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
      ('acct-2', 'https://accounts.google.com', 'google-2', 'google', 'user-2', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  `);
}

function count(sqlite: MemoryDatabase, table: string, userId: string, column = "user_id") {
  return (
    sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} = ?`).get(userId) as {
      count: number;
    }
  ).count;
}

describe("deleteAccount", () => {
  let sqlite: MemoryDatabase;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    seed(sqlite);
  });

  it("deletes the current R2 CV object before any SQL deletes", async () => {
    const log: string[] = [];
    const files = {
      delete: vi.fn(async (key: string) => {
        log.push(`r2:${key}`);
      }),
    };

    await deleteAccount({
      userId: "user-1",
      db: createD1(sqlite, log),
      files,
    });

    expect(files.delete).toHaveBeenCalledTimes(1);
    expect(files.delete).toHaveBeenCalledWith("cv/user-1/current.pdf");
    expect(log).toEqual([
      "r2:cv/user-1/current.pdf",
      "sql:experience_entries",
      "sql:profile_skills",
      "sql:unlocks",
      "sql:consent_events",
      "sql:subscriptions",
      "sql:profiles",
      "sql:session",
      "sql:account",
      "sql:users",
    ]);
    expect(count(sqlite, "experience_entries", "user-1")).toBe(0);
    expect(count(sqlite, "profile_skills", "user-1")).toBe(0);
    expect(count(sqlite, "unlocks", "user-1")).toBe(0);
    expect(count(sqlite, "consent_events", "user-1")).toBe(0);
    expect(count(sqlite, "subscriptions", "user-1")).toBe(0);
    expect(count(sqlite, "profiles", "user-1")).toBe(0);
    expect(count(sqlite, "session", "user-1")).toBe(0);
    expect(count(sqlite, "account", "user-1")).toBe(0);
    expect(count(sqlite, "users", "user-1", "id")).toBe(0);
    expect(count(sqlite, "users", "user-2", "id")).toBe(1);
    expect(count(sqlite, "profiles", "user-2")).toBe(1);
    expect(count(sqlite, "experience_entries", "user-2")).toBe(1);
  });

  it("skips R2 when there is no current CV key and still deletes SQL rows in order", async () => {
    sqlite.prepare("UPDATE profiles SET cv_r2_key = NULL WHERE user_id = ?").run("user-1");
    const log: string[] = [];
    const files = { delete: vi.fn(async () => undefined) };

    await deleteAccount({
      userId: "user-1",
      db: createD1(sqlite, log),
      files,
    });

    expect(files.delete).not.toHaveBeenCalled();
    expect(log).toEqual([
      "sql:experience_entries",
      "sql:profile_skills",
      "sql:unlocks",
      "sql:consent_events",
      "sql:subscriptions",
      "sql:profiles",
      "sql:session",
      "sql:account",
      "sql:users",
    ]);
    expect(count(sqlite, "users", "user-1", "id")).toBe(0);
  });

  it("does not run SQL deletes when R2 delete fails", async () => {
    const files = {
      delete: vi.fn(async () => {
        throw new Error("r2 unavailable");
      }),
    };

    await expect(
      deleteAccount({
        userId: "user-1",
        db: createD1(sqlite),
        files,
      }),
    ).rejects.toThrow("r2 unavailable");

    expect(count(sqlite, "users", "user-1", "id")).toBe(1);
    expect(count(sqlite, "profiles", "user-1")).toBe(1);
    expect(count(sqlite, "experience_entries", "user-1")).toBe(1);
  });
});
