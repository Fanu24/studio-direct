import { createRequire } from "node:module";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  getSession: vi.fn(),
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

function env(DB: unknown) {
  return {
    env: {
      DB,
      BETTER_AUTH_SECRET: "auth-secret",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      EMAIL_FROM: "noreply@example.com",
      EMAIL: { send: vi.fn() },
    },
  };
}

describe("GET /api/account/export", () => {
  let sqlite: MemoryDatabase;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
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
        target_role TEXT,
        location TEXT,
        remote_pref TEXT,
        completeness INTEGER NOT NULL DEFAULT 0,
        talent_pool_opt_in INTEGER NOT NULL DEFAULT 0,
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
      INSERT INTO users (id, tenant_id, name, email, created_at, updated_at)
      VALUES (
        'user-1', 'tenant-1', 'Ada', 'ada@example.com',
        '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
      );
      INSERT INTO profiles (user_id, display_name, cv_r2_key)
      VALUES ('user-1', 'Ada Lovelace', 'cv/user-1/current.pdf');
    `);
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getCloudflareContext.mockResolvedValue(env(createD1(sqlite)));
  });

  it("returns 401 without reading when there is no session", async () => {
    mocks.getSession.mockResolvedValue(null);
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/account/export"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ code: "unauthorized" });
  });

  it("returns this user's JSON without publicUrl or /talent", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/account/export"));
    const body = await response.json() as {
      user: { id: string; email: string };
      profile: { display_name: string };
    };
    const raw = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/application\/json/i);
    expect(body.user).toMatchObject({ id: "user-1", email: "ada@example.com" });
    expect(body.profile).toMatchObject({ display_name: "Ada Lovelace" });
    expect(raw).not.toMatch(/publicUrl/i);
    expect(raw).not.toMatch(/\/talent/i);
  });
});
