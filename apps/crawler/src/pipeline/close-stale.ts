import type { Source } from "@gaming/shared";

import type { JobsRepository } from "../repo/types";

export type CrawlRunSummary = {
  source: Source;
  startedAt: string;
  finishedAt?: string | null;
  ok: number;
};

export type CloseStaleCareerJobsContext = {
  repo: JobsRepository;
  companyId: string;
  seenJobIds: readonly string[];
  atsClosedJobIds?: readonly string[];
  notFoundJobIds?: readonly string[];
  crawlRuns: readonly CrawlRunSummary[];
  now?: Date;
};

export type CloseStaleCareerJobsResult = {
  closed: number;
  jobIds: string[];
};

export async function closeStaleCareerJobs(
  ctx: CloseStaleCareerJobsContext,
): Promise<CloseStaleCareerJobsResult> {
  const candidates = await ctx.repo.listListedCareerJobs(ctx.companyId);
  const explicitlyClosedJobIds = new Set([
    ...(ctx.atsClosedJobIds ?? []),
    ...(ctx.notFoundJobIds ?? []),
  ]);
  const successfulRunTimestamps = ctx.crawlRuns
    .filter(
      (run) => run.source === "career_page" && run.ok === 1,
    )
    .map((run) => run.startedAt)
    .sort()
    .slice(-3);

  const oldestMissTimestamp = successfulRunTimestamps.at(0);
  const seenJobIds = new Set(ctx.seenJobIds);
  const jobIds = candidates
    .filter(
      (candidate) =>
        explicitlyClosedJobIds.has(candidate.jobId) ||
        (successfulRunTimestamps.length === 3 &&
          !seenJobIds.has(candidate.jobId) &&
          candidate.lastSeenAt < oldestMissTimestamp!),
    )
    .map((candidate) => candidate.jobId);

  if (jobIds.length > 0) {
    await ctx.repo.unlistJobs(
      jobIds,
      (ctx.now ?? new Date()).toISOString(),
    );
  }

  return { closed: jobIds.length, jobIds };
}
