import {JOB_TAGS,canonicalApplyUrl} from "@gaming/shared";
import {attachTaxonomy} from "./web3-api";
import type { QueueMessage } from "@gaming/shared";

import {
  RateLimitedError,
  retryDelaySeconds,
} from "../http/public-fetch";
import { acquireFetchHostLock } from "../locks/kv-lock";
import { closeStaleCareerJobs } from "../pipeline/close-stale";
import { recomputeExclusivity } from "../pipeline/exclusivity";
import { ingestDrafts } from "../pipeline/ingest";
import {
  D1JobsRepository,
  type CareerConsumerCompany,
  type CareerConsumerRepository,
} from "../repo/d1";
import { writeRateLimitedRun } from "../runs";
import { CareerJobSource } from "../sources/career";

type CareerEnv = Pick<Env, "DB" | "LOCKS">;

type CareerDependencies = {
  fetchImpl?: typeof fetch;
  repo?: CareerConsumerRepository;
  now?: () => Date;
  randomUUID?: () => string;
};

export type CareerMessageResult =
  | { action: "ack" }
  | { action: "retry"; delaySeconds?: number };

function fetchHostname(company: CareerConsumerCompany): string {
  if (company.ats_type === "greenhouse") return "boards-api.greenhouse.io";
  if (company.ats_type === "lever") return "api.lever.co";
  if (company.ats_type === "ashby") return "api.ashbyhq.com";
  if (company.career_url) return new URL(company.career_url).hostname;
  throw new Error(`Company has no fetchable career URL: ${company.id}`);
}

async function writeSuccessfulRun(
  db: D1Database,
  {
    id,
    startedAt,
    finishedAt,
    stats,
  }: {
    id: string;
    startedAt: string;
    finishedAt: string;
    stats: Record<string, unknown>;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO crawl_runs
        (id, source, started_at, finished_at, ok, stats_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      "career_page",
      startedAt,
      finishedAt,
      1,
      JSON.stringify(stats),
    )
    .run();
}

export async function handleCareerMessage(
  message: Extract<QueueMessage, { kind: "career" }>,
  env: CareerEnv,
  dependencies: CareerDependencies = {},
): Promise<CareerMessageResult> {
  const repo = dependencies.repo ?? new D1JobsRepository(env.DB);
  const now = dependencies.now ?? (() => new Date());
  const randomUUID = dependencies.randomUUID ?? (() => crypto.randomUUID());
  const startedAtDate = now();
  const startedAt = startedAtDate.toISOString();
  const company = await repo.getById(message.companyId);
  if (!company) throw new Error(`Company not found: ${message.companyId}`);

  const lock = await acquireFetchHostLock(
    env,
    fetchHostname(company),
    startedAtDate.getTime(),
  );
  if (!lock.acquired) {
    const delaySeconds =
      lock.retryAfterMs === undefined
        ? undefined
        : Math.max(1, Math.ceil(lock.retryAfterMs / 1_000));
    return delaySeconds === undefined
      ? { action: "retry" }
      : { action: "retry", delaySeconds };
  }

  const runId = randomUUID();
  try {
    const source = new CareerJobSource(
      repo,
      dependencies.fetchImpl ?? fetch,
    );
    const drafts = await source.fetch(message);
    const ingest = await ingestDrafts(drafts, {
      repo,
      tenantId: company.tenantId,
      companyId: company.id,
      allowlistedCompany: true,
      now: startedAtDate,
    });

    for(const draft of drafts){
      const saved=await repo.findJobByCanonicalKey(company.tenantId,canonicalApplyUrl(draft.applyUrl));
      if(!saved)continue;
      const title=' '+draft.title.toLowerCase().replace(/[^a-z0-9+#]+/g,' ')+' ';
      const inferred=JOB_TAGS.filter(tag=>title.includes(' '+tag.replaceAll('-',' ')+' '));
      await attachTaxonomy(env.DB,saved.id,{...draft,tags:[...new Set([...(draft.tags??[]),...inferred])]});
    }

    const [jobs, linkedinRun, linkedinSightings] = await Promise.all([
      repo.getJobsByIds(ingest.jobIds),
      repo.getLatestLinkedinRun(),
      repo.listLinkedinSightings(),
    ]);
    for (const job of jobs) {
      const exclusivity = recomputeExclusivity({
        hasCareer: true,
        careerJob: {
          companyName: company.name,
          title: job.title,
          postedAtIso: job.postedAt,
        },
        linkedinSightings,
        linkedinRun,
        now: startedAtDate,
      });
      await repo.updateExclusivity(job.id, exclusivity, startedAt);
    }

    const finishedAt = now().toISOString();
    const crawlRuns = await repo.listCareerRuns(company.id);
    await closeStaleCareerJobs({
      repo,
      companyId: company.id,
      seenJobIds: ingest.jobIds,
      crawlRuns: [
        ...crawlRuns,
        {
          source: "career_page",
          startedAt,
          finishedAt,
          ok: 1,
        },
      ],
      now: startedAtDate,
    });

    await writeSuccessfulRun(env.DB, {
      id: runId,
      startedAt,
      finishedAt,
      stats: {
        companyId: company.id,
        fetched: drafts.length,
        upserted: ingest.upserted,
        droppedStaffing: ingest.droppedStaffing,
      },
    });

    return { action: "ack" };
  } catch (error) {
    if (!(error instanceof RateLimitedError)) throw error;
    const delaySeconds = retryDelaySeconds(error);

    await writeRateLimitedRun(env.DB, {
      id: runId,
      source: "career_page",
      startedAt,
      finishedAt: now().toISOString(),
      error,
    });
    return delaySeconds === null
      ? { action: "retry" }
      : { action: "retry", delaySeconds };
  }
}
