import { isoWeekId } from "./week";

export const FREE_UNLOCKS_PER_WEEK = 5;

export type UnlockDatabase = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(column?: string): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
};

export function canUnlock({
  isPaid,
  existingUnlockSameJob,
  countThisWeek,
}: {
  isPaid: boolean;
  existingUnlockSameJob: boolean;
  countThisWeek: number;
}): boolean {
  if (isPaid || existingUnlockSameJob) return true;
  return countThisWeek < FREE_UNLOCKS_PER_WEEK;
}

export function isPaidSubscription(
  subscription:
    | { stripe_status?: string | null; period_end?: string | null }
    | null
    | undefined,
  now: Date,
): boolean {
  if (!subscription) return false;
  if (subscription.stripe_status !== "active") return false;
  if (!subscription.period_end) return false;
  return Date.parse(subscription.period_end) > now.getTime();
}

export async function unlockJob(
  db: UnlockDatabase,
  {
    userId,
    jobId,
    now = new Date(),
  }: {
    userId: string;
    jobId: string;
    now?: Date;
  },
): Promise<Response> {
  const weekId = isoWeekId(now);
  const job = await db
    .prepare(
      `SELECT apply_url
       FROM jobs
       WHERE id = ? AND listed = 1`,
    )
    .bind(jobId)
    .first<{ apply_url: string }>();

  if (!job?.apply_url) {
    return Response.json({ code: "not_found" }, { status: 404 });
  }

  const subscription = await db
    .prepare(
      `SELECT stripe_status, period_end
       FROM subscriptions
       WHERE user_id = ?`,
    )
    .bind(userId)
    .first<{ stripe_status: string | null; period_end: string | null }>();

  const existing = await db
    .prepare(
      `SELECT id
       FROM unlocks
       WHERE user_id = ? AND job_id = ? AND week_id = ?`,
    )
    .bind(userId, jobId, weekId)
    .first<{ id: string }>();

  const countRow = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM unlocks
       WHERE user_id = ? AND week_id = ?`,
    )
    .bind(userId, weekId)
    .first<{ count: number }>();

  const allowed = canUnlock({
    isPaid: isPaidSubscription(subscription, now),
    existingUnlockSameJob: Boolean(existing),
    countThisWeek: Number(countRow?.count ?? 0),
  });

  if (!allowed) {
    return Response.json({ code: "quota" }, { status: 402 });
  }

  if (!existing) {
    try {
      await db
        .prepare(
          `INSERT INTO unlocks (id, user_id, job_id, week_id, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), userId, jobId, weekId, now.toISOString())
        .run();
    } catch {
      // Unique (user_id, job_id, week_id): treat as a free repeat unlock.
    }
  }

  return Response.json({ applyUrl: job.apply_url });
}
