import { describe, expect, it, vi } from "vitest";

import { applicantsSentence, applicationVolume } from "./queries";

function fakeDb(row: { applications: number | null; jobsWithApplications: number | null } | null) {
  const captured: { sql?: string; bindings?: unknown[] } = {};
  const db = {
    prepare: vi.fn((sql: string) => {
      captured.sql = sql;
      return {
        bind: vi.fn((...bindings: unknown[]) => {
          captured.bindings = bindings;
          return { first: vi.fn(async () => row) };
        }),
      };
    }),
  };
  return { db, captured };
}

describe("applicationVolume", () => {
  it("matches a role page's tag-or-title job set", async () => {
    const { db, captured } = fakeDb({ applications: 4, jobsWithApplications: 2 });

    const volume = await applicationVolume(db as never, "tenant-gaming", {
      tag: "solidity",
      orTitle: true,
    });

    expect(volume).toEqual({ applications: 4, jobsWithApplications: 2 });
    expect(captured.sql).toContain("FROM job_applications a");
    expect(captured.sql).toContain("LOWER(j.title) LIKE LOWER(?)");
    expect(captured.bindings).toEqual(["tenant-gaming", "tenant-gaming", "solidity", "%solidity%"]);
  });

  it("scopes a geo page by location and a seniority page by title", async () => {
    const geo = fakeDb({ applications: 0, jobsWithApplications: 0 });
    await applicationVolume(geo.db as never, "t", { locationSlug: "germany" });
    expect(geo.captured.sql).toContain("job_locations jl");
    expect(geo.captured.bindings).toEqual(["t", "t", "germany"]);

    const seniority = fakeDb({ applications: 0, jobsWithApplications: 0 });
    await applicationVolume(seniority.db as never, "t", { titleLike: "senior" });
    expect(seniority.captured.sql).not.toContain("job_locations jl");
    expect(seniority.captured.bindings).toEqual(["t", "t", "%senior%"]);
  });

  it("escapes LIKE wildcards in the stem so a slug cannot widen the match", async () => {
    const { db, captured } = fakeDb(null);
    await applicationVolume(db as never, "t", { titleLike: "100%_off" });
    expect(captured.bindings).toEqual(["t", "t", "%100\\%\\_off%"]);
  });

  it("reads a missing row as zero rather than NaN", async () => {
    const { db } = fakeDb(null);
    expect(await applicationVolume(db as never, "t", {})).toEqual({
      applications: 0,
      jobsWithApplications: 0,
    });
  });
});

describe("applicantsSentence", () => {
  it("says nobody has applied instead of publishing an average of zero", () => {
    const sentence = applicantsSentence(
      { applications: 0, jobsWithApplications: 0 },
      "Solidity Developer jobs",
      12,
    );
    expect(sentence).toContain("No one has applied");
    expect(sentence).not.toMatch(/\b0 per\b/);
  });

  it("averages over every listed job, not only the ones with applications", () => {
    const sentence = applicantsSentence(
      { applications: 9, jobsWithApplications: 3 },
      "Rust Developer jobs",
      6,
    );
    expect(sentence).toContain("9 applications");
    expect(sentence).toContain("3 jobs");
    expect(sentence).toContain("1.5 per listed role");
  });

  it("rounds to a whole number once the average is large", () => {
    const sentence = applicantsSentence(
      { applications: 121, jobsWithApplications: 4 },
      "Design jobs",
      10,
    );
    expect(sentence).toContain("12 per listed role");
  });

  it("does not divide by zero when the slice has no listed jobs", () => {
    const sentence = applicantsSentence(
      { applications: 2, jobsWithApplications: 1 },
      "Legal jobs",
      0,
    );
    expect(sentence).toContain("2 per listed role");
  });
});
