import { isJobTag } from "@gaming/shared";

export const COMPLETENESS_NUDGE_THRESHOLD = 80;
export const CV_COMPLETENESS_POINTS = 20;

export type CompletenessInput = {
  displayName?: string | null;
  targetRole?: string | null;
  location?: string | null;
  remotePref?: string | null;
  experienceCount: number;
  skillCount: number;
  cvUploaded?: boolean;
};

export type ExperienceEntry = {
  id: string;
  company: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
};

export type ProfileDetails = {
  display_name: string | null;
  target_role: string | null;
  location: string | null;
  remote_pref: string | null;
  cv_r2_key: string | null;
};

export interface CompletenessDatabase {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(column?: string): Promise<T | null>;
      all?<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
      run?(): Promise<unknown>;
    };
  };
}

function isFilled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function scoreCompleteness(input: CompletenessInput): number {
  let score = 0;
  if (isFilled(input.displayName) && isFilled(input.targetRole)) score += 20;
  if (isFilled(input.location) && isFilled(input.remotePref)) score += 20;
  if (input.experienceCount >= 1) score += 20;
  if (input.skillCount >= 3) score += 20;
  if (input.cvUploaded) score += CV_COMPLETENESS_POINTS;
  return score;
}

export function shouldShowCompletenessNudge(completeness: number): boolean {
  return completeness < COMPLETENESS_NUDGE_THRESHOLD;
}

type ProfileCompletenessRow = {
  display_name?: string | null;
  target_role?: string | null;
  location?: string | null;
  remote_pref?: string | null;
  cv_r2_key?: string | null;
};

export async function loadProfileCompleteness(
  db: CompletenessDatabase,
  userId: string,
): Promise<number> {
  const profile = await db
    .prepare(
      `SELECT display_name, target_role, location, remote_pref, cv_r2_key
       FROM profiles
       WHERE user_id = ?`,
    )
    .bind(userId)
    .first<ProfileCompletenessRow>();

  const experience = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM experience_entries
       WHERE user_id = ?`,
    )
    .bind(userId)
    .first<{ count: number }>();

  const skills = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM profile_skills
       WHERE user_id = ?`,
    )
    .bind(userId)
    .first<{ count: number }>();

  return scoreCompleteness({
    displayName: profile?.display_name,
    targetRole: profile?.target_role,
    location: profile?.location,
    remotePref: profile?.remote_pref,
    experienceCount: Number(experience?.count ?? 0),
    skillCount: Number(skills?.count ?? 0),
    cvUploaded: isFilled(profile?.cv_r2_key),
  });
}

export async function loadProfileDetails(
  db: CompletenessDatabase,
  userId: string,
): Promise<ProfileDetails | null> {
  const row = await db
    .prepare(
      `SELECT display_name, target_role, location, remote_pref, cv_r2_key
       FROM profiles
       WHERE user_id = ?`,
    )
    .bind(userId)
    .first<ProfileDetails>();

  return row ?? null;
}

export async function listExperienceEntries(
  db: CompletenessDatabase,
  userId: string,
): Promise<ExperienceEntry[]> {
  const result = await db
    .prepare(
      `SELECT id, company, title, start_date, end_date, description
       FROM experience_entries
       WHERE user_id = ?
       ORDER BY start_date DESC, company`,
    )
    .bind(userId)
    .all?.<ExperienceEntry>();

  return result?.results ?? [];
}

export async function listProfileSkills(
  db: CompletenessDatabase,
  userId: string,
): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT skill
       FROM profile_skills
       WHERE user_id = ?
       ORDER BY skill`,
    )
    .bind(userId)
    .all?.<{ skill: string }>();

  return (result?.results ?? []).map((row) => row.skill);
}

export async function persistCompleteness(
  db: CompletenessDatabase,
  userId: string,
): Promise<number> {
  const completeness = await loadProfileCompleteness(db, userId);
  await db
    .prepare(
      `UPDATE profiles
       SET completeness = ?
       WHERE user_id = ?`,
    )
    .bind(completeness, userId)
    .run?.();
  return completeness;
}

export async function addExperienceEntry(
  db: CompletenessDatabase,
  userId: string,
  entry: {
    company: string;
    title: string;
    startDate?: string | null;
    endDate?: string | null;
    description?: string | null;
  },
): Promise<void> {
  const company = entry.company.trim();
  const title = entry.title.trim();
  if (!company || !title) return;

  await db
    .prepare(
      `INSERT INTO experience_entries (
         id, user_id, company, title, start_date, end_date, description
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      userId,
      company,
      title,
      entry.startDate?.trim() || null,
      entry.endDate?.trim() || null,
      entry.description?.trim() || null,
    )
    .run?.();

  await persistCompleteness(db, userId);
}

export async function saveProfileSkills(
  db: CompletenessDatabase,
  userId: string,
  skills: string[],
): Promise<void> {
  const allowed = [...new Set(skills.filter(isJobTag))];

  await db
    .prepare(`DELETE FROM profile_skills WHERE user_id = ?`)
    .bind(userId)
    .run?.();

  for (const skill of allowed) {
    await db
      .prepare(`INSERT INTO profile_skills (user_id, skill) VALUES (?, ?)`)
      .bind(userId, skill)
      .run?.();
  }

  await persistCompleteness(db, userId);
}

export async function saveWorkPreferences(
  db: CompletenessDatabase,
  userId: string,
  prefs: {
    location: string;
    remotePref: string;
  },
): Promise<void> {
  const location = prefs.location.trim();
  const remotePref = prefs.remotePref.trim();

  await db
    .prepare(
      `INSERT INTO profiles (
         user_id, location, remote_pref, completeness, talent_pool_opt_in
       ) VALUES (?, ?, ?, 0, 0)
       ON CONFLICT(user_id) DO UPDATE SET
         location = excluded.location,
         remote_pref = excluded.remote_pref`,
    )
    .bind(userId, location || null, remotePref || null)
    .run?.();

  await persistCompleteness(db, userId);
}
