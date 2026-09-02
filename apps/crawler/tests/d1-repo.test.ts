import {
  applyD1Migrations,
  env,
  type D1Migration,
} from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

import { D1JobsRepository } from "../src/repo/d1";
import type { JobRecord } from "../src/repo/types";

declare module "cloudflare:test" {
  interface ProvidedEnv {
    TEST_MIGRATIONS: D1Migration[];
  }
}

const tenantId = "tenant:d1-repo";
const companyId = "company:d1-repo";
const otherCompanyId = "company:d1-repo-other";

describe("D1JobsRepository", () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    await env.DB.prepare(
      "INSERT INTO tenants (id, slug, name) VALUES (?, ?, ?)",
    )
      .bind(tenantId, "d1-repo", "D1 Repository Tests")
      .run();

    const insertCompany = env.DB.prepare(
      `INSERT INTO companies
        (id, tenant_id, name, name_norm, career_url, ats_type, ats_slug, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    await env.DB.batch([
      insertCompany.bind(
        companyId,
        tenantId,
        "Pixel Forge",
        "pixel forge",
        "https://pixel-forge.example/careers",
        "greenhouse",
        "pixel-forge",
        "2026-09-02T00:00:00.000Z",
      ),
      insertCompany.bind(
        otherCompanyId,
        tenantId,
        "Other Studio",
        "other studio",
        "https://other.example/careers",
        null,
        null,
        "2026-09-02T00:00:00.000Z",
      ),
    ]);
  });

  it("loads a listed company", async () => {
    const repo = new D1JobsRepository(env.DB);

    await expect(repo.getById(companyId)).resolves.toEqual({
      id: companyId,
      tenantId,
      name: "Pixel Forge",
      ats_type: "greenhouse",
      ats_slug: "pixel-forge",
      career_url: "https://pixel-forge.example/careers",
    });
  });

  it("executes job upsert and sighting SQL", async () => {
    const repo = new D1JobsRepository(env.DB);
    const job: JobRecord = {
      id: "job:d1-repo",
      tenantId,
      companyId,
      canonicalKey: "https://pixel-forge.example/jobs/engineer",
      title: "Gameplay Engineer",
      titleNorm: "gameplay engineer",
      slug: "gameplay-engineer",
      location: "Remote",
      remote: "remote",
      descriptionHtml: "<p>Build gameplay systems.</p>",
      applyUrl: "https://pixel-forge.example/jobs/engineer",
      salaryText: null,
      exclusivity: "unknown",
      seenOnIndeed: 0,
      postedAt: "2026-09-01T00:00:00.000Z",
      listed: 1,
      createdAt: "2026-09-02T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
    };

    await expect(repo.upsertJob(job)).resolves.toEqual(job);
    await repo.insertSighting({
      id: "sighting:d1-repo",
      jobId: job.id,
      source: "career_page",
      sourceUrl: job.applyUrl,
      seenAt: "2026-09-02T00:00:00.000Z",
    });

    await expect(
      repo.findJobByCanonicalKey(tenantId, job.canonicalKey),
    ).resolves.toEqual(job);
    await expect(repo.hasSighting(job.id, "career_page")).resolves.toBe(true);

    const updated = await repo.upsertJob({
      ...job,
      title: "Senior Gameplay Engineer",
      titleNorm: "senior gameplay engineer",
      updatedAt: "2026-09-02T01:00:00.000Z",
    });
    expect(updated).toMatchObject({
      id: job.id,
      title: "Senior Gameplay Engineer",
      updatedAt: "2026-09-02T01:00:00.000Z",
    });
  });

  it("reads LinkedIn fetched stats for non-empty and empty successes", async () => {
    const repo = new D1JobsRepository(env.DB);
    const insertRun = env.DB.prepare(
      `INSERT INTO crawl_runs
        (id, source, started_at, finished_at, ok, stats_json)
       VALUES (?, 'linkedin', ?, ?, 1, ?)`,
    );

    await insertRun
      .bind(
        "run:linkedin-empty",
        "2026-09-02T01:00:00.000Z",
        "2026-09-02T01:01:00.000Z",
        '{"fetched":0}',
      )
      .run();
    await expect(repo.getLatestLinkedinRun()).resolves.toEqual({
      ok: true,
      finishedAtIso: "2026-09-02T01:01:00.000Z",
      parseableDrafts: 0,
    });

    await insertRun
      .bind(
        "run:linkedin-non-empty",
        "2026-09-02T02:00:00.000Z",
        "2026-09-02T02:01:00.000Z",
        '{"fetched":4}',
      )
      .run();
    await expect(repo.getLatestLinkedinRun()).resolves.toEqual({
      ok: true,
      finishedAtIso: "2026-09-02T02:01:00.000Z",
      parseableDrafts: 4,
    });

    await insertRun
      .bind(
        "run:linkedin-preferred",
        "2026-09-02T03:00:00.000Z",
        "2026-09-02T03:01:00.000Z",
        '{"parseableDrafts":2,"fetched":9}',
      )
      .run();
    await expect(repo.getLatestLinkedinRun()).resolves.toMatchObject({
      parseableDrafts: 2,
    });
  });

  it("returns only successful career runs for the requested company", async () => {
    const repo = new D1JobsRepository(env.DB);
    const insertRun = env.DB.prepare(
      `INSERT INTO crawl_runs
        (id, source, started_at, finished_at, ok, stats_json)
       VALUES (?, 'career_page', ?, ?, ?, ?)`,
    );
    await env.DB.batch([
      insertRun.bind(
        "run:career-target",
        "2026-09-02T04:00:00.000Z",
        "2026-09-02T04:01:00.000Z",
        1,
        JSON.stringify({ companyId }),
      ),
      insertRun.bind(
        "run:career-other",
        "2026-09-02T05:00:00.000Z",
        "2026-09-02T05:01:00.000Z",
        1,
        JSON.stringify({ companyId: otherCompanyId }),
      ),
      insertRun.bind(
        "run:career-failed",
        "2026-09-02T06:00:00.000Z",
        "2026-09-02T06:01:00.000Z",
        0,
        JSON.stringify({ companyId }),
      ),
    ]);

    await expect(repo.listCareerRuns(companyId)).resolves.toEqual([
      {
        source: "career_page",
        startedAt: "2026-09-02T04:00:00.000Z",
        finishedAt: "2026-09-02T04:01:00.000Z",
        ok: 1,
      },
    ]);
  });
});
