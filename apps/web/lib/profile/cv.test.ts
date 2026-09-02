import { createRequire } from "node:module";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadProfileCompleteness } from "./completeness";
import { MAX_CV_BYTES, uploadCv } from "./cv";

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

function pdfFile(size: number, type = "application/pdf", name = "cv.pdf") {
  return new File([new Uint8Array(size)], name, { type });
}

function createBucket() {
  return {
    put: vi.fn(async () => ({ key: "ok" })),
  };
}

describe("uploadCv", () => {
  let sqlite: MemoryDatabase;

  beforeEach(() => {
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
      INSERT INTO profiles (user_id, display_name, target_role, location, remote_pref)
      VALUES ('user-1', 'Ada', 'Gameplay Programmer', 'Berlin', 'remote');
    `);
  });

  it("returns 400 and does not put a non-PDF", async () => {
    const bucket = createBucket();
    const result = await uploadCv({
      userId: "user-1",
      file: pdfFile(128, "text/plain", "cv.txt"),
      bucket,
      db: createD1(sqlite),
    });
    const stored = sqlite
      .prepare("SELECT cv_r2_key FROM profiles WHERE user_id = ?")
      .get("user-1") as { cv_r2_key: string | null };

    expect(result).toEqual({ status: 400, code: "invalid_type" });
    expect(bucket.put).not.toHaveBeenCalled();
    expect(stored.cv_r2_key).toBeNull();
  });

  it("returns 400 and does not put when the PDF is larger than 5 MB", async () => {
    const bucket = createBucket();
    const result = await uploadCv({
      userId: "user-1",
      file: pdfFile(MAX_CV_BYTES + 1),
      bucket,
      db: createD1(sqlite),
    });
    const stored = sqlite
      .prepare("SELECT cv_r2_key FROM profiles WHERE user_id = ?")
      .get("user-1") as { cv_r2_key: string | null };

    expect(result).toEqual({ status: 400, code: "too_large" });
    expect(bucket.put).not.toHaveBeenCalled();
    expect(stored.cv_r2_key).toBeNull();
  });

  it("writes a PDF of at most 5 MB to cv/{userId}/{uuid}.pdf and scores +20", async () => {
    const bucket = createBucket();
    const objectId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    vi.spyOn(crypto, "randomUUID").mockReturnValue(objectId);

    const result = await uploadCv({
      userId: "user-1",
      file: pdfFile(MAX_CV_BYTES),
      bucket,
      db: createD1(sqlite),
    });
    const stored = sqlite
      .prepare("SELECT cv_r2_key, completeness, talent_pool_opt_in FROM profiles WHERE user_id = ?")
      .get("user-1") as {
        cv_r2_key: string;
        completeness: number;
        talent_pool_opt_in: number;
      };
    const key = `cv/user-1/${objectId}.pdf`;

    expect(result).toEqual({ status: 200, key, completeness: 60 });
    expect(bucket.put).toHaveBeenCalledTimes(1);
    expect(bucket.put).toHaveBeenCalledWith(
      key,
      expect.any(ArrayBuffer),
      { httpMetadata: { contentType: "application/pdf" } },
    );
    expect(stored.cv_r2_key).toBe(key);
    expect(stored.completeness).toBe(60);
    expect(stored.talent_pool_opt_in).toBe(0);
    await expect(loadProfileCompleteness(createD1(sqlite), "user-1")).resolves.toBe(60);
  });
});
