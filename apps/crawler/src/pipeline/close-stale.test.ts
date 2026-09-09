import { describe, expect, it } from "vitest";

import { MemoryJobsRepository } from "../../test/fakes/memory-jobs-repo";
import type { JobRecord } from "../repo/types";
import { closeStaleCareerJobs } from "./close-stale";

function job(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: "job-1",
    tenantId: "tenant-1",
    companyId: "company-1",
    canonicalKey: "https://careers.example/jobs/1",
    title: "Senior Gameplay Engineer",
    titleNorm: "senior-gameplay-engineer",
    slug: "senior-gameplay-engineer",
    location: "Remote",
    remote: "remote",
    descriptionHtml: "<p>Build gameplay systems.</p>",
    applyUrl: "https://careers.example/jobs/1",
    salaryText: null,
    salaryMin: null,
    salaryMax: null,
    source: "career_page",
    externalId: null,
    featuredUntil: null,
    highlight: 0,
    exclusivity: "unknown",
    seenOnIndeed: 0,
    postedAt: "2026-08-20T10:00:00.000Z",
    listed: 1,
    createdAt: "2026-08-20T10:00:00.000Z",
    updatedAt: "2026-08-20T10:00:00.000Z",
    ...overrides,
  };
}

describe("closeStaleCareerJobs", () => {
  it("closes a career job after three successful empty ATS board pulls", async () => {
    const repo = new MemoryJobsRepository();
    repo.jobs.push(job());
    repo.sightings.push({
      id: "sighting-1",
      jobId: "job-1",
      source: "career_page",
      sourceUrl: "https://careers.example/jobs/1",
      seenAt: "2026-09-01T09:00:00.000Z",
    });

    const result = await closeStaleCareerJobs({
      repo,
      companyId: "company-1",
      seenJobIds: [],
      crawlRuns: [
        {
          source: "career_page",
          startedAt: "2026-09-02T09:00:00.000Z",
          finishedAt: "2026-09-02T09:00:00.000Z",
          ok: 1,
        },
        {
          source: "career_page",
          startedAt: "2026-09-02T10:00:00.000Z",
          finishedAt: "2026-09-02T10:00:00.000Z",
          ok: 1,
        },
        {
          source: "career_page",
          startedAt: "2026-09-02T11:00:00.000Z",
          finishedAt: "2026-09-02T11:00:00.000Z",
          ok: 1,
        },
      ],
      now: new Date("2026-09-02T11:00:00.000Z"),
    });

    expect(result).toEqual({ closed: 1, jobIds: ["job-1"] });
    expect(repo.jobs[0]).toMatchObject({
      listed: 0,
      updatedAt: "2026-09-02T11:00:00.000Z",
    });
  });

  it("does not count failed or non-career crawl runs as misses", async () => {
    const repo = new MemoryJobsRepository();
    repo.jobs.push(job());
    repo.sightings.push({
      id: "sighting-1",
      jobId: "job-1",
      source: "career_page",
      sourceUrl: "https://careers.example/jobs/1",
      seenAt: "2026-09-01T09:00:00.000Z",
    });

    const result = await closeStaleCareerJobs({
      repo,
      companyId: "company-1",
      seenJobIds: [],
      crawlRuns: [
        {
          source: "career_page",
          startedAt: "2026-09-02T09:00:00.000Z",
          finishedAt: "2026-09-02T09:00:00.000Z",
          ok: 1,
        },
        {
          source: "career_page",
          startedAt: "2026-09-02T10:00:00.000Z",
          finishedAt: "2026-09-02T10:00:00.000Z",
          ok: 0,
        },
        {
          source: "linkedin",
          startedAt: "2026-09-02T11:00:00.000Z",
          finishedAt: "2026-09-02T11:00:00.000Z",
          ok: 1,
        },
      ],
    });

    expect(result).toEqual({ closed: 0, jobIds: [] });
    expect(repo.jobs[0]?.listed).toBe(1);
  });

  it("closes a job immediately when its ATS marks it closed", async () => {
    const repo = new MemoryJobsRepository();
    repo.jobs.push(job());
    repo.sightings.push({
      id: "sighting-1",
      jobId: "job-1",
      source: "career_page",
      sourceUrl: "https://careers.example/jobs/1",
      seenAt: "2026-09-02T09:00:00.000Z",
    });

    const result = await closeStaleCareerJobs({
      repo,
      companyId: "company-1",
      seenJobIds: [],
      atsClosedJobIds: ["job-1"],
      crawlRuns: [],
      now: new Date("2026-09-02T10:00:00.000Z"),
    });

    expect(result).toEqual({ closed: 1, jobIds: ["job-1"] });
    expect(repo.jobs[0]?.listed).toBe(0);
  });

  it("closes a career job immediately when its apply URL returns 404", async () => {
    const repo = new MemoryJobsRepository();
    repo.jobs.push(job());
    repo.sightings.push({
      id: "sighting-1",
      jobId: "job-1",
      source: "career_page",
      sourceUrl: "https://careers.example/jobs/1",
      seenAt: "2026-09-02T09:00:00.000Z",
    });

    const result = await closeStaleCareerJobs({
      repo,
      companyId: "company-1",
      seenJobIds: [],
      notFoundJobIds: ["job-1"],
      crawlRuns: [],
    });

    expect(result).toEqual({ closed: 1, jobIds: ["job-1"] });
    expect(repo.jobs[0]?.listed).toBe(0);
  });

  it("keeps a job seen during the third-newest successful crawl", async () => {
    const repo = new MemoryJobsRepository();
    repo.jobs.push(job());
    repo.sightings.push({
      id: "sighting-1",
      jobId: "job-1",
      source: "career_page",
      sourceUrl: "https://careers.example/jobs/1",
      seenAt: "2026-09-02T09:00:30.000Z",
    });

    const result = await closeStaleCareerJobs({
      repo,
      companyId: "company-1",
      seenJobIds: [],
      crawlRuns: [
        {
          source: "career_page",
          startedAt: "2026-09-02T09:00:00.000Z",
          finishedAt: "2026-09-02T09:01:00.000Z",
          ok: 1,
        },
        {
          source: "career_page",
          startedAt: "2026-09-02T10:00:00.000Z",
          finishedAt: "2026-09-02T10:01:00.000Z",
          ok: 1,
        },
        {
          source: "career_page",
          startedAt: "2026-09-02T11:00:00.000Z",
          finishedAt: "2026-09-02T11:01:00.000Z",
          ok: 1,
        },
      ],
    });

    expect(result).toEqual({ closed: 0, jobIds: [] });
    expect(repo.jobs[0]?.listed).toBe(1);
  });
});
