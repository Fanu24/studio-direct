import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createAuth, type AuthEnv } from "../../lib/auth/index";
import { submitOnboarding } from "./actions";
import {
  loadOnboardingProfile,
  needsOnboarding,
  type ProfileQueryDatabase,
  type ProfileWriteDatabase,
  safeNextPath,
} from "../../lib/profile/gate";

export const dynamic = "force-dynamic";

type OnboardingEnv = AuthEnv & {
  DB: ProfileQueryDatabase & ProfileWriteDatabase;
};

async function onboardingEnv(): Promise<OnboardingEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as OnboardingEnv;
}

async function sessionUserId(env: OnboardingEnv): Promise<string | null> {
  const session = await createAuth(env).api.getSession({
    headers: await headers(),
  });
  return session?.user?.id ?? null;
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: nextParam } = await searchParams;
  const env = await onboardingEnv();
  const userId = await sessionUserId(env);
  const next = safeNextPath(nextParam) ?? "/";

  if (!userId) {
    redirect("/login");
  }

  const profile = await loadOnboardingProfile(env.DB, userId);
  if (!needsOnboarding(profile)) {
    redirect(next);
  }

  return (
    <main>
      <h1>Finish your profile</h1>
      <p>
        Add your display name, target role, and remote preference before you
        unlock an application link.
      </p>
      <form action={submitOnboarding}>
        <input name="next" type="hidden" value={next} />
        <label>
          Display name
          <input autoComplete="name" name="display_name" required type="text" />
        </label>
        <label>
          Target role
          <input name="target_role" required type="text" />
        </label>
        <label>
          Remote preference
          <select name="remote_pref" required>
            <option value="">Select a preference</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
          </select>
        </label>
        <button type="submit">Continue</button>
      </form>
    </main>
  );
}
