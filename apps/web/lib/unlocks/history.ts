import { isPaidSubscription } from "./quota";
import { isoWeekId } from "./week";

export const RECENT_UNLOCKS_LIMIT = 5;
const MAX_RECENT_UNLOCKS = 50;

export interface UnlockHistoryDatabase {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(column?: string): Promise<T | null>;
      all?<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
    };
  };
}

export type RecentUnlock = {
  jobId: string;
  slug: string;
  title: string;
  companyName: string;
  unlockedAt: string;
};

export type SubscriptionStatus = {
  paid: boolean;
  periodEnd: string | null;
};

export async function countUnlocksThisWeek(
  db: UnlockHistoryDatabase,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM unlocks
       WHERE user_id = ? AND week_id = ?`,
    )
    .bind(userId, isoWeekId(now))
    .first<{ count: number }>();

  return Number(row?.count ?? 0);
}

export async function listRecentUnlocks(
  db: UnlockHistoryDatabase,
  userId: string,
  limit: number = RECENT_UNLOCKS_LIMIT,
): Promise<RecentUnlock[]> {
  const size = Math.min(
    MAX_RECENT_UNLOCKS,
    Math.max(1, Math.floor(Number.isFinite(limit) ? limit : RECENT_UNLOCKS_LIMIT)),
  );

  const result = await db
    .prepare(
      `SELECT
         u.job_id AS jobId,
         j.slug,
         j.title,
         c.name AS companyName,
         MAX(u.created_at) AS unlockedAt
       FROM unlocks u
       JOIN jobs j ON j.id = u.job_id
       JOIN companies c ON c.id = j.company_id
       WHERE u.user_id = ?
       GROUP BY u.job_id, j.slug, j.title, c.name
       ORDER BY unlockedAt DESC, j.title ASC
       LIMIT ?`,
    )
    .bind(userId, size)
    .all?.<RecentUnlock>();

  return result?.results ?? [];
}

export async function loadSubscriptionStatus(
  db: UnlockHistoryDatabase,
  userId: string,
  now: Date = new Date(),
): Promise<SubscriptionStatus> {
  const subscription = await db
    .prepare(
      `SELECT stripe_status, period_end
       FROM subscriptions
       WHERE user_id = ?`,
    )
    .bind(userId)
    .first<{ stripe_status: string | null; period_end: string | null }>();

  const paid = isPaidSubscription(subscription, now);
  return {
    paid,
    periodEnd: paid ? (subscription?.period_end ?? null) : null,
  };
}
