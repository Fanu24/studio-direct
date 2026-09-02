import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createAuth, type AuthEnv } from "../../../../lib/auth/index";
import {
  isEmailAuthPath,
  turnstileTokenFromRequest,
  verifyTurnstile,
} from "../../../../lib/auth/turnstile";

async function authEnv(): Promise<AuthEnv & { TURNSTILE_SECRET_KEY: string }> {
  const { env } = await getCloudflareContext({ async: true });
  return env as AuthEnv & { TURNSTILE_SECRET_KEY: string };
}

export async function GET(request: Request) {
  const env = await authEnv();
  return createAuth(env).handler(request);
}

export async function POST(request: Request) {
  const env = await authEnv();
  const pathname = new URL(request.url).pathname;

  if (isEmailAuthPath(pathname)) {
    const result = await verifyTurnstile({
      token: turnstileTokenFromRequest(request),
      secretKey: env.TURNSTILE_SECRET_KEY,
    });
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
  }

  return createAuth(env).handler(request);
}
