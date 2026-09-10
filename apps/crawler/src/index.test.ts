import type { QueueMessage } from "@gaming/shared";
import { describe, expect, it, vi } from "vitest";

import { routeQueueBatch, type QueueHandlers } from "./index";

type HandlerName = keyof QueueHandlers;

function createHandlers() {
  return {
    career: vi.fn(async () => ({ action: "ack" as const })),
    linkedin: vi.fn(async () => ({ action: "ack" as const })),
    indeed: vi.fn(async () => ({ action: "ack" as const })),
    web3Api: vi.fn(async () => ({ action: "ack" as const })),
  } satisfies QueueHandlers;
}

function createBatch(queue: string, body: QueueMessage) {
  const message = {
    body,
    ack: vi.fn(),
    retry: vi.fn(),
  };

  return {
    batch: {
      queue,
      messages: [message],
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    } as unknown as MessageBatch<unknown>,
    message,
  };
}

describe.each([
  ["crawl-career", "career", { kind: "career", companyId: "company-1" }],
  ["crawl-career", "web3Api", { kind: "web3_api", tag: "solidity" }],
  ["crawl-linkedin", "linkedin", { kind: "linkedin", query: "unity remote" }],
  ["crawl-indeed", "indeed", { kind: "indeed", query: "unreal remote" }],
] as const)(
  "routeQueueBatch for %s",
  (queue, expectedHandler, body) => {
    it("calls only the matching handler", async () => {
      const handlers = createHandlers();
      const { batch, message } = createBatch(queue, body);

      await routeQueueBatch(batch, {} as Env, handlers);

      for (const [name, handler] of Object.entries(handlers) as [
        HandlerName,
        QueueHandlers[HandlerName],
      ][]) {
        expect(handler).toHaveBeenCalledTimes(name === expectedHandler ? 1 : 0);
      }
      expect(handlers[expectedHandler]).toHaveBeenCalledWith(body, {});
      expect(message.ack).toHaveBeenCalledOnce();
      expect(message.retry).not.toHaveBeenCalled();
    });
  },
);
