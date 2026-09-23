import {
  countryForCity,
  resolveJobLocations,
  isCitySlug,
  isCountrySlug,
  isJobTag,
  isRegionSlug,
  normalizeCompanyName,
  regionForCountry,
  slugifyTag,
  tagLabel,
  type CitySlug,
  type CountrySlug,
  type JobDraft,
} from "@gaming/shared";

import { ingestDrafts } from "../pipeline/ingest";
import { D1JobsRepository } from "../repo/d1";
import {
  fetchWeb3CareerJobs,
  Web3CareerApiError,
} from "../sources/web3-career-api";

const STALE_DAYS = 21;

type Web3Env = {
  DB: D1Database;
  WEB3_CAREER_API_TOKEN?: string;
};

async function tenantId(db: D1Database): Promise<string | null> {
  return db
    .prepare("SELECT id FROM tenants WHERE slug = ?")
    .bind("nodework")
    .first<string>("id");
}

/** Fields the upstream Web3Career API may expose on a job row that describe
 * the company beyond what JobDraft carries - read from the draft's rawJson,
 * since JobDraft itself has no logo/domain fields. */
type RawWeb3CompanyFields = {
  logo?: unknown;
  company_logo?: unknown;
  logo_url?: unknown;
  company_url?: unknown;
  url?: unknown;
  website?: unknown;
};

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseRawCompanyFields(rawJson: string): RawWeb3CompanyFields {
  try {
    const parsed: unknown = JSON.parse(rawJson);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as RawWeb3CompanyFields)
      : {};
  } catch {
    return {};
  }
}

export function hostFromUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    const host = url.hostname.replace(/^www\./, "").trim();
    return host || null;
  } catch {
    return null;
  }
}

/** Best-effort company logo/domain for a draft: prefer an explicit field on
 * the upstream payload, and derive the domain from the apply/source URL host
 * when the payload has no explicit domain. Never guesses a logo. */
export function companyProfileFromDraft(draft: JobDraft): {
  domain: string | null;
  logoUrl: string | null;
} {
  const raw = parseRawCompanyFields(draft.rawJson);
  const logoUrl =
    asNonEmptyString(raw.logo) ??
    asNonEmptyString(raw.company_logo) ??
    asNonEmptyString(raw.logo_url);
  const explicitDomainSource =
    asNonEmptyString(raw.company_url) ??
    asNonEmptyString(raw.url) ??
    asNonEmptyString(raw.website);
  const domain =
    hostFromUrl(explicitDomainSource) ??
    hostFromUrl(draft.applyUrl) ??
    hostFromUrl(draft.sourceUrl);
  return { domain, logoUrl };
}

function locationSlugFromDraft(draft: JobDraft): string | null {
  if (draft.remote === "remote") return null;
  const slug = slugifyTag(draft.location ?? "");
  if (!slug) return null;
  if (isCitySlug(slug) || isCountrySlug(slug) || isRegionSlug(slug)) return slug;
  return null;
}

type LocationLevel = { slug: string; kind: "city" | "country" | "region" };

/**
 * Expands a single resolved location slug into every hierarchy level it
 * implies - a Berlin job resolves to berlin, germany AND europe. Cities
 * absent from CITY_COUNTRY (most of CITIES) only produce the city-level row:
 * the country is never guessed.
 */
export function locationHierarchy(
  slug: string,
  kind: "city" | "country" | "region",
): LocationLevel[] {
  if (kind === "region") return [{ slug, kind: "region" }];

  if (kind === "country") {
    const country = slug as CountrySlug;
    return [
      { slug: country, kind: "country" },
      { slug: regionForCountry(country), kind: "region" },
    ];
  }

  const city = slug as CitySlug;
  const levels: LocationLevel[] = [{ slug: city, kind: "city" }];
  const country = countryForCity(city);
  if (country) {
    levels.push({ slug: country, kind: "country" });
    levels.push({ slug: regionForCountry(country), kind: "region" });
  }
  return levels;
}

export async function attachTaxonomy(
  db: D1Database,
  jobId: string,
  draft: JobDraft,
): Promise<void> {
  await db.prepare(`DELETE FROM job_tags WHERE job_id = ?`).bind(jobId).run();
  await db.prepare(`DELETE FROM job_locations WHERE job_id = ?`).bind(jobId).run();

  const tags = new Set(
    (draft.tags ?? []).map(slugifyTag).filter((tag) => tag && isJobTag(tag)),
  );
  for (const tag of tags) {
    await db
      .prepare(`INSERT OR IGNORE INTO tags (slug, label) VALUES (?, ?)`)
      .bind(tag, tagLabel(tag))
      .run();
    await db
      .prepare(
        `INSERT OR IGNORE INTO job_tags (job_id, tag_slug) VALUES (?, ?)`,
      )
      .bind(jobId, tag)
      .run();
  }

  for (const level of resolveJobLocations(draft.location)) {
    await db.prepare('INSERT OR IGNORE INTO locations(slug,kind,label) VALUES(?,?,?)').bind(level.slug,level.kind,tagLabel(level.slug)).run();
    await db.prepare('INSERT OR IGNORE INTO job_locations(job_id,location_slug) VALUES(?,?)').bind(jobId,level.slug).run();
  }
}

export async function handleWeb3ApiMessage(
  message: { kind: "web3_api"; tag?: string; country?: string; remote?: boolean },
  env: Web3Env,
): Promise<{ action: "ack" } | { action: "retry"; delaySeconds?: number }> {
  const token = env.WEB3_CAREER_API_TOKEN?.trim();
  if (!token) {
    console.error("WEB3_CAREER_API_TOKEN is not set");
    return { action: "ack" };
  }

  const tenant = await tenantId(env.DB);
  if (!tenant) {
    console.error("Nodework tenant was not found");
    return { action: "ack" };
  }

  try {
    const drafts = await fetchWeb3CareerJobs(token, {
      tag: message.tag,
      country: message.country,
      remote: message.remote,
    });
    const repo = new D1JobsRepository(env.DB);
    const now = new Date();
    const seenIds: string[] = [];

    for (const draft of drafts) {
      const profile = companyProfileFromDraft(draft);
      const { id: companyId } = await repo.upsertCompanyProfile({
        tenantId: tenant,
        name: draft.companyName,
        nameNorm: normalizeCompanyName(draft.companyName),
        domain: profile.domain,
        logoUrl: profile.logoUrl,
        createdAt: now.toISOString(),
      });
      const result = await ingestDrafts([draft], {
        repo,
        tenantId: tenant,
        companyId,
        allowlistedCompany: true,
        now,
      });
      seenIds.push(...result.jobIds);
      for (const jobId of result.jobIds) {
        await attachTaxonomy(env.DB, jobId, draft);
      }
    }

    return { action: "ack" };
  } catch (error) {
    if (error instanceof Web3CareerApiError && error.status === 429) {
      return { action: "retry", delaySeconds: 60 };
    }
    if (error instanceof Web3CareerApiError && (error.status === 401 || error.status === 403)) {
      console.error("Web3 Career API auth failed", error.status);
      return { action: "ack" };
    }
    console.error("Web3 Career API import failed", error);
    return { action: "retry", delaySeconds: 120 };
  }
}

export async function unlistStaleApiJobs(
  db: D1Database,
  now: Date,
): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const result = await db
    .prepare(
      `UPDATE jobs
       SET listed = 0, updated_at = ?
       WHERE source = 'web3_career_api'
         AND listed = 1
         AND id NOT IN (
           SELECT job_id FROM job_sightings
           WHERE source = 'web3_career_api' AND seen_at >= ?
         )`,
    )
    .bind(now.toISOString(), cutoff)
    .run();
  return result.meta?.changes ?? 0;
}
