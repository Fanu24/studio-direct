const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export function turnstileTokenFromRequest(request: Request): string | undefined {
  const headerToken = request.headers.get("x-captcha-response")?.trim();
  if (headerToken) return headerToken;

  const formToken = request.headers.get("cf-turnstile-response")?.trim();
  return formToken || undefined;
}

export async function verifyTurnstile({
  token,
  secretKey,
  fetch: fetchImpl = fetch,
  remoteip,
}: {
  token: string | null | undefined;
  secretKey: string;
  fetch?: typeof fetch;
  remoteip?: string;
}): Promise<TurnstileResult> {
  if (!token?.trim()) {
    return {
      ok: false,
      status: 400,
      error: "Turnstile token is required",
    };
  }

  const body = new URLSearchParams({
    secret: secretKey,
    response: token.trim(),
  });
  if (remoteip) body.set("remoteip", remoteip);

  const response = await fetchImpl(SITEVERIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    return {
      ok: false,
      status: 400,
      error: "Turnstile verification failed",
    };
  }

  const payload = (await response.json()) as { success?: boolean };
  if (!payload.success) {
    return {
      ok: false,
      status: 400,
      error: "Turnstile verification failed",
    };
  }

  return { ok: true };
}

export function isEmailAuthPath(pathname: string): boolean {
  return ['/sign-in/magic-link','/sign-in/email','/sign-up/email','/request-password-reset','/send-verification-email'].some(path=>pathname.endsWith(path));
}
