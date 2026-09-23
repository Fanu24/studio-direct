import {
  applyD1Migrations,
  createExecutionContext,
  createScheduledController,
  env,
  waitOnExecutionContext,
  type D1Migration,
} from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import {FX_ENDPOINT,SALARY_CURRENCIES} from '@gaming/shared';

declare module "cloudflare:test" {
  interface ProvidedEnv {
    TEST_MIGRATIONS: D1Migration[];
  }
}

describe("crawler scheduled handler", () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

    const insertCompany = env.DB.prepare(
      `INSERT INTO companies
        (id, tenant_id, name, name_norm, career_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    await env.DB.batch(
      [
        ["company:riot", "Riot Games", "riot"],
        ["company:dream", "Dream Games", "dream"],
        ["company:scopely", "Scopely", "scopely"],
        ["company:epic", "Epic Games", "epic"],
        ["company:roblox", "Roblox", "roblox"],
      ].map(([id, name, nameNorm]) =>
        insertCompany.bind(
          id,
          "tenant:gaming",
          name,
          nameNorm,
          `https://example.test/${id}`,
          "2026-09-02T00:00:00.000Z",
        ),
      ),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("enqueues configured career sources without a competitor API token", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async url=>{
      expect(String(url)).toBe(FX_ENDPOINT);
      return Response.json({result:'success',base_code:'USD',time_last_update_unix:Math.floor(Date.now()/1000),rates:{...Object.fromEntries(SALARY_CURRENCIES.map(currency=>[currency,2])),USD:1}});
    });
    // Observe dispatch without running queued career consumers in this scheduler test.
    const queue={send:vi.fn(),sendBatch:vi.fn()};
    const bindings={...env,CRAWL_CAREER:queue as unknown as typeof env.CRAWL_CAREER};
    const controller = createScheduledController({
      cron: "0 */6 * * *",
      scheduledTime: Date.now(),
    });
    const ctx = createExecutionContext();

    await worker.scheduled(controller, bindings, ctx);
    await waitOnExecutionContext(ctx);

    const row = await env.DB.prepare(
      "SELECT source, ok, stats_json FROM crawl_runs",
    ).first();
    expect(row).toEqual({
      source: "scheduler",
      ok: 1,
      stats_json: expect.stringContaining("enqueuedApi"),
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(queue.sendBatch.mock.calls[0]?.[0]).toHaveLength(5);
    expect(await env.DB.prepare('SELECT COUNT(*) n FROM fx_rates').first('n')).toBe(20);
    const second=createExecutionContext();await worker.scheduled(controller,bindings,second);await waitOnExecutionContext(second);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
