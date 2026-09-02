import { afterEach, describe, expect, it, vi } from "vitest";
import { enqueueCronWork } from "./cron";

type QueueMessage =
  | { kind: "career"; companyId: string }
  | { kind: "linkedin"; query: string }
  | { kind: "indeed"; query: string };

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

  it("enqueues five kind-based career messages and fixed board queries without HTTP", async () => {
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

    expect(careerMessages).toEqual(
      companyIds.map((companyId) => ({ kind: "career", companyId })),
    );
    expect(careerMessages).toHaveLength(5);
    expect(careerMessages.every((message) => !("type" in message))).toBe(true);
    expect(linkedinMessages).toEqual([
      { kind: "linkedin", query: "unity remote" },
      { kind: "linkedin", query: "unreal remote" },
    ]);
    expect(indeedMessages).toEqual([
      { kind: "indeed", query: "unity remote" },
      { kind: "indeed", query: "unreal remote" },
    ]);
    expect(stats).toEqual({ enqueuedCareer: 5 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
