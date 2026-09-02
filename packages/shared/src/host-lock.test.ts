import { describe, expect, it } from "vitest";
import { acquireHostLock, type HostLockKv } from "./host-lock.ts";

function memoryKv(): HostLockKv & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value) {
      store.set(key, value);
    },
  };
}

describe("acquireHostLock", () => {
  it("allows the first acquire and rejects a second within 2s", async () => {
    const kv = memoryKv();
    const first = await acquireHostLock(kv, "jobs.example.com", 1_000);
    expect(first.acquired).toBe(true);

    const second = await acquireHostLock(kv, "jobs.example.com", 1_500);
    expect(second.acquired).toBe(false);
    expect(second.retryAfterMs).toBe(1_500);
  });
});
