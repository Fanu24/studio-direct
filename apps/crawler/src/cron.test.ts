import { REMOTE_GAMING_QUERIES, type QueueMessage } from "@gaming/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { enqueueCronWork } from "./cron";

const companyIds = [
  "company:riot",
  "company:dream",
  "company:scopely",
  "company:epic",
  "company:roblox",
];

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

  it("fans out eligible companies and every dictionary query without HTTP", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const careerMessages: QueueMessage[] = [];
    const linkedinMessages: QueueMessage[] = [];
    const indeedMessages: QueueMessage[] = [];
    const env = {
      DB: {
        prepare: vi.fn(() => ({
          all: async () => ({
            results: companyIds.map((id) => ({ id })),
          }),
        })),
      },
      CRAWL_CAREER: fakeQueue(careerMessages),
      CRAWL_LINKEDIN: fakeQueue(linkedinMessages),
      CRAWL_INDEED: fakeQueue(indeedMessages),
    };

    const stats = await enqueueCronWork(env as unknown as Env);

    expect(REMOTE_GAMING_QUERIES).toEqual([
      "unity remote",
      "unity hybrid",
      "unreal remote",
      "unreal hybrid",
      "gameplay programmer remote",
      "gameplay programmer hybrid",
      "engine programmer remote",
      "engine programmer hybrid",
      "technical artist remote",
      "technical artist hybrid",
      "animator remote",
      "animator hybrid",
    ]);
    expect(careerMessages).toEqual(
      companyIds.map((companyId) => ({ kind: "career", companyId })),
    );
    expect(careerMessages).toHaveLength(5);
    expect(careerMessages.every((message) => !("type" in message))).toBe(true);
    expect(linkedinMessages).toEqual(
      REMOTE_GAMING_QUERIES.map((query) => ({ kind: "linkedin", query })),
    );
    expect(indeedMessages).toEqual(
      REMOTE_GAMING_QUERIES.map((query) => ({ kind: "indeed", query })),
    );
    expect(linkedinMessages).toHaveLength(REMOTE_GAMING_QUERIES.length);
    expect(indeedMessages).toHaveLength(REMOTE_GAMING_QUERIES.length);
    expect(env.DB.prepare).toHaveBeenCalledWith(
      expect.stringContaining("WHERE career_url IS NOT NULL"),
    );
    expect(stats).toEqual({ enqueuedCareer: 5 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
