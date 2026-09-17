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

export function parseRetryAfter(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const seconds = Number(value);
  if(Number.isFinite(seconds)&&seconds>=0)return seconds;
  const date=Date.parse(value);
  return Number.isFinite(date)?Math.max(0,Math.ceil((date-Date.now())/1000)):null;
}

export async function fetchPublicText(
  url: string,
  fetchImpl: typeof fetch,
  userAgent: string,
): Promise<{ status: number; body: string }> {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { "User-Agent": userAgent },
    signal: AbortSignal.timeout(20000),
  });

  if (response.status === 429 || response.status === 403) {
    throw new RateLimitedError(
      response.status,
      parseRetryAfter(response.headers.get("Retry-After")),
    );
  }

  const reader=response.body?.getReader(),decoder=new TextDecoder();let body='',bytes=0;
  if(reader)try {
    for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;
      if(bytes>10_000_000)throw new Error('Source response exceeds 10 MB');body+=decoder.decode(part.value,{stream:true});}
    body+=decoder.decode();
  }finally{await reader.cancel().catch(()=>{});}
  return {status:response.status,body};
}

export function retryDelaySeconds(error: unknown): number | null {
  return error instanceof RateLimitedError ? error.retryAfterSeconds : null;
}
