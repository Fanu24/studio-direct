"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createAuth, type AuthEnv } from "../../lib/auth/index";
import {
  addExperienceEntry,
  saveProfileSkills,
  saveWorkPreferences,
  type CompletenessDatabase,
} from "../../lib/profile/completeness";

type ProfileEnv = AuthEnv & {
  DB: CompletenessDatabase;
};

async function profileEnv(): Promise<ProfileEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as ProfileEnv;
}

async function sessionUserId(env: ProfileEnv): Promise<string | null> {
  const session = await createAuth(env).api.getSession({
    headers: await headers(),
  });
  return session?.user?.id ?? null;
}

export async function submitWorkPreferences(formData: FormData) {
  const env = await profileEnv();
  const userId = await sessionUserId(env);
  if (!userId) redirect("/login");

  await saveWorkPreferences(env.DB, userId, {
    location: String(formData.get("location") ?? ""),
    remotePref: String(formData.get("remote_pref") ?? ""),
  });
  redirect("/profile");
}

export async function submitExperience(formData: FormData) {
  const env = await profileEnv();
  const userId = await sessionUserId(env);
  if (!userId) redirect("/login");

  await addExperienceEntry(env.DB, userId, {
    company: String(formData.get("company") ?? ""),
    title: String(formData.get("title") ?? ""),
    startDate: String(formData.get("start_date") ?? ""),
    endDate: String(formData.get("end_date") ?? ""),
    description: String(formData.get("description") ?? ""),
  });
  redirect("/profile");
}

export async function submitSkills(formData: FormData) {
  const env = await profileEnv();
  const userId = await sessionUserId(env);
  if (!userId) redirect("/login");

  await saveProfileSkills(
    env.DB,
    userId,
    formData.getAll("skill").map((value) => String(value)),
  );
  redirect("/profile");
}
