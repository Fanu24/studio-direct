import type { JobDraft, Source } from "@gaming/shared";

export type JobRecord = {
  id: string;
  tenantId: string;
  companyId: string;
  canonicalKey: string;
  title: string;
  titleNorm: string;
  slug: string;
  location: string | null;
  remote: JobDraft["remote"];
  descriptionHtml: string;
  applyUrl: string;
  salaryText: string | null;
  exclusivity: "hidden_from_linkedin" | "on_boards" | "unknown";
  seenOnIndeed: number;
  postedAt: string | null;
  listed: number;
  createdAt: string;
  updatedAt: string;
};

export type JobUpsert = JobRecord;

export type JobSighting = {
  id: string;
  jobId: string;
  source: Source;
  sourceUrl: string;
  seenAt: string;
};

export type CareerJobCandidate = {
  jobId: string;
  lastSeenAt: string;
};

export interface JobsRepository {
  findJobByCanonicalKey(
    tenantId: string,
    canonicalKey: string,
  ): Promise<JobRecord | null>;
  hasSighting(jobId: string, source: Source): Promise<boolean>;
  listListedCareerJobs(companyId: string): Promise<CareerJobCandidate[]>;
  unlistJobs(jobIds: readonly string[], updatedAt: string): Promise<void>;
  upsertJob(job: JobUpsert): Promise<JobRecord>;
  insertSighting(sighting: JobSighting): Promise<void>;
}
