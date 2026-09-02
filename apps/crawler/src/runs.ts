import type { RateLimitedError } from "./http/public-fetch";

export interface RateLimitedRun {
  id: string;
  source: string;
  startedAt: string;
  finishedAt: string;
  error: RateLimitedError;
}

export async function writeRateLimitedRun(
  db: D1Database,
  run: RateLimitedRun,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO crawl_runs
        (id, source, started_at, finished_at, ok, stats_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      run.id,
      run.source,
      run.startedAt,
      run.finishedAt,
      0,
      JSON.stringify({
        status: run.error.status,
        retryAfterSeconds: run.error.retryAfterSeconds,
      }),
    )
    .run();
}
