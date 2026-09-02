import { describe, expect, it } from "vitest";
import { acquireFetchHostLock } from "./kv-lock";

function memoryKv(): KVNamespace {
  const store = new Map<string, string>();

  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
  } as unknown as KVNamespace;
}

describe("acquireFetchHostLock", () => {
  it("does not acquire the same host twice within 2 seconds", async () => {
    const env = { LOCKS: memoryKv() };

    const first = await acquireFetchHostLock(env, "jobs.example.com", 1_000);
    const second = await acquireFetchHostLock(env, "jobs.example.com", 2_999);

    expect(first.acquired).toBe(true);
    expect(second.acquired).toBe(false);
    expect(second.retryAfterMs).toBe(1);
  });
});
