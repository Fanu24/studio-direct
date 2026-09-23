import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createAuth, type AuthEnv } from "../../../../lib/auth/index";
import {loadProductFlags} from '../../../../lib/product/flags';
import {requireTenantId} from '../../../../lib/tenant';
import type {Database} from '../../../../lib/platform';
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
  if(['/sign-in/email','/sign-up/email','/request-password-reset'].some(p=>pathname.endsWith(p))&&!(await loadProductFlags(env.DB as Database,await requireTenantId(env.DB as Database))).PRODUCT_PROFILES_V2)return Response.json({message:'Email/password access is not enabled.'},{status:404});

  if (isEmailAuthPath(pathname)) {
    const result = await verifyTurnstile({
      token: turnstileTokenFromRequest(request),
      secretKey: env.TURNSTILE_SECRET_KEY,
    });
    if (!result.ok) {
      return Response.json({ code:"CHALLENGE_FAILED", message: result.error, error: result.error }, { status: result.status });
    }
  }

  return createAuth(env).handler(request);
}
