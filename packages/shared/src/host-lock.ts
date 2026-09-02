export type HostLockKv = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

export async function acquireHostLock(
  kv: HostLockKv,
  hostname: string,
  nowMs: number,
  minIntervalMs = 2000,
): Promise<{ acquired: boolean; retryAfterMs?: number }> {
  const key = `lock:host:${hostname}`;
  const raw = await kv.get(key);
  if (raw) {
    const lockedUntil = Number(raw);
    if (Number.isFinite(lockedUntil) && lockedUntil > nowMs) {
      return { acquired: false, retryAfterMs: lockedUntil - nowMs };
    }
  }

  const lockedUntil = nowMs + minIntervalMs;
  await kv.put(key, String(lockedUntil), {
    expirationTtl: Math.max(60, Math.ceil(minIntervalMs / 1000) + 1),
  });
  return { acquired: true };
}
