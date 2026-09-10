import { API_SWEEP_COUNTRIES, API_SWEEP_TAGS, type QueueMessage } from "@gaming/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { enqueueCronWork } from "./cron";

function fakeQueue(messages: QueueMessage[]) {
  return {
    async send(message: QueueMessage) {
      messages.push(message);
    },
  };
}

describe("enqueueCronWork", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("enqueues web3 API sweep messages without LinkedIn or Indeed", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const careerMessages: QueueMessage[] = [];
    const env = {
      DB: { prepare: vi.fn() },
      CRAWL_CAREER: fakeQueue(careerMessages),
      CRAWL_LINKEDIN: fakeQueue([]),
      CRAWL_INDEED: fakeQueue([]),
    };

    const stats = await enqueueCronWork(env as unknown as Env);

    expect(careerMessages[0]).toEqual({ kind: "web3_api", remote: true });
    expect(careerMessages).toContainEqual({ kind: "web3_api", tag: "solidity" });
    expect(careerMessages).toContainEqual({
      kind: "web3_api",
      country: API_SWEEP_COUNTRIES[0],
    });
    expect(stats.enqueuedApi).toBe(
      1 + API_SWEEP_TAGS.length + API_SWEEP_COUNTRIES.length,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
