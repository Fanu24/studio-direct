import type { JobDraft, Source } from "@gaming/shared";

/**
 * A resolved remote-work classification. "unknown" from JobDraft/classifyRemote
 * is normalised to null at ingest time: null means the source honestly did
 * not say, rather than leaking the sentinel string "unknown" into records and
 * (eventually) UI copy.
 */
export type NormalizedRemote = "remote" | "hybrid" | "onsite" | null;

export type JobRecord = {
  id: string;
  tenantId: string;
  companyId: string;
  canonicalKey: string;
  title: string;
  titleNorm: string;
  slug: string;
  location: string | null;
  remote: NormalizedRemote;
  descriptionHtml: string;
  applyUrl: string;
  salaryText: string | null;
  statedSalary?:{min:number;max:number;currency:string;period:'yearly'|'monthly'|'hourly'}|null;
  salaryMin: number | null;
  salaryMax: number | null;
  source: JobDraft["source"];
  externalId: string | null;
  featuredUntil: string | null;
  highlight: number;
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
  isManagedCompany?(companyId:string):Promise<boolean>;
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

/**
 * Company logo/domain, as discovered from a job source at ingest time.
 * `domain` and `logoUrl` are the best values found for this ingest pass;
 * an upsert must not overwrite an already-stored non-null value with null
 * (see D1JobsRepository.upsertCompanyProfile).
 */
export type CompanyProfileUpsert = {
  tenantId: string;
  name: string;
  nameNorm: string;
  domain: string | null;
  logoUrl: string | null;
  createdAt: string;
};

export interface CompanyProfileRepository {
  upsertCompanyProfile(input: CompanyProfileUpsert): Promise<{ id: string }>;
}
