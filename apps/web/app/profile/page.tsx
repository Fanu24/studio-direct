import { JOB_TAGS, tagLabel, TENANT_NAME } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AccountShell } from "../_components/account-shell";
import { CheckIcon, MinusIcon } from "../_components/icons";
import { createAuth, type AuthEnv } from "../../lib/auth/index";
import {
  submitExperience,
  submitSkills,
  submitWorkPreferences,
} from "./actions";
import {
  listExperienceEntries,
  listProfileSkills,
  loadProfileCompleteness,
  loadProfileDetails,
  type CompletenessDatabase,
  type ExperienceEntry,
} from "../../lib/profile/completeness";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your profile",
  description:
    `Your ${TENANT_NAME} profile: location and remote preference, experience, skills from the job hubs, and a PDF CV.`,
  robots: { index: false, follow: false },
  alternates: { canonical: "/profile" },
};

type ProfileEnv = AuthEnv & {
  DB: CompletenessDatabase;
};

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const MONTH_FORMAT = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

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

function isFilled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function formatMonth(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return Number.isNaN(date.getTime()) ? value : MONTH_FORMAT.format(date);
}

function experienceDates(entry: ExperienceEntry): string | null {
  const start = formatMonth(entry.start_date);
  const end = formatMonth(entry.end_date);
  if (start && end) return `${start} to ${end}`;
  if (start) return `Since ${start}`;
  if (end) return `Until ${end}`;
  return null;
}

export default async function ProfilePage() {
  const env = await profileEnv();
  const userId = await sessionUserId(env);

  if (!userId) {
    redirect("/login?next=/profile");
  }

  const [completeness, profile, experience, selectedSkills] = await Promise.all([
    loadProfileCompleteness(env.DB, userId),
    loadProfileDetails(env.DB, userId),
    listExperienceEntries(env.DB, userId),
    listProfileSkills(env.DB, userId),
  ]);
  const selected = new Set(selectedSkills);
  const ringValue = Math.min(100, Math.max(0, completeness));
  const checklist = [
    {
      label: "Display name and target role",
      done: isFilled(profile?.display_name) && isFilled(profile?.target_role),
    },
    {
      label: "Location and remote preference",
      done: isFilled(profile?.location) && isFilled(profile?.remote_pref),
    },
    { label: "One experience entry", done: experience.length >= 1 },
    { label: "Three skills", done: selected.size >= 3 },
    { label: "PDF CV", done: isFilled(profile?.cv_r2_key) },
  ];

  return (
    <AccountShell
      active="profile"
      lead="Your experience, skills and CV in one place."
      title="Your profile"
    >
      <section
        aria-labelledby="completeness-title"
        className="panel panel--lg panel--accent acct-completeness"
      >
        <div
          aria-label={`Profile ${completeness}% complete`}
          className="acct-ring"
          role="img"
        >
          <svg aria-hidden="true" focusable="false" viewBox="0 0 120 120">
            <circle className="acct-ring__track" cx="60" cy="60" r={RING_RADIUS} />
            <circle
              className="acct-ring__value"
              cx="60"
              cy="60"
              r={RING_RADIUS}
              strokeDasharray={`${(RING_CIRCUMFERENCE * ringValue) / 100} ${RING_CIRCUMFERENCE}`}
            />
          </svg>
          <span className="acct-ring__label">{completeness}%</span>
        </div>
        <div className="acct-completeness__copy">
          <h2 id="completeness-title">Profile completeness</h2>
          <p>Each item below adds 20 points. A PDF CV can be up to 5 MB.</p>
          <ul className="acct-checklist">
            {checklist.map((item) => (
              <li className={item.done ? "is-done" : undefined} key={item.label}>
                {item.done ? <CheckIcon size={16} /> : <MinusIcon size={16} />}
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="work-preferences" className="panel acct-panel">
        <div className="acct-panel__head">
          <h2 id="work-preferences">Location and remote preference</h2>
        </div>
        <form
          action={submitWorkPreferences}
          className="form-grid form-grid--2 acct-form"
        >
          <label htmlFor="profile-location">
            <span>Location</span>
            <input
              defaultValue={profile?.location ?? ""}
              id="profile-location"
              name="location"
              placeholder="City, country"
              type="text"
            />
          </label>
          <label htmlFor="profile-remote-pref">
            <span>Remote preference</span>
            <select
              defaultValue={profile?.remote_pref ?? ""}
              id="profile-remote-pref"
              name="remote_pref"
              required
            >
              <option value="">Select a preference</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
          </label>
          <div className="span-2 acct-actions">
            <button className="button" type="submit">
              Save location
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="experience" className="panel acct-panel">
        <div className="acct-panel__head">
          <h2 id="experience">Experience</h2>
          <p className="count">
            {experience.length} {experience.length === 1 ? "entry" : "entries"}
          </p>
        </div>
        {experience.length === 0 ? (
          <div className="empty">
            <p>No experience added yet. Start with your most recent role.</p>
          </div>
        ) : (
          <ul className="acct-rows">
            {experience.map((entry) => {
              const dates = experienceDates(entry);
              return (
                <li key={entry.id}>
                  <span className="acct-rows__title">{entry.title}</span>
                  <p className="acct-rows__meta">{entry.company}</p>
                  {dates ? <span className="acct-rows__time">{dates}</span> : null}
                </li>
              );
            })}
          </ul>
        )}
        <form action={submitExperience} className="form-grid form-grid--2 acct-form">
          <label htmlFor="experience-company">
            <span>Company</span>
            <input id="experience-company" name="company" required type="text" />
          </label>
          <label htmlFor="experience-title">
            <span>Title</span>
            <input id="experience-title" name="title" required type="text" />
          </label>
          <label htmlFor="experience-start">
            <span>Start date</span>
            <input id="experience-start" name="start_date" type="month" />
          </label>
          <label htmlFor="experience-end">
            <span>End date</span>
            <input id="experience-end" name="end_date" type="month" />
          </label>
          <label className="span-2" htmlFor="experience-description">
            <span>Description</span>
            <textarea id="experience-description" name="description" rows={3} />
          </label>
          <div className="span-2 acct-actions">
            <button className="button button--secondary" type="submit">
              Add experience
            </button>
            <p className="field__hint">Leave the end date empty for a current role.</p>
          </div>
        </form>
      </section>

      <section aria-labelledby="skills" className="panel acct-panel">
        <div className="acct-panel__head">
          <h2 id="skills">Skills</h2>
          <p className="count">{selected.size} selected</p>
        </div>
        <p>Pick at least three. These are the skills and roles used in the job search.</p>
        <form action={submitSkills} className="acct-form">
          <fieldset className="acct-fieldset">
            <legend className="visually-hidden">Skills</legend>
            <div className="acct-chips">
              {JOB_TAGS.map((slug) => (
                <label className="check acct-chip" key={slug}>
                  <input
                    defaultChecked={selected.has(slug)}
                    name="skill"
                    type="checkbox"
                    value={slug}
                  />
                  {tagLabel(slug)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="acct-actions">
            <button className="button" type="submit">
              Save skills
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="cv" className="panel acct-panel">
        <div className="acct-panel__head">
          <h2 id="cv">CV</h2>
          {profile?.cv_r2_key ? <span className="chip chip--on">Uploaded</span> : null}
        </div>
        <p>
          {profile?.cv_r2_key
            ? "Your CV is on file. Upload a new PDF to replace it (max 5 MB)."
            : "Upload a PDF CV (max 5 MB)."}
        </p>
        <form
          action="/api/profile/cv"
          className="acct-form acct-upload"
          encType="multipart/form-data"
          method="post"
        >
          <label htmlFor="profile-cv">
            <span>PDF file</span>
            <input accept="application/pdf" id="profile-cv" name="cv" required type="file" />
          </label>
          <button className="button button--secondary" type="submit">
            Upload CV
          </button>
        </form>
      </section>
    </AccountShell>
  );
}
