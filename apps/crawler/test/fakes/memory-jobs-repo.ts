import type { Source } from "@gaming/shared";

import type {
  JobRecord,
  JobsRepository,
  JobSighting,
  JobUpsert,
} from "../../src/repo/types";

export class MemoryJobsRepository implements JobsRepository {
  readonly jobs: JobRecord[] = [];
  readonly sightings: JobSighting[] = [];

  async findJobByCanonicalKey(
    tenantId: string,
    canonicalKey: string,
  ): Promise<JobRecord | null> {
    return (
      this.jobs.find(
        (job) => job.tenantId === tenantId && job.canonicalKey === canonicalKey,
      ) ?? null
    );
  }

  async hasSighting(jobId: string, source: Source): Promise<boolean> {
    return this.sightings.some(
      (sighting) => sighting.jobId === jobId && sighting.source === source,
    );
  }

  async listListedCareerJobs(companyId: string) {
    return this.jobs
      .filter((job) => job.companyId === companyId && job.listed === 1)
      .flatMap((job) => {
        const lastSeenAt = this.sightings
          .filter(
            (sighting) =>
              sighting.jobId === job.id && sighting.source === "career_page",
          )
          .map((sighting) => sighting.seenAt)
          .sort()
          .at(-1);

        return lastSeenAt ? [{ jobId: job.id, lastSeenAt }] : [];
      });
  }

  async unlistJobs(
    jobIds: readonly string[],
    updatedAt: string,
  ): Promise<void> {
    const ids = new Set(jobIds);
    for (const job of this.jobs) {
      if (ids.has(job.id)) {
        job.listed = 0;
        job.updatedAt = updatedAt;
      }
    }
  }

  async upsertJob(input: JobUpsert): Promise<JobRecord> {
    const index = this.jobs.findIndex(
      (job) =>
        job.tenantId === input.tenantId &&
        job.canonicalKey === input.canonicalKey,
    );

    if (index === -1) {
      const job = { ...input };
      this.jobs.push(job);
      return { ...job };
    }

    const existing = this.jobs[index]!;
    const job = {
      ...input,
      id: existing.id,
      createdAt: existing.createdAt,
    };
    this.jobs[index] = job;
    return { ...job };
  }

  async insertSighting(sighting: JobSighting): Promise<void> {
    this.sightings.push({ ...sighting });
  }
}
