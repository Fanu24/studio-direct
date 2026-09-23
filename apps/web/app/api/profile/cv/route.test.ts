import { createRequire } from "node:module";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  getSession: vi.fn(),
  put: vi.fn(),
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
      FILES: { put: mocks.put },
      BETTER_AUTH_SECRET: "auth-secret",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      EMAIL_FROM: "noreply@example.com",
      EMAIL: { send: vi.fn() },
    },
  };
}

function cvRequest(file: File | null) {
  const form = new FormData();
  if (file) form.set("cv", file);
  return new Request("http://localhost/api/profile/cv", {
    method: "POST", headers:{origin:"http://localhost"},
    body: form,
  });
}

describe("POST /api/profile/cv", () => {
  let sqlite: MemoryDatabase;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
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
        title TEXT NOT NULL
      );
      CREATE TABLE profile_skills (
        user_id TEXT NOT NULL,
        skill TEXT NOT NULL,
        PRIMARY KEY (user_id, skill)
      );
      INSERT INTO profiles (user_id, display_name, target_role)
      VALUES ('user-1', 'Ada', 'Gameplay Programmer');
    `);
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getCloudflareContext.mockResolvedValue(env(createD1(sqlite)));
    mocks.put.mockResolvedValue({ key: "ok" });
  });

  it("returns 401 without writing when there is no session", async () => {
    mocks.getSession.mockResolvedValue(null);
    const { POST } = await import("./route");
    const response = await POST(
      cvRequest(new File([new Uint8Array(8)], "cv.pdf", { type: "application/pdf" })),
    );

    expect(response.status).toBe(401);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("returns 400 and does not put a non-PDF", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      cvRequest(new File([new Uint8Array(8)], "cv.txt", { type: "text/plain" })),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ code: "invalid_type" });
    expect(mocks.put).not.toHaveBeenCalled();
  });
});
