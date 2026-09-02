import {
  createExecutionContext,
  createMessageBatch,
  env,
  getQueueResult,
} from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";

describe("crawler queue", () => {
  it("acknowledges every message without outbound HTTP", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const batch = createMessageBatch("crawl-career", [
      {
        id: "crawl-1",
        timestamp: new Date(),
        body: { kind: "career_page", url: "https://example.test/careers" },
        attempts: 1,
      },
      {
        id: "crawl-2",
        timestamp: new Date(),
        body: { kind: "career_page", url: "https://example.test/jobs" },
        attempts: 1,
      },
      {
        id: "crawl-3",
        timestamp: new Date(),
        body: { kind: "linkedin", query: "unity remote" },
        attempts: 1,
      },
      {
        id: "crawl-4",
        timestamp: new Date(),
        body: { kind: "indeed", query: "unreal remote" },
        attempts: 1,
      },
    ]);
    const ctx = createExecutionContext();

    await worker.queue(batch, env, ctx);

    const result = await getQueueResult(batch, ctx);
    expect(result).toMatchObject({ ackAll: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
