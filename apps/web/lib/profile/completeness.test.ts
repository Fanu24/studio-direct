import { createRequire } from "node:module";
import { beforeEach, describe, expect, it } from "vitest";

import { JOB_TAGS } from "@gaming/shared";

import {
  addExperienceEntry,
  loadProfileCompleteness,
  saveProfileSkills,
  saveWorkPreferences,
  scoreCompleteness,
  shouldShowCompletenessNudge,
} from "./completeness";

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

describe("scoreCompleteness", () => {
  it("is 0 for an empty profile", () => {
    expect(
      scoreCompleteness({
        displayName: null,
        targetRole: null,
        location: null,
        remotePref: null,
        experienceCount: 0,
        skillCount: 0,
        cvUploaded: false,
      }),
    ).toBe(0);
  });

  it("awards 20 only when both display_name and target_role are filled", () => {
    expect(
      scoreCompleteness({
        displayName: "Ada",
        targetRole: null,
        location: null,
        remotePref: null,
        experienceCount: 0,
        skillCount: 0,
      }),
    ).toBe(0);
    expect(
      scoreCompleteness({
        displayName: "Ada",
        targetRole: "  ",
        location: null,
        remotePref: null,
        experienceCount: 0,
        skillCount: 0,
      }),
    ).toBe(0);
    expect(
      scoreCompleteness({
        displayName: "Ada",
        targetRole: "Gameplay Programmer",
        location: null,
        remotePref: null,
        experienceCount: 0,
        skillCount: 0,
      }),
    ).toBe(20);
  });

  it("awards 20 for location and remote preference together", () => {
    const nameAndRole = {
      displayName: "Ada",
      targetRole: "Gameplay Programmer",
      experienceCount: 0,
      skillCount: 0,
    };

    expect(
      scoreCompleteness({
        ...nameAndRole,
        location: null,
        remotePref: "remote",
      }),
    ).toBe(20);
    expect(
      scoreCompleteness({
        ...nameAndRole,
        location: "Berlin",
        remotePref: null,
      }),
    ).toBe(20);
    expect(
      scoreCompleteness({
        ...nameAndRole,
        location: "Berlin",
        remotePref: "remote",
      }),
    ).toBe(40);
  });

  it("awards 20 for at least one experience row", () => {
    expect(
      scoreCompleteness({
        displayName: "Ada",
        targetRole: "Gameplay Programmer",
        location: "Berlin",
        remotePref: "remote",
        experienceCount: 1,
        skillCount: 0,
      }),
    ).toBe(60);
    expect(
      scoreCompleteness({
        displayName: "Ada",
        targetRole: "Gameplay Programmer",
        location: "Berlin",
        remotePref: "remote",
        experienceCount: 2,
        skillCount: 0,
      }),
    ).toBe(60);
  });

  it("awards 20 for at least three skills", () => {
    expect(
      scoreCompleteness({
        displayName: "Ada",
        targetRole: "Gameplay Programmer",
        location: "Berlin",
        remotePref: "remote",
        experienceCount: 1,
        skillCount: 2,
      }),
    ).toBe(60);
    expect(
      scoreCompleteness({
        displayName: "Ada",
        targetRole: "Gameplay Programmer",
        location: "Berlin",
        remotePref: "remote",
        experienceCount: 1,
        skillCount: 3,
      }),
    ).toBe(80);
  });

  it("awards 20 when a CV is uploaded", () => {
    const filled = {
      displayName: "Ada",
      targetRole: "Gameplay Programmer",
      location: "Berlin",
      remotePref: "remote",
      experienceCount: 1,
      skillCount: 3,
    };

    expect(scoreCompleteness({ ...filled, cvUploaded: false })).toBe(80);
    expect(scoreCompleteness({ ...filled, cvUploaded: true })).toBe(100);
  });
});

describe("shouldShowCompletenessNudge", () => {
  it("is true below 80 and false at 80", () => {
    expect(shouldShowCompletenessNudge(0)).toBe(true);
    expect(shouldShowCompletenessNudge(60)).toBe(true);
    expect(shouldShowCompletenessNudge(79)).toBe(true);
    expect(shouldShowCompletenessNudge(80)).toBe(false);
  });
});

describe("loadProfileCompleteness", () => {
  let sqlite: MemoryDatabase;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE profiles (
        product_profile_completed INTEGER NOT NULL DEFAULT 0,
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
    `);
  });

  it("scores 0 when the profile has no name, role, location, experience, or skills", async () => {
    sqlite
      .prepare(
        "INSERT INTO profiles (user_id, display_name, target_role, location, remote_pref, cv_r2_key) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run("user-1", null, null, null, null, null);

    await expect(loadProfileCompleteness(createD1(sqlite), "user-1")).resolves.toBe(0);
  });

  it("scores live rows including a stored CV key as the fifth bucket", async () => {
    sqlite
      .prepare(
        "INSERT INTO profiles (user_id, display_name, target_role, location, remote_pref, cv_r2_key) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        "user-1",
        "Ada",
        "Gameplay Programmer",
        "Berlin",
        "remote",
        "cv/user-1/fake.pdf",
      );
    sqlite
      .prepare(
        "INSERT INTO experience_entries (id, user_id, company, title) VALUES (?, ?, ?, ?)",
      )
      .run("exp-1", "user-1", "Moonshot", "Gameplay Engineer");
    sqlite
      .prepare("INSERT INTO profile_skills (user_id, skill) VALUES (?, ?)")
      .run("user-1", "solidity");
    sqlite
      .prepare("INSERT INTO profile_skills (user_id, skill) VALUES (?, ?)")
      .run("user-1", "rust");
    sqlite
      .prepare("INSERT INTO profile_skills (user_id, skill) VALUES (?, ?)")
      .run("user-1", "blockchain");

    await expect(loadProfileCompleteness(createD1(sqlite), "user-1")).resolves.toBe(100);
  });
});

describe("profile experience and skills", () => {
  let sqlite: MemoryDatabase;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY);
      INSERT INTO users (id) VALUES ('user-1');
      CREATE TABLE profiles (
        product_profile_completed INTEGER NOT NULL DEFAULT 0,
        user_id TEXT PRIMARY KEY,
        display_name TEXT,
        target_role TEXT,
        location TEXT,
        remote_pref TEXT,
        completeness INTEGER NOT NULL DEFAULT 0,
        talent_pool_opt_in INTEGER NOT NULL DEFAULT 0,
        cv_r2_key TEXT
      );
      INSERT INTO profiles (user_id, display_name, target_role, remote_pref)
      VALUES ('user-1', 'Ada', 'Gameplay Programmer', 'remote');
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
    `);
  });

  it("adds an experience row and refreshes stored completeness", async () => {
    const db = createD1(sqlite);
    await addExperienceEntry(db, "user-1", {
      company: "Moonshot",
      title: "Gameplay Engineer",
      startDate: "2022-01",
      endDate: "2024-06",
      description: "Shipped combat.",
    });

    const row = sqlite
      .prepare("SELECT company, title FROM experience_entries WHERE user_id = ?")
      .get("user-1") as { company: string; title: string };
    const stored = sqlite
      .prepare("SELECT completeness, talent_pool_opt_in FROM profiles WHERE user_id = ?")
      .get("user-1") as { completeness: number; talent_pool_opt_in: number };

    expect(row).toEqual({ company: "Moonshot", title: "Gameplay Engineer" });
    expect(stored.completeness).toBe(40);
    expect(stored.talent_pool_opt_in).toBe(0);
    await expect(loadProfileCompleteness(db, "user-1")).resolves.toBe(40);
  });

  it("stores only recognized Web3 skill slugs and scores 20 at three skills", async () => {
    const db = createD1(sqlite);
    await saveProfileSkills(db, "user-1", [
      "solidity",
      "rust",
      "not-a-hub",
      "blockchain",
    ]);

    const skills = sqlite
      .prepare("SELECT skill FROM profile_skills WHERE user_id = ? ORDER BY skill")
      .all("user-1") as { skill: string }[];
    const stored = sqlite
      .prepare("SELECT completeness FROM profiles WHERE user_id = ?")
      .get("user-1") as { completeness: number };

    expect(skills.map((row) => row.skill)).toEqual(["blockchain", "rust", "solidity"]);
    expect(JOB_TAGS).toEqual(expect.arrayContaining(["blockchain", "rust", "solidity"]));
    expect(stored.completeness).toBe(40);
  });

  it("saves location and remote preference without a talent-pool opt-in", async () => {
    const db = createD1(sqlite);
    await saveWorkPreferences(db, "user-1", {
      location: "Berlin",
      remotePref: "hybrid",
    });

    const row = sqlite
      .prepare(
        "SELECT location, remote_pref, completeness, talent_pool_opt_in FROM profiles WHERE user_id = ?",
      )
      .get("user-1") as {
        location: string;
        remote_pref: string;
        completeness: number;
        talent_pool_opt_in: number;
      };

    expect(row.location).toBe("Berlin");
    expect(row.remote_pref).toBe("hybrid");
    expect(row.completeness).toBe(40);
    expect(row.talent_pool_opt_in).toBe(0);
  });
});
