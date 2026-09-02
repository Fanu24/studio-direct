export class RateLimitedError extends Error {
  readonly status: 429 | 403;
  readonly retryAfterSeconds: number | null;

  constructor(status: 429 | 403, retryAfterSeconds: number | null) {
    super(`Public request was rate limited with status ${status}`);
    this.name = "RateLimitedError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

export async function fetchPublicText(
  url: string,
  fetchImpl: typeof fetch,
  userAgent: string,
): Promise<{ status: number; body: string }> {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { "User-Agent": userAgent },
  });

  if (response.status === 429 || response.status === 403) {
    throw new RateLimitedError(
      response.status,
      parseRetryAfter(response.headers.get("Retry-After")),
    );
  }

  return {
    status: response.status,
    body: await response.text(),
  };
}

export function retryDelaySeconds(error: unknown): number | null {
  return error instanceof RateLimitedError ? error.retryAfterSeconds : null;
}
