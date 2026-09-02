import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Finish your profile",
  description:
    "Add a display name, target role and remote preference to your Studio Direct account before you unlock an application link.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/onboarding" },
};

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
    <main className="acct-main acct-onboard">
      <div className="container container--content">
        <section aria-labelledby="onboarding-title" className="panel panel--lg acct-card">
          <div>
            <span className="kicker">One step before you unlock</span>
            <h1 id="onboarding-title">Finish your profile</h1>
            <p>
              Add your display name, target role, and remote preference before you
              unlock an application link. Experience, skills and a CV can wait until
              later.
            </p>
          </div>
          <form action={submitOnboarding} className="acct-form">
            <input name="next" type="hidden" value={next} />
            <label htmlFor="onboarding-display-name">
              <span>Display name</span>
              <input
                autoComplete="name"
                id="onboarding-display-name"
                name="display_name"
                required
                type="text"
              />
            </label>
            <label htmlFor="onboarding-target-role">
              <span>Target role</span>
              <input
                id="onboarding-target-role"
                name="target_role"
                placeholder="Gameplay programmer, technical artist, producer"
                required
                type="text"
              />
            </label>
            <label htmlFor="onboarding-remote-pref">
              <span>Remote preference</span>
              <select id="onboarding-remote-pref" name="remote_pref" required>
                <option value="">Select a preference</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </label>
            <button className="button button--block" type="submit">
              Continue
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
