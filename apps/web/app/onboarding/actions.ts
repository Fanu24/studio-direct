"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createAuth, type AuthEnv } from "../../lib/auth/index";
import {
  needsOnboarding,
  type ProfileQueryDatabase,
  type ProfileWriteDatabase,
  safeNextPath,
  saveOnboardingProfile,
} from "../../lib/profile/gate";

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

export async function submitOnboarding(formData: FormData) {
  const env = await onboardingEnv();
  const userId = await sessionUserId(env);
  const next = safeNextPath(String(formData.get("next") ?? "")) ?? "/";

  if (!userId) {
    redirect("/login");
  }

  const profile = {
    display_name: String(formData.get("display_name") ?? "").trim(),
    target_role: String(formData.get("target_role") ?? "").trim(),
    remote_pref: String(formData.get("remote_pref") ?? "").trim(),
  };

  if (needsOnboarding(profile)) {
    redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  }

  await saveOnboardingProfile(env.DB, userId, profile);
  redirect(next);
}
