import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createAuth, type AuthEnv } from "../../../lib/auth/index";
import {
  loadProfileCompleteness,
  type CompletenessDatabase,
} from "../../../lib/profile/completeness";
import {
  loadOnboardingProfile,
  type ProfileQueryDatabase,
  unlockGateResponse,
} from "../../../lib/profile/gate";
import {
  unlockJob,
  type UnlockDatabase,
} from "../../../lib/unlocks/quota";

type UnlockRouteDatabase = ProfileQueryDatabase & UnlockDatabase & CompletenessDatabase;

async function unlockEnv(): Promise<AuthEnv & { DB: UnlockRouteDatabase }> {
  const { env } = await getCloudflareContext({ async: true });
  return env as AuthEnv & { DB: UnlockRouteDatabase };
}

export async function POST(request: Request) {
  const env = await unlockEnv();
  const session = await createAuth(env).api.getSession({
    headers: request.headers,
  });
  const form = await request.formData();
  const next = String(form.get("next") ?? "");
  const jobId = String(form.get("jobId") ?? "").trim();
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

  const unlocked = await unlockJob(env.DB, { userId: userId!, jobId });
  if (unlocked.status !== 200) return unlocked;

  const body = await unlocked.json() as { applyUrl?: string };
  if (typeof body.applyUrl !== "string" || body.applyUrl.length === 0) {
    return Response.json({ code: "error" }, { status: 500 });
  }

  const completeness = await loadProfileCompleteness(env.DB, userId!);
  return Response.json({ applyUrl: body.applyUrl, completeness });
}
