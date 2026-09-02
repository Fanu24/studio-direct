import {
  canonicalApplyUrl,
  classifyRemote,
  isStaffingDraft,
  jobPublicSlug,
  normalizeCompanyName,
  slugTitle,
  type JobDraft,
} from "@gaming/shared";

import type { JobRecord, JobsRepository } from "../repo/types";

const RECENT_FALLBACK_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1_000;

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

    const remote = classifyRemote(draft);
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

    const job = await ctx.repo.upsertJob({
      id,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      canonicalKey: key,
      title: draft.title,
      titleNorm: slugTitle(draft.title),
      slug: jobPublicSlug(draft.companyName, draft.title),
      location: draft.location,
      remote,
      descriptionHtml: draft.descriptionHtml,
      applyUrl: preferredApplyUrl(draft, existing, existingHasCareerSighting),
      salaryText: existing?.salaryText ?? null,
      exclusivity: existing?.exclusivity ?? "unknown",
      seenOnIndeed:
        existing?.seenOnIndeed === 1 || draft.source === "indeed" ? 1 : 0,
      postedAt: draft.postedAt,
      listed: remote === "onsite" ? 0 : 1,
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
