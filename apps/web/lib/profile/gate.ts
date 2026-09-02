export type OnboardingProfile = {
  display_name?: string | null;
  target_role?: string | null;
  remote_pref?: string | null;
};

function isFilled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function needsOnboarding(
  profile: OnboardingProfile | null | undefined,
): boolean {
  if (!profile) return true;

  return !isFilled(profile.display_name)
    || !isFilled(profile.target_role)
    || !isFilled(profile.remote_pref);
}

export function safeNextPath(next?: string | null): string | null {
  if (typeof next !== "string") return null;

  const path = next.trim();
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//") || path.startsWith("/\\")) return null;
  if (path.includes("://")) return null;

  return path;
}

export function onboardingLocation(next?: string | null): string {
  const path = safeNextPath(next);
  if (!path) return "/onboarding";
  return `/onboarding?next=${encodeURIComponent(path)}`;
}

export interface ProfileQueryDatabase {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(column?: string): Promise<T | null>;
    };
  };
}

export interface ProfileWriteDatabase {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
    };
  };
}

export async function loadOnboardingProfile(
  db: ProfileQueryDatabase,
  userId: string,
): Promise<OnboardingProfile | null> {
  const row = await db
    .prepare(
      `SELECT display_name, target_role, remote_pref
       FROM profiles
       WHERE user_id = ?`,
    )
    .bind(userId)
    .first<OnboardingProfile>();

  return row ?? null;
}

export async function saveOnboardingProfile(
  db: ProfileWriteDatabase,
  userId: string,
  profile: {
    display_name: string;
    target_role: string;
    remote_pref: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO profiles (
         user_id, display_name, target_role, remote_pref, completeness, talent_pool_opt_in
       ) VALUES (?, ?, ?, ?, 0, 0)
       ON CONFLICT(user_id) DO UPDATE SET
         display_name = excluded.display_name,
         target_role = excluded.target_role,
         remote_pref = excluded.remote_pref`,
    )
    .bind(
      userId,
      profile.display_name,
      profile.target_role,
      profile.remote_pref,
    )
    .run();
}

export function unlockGateResponse({
  request,
  sessionUserId,
  profile,
  next,
}: {
  request: Request;
  sessionUserId: string | null | undefined;
  profile: OnboardingProfile | null | undefined;
  next?: string | null;
  applyUrl?: string | null;
}): Response | null {
  const origin = new URL(request.url).origin;

  if (!sessionUserId) {
    return Response.redirect(new URL("/login", origin), 303);
  }

  if (needsOnboarding(profile)) {
    return Response.redirect(new URL(onboardingLocation(next), origin), 303);
  }

  return null;
}
