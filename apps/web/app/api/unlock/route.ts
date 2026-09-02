import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createAuth, type AuthEnv } from "../../../lib/auth/index";
import {
  loadOnboardingProfile,
  type ProfileQueryDatabase,
  unlockGateResponse,
} from "../../../lib/profile/gate";

async function unlockEnv(): Promise<AuthEnv & { DB: ProfileQueryDatabase }> {
  const { env } = await getCloudflareContext({ async: true });
  return env as AuthEnv & { DB: ProfileQueryDatabase };
}

export async function POST(request: Request) {
  const env = await unlockEnv();
  const session = await createAuth(env).api.getSession({
    headers: request.headers,
  });
  const form = await request.formData();
  const next = String(form.get("next") ?? "");
  const userId = session?.user?.id ?? null;
  const profile = userId
    ? await loadOnboardingProfile(env.DB, userId)
    : null;

  const gated = unlockGateResponse({
    request,
    sessionUserId: userId,
    profile,
    next,
  });
  if (gated) return gated;

  // Task 33 owns UTC ISO-week quota (5/week) and apply URL reveal.
  // Continue to quota later. Do not invent Stripe. Do not return apply_url here.
  return Response.json({ code: "quota_pending" }, { status: 501 });
}
