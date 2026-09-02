import { acquireHostLock } from "@gaming/shared";

export async function acquireFetchHostLock(
  env: { LOCKS: KVNamespace },
  hostname: string,
  nowMs: number,
): Promise<{ acquired: boolean; retryAfterMs?: number }> {
  return acquireHostLock(env.LOCKS, hostname, nowMs);
}
