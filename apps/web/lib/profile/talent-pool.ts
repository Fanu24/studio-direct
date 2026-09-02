export function defaultTalentPoolOptIn(): 0 {
  return 0;
}

export const TALENT_POOL_CONSENT_KIND = "talent_pool";

export type TalentPoolOptIn = 0 | 1;

export interface TalentPoolDatabase {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(column?: string): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
}

export function asTalentPoolOptIn(value: unknown): TalentPoolOptIn {
  return value === 1 || value === "1" ? 1 : defaultTalentPoolOptIn();
}

export function parseTalentPoolOptIn(form: FormData): TalentPoolOptIn {
  return asTalentPoolOptIn(form.get("talent_pool_opt_in"));
}

export async function loadTalentPoolOptIn(
  db: TalentPoolDatabase,
  userId: string,
): Promise<TalentPoolOptIn> {
  const row = await db
    .prepare(
      `SELECT talent_pool_opt_in
       FROM profiles
       WHERE user_id = ?`,
    )
    .bind(userId)
    .first<{ talent_pool_opt_in: number | string | null }>();

  return asTalentPoolOptIn(row?.talent_pool_opt_in);
}

export async function setTalentPoolOptIn(
  db: TalentPoolDatabase,
  userId: string,
  optedIn: TalentPoolOptIn,
  now = new Date(),
): Promise<{ changed: boolean; value: TalentPoolOptIn }> {
  const value = asTalentPoolOptIn(optedIn);
  const current = await loadTalentPoolOptIn(db, userId);
  if (current === value) {
    return { changed: false, value };
  }

  const at = now.toISOString();
  await db
    .prepare(
      `INSERT INTO profiles (
         user_id, completeness, talent_pool_opt_in, talent_pool_opt_in_at, talent_pool_opt_out_at
       ) VALUES (?, 0, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         talent_pool_opt_in = excluded.talent_pool_opt_in,
         talent_pool_opt_in_at = CASE
           WHEN excluded.talent_pool_opt_in = 1 THEN excluded.talent_pool_opt_in_at
           ELSE talent_pool_opt_in_at
         END,
         talent_pool_opt_out_at = CASE
           WHEN excluded.talent_pool_opt_in = 0 THEN excluded.talent_pool_opt_out_at
           ELSE talent_pool_opt_out_at
         END`,
    )
    .bind(
      userId,
      value,
      value === 1 ? at : null,
      value === 0 ? at : null,
    )
    .run();

  await db
    .prepare(
      `INSERT INTO consent_events (id, user_id, kind, value, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      userId,
      TALENT_POOL_CONSENT_KIND,
      String(value),
      at,
    )
    .run();

  return { changed: true, value };
}
