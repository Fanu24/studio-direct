import { HUB_ROLE_SLUGS, hubSlugLabel } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createAuth, type AuthEnv } from "../../lib/auth/index";
import {
  addExperienceEntry,
  listExperienceEntries,
  listProfileSkills,
  loadProfileCompleteness,
  loadProfileDetails,
  saveProfileSkills,
  saveWorkPreferences,
  type CompletenessDatabase,
} from "../../lib/profile/completeness";

export const dynamic = "force-dynamic";

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
  "use server";
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
  "use server";
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
  "use server";
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

export default async function ProfilePage() {
  const env = await profileEnv();
  const userId = await sessionUserId(env);

  if (!userId) {
    redirect("/login");
  }

  const [completeness, profile, experience, selectedSkills] = await Promise.all([
    loadProfileCompleteness(env.DB, userId),
    loadProfileDetails(env.DB, userId),
    listExperienceEntries(env.DB, userId),
    listProfileSkills(env.DB, userId),
  ]);
  const selected = new Set(selectedSkills);

  return (
    <main>
      <h1>Your profile</h1>
      <p>Profile completeness: {completeness}%</p>
      <p>
        Add experience, at least three skills, and a PDF CV (max 5 MB).
      </p>

      <section aria-labelledby="work-preferences">
        <h2 id="work-preferences">Location and remote preference</h2>
        <form action={submitWorkPreferences}>
          <label>
            Location
            <input
              defaultValue={profile?.location ?? ""}
              name="location"
              type="text"
            />
          </label>
          <label>
            Remote preference
            <select
              defaultValue={profile?.remote_pref ?? ""}
              name="remote_pref"
              required
            >
              <option value="">Select a preference</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
          </label>
          <button type="submit">Save location</button>
        </form>
      </section>

      <section aria-labelledby="experience">
        <h2 id="experience">Experience</h2>
        {experience.length === 0 ? (
          <p>No experience added yet.</p>
        ) : (
          <ul>
            {experience.map((entry) => (
              <li key={entry.id}>
                {entry.title} at {entry.company}
                {entry.start_date ? ` (${entry.start_date}` : ""}
                {entry.start_date && entry.end_date ? `–${entry.end_date}` : ""}
                {entry.start_date ? ")" : ""}
              </li>
            ))}
          </ul>
        )}
        <form action={submitExperience}>
          <label>
            Company
            <input name="company" required type="text" />
          </label>
          <label>
            Title
            <input name="title" required type="text" />
          </label>
          <label>
            Start date
            <input name="start_date" type="month" />
          </label>
          <label>
            End date
            <input name="end_date" type="month" />
          </label>
          <label>
            Description
            <textarea name="description" />
          </label>
          <button type="submit">Add experience</button>
        </form>
      </section>

      <section aria-labelledby="skills">
        <h2 id="skills">Skills</h2>
        <p>Choose at least three skills from the same dictionary as job hubs.</p>
        <form action={submitSkills}>
          {HUB_ROLE_SLUGS.map((slug) => (
            <label key={slug}>
              <input
                defaultChecked={selected.has(slug)}
                name="skill"
                type="checkbox"
                value={slug}
              />
              {hubSlugLabel(slug)}
            </label>
          ))}
          <button type="submit">Save skills</button>
        </form>
      </section>

      <section aria-labelledby="cv">
        <h2 id="cv">CV</h2>
        <p>
          {profile?.cv_r2_key
            ? "CV uploaded. You can replace it with a new PDF (max 5 MB)."
            : "Upload a PDF CV (max 5 MB)."}
        </p>
        <form
          action="/api/profile/cv"
          encType="multipart/form-data"
          method="post"
        >
          <label>
            CV
            <input accept="application/pdf" name="cv" required type="file" />
          </label>
          <button type="submit">Upload CV</button>
        </form>
      </section>
    </main>
  );
}
