import { createRequire } from "node:module";
import { beforeEach, describe, expect, it } from "vitest";

import { exportAccountData } from "./export";

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

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

describe("exportAccountData", () => {
  let sqlite: MemoryDatabase;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE tenants (
        id TEXT PRIMARY KEY NOT NULL,
        slug TEXT NOT NULL
      );
      CREATE TABLE users (
        id TEXT PRIMARY KEY NOT NULL,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL,
        email_verified INTEGER NOT NULL DEFAULT 0,
        image TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE profiles (
        user_id TEXT PRIMARY KEY,
        display_name TEXT,
        headline TEXT,
        location TEXT,
        timezone TEXT,
        target_role TEXT,
        seniority TEXT,
        remote_pref TEXT,
        salary_min INTEGER,
        salary_max INTEGER,
        work_auth_text TEXT,
        completeness INTEGER NOT NULL DEFAULT 0,
        talent_pool_opt_in INTEGER NOT NULL DEFAULT 0,
        talent_pool_opt_in_at TEXT,
        talent_pool_opt_out_at TEXT,
        cv_r2_key TEXT
      );
      CREATE TABLE experience_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        company TEXT NOT NULL,
        title TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        description TEXT
      );
      CREATE TABLE profile_skills (
        user_id TEXT NOT NULL,
        skill TEXT NOT NULL,
        PRIMARY KEY (user_id, skill)
      );
      CREATE TABLE unlocks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        week_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE consent_events (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE subscriptions (
        user_id TEXT PRIMARY KEY,
        stripe_customer_id TEXT,
        stripe_status TEXT,
        period_end TEXT
      );
      INSERT INTO tenants (id, slug) VALUES ('tenant-1', 'nodework');
      INSERT INTO users (id, tenant_id, name, email, email_verified, created_at, updated_at)
      VALUES (
        'user-1', 'tenant-1', 'Ada', 'ada@example.com', 1,
        '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z'
      );
      INSERT INTO users (id, tenant_id, name, email, created_at, updated_at)
      VALUES (
        'user-2', 'tenant-1', 'Other', 'other@example.com',
        '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
      );
      INSERT INTO profiles (
        user_id, display_name, headline, location, timezone, target_role,
        seniority, remote_pref, salary_min, salary_max, work_auth_text,
        completeness, talent_pool_opt_in, cv_r2_key
      ) VALUES (
        'user-1', 'Ada Lovelace', 'Gameplay Programmer', 'Berlin', 'Europe/Berlin',
        'Gameplay Programmer', 'mid', 'remote', 80000, 110000, 'EU',
        80, 0, 'cv/user-1/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.pdf'
      );
      INSERT INTO profiles (user_id, display_name, talent_pool_opt_in)
      VALUES ('user-2', 'Other Person', 1);
      INSERT INTO experience_entries (id, user_id, company, title, start_date, end_date, description)
      VALUES (
        'exp-1', 'user-1', 'Alpha Studio', 'Gameplay Programmer',
        '2024-01-01', NULL, 'Shipped a combat system'
      );
      INSERT INTO experience_entries (id, user_id, company, title)
      VALUES ('exp-2', 'user-2', 'Other Studio', 'Producer');
      INSERT INTO profile_skills (user_id, skill) VALUES ('user-1', 'gameplay-programmer');
      INSERT INTO profile_skills (user_id, skill) VALUES ('user-2', 'producer');
      INSERT INTO unlocks (id, user_id, job_id, week_id, created_at)
      VALUES ('unlock-1', 'user-1', 'job-1', '2026-W36', '2026-09-02T12:00:00.000Z');
      INSERT INTO unlocks (id, user_id, job_id, week_id, created_at)
      VALUES ('unlock-2', 'user-2', 'job-9', '2026-W36', '2026-09-02T12:00:00.000Z');
      INSERT INTO consent_events (id, user_id, kind, value, created_at)
      VALUES ('consent-1', 'user-1', 'talent_pool', '0', '2026-09-02T12:00:00.000Z');
      INSERT INTO consent_events (id, user_id, kind, value, created_at)
      VALUES ('consent-2', 'user-2', 'talent_pool', '1', '2026-09-02T12:00:00.000Z');
      INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_status, period_end)
      VALUES ('user-1', 'cus_ada', 'active', '2026-10-01T00:00:00.000Z');
      INSERT INTO subscriptions (user_id, stripe_status)
      VALUES ('user-2', 'canceled');
    `);
  });

  it("exports this user's rows and never includes publicUrl or /talent", async () => {
    const payload = await exportAccountData(createD1(sqlite), "user-1");
    const json = serialized(payload);

    expect(payload.user).toMatchObject({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
    });
    expect(payload.profile).toMatchObject({
      display_name: "Ada Lovelace",
      target_role: "Gameplay Programmer",
      cv_r2_key: "cv/user-1/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.pdf",
      talent_pool_opt_in: 0,
    });
    expect(payload.experience).toEqual([
      expect.objectContaining({
        company: "Alpha Studio",
        title: "Gameplay Programmer",
      }),
    ]);
    expect(payload.skills).toEqual(["gameplay-programmer"]);
    expect(payload.unlocks).toEqual([
      expect.objectContaining({ job_id: "job-1", week_id: "2026-W36" }),
    ]);
    expect(payload.consent_events).toEqual([
      expect.objectContaining({ kind: "talent_pool", value: "0" }),
    ]);
    expect(payload.subscription).toMatchObject({
      stripe_status: "active",
      stripe_customer_id: "cus_ada",
    });
    expect(json).not.toMatch(/publicUrl/i);
    expect(json).not.toMatch(/\/talent/i);
    expect(json).not.toContain("other@example.com");
    expect(json).not.toContain("Other Person");
    expect(json).not.toContain("Other Studio");
  });

  it("exports empty collections when the user has no profile rows", async () => {
    sqlite.exec(`
      INSERT INTO users (id, tenant_id, name, email, created_at, updated_at)
      VALUES (
        'user-3', 'tenant-1', 'Empty', 'empty@example.com',
        '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
      );
    `);

    const payload = await exportAccountData(createD1(sqlite), "user-3");
    const json = serialized(payload);

    expect(payload.user).toMatchObject({ id: "user-3", email: "empty@example.com" });
    expect(payload.profile).toBeNull();
    expect(payload.experience).toEqual([]);
    expect(payload.skills).toEqual([]);
    expect(payload.unlocks).toEqual([]);
    expect(payload.consent_events).toEqual([]);
    expect(payload.subscription).toBeNull();
    expect(json).not.toMatch(/publicUrl/i);
    expect(json).not.toMatch(/\/talent/i);
  });
});
