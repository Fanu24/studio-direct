import {
  applyD1Migrations,
  createExecutionContext,
  createScheduledController,
  env,
  waitOnExecutionContext,
  type D1Migration,
} from "cloudflare:test";
import { beforeAll, describe, expect, it, vi } from "vitest";
import worker from "../src/index";

declare module "cloudflare:test" {
  interface ProvidedEnv {
    TEST_MIGRATIONS: D1Migration[];
  }
}

describe("crawler scheduled handler", () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  });

  it("records an empty successful career-page crawl run without HTTP", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const controller = createScheduledController({
      cron: "0 */6 * * *",
      scheduledTime: Date.now(),
    });
    const ctx = createExecutionContext();

    await worker.scheduled(controller, env, ctx);
    await waitOnExecutionContext(ctx);

    const row = await env.DB.prepare(
      "SELECT source, ok, stats_json FROM crawl_runs",
    ).first();
    expect(row).toEqual({
      source: "career_page",
      ok: 1,
      stats_json: '{"enqueued":0}',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
