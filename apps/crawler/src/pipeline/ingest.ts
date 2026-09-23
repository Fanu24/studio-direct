import {externalSalary} from '@gaming/shared';
import {
  canonicalApplyUrl,
  classifyRemote,
  isStaffingDraft,
  jobPublicSlug,
  jobSeoSlug,
  normalizeCompanyName,
  slugTitle,
  web3CareerCanonicalKey,
  type JobDraft,
} from "@gaming/shared";

import type { JobRecord, JobsRepository, NormalizedRemote } from "../repo/types";

const RECENT_FALLBACK_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1_000;

/**
 * classifyRemote only ever returns "remote" | "hybrid" | "onsite" | "unknown".
 * "unknown" (no signal in the source text) is normalised to null here so the
 * honest absence of data never leaks past ingest as the literal string
 * "unknown" - and so a value outside the canonical three never reaches the
 * database.
 */
function normalizeRemote(value: ReturnType<typeof classifyRemote>): NormalizedRemote {
  return value === "remote" || value === "hybrid" || value === "onsite" ? value : null;
}

export type IngestContext = {
  repo: JobsRepository;
  tenantId: string;
  companyId: string;
  allowlistedCompany: boolean;
  now?: Date;
};

export type IngestResult = {
  upserted: number;
  jobIds: string[];
  droppedStaffing: number;
};

function canonicalKey(draft: JobDraft, now: Date): string | null {
  if (draft.source === "web3_career_api" && draft.externalId) {
    return web3CareerCanonicalKey(draft.externalId);
  }

  const applyUrl = draft.applyUrl.trim();
  if (applyUrl) {
    return canonicalApplyUrl(applyUrl);
  }

  if (!draft.postedAt) return null;
  const postedAt = new Date(draft.postedAt);
  const ageMs = now.getTime() - postedAt.getTime();
  if (
    Number.isNaN(postedAt.getTime()) ||
    ageMs < 0 ||
    ageMs > RECENT_FALLBACK_DAYS * DAY_MS
  ) {
    return null;
  }

  return `${normalizeCompanyName(draft.companyName)}:${slugTitle(draft.title)}`;
}

function preferredApplyUrl(
  draft: JobDraft,
  existing: JobRecord | null,
  existingHasCareerSighting: boolean,
): string {
  if (draft.keepApplyUrl || draft.source === "web3_career_api") {
    return draft.applyUrl.trim();
  }

  const candidate = canonicalApplyUrl(
    draft.applyUrl.trim() || draft.sourceUrl.trim(),
  );

  if (draft.source === "career_page" || !existingHasCareerSighting) {
    return candidate;
  }

  return existing?.applyUrl ?? candidate;
}

export async function ingestDrafts(
  drafts: readonly JobDraft[],
  ctx: IngestContext,
): Promise<IngestResult> {
  if(await ctx.repo.isManagedCompany?.(ctx.companyId))return {upserted:0,jobIds:[],droppedStaffing:0};
  const now = ctx.now ?? new Date();
  const timestamp = now.toISOString();
  const jobIds = new Set<string>();
  let upserted = 0;
  let droppedStaffing = 0;

  for (const sourceDraft of drafts) {
    const draft = {
      ...sourceDraft,
      companyName: sourceDraft.companyName.trim(),
      title: sourceDraft.title.trim(),
    };

    const remote = normalizeRemote(classifyRemote(draft));
    if (isStaffingDraft(draft, { allowlistedCompany: ctx.allowlistedCompany })) {
      droppedStaffing += 1;
      continue;
    }

    const key = canonicalKey(draft, now);
    if (!key) continue;

    const existing = await ctx.repo.findJobByCanonicalKey(ctx.tenantId, key);
    const existingHasCareerSighting = existing
      ? await ctx.repo.hasSighting(existing.id, "career_page")
      : false;
    const id = existing?.id ?? crypto.randomUUID();

    const listed =
      1;
    const slug =
      draft.source === "web3_career_api" && draft.externalId
        ? `${jobSeoSlug(draft.title, draft.companyName)}-${draft.externalId}`
        : `${jobPublicSlug(draft.companyName, draft.title)}-${id.slice(-12)}`;

    const job = await ctx.repo.upsertJob({
      id,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      canonicalKey: key,
      title: draft.title,
      titleNorm: slugTitle(draft.title),
      slug,
      location: draft.location,
      remote,
      descriptionHtml: draft.descriptionHtml,
      applyUrl: preferredApplyUrl(draft, existing, existingHasCareerSighting),
      statedSalary:externalSalary(draft),
      salaryText: draft.salaryText ?? existing?.salaryText ?? null,
      salaryMin: draft.salaryMin ?? existing?.salaryMin ?? null,
      salaryMax: draft.salaryMax ?? existing?.salaryMax ?? null,
      source: draft.source,
      externalId: draft.externalId ?? existing?.externalId ?? null,
      featuredUntil: existing?.featuredUntil ?? null,
      highlight: existing?.highlight ?? 0,
      exclusivity: existing?.exclusivity ?? "unknown",
      seenOnIndeed:
        existing?.seenOnIndeed === 1 || draft.source === "indeed" ? 1 : 0,
      postedAt: draft.postedAt,
      listed,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });

    await ctx.repo.insertSighting({
      id: crypto.randomUUID(),
      jobId: job.id,
      source: draft.source,
      sourceUrl: draft.sourceUrl,
      seenAt: timestamp,
    });

    upserted += 1;
    jobIds.add(job.id);
  }

  return { upserted, jobIds: [...jobIds], droppedStaffing };
}
