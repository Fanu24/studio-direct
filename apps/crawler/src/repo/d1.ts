import { REMOTE_GAMING_QUERIES, type Source } from "@gaming/shared";

import type { CrawlRunSummary } from "../pipeline/close-stale";
import type {
  ExclusivityJobIdentity,
  LinkedinBadgeRun,
} from "../pipeline/exclusivity";
import type { CareerCompany, CareerCompanyRepo } from "../sources/career";
import type {
  CompanyProfileRepository,
  CompanyProfileUpsert,
  JobRecord,
  JobsRepository,
  JobSighting,
  JobUpsert,
} from "./types";

/** The remote value as it is physically stored: NOT NULL, so the honest
 * "not specified" state is encoded as the sentinel string "unknown" and
 * decoded back to null by mapJob (see JobRecord["remote"]). */
type StoredRemote = "remote" | "hybrid" | "onsite" | "unknown";

type JobRow = {
  id: string;
  tenant_id: string;
  company_id: string;
  canonical_key: string;
  title: string;
  title_norm: string;
  slug: string;
  location: string | null;
  remote: StoredRemote;
  description_html: string;
  apply_url: string;
  salary_text: string | null;
  salary_min: number | null;
  salary_max: number | null;
  source: JobRecord["source"];
  external_id: string | null;
  featured_until: string | null;
  highlight: number;
  exclusivity: JobRecord["exclusivity"];
  seen_on_indeed: number;
  posted_at: string | null;
  listed: number;
  created_at: string;
  updated_at: string;
};

export type CareerConsumerCompany = CareerCompany & {
  tenantId: string;
};

export type CareerJobForExclusivity = {
  id: string;
  title: string;
  postedAt: string | null;
  companyName: string;
};

export interface CareerConsumerRepository
  extends JobsRepository,
    CareerCompanyRepo {
  getById(id: string): Promise<CareerConsumerCompany | null>;
  listCareerRuns(companyId: string): Promise<CrawlRunSummary[]>;
  getJobsByIds(jobIds: readonly string[]): Promise<JobRecord[]>;
  getLatestLinkedinRun(): Promise<LinkedinBadgeRun | null>;
  listLinkedinSightings(): Promise<ExclusivityJobIdentity[]>;
  listCareerJobsForExclusivity(): Promise<CareerJobForExclusivity[]>;
  updateExclusivity(
    jobId: string,
    exclusivity: JobRecord["exclusivity"],
    updatedAt: string,
  ): Promise<void>;
}

function mapJob(row: JobRow): JobRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    companyId: row.company_id,
    canonicalKey: row.canonical_key,
    title: row.title,
    titleNorm: row.title_norm,
    slug: row.slug,
    location: row.location,
    remote: row.remote === "unknown" ? null : row.remote,
    descriptionHtml: row.description_html,
    applyUrl: row.apply_url,
    salaryText: row.salary_text,
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    source: row.source,
    externalId: row.external_id,
    featuredUntil: row.featured_until,
    highlight: row.highlight,
    exclusivity: row.exclusivity,
    seenOnIndeed: row.seen_on_indeed,
    postedAt: row.posted_at,
    listed: row.listed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const JOB_COLUMNS = `id, tenant_id, company_id, canonical_key, title,
  title_norm, slug, location, remote, description_html, apply_url,
  salary_text, salary_min, salary_max, source, external_id, featured_until,
  highlight, exclusivity, seen_on_indeed, posted_at, listed,
  created_at, updated_at`;

function parseLinkedinRunStats(statsJson: string): {
  query: string | null;
  parseableDrafts: number;
} {
  try {
    const stats = JSON.parse(statsJson) as {
      query?: unknown;
      parseableDrafts?: unknown;
      fetched?: unknown;
    };
    const draftCount =
      stats.parseableDrafts === undefined ? stats.fetched : stats.parseableDrafts;
    return {
      query: typeof stats.query === "string" && stats.query.trim() ? stats.query : null,
      parseableDrafts:
        typeof draftCount === "number" && Number.isFinite(draftCount)
          ? draftCount
          : 0,
    };
  } catch {
    return { query: null, parseableDrafts: 0 };
  }
}

export class D1JobsRepository
  implements CareerConsumerRepository, CompanyProfileRepository
{
  constructor(private readonly db: D1Database) {}

  /**
   * Idempotent company upsert keyed by (tenant_id, name_norm). Never
   * overwrites an already-stored non-null domain/logo_url with null -
   * COALESCE prefers the existing stored value whenever it is non-null.
   */
  async upsertCompanyProfile(input: CompanyProfileUpsert): Promise<{ id: string }> {
    const id = `company:${input.nameNorm}`;
    await this.db
      .prepare(
        `INSERT INTO companies (id, tenant_id, name, name_norm, domain, logo_url, listed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)
         ON CONFLICT (tenant_id, name_norm) DO UPDATE SET
           name = excluded.name,
           domain = COALESCE(companies.domain, excluded.domain),
           logo_url = COALESCE(companies.logo_url, excluded.logo_url)`,
      )
      .bind(
        id,
        input.tenantId,
        input.name,
        input.nameNorm,
        input.domain,
        input.logoUrl,
        input.createdAt,
      )
      .run();

    const row = await this.db
      .prepare(`SELECT id FROM companies WHERE tenant_id = ? AND name_norm = ? LIMIT 1`)
      .bind(input.tenantId, input.nameNorm)
      .first<{ id: string }>();

    return { id: row?.id ?? id };
  }

  async getById(id: string): Promise<CareerConsumerCompany | null> {
    const row = await this.db
      .prepare(
        `SELECT id, tenant_id, name, ats_type, ats_slug, career_url
         FROM companies
         WHERE id = ? AND listed = 1`,
      )
      .bind(id)
      .first<{
        id: string;
        tenant_id: string;
        name: string;
        ats_type: string | null;
        ats_slug: string | null;
        career_url: string | null;
      }>();

    return row
      ? {
          id: row.id,
          tenantId: row.tenant_id,
          name: row.name,
          ats_type: row.ats_type,
          ats_slug: row.ats_slug,
          career_url: row.career_url,
        }
      : null;
  }

  async findJobByCanonicalKey(
    tenantId: string,
    canonicalKey: string,
  ): Promise<JobRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT ${JOB_COLUMNS}
         FROM jobs
         WHERE tenant_id = ? AND canonical_key = ?`,
      )
      .bind(tenantId, canonicalKey)
      .first<JobRow>();
    return row ? mapJob(row) : null;
  }

  async hasSighting(jobId: string, source: Source): Promise<boolean> {
    const row = await this.db
      .prepare(
        `SELECT 1 AS found
         FROM job_sightings
         WHERE job_id = ? AND source = ?
         LIMIT 1`,
      )
      .bind(jobId, source)
      .first<{ found: number }>();
    return row !== null;
  }

  async listListedCareerJobs(companyId: string) {
    const { results } = await this.db
      .prepare(
        `SELECT j.id AS job_id, MAX(s.seen_at) AS last_seen_at
         FROM jobs j
         JOIN job_sightings s ON s.job_id = j.id
         WHERE j.company_id = ?
           AND j.listed = 1
           AND s.source = 'career_page'
         GROUP BY j.id`,
      )
      .bind(companyId)
      .all<{ job_id: string; last_seen_at: string }>();

    return results.map((row) => ({
      jobId: row.job_id,
      lastSeenAt: row.last_seen_at,
    }));
  }

  async unlistJobs(
    jobIds: readonly string[],
    updatedAt: string,
  ): Promise<void> {
    if (jobIds.length === 0) return;
    const placeholders = jobIds.map(() => "?").join(", ");
    await this.db
      .prepare(
        `UPDATE jobs
         SET listed = 0, updated_at = ?
         WHERE id IN (${placeholders})`,
      )
      .bind(updatedAt, ...jobIds)
      .run();
  }

  async upsertJob(job: JobUpsert): Promise<JobRecord> {
    const row = await this.db
      .prepare(
        `INSERT INTO jobs (${JOB_COLUMNS})
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (tenant_id, canonical_key) DO UPDATE SET
           company_id = excluded.company_id,
           title = excluded.title,
           title_norm = excluded.title_norm,
           slug = excluded.slug,
           location = excluded.location,
           remote = excluded.remote,
           description_html = excluded.description_html,
           apply_url = excluded.apply_url,
           salary_text = excluded.salary_text,
           salary_min = excluded.salary_min,
           salary_max = excluded.salary_max,
           source = excluded.source,
           external_id = excluded.external_id,
           featured_until = excluded.featured_until,
           highlight = excluded.highlight,
           exclusivity = excluded.exclusivity,
           seen_on_indeed = excluded.seen_on_indeed,
           posted_at = excluded.posted_at,
           listed = excluded.listed,
           updated_at = excluded.updated_at
         RETURNING ${JOB_COLUMNS}`,
      )
      .bind(
        job.id,
        job.tenantId,
        job.companyId,
        job.canonicalKey,
        job.title,
        job.titleNorm,
        job.slug,
        job.location,
        job.remote ?? "unknown",
        job.descriptionHtml,
        job.applyUrl,
        job.salaryText,
        job.salaryMin,
        job.salaryMax,
        job.source,
        job.externalId,
        job.featuredUntil,
        job.highlight,
        job.exclusivity,
        job.seenOnIndeed,
        job.postedAt,
        job.listed,
        job.createdAt,
        job.updatedAt,
      )
      .first<JobRow>();

    if (!row) throw new Error(`D1 did not return upserted job: ${job.id}`);
    return mapJob(row);
  }

  async insertSighting(sighting: JobSighting): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO job_sightings (id, job_id, source, source_url, seen_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(
        sighting.id,
        sighting.jobId,
        sighting.source,
        sighting.sourceUrl,
        sighting.seenAt,
      )
      .run();
  }

  async listCareerRuns(companyId: string): Promise<CrawlRunSummary[]> {
    const { results } = await this.db
      .prepare(
        `SELECT source, started_at, finished_at, ok
         FROM crawl_runs
         WHERE source = 'career_page'
           AND ok = 1
           AND json_extract(stats_json, '$.companyId') = ?
         ORDER BY started_at DESC
         LIMIT 3`,
      )
      .bind(companyId)
      .all<{
        source: Source;
        started_at: string;
        finished_at: string | null;
        ok: number;
      }>();

    return results.map((row) => ({
      source: row.source,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      ok: row.ok,
    }));
  }

  async getJobsByIds(jobIds: readonly string[]): Promise<JobRecord[]> {
    if (jobIds.length === 0) return [];
    const placeholders = jobIds.map(() => "?").join(", ");
    const { results } = await this.db
      .prepare(
        `SELECT ${JOB_COLUMNS}
         FROM jobs
         WHERE id IN (${placeholders})`,
      )
      .bind(...jobIds)
      .all<JobRow>();
    return results.map(mapJob);
  }

  async getLatestLinkedinRun(): Promise<LinkedinBadgeRun | null> {
    const { results } = await this.db
      .prepare(
        `SELECT started_at, finished_at, ok, stats_json
         FROM crawl_runs
         WHERE source = 'linkedin'
         ORDER BY started_at DESC
         LIMIT 100`,
      )
      .all<{
        started_at: string;
        finished_at: string | null;
        ok: number;
        stats_json: string;
      }>();
    const latest = results[0];
    if (!latest) return null;

    const latestStarted = new Date(latest.started_at).getTime();
    const windowStart = latestStarted - 24 * 60 * 60 * 1_000;
    const queries = new Set<string>();
    let parseableDrafts = 0;

    for (const row of results) {
      if (row.ok !== 1) continue;
      const started = new Date(row.started_at).getTime();
      if (
        Number.isNaN(started) ||
        started < windowStart ||
        started > latestStarted
      ) {
        continue;
      }

      const stats = parseLinkedinRunStats(row.stats_json);
      if (stats.query) queries.add(stats.query);
      parseableDrafts += stats.parseableDrafts;
    }

    return {
      ok: latest.ok === 1,
      finishedAtIso: latest.finished_at ?? "",
      parseableDrafts,
      okQueryCount: queries.size,
      dictionarySize: REMOTE_GAMING_QUERIES.length,
    };
  }

  async listLinkedinSightings(): Promise<ExclusivityJobIdentity[]> {
    const { results } = await this.db
      .prepare(
        `SELECT c.name AS company_name, j.title, j.posted_at
         FROM job_sightings s
         JOIN jobs j ON j.id = s.job_id
         JOIN companies c ON c.id = j.company_id
         WHERE s.source = 'linkedin'`,
      )
      .all<{
        company_name: string;
        title: string;
        posted_at: string | null;
      }>();

    return results.map((row) => ({
      companyName: row.company_name,
      title: row.title,
      postedAtIso: row.posted_at,
    }));
  }

  async listCareerJobsForExclusivity(): Promise<CareerJobForExclusivity[]> {
    const { results } = await this.db
      .prepare(
        `SELECT j.id, j.title, j.posted_at, c.name AS company_name
         FROM jobs j
         JOIN companies c ON c.id = j.company_id AND c.tenant_id = j.tenant_id
         JOIN job_sightings s ON s.job_id = j.id AND s.source = 'career_page'
         WHERE j.listed = 1
         GROUP BY j.id`,
      )
      .all<{
        id: string;
        title: string;
        posted_at: string | null;
        company_name: string;
      }>();

    return results.map((row) => ({
      id: row.id,
      title: row.title,
      postedAt: row.posted_at,
      companyName: row.company_name,
    }));
  }

  async updateExclusivity(
    jobId: string,
    exclusivity: JobRecord["exclusivity"],
    updatedAt: string,
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE jobs
         SET exclusivity = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(exclusivity, updatedAt, jobId)
      .run();
  }
}
