import { describe, expect, it, vi } from "vitest";
import { RateLimitedError } from "./http/public-fetch";
import { writeRateLimitedRun } from "./runs";

describe("writeRateLimitedRun", () => {
  it("inserts a failed crawl run for a rate-limited request", async () => {
    const run = vi.fn(async () => undefined);
    const bind = vi.fn(() => ({ run }));
    const prepare = vi.fn(() => ({ bind }));
    const db = { prepare } as unknown as D1Database;
    const error = new RateLimitedError(403, 45);

    await writeRateLimitedRun(db, {
      id: "run:403",
      source: "career_page",
      startedAt: "2026-09-02T10:00:00.000Z",
      finishedAt: "2026-09-02T10:00:01.000Z",
      error,
    });

    expect(prepare).toHaveBeenCalledWith(
      `INSERT INTO crawl_runs
        (id, source, started_at, finished_at, ok, stats_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    expect(bind).toHaveBeenCalledWith(
      "run:403",
      "career_page",
      "2026-09-02T10:00:00.000Z",
      "2026-09-02T10:00:01.000Z",
      0,
      '{"status":403,"retryAfterSeconds":45}',
    );
    expect(run).toHaveBeenCalledOnce();
  });
});
