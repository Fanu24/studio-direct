import { createRequire } from "node:module";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  getSession: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("../../../../lib/auth/index", () => ({
  createAuth: () => ({
    api: {
      getSession: mocks.getSession,
    },
  }),
}));

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

function env(DB: unknown) {
  return {
    env: {
      DB,
      FILES: { delete: mocks.deleteObject },
      BETTER_AUTH_SECRET: "auth-secret",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      EMAIL_FROM: "noreply@example.com",
      EMAIL: { send: vi.fn() },
    },
  };
}

describe("POST /api/account/delete", () => {
  let sqlite: MemoryDatabase;
  let log: string[];

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    log = [];
    sqlite = new DatabaseSync(":memory:");
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
      VALUES ('user-1', 'tenant-1', 'Ada', 'ada@example.com', '2026-01-01T00:00:00.000Z');
      INSERT INTO profiles (user_id, cv_r2_key) VALUES ('user-1', 'cv/user-1/current.pdf');
      INSERT INTO experience_entries (id, user_id, company, title)
      VALUES ('exp-1', 'user-1', 'Alpha Studio', 'Gameplay Programmer');
      INSERT INTO profile_skills (user_id, skill) VALUES ('user-1', 'gameplay-programmer');
      INSERT INTO unlocks (id, user_id, job_id, week_id, created_at)
      VALUES ('unlock-1', 'user-1', 'job-1', '2026-W36', '2026-09-02T12:00:00.000Z');
      INSERT INTO consent_events (id, user_id, kind, value, created_at)
      VALUES ('consent-1', 'user-1', 'talent_pool', '0', '2026-09-02T12:00:00.000Z');
      INSERT INTO subscriptions (user_id, stripe_status) VALUES ('user-1', 'active');
      INSERT INTO session (id, expires_at, token, created_at, updated_at, user_id)
      VALUES ('sess-1', '2099-01-01T00:00:00.000Z', 'token-1', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'user-1');
      INSERT INTO account (id, issuer, account_id, provider_id, user_id, created_at, updated_at)
      VALUES ('acct-1', 'https://accounts.google.com', 'google-1', 'google', 'user-1', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    `);
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.deleteObject.mockImplementation(async (key: string) => {
      log.push(`r2:${key}`);
    });
    mocks.getCloudflareContext.mockResolvedValue(env(createD1(sqlite, log)));
  });

  it("returns 401 without deleting when there is no session", async () => {
    mocks.getSession.mockResolvedValue(null);
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/account/delete", { method: "POST" }),
    );
    const users = sqlite.prepare("SELECT COUNT(*) AS count FROM users").get() as {
      count: number;
    };

    expect(response.status).toBe(401);
    expect(mocks.deleteObject).not.toHaveBeenCalled();
    expect(users.count).toBe(1);
  });

  it("deletes R2 then SQL and redirects home", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/account/delete", { method: "POST" }),
    );
    const users = sqlite.prepare("SELECT COUNT(*) AS count FROM users").get() as {
      count: number;
    };

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/");
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
    expect(users.count).toBe(0);
  });
});
