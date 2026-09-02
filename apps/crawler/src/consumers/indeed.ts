import {
  normalizeCompanyName,
  type QueueMessage,
} from "@gaming/shared";

import { RateLimitedError, retryDelaySeconds } from "../http/public-fetch";
import { acquireFetchHostLock } from "../locks/kv-lock";
import { ingestDrafts } from "../pipeline/ingest";
import { D1JobsRepository } from "../repo/d1";
import type { JobsRepository } from "../repo/types";
import { writeRateLimitedRun } from "../runs";
import { IndeedJobSource } from "../sources/indeed";

type IndeedEnv = Pick<Env, "DB" | "LOCKS">;

type IndeedCompany = {
  id: string;
  tenantId: string;
};

export interface IndeedConsumerRepository extends JobsRepository {}

type IndeedDependencies = {
  fetchImpl?: typeof fetch;
  repo?: IndeedConsumerRepository;
  resolveCompany?: (companyName: string) => Promise<IndeedCompany | null>;
  now?: () => Date;
  randomUUID?: () => string;
};

export type IndeedMessageResult =
  | { action: "ack" }
  | { action: "retry"; delaySeconds?: number };

async function resolveCompany(
  db: D1Database,
  companyName: string,
): Promise<IndeedCompany | null> {
  const row = await db
    .prepare(
      `SELECT id, tenant_id
       FROM companies
       WHERE name_norm = ? AND listed = 1
       LIMIT 1`,
    )
    .bind(normalizeCompanyName(companyName))
    .first<{ id: string; tenant_id: string }>();

  return row ? { id: row.id, tenantId: row.tenant_id } : null;
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
    .bind(id, "indeed", startedAt, finishedAt, 1, JSON.stringify(stats))
    .run();
}

export async function handleIndeedMessage(
  message: Extract<QueueMessage, { kind: "indeed" }>,
  env: IndeedEnv,
  dependencies: IndeedDependencies = {},
): Promise<IndeedMessageResult> {
  const now = dependencies.now ?? (() => new Date());
  const startedAtDate = now();
  const startedAt = startedAtDate.toISOString();
  const lock = await acquireFetchHostLock(
    env,
    "www.indeed.com",
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

  const repo = dependencies.repo ?? new D1JobsRepository(env.DB);
  const findCompany =
    dependencies.resolveCompany ??
    ((companyName: string) => resolveCompany(env.DB, companyName));
  const randomUUID = dependencies.randomUUID ?? (() => crypto.randomUUID());
  const runId = randomUUID();

  try {
    const source = new IndeedJobSource(dependencies.fetchImpl ?? fetch);
    const drafts = await source.fetch(message);
    let upserted = 0;
    let droppedStaffing = 0;

    for (const draft of drafts) {
      const company = await findCompany(draft.companyName);
      if (!company) continue;

      const ingest = await ingestDrafts([draft], {
        repo,
        tenantId: company.tenantId,
        companyId: company.id,
        allowlistedCompany: true,
        now: startedAtDate,
      });
      upserted += ingest.upserted;
      droppedStaffing += ingest.droppedStaffing;
    }

    await writeSuccessfulRun(env.DB, {
      id: runId,
      startedAt,
      finishedAt: now().toISOString(),
      stats: {
        query: message.query,
        fetched: drafts.length,
        parseableDrafts: drafts.length,
        upserted,
        droppedStaffing,
      },
    });

    return { action: "ack" };
  } catch (error) {
    if (!(error instanceof RateLimitedError)) throw error;
    const delaySeconds = retryDelaySeconds(error);

    await writeRateLimitedRun(env.DB, {
      id: runId,
      source: "indeed",
      startedAt,
      finishedAt: now().toISOString(),
      error,
    });
    return delaySeconds === null
      ? { action: "retry" }
      : { action: "retry", delaySeconds };
  }
}
