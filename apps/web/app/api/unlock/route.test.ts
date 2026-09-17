import { createRequire } from "node:module";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isoWeekId } from "../../../lib/unlocks/week";

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  getSession: vi.fn(),
  first: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("../../../lib/auth/index", () => ({
  createAuth: () => ({
    api: {
      getSession: mocks.getSession,
    },
  }),
}));

const applyUrl = "https://studio.example/careers/secret-apply";

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

function authEnv(DB: unknown) {
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

function unlockRequest(jobId = "job-1") {
  return new Request("http://localhost/api/unlock", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      jobId,
      next: "/jobs/gameplay-engineer",
    }),
  });
}

describe("POST /api/unlock onboarding gate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.first.mockResolvedValue(null);
    mocks.getCloudflareContext.mockResolvedValue({
      env: {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              first: mocks.first,
            })),
          })),
        },
        BETTER_AUTH_SECRET: "auth-secret",
        GOOGLE_CLIENT_ID: "google-client-id",
        GOOGLE_CLIENT_SECRET: "google-client-secret",
        EMAIL_FROM: "noreply@example.com",
        EMAIL: { send: vi.fn() },
      },
    });
  });

  it("redirects to login without leaking apply_url when there is no session", async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.first.mockResolvedValue({ apply_url: applyUrl });

    const { POST } = await import("./route");
    const response = await POST(unlockRequest());
    const location = response.headers.get("location");
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(location).toBeNull();
    expect(body).toEqual({ redirect: "/login" });
    expect(JSON.stringify(body)).not.toContain(applyUrl);
  });

  it("redirects to /onboarding?next= when the session user needs onboarding", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.first.mockResolvedValue({
      display_name: null,
      target_role: null,
      remote_pref: null,
      apply_url: applyUrl,
    });

    const { POST } = await import("./route");
    const response = await POST(unlockRequest());
    const location = response.headers.get("location");
    const body = await response.json() as { redirect: string };
    const redirected = new URL(body.redirect, "http://localhost");

    expect(response.status).toBe(403);
    expect(location).toBeNull();
    expect(redirected.pathname).toBe("/onboarding");
    expect(redirected.searchParams.get("next")).toBe("/jobs/gameplay-engineer");
    expect(JSON.stringify(body)).not.toContain(applyUrl);
    expect(body).not.toHaveProperty("applyUrl");
  });
});

describe("POST /api/unlock quota", () => {
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
      INSERT INTO profiles (user_id, display_name, target_role, remote_pref)
      VALUES ('user-1', 'Ada', 'Gameplay Programmer', 'remote');
    `);
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getCloudflareContext.mockResolvedValue(authEnv(createD1(sqlite)));
  });

  function insertJob(id: string) {
    sqlite
      .prepare("INSERT INTO jobs (id, apply_url, listed) VALUES (?, ?, 1)")
      .run(id, applyUrl);
  }

  function insertUnlock(jobId: string, weekId = isoWeekId(new Date())) {
    sqlite
      .prepare(
        "INSERT INTO unlocks (id, user_id, job_id, week_id, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(`${jobId}-${weekId}`, "user-1", jobId, weekId, "2026-09-01T00:00:00.000Z");
  }

  it("returns applyUrl JSON for an onboarded free unlock and does not 303 to the studio", async () => {
    insertJob("job-1");

    const { POST } = await import("./route");
    const response = await POST(unlockRequest("job-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(body).toEqual({ applyUrl, completeness: 20 });
    expect(body).not.toHaveProperty("apply_url");
  });

  it("includes live completeness on unlock JSON and still omits applyUrl from quota", async () => {
    insertJob("job-1");
    sqlite
      .prepare("UPDATE profiles SET location = ? WHERE user_id = ?")
      .run("Berlin", "user-1");
    sqlite
      .prepare(
        "INSERT INTO experience_entries (id, user_id, company, title) VALUES (?, ?, ?, ?)",
      )
      .run("exp-1", "user-1", "Moonshot", "Gameplay Engineer");
    sqlite
      .prepare("INSERT INTO profile_skills (user_id, skill) VALUES (?, ?)")
      .run("user-1", "unity");
    sqlite
      .prepare("INSERT INTO profile_skills (user_id, skill) VALUES (?, ?)")
      .run("user-1", "unreal");
    sqlite
      .prepare("INSERT INTO profile_skills (user_id, skill) VALUES (?, ?)")
      .run("user-1", "godot");

    const { POST } = await import("./route");
    const response = await POST(unlockRequest("job-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ applyUrl, completeness: 80 });
    expect(JSON.stringify(body)).not.toContain("apply_url");
  });

  it("returns 402 quota with no applyUrl on the 6th distinct job", async () => {
    for (const id of ["job-1", "job-2", "job-3", "job-4", "job-5", "job-6"]) {
      insertJob(id);
    }
    for (const id of ["job-1", "job-2", "job-3", "job-4", "job-5"]) {
      insertUnlock(id);
    }

    const { POST } = await import("./route");
    const response = await POST(unlockRequest("job-6"));
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(response.headers.get("location")).toBeNull();
    expect(body).toEqual({ code: "quota" });
    expect(JSON.stringify(body)).not.toContain(applyUrl);
  });
});
