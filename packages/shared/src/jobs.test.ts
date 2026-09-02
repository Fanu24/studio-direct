import { describe, expect, it } from "vitest";
import { isQueueMessage } from "./jobs.ts";

describe("QueueMessage", () => {
  it("accepts kind career with companyId", () => {
    expect(isQueueMessage({ kind: "career", companyId: "c1" })).toBe(true);
  });

  it("rejects type instead of kind", () => {
    expect(isQueueMessage({ type: "career", companyId: "c1" })).toBe(false);
  });

  it("accepts linkedin and indeed query messages", () => {
    expect(isQueueMessage({ kind: "linkedin", query: "unity remote" })).toBe(true);
    expect(isQueueMessage({ kind: "indeed", query: "qa remote" })).toBe(true);
  });
});
