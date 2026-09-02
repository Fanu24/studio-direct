import type { JobDraft } from "@gaming/shared";
import { describe, expect, it } from "vitest";

import { MemoryJobsRepository } from "../../test/fakes/memory-jobs-repo";
import { ingestDrafts } from "./ingest";

const now = new Date("2026-09-02T12:00:00.000Z");

function draft(
  source: JobDraft["source"],
  overrides: Partial<JobDraft> = {},
): JobDraft {
  return {
    source,
    sourceUrl: `https://${source}.example/jobs/42`,
    companyName: "Moonshot Games Studio",
    title: "Senior Gameplay Engineer",
    location: "Remote",
    remote: "unknown",
    descriptionHtml: "<p>Build online gameplay systems.</p>",
    applyUrl: "https://jobs.moonshot.example/roles/42?utm_source=board",
    postedAt: "2026-08-20T10:00:00.000Z",
    rawJson: "{}",
    ...overrides,
  };
}

function context(repo: MemoryJobsRepository) {
  return {
    repo,
    tenantId: "tenant-1",
    companyId: "company-1",
    allowlistedCompany: true,
    now,
  };
}

describe("ingestDrafts", () => {
  it("deduplicates three sources, records sightings, and prefers career apply_url", async () => {
    const repo = new MemoryJobsRepository();
    const applyUrl = "https://jobs.moonshot.example/roles/42";

    const result = await ingestDrafts(
      [
        draft("linkedin"),
        draft("career_page", {
          sourceUrl: applyUrl,
          applyUrl: `${applyUrl}?utm_campaign=careers`,
        }),
        draft("indeed"),
      ],
      context(repo),
    );

    expect(result).toEqual({
      upserted: 3,
      jobIds: [expect.any(String)],
      droppedStaffing: 0,
    });
    expect(repo.jobs).toHaveLength(1);
    expect(repo.sightings.map(({ source }) => source)).toEqual([
      "linkedin",
      "career_page",
      "indeed",
    ]);
    expect(new Set(repo.sightings.map(({ jobId }) => jobId)).size).toBe(1);
    expect(repo.jobs[0]).toMatchObject({
      canonicalKey: applyUrl,
      applyUrl,
      remote: "remote",
      listed: 1,
      exclusivity: "unknown",
      seenOnIndeed: 1,
    });
  });

  it("keeps a career apply URL when a board sighting arrives later", async () => {
    const repo = new MemoryJobsRepository();
    const ctx = context(repo);
    const applyUrl = "https://jobs.moonshot.example/roles/42";

    await ingestDrafts(
      [draft("career_page", { applyUrl, sourceUrl: applyUrl })],
      ctx,
    );
    await ingestDrafts(
      [draft("linkedin", { applyUrl, sourceUrl: "https://linkedin.example/42" })],
      ctx,
    );

    expect(repo.jobs[0]?.applyUrl).toBe(applyUrl);
    expect(repo.sightings).toHaveLength(2);
  });

  it("stores onsite drafts as unlisted", async () => {
    const repo = new MemoryJobsRepository();

    await ingestDrafts(
      [
        draft("career_page", {
          title: "Office IT Engineer",
          location: "London, UK (5 days in office)",
        }),
      ],
      context(repo),
    );

    expect(repo.jobs[0]).toMatchObject({ remote: "onsite", listed: 0 });
  });

  it("drops staffing drafts before writing", async () => {
    const repo = new MemoryJobsRepository();

    const result = await ingestDrafts(
      [
        draft("indeed", {
          companyName: "Game Talent Agency",
          title: "Gameplay Engineer",
        }),
      ],
      { ...context(repo), allowlistedCompany: false },
    );

    expect(result).toEqual({ upserted: 0, jobIds: [], droppedStaffing: 1 });
    expect(repo.jobs).toHaveLength(0);
    expect(repo.sightings).toHaveLength(0);
  });

  it("gives two companies with the same title different public slugs", async () => {
    const repo = new MemoryJobsRepository();
    const title = "Senior Software Engineer";

    await ingestDrafts(
      [
        draft("career_page", {
          companyName: "Moonshot Games Studio",
          title,
          applyUrl: "https://jobs.moonshot.example/roles/sse",
          sourceUrl: "https://jobs.moonshot.example/roles/sse",
        }),
      ],
      context(repo),
    );
    await ingestDrafts(
      [
        draft("career_page", {
          companyName: "Pixel Forge Studio",
          title,
          applyUrl: "https://jobs.pixelforge.example/roles/sse",
          sourceUrl: "https://jobs.pixelforge.example/roles/sse",
        }),
      ],
      { ...context(repo), companyId: "company-2" },
    );

    expect(repo.jobs).toHaveLength(2);
    expect(repo.jobs[0]?.slug).not.toBe(repo.jobs[1]?.slug);
    expect(repo.jobs.map((job) => job.slug).sort()).toEqual([
      "moonshot-senior-software-engineer",
      "pixelforge-senior-software-engineer",
    ]);
    expect(new Set(repo.jobs.map((job) => job.canonicalKey)).size).toBe(2);
  });

  it("uses the recent company-title fallback when apply_url is absent", async () => {
    const repo = new MemoryJobsRepository();

    await ingestDrafts(
      [
        draft("linkedin", { applyUrl: "", sourceUrl: "https://linkedin.example/a" }),
        draft("indeed", { applyUrl: "", sourceUrl: "https://indeed.example/b" }),
      ],
      context(repo),
    );

    expect(repo.jobs).toHaveLength(1);
    expect(repo.jobs[0]?.canonicalKey).toBe(
      "moonshot:senior-gameplay-engineer",
    );
    expect(repo.sightings).toHaveLength(2);
  });
});
