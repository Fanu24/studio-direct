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

function optInRequest(value?: string) {
  const form = new FormData();
  if (value !== undefined) form.set("talent_pool_opt_in", value);
  return new Request("http://localhost/api/account/talent-pool", {
    method: "POST",
      headers: {origin:"http://localhost"},
    body: form,
  });
}

describe("POST /api/account/talent-pool", () => {
  let sqlite: MemoryDatabase;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
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
      INSERT INTO profiles (user_id) VALUES ('user-1');
    `);
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getCloudflareContext.mockResolvedValue(env(createD1(sqlite)));
  });

  it("returns 401 without writing when there is no session", async () => {
    mocks.getSession.mockResolvedValue(null);
    const { POST } = await import("./route");
    const response = await POST(optInRequest("1"));
    const profile = sqlite
      .prepare("SELECT talent_pool_opt_in FROM profiles WHERE user_id = ?")
      .get("user-1") as { talent_pool_opt_in: number };
    const events = sqlite
      .prepare("SELECT COUNT(*) AS count FROM consent_events")
      .get() as { count: number };

    expect(response.status).toBe(401);
    expect(profile.talent_pool_opt_in).toBe(0);
    expect(events.count).toBe(0);
  });

  it("opts in, writes consent, and redirects back to settings", async () => {
    const { POST } = await import("./route");
    const response = await POST(optInRequest("1"));
    const profile = sqlite
      .prepare("SELECT talent_pool_opt_in FROM profiles WHERE user_id = ?")
      .get("user-1") as { talent_pool_opt_in: number };
    const event = sqlite
      .prepare("SELECT user_id, kind, value FROM consent_events")
      .get() as { user_id: string; kind: string; value: string };

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/settings");
    expect(profile.talent_pool_opt_in).toBe(1);
    expect(event).toEqual({
      user_id: "user-1",
      kind: "talent_pool",
      value: "1",
    });
  });

  it("treats an unchecked box as opt-out and writes consent on change", async () => {
    sqlite
      .prepare("UPDATE profiles SET talent_pool_opt_in = 1 WHERE user_id = ?")
      .run("user-1");

    const { POST } = await import("./route");
    const response = await POST(optInRequest());
    const profile = sqlite
      .prepare("SELECT talent_pool_opt_in FROM profiles WHERE user_id = ?")
      .get("user-1") as { talent_pool_opt_in: number };
    const event = sqlite
      .prepare("SELECT value FROM consent_events")
      .get() as { value: string };

    expect(response.status).toBe(303);
    expect(profile.talent_pool_opt_in).toBe(0);
    expect(event.value).toBe("0");
  });
});
