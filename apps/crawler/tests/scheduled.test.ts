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

declare module "cloudflare:test" {
  interface ProvidedEnv {
    TEST_MIGRATIONS: D1Migration[];
  }
}

describe("crawler scheduled handler", () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    await env.DB.prepare(
      "INSERT INTO tenants (id, slug, name) VALUES (?, ?, ?)",
    )
      .bind("tenant:gaming", "gaming", "Studio Direct")
      .run();

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

  it("records five enqueued career crawls without HTTP", async () => {
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
      stats_json: '{"enqueuedCareer":5}',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
