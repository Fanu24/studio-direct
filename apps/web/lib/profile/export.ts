export type AccountExportDatabase = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(column?: string): Promise<T | null>;
      all?<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
    };
  };
};

export type AccountExport = {
  user: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  experience: Record<string, unknown>[];
  skills: string[];
  unlocks: Record<string, unknown>[];
  consent_events: Record<string, unknown>[];
  subscription: Record<string, unknown> | null;
  owned_records: Record<string, Record<string,unknown>[]>;
};

async function firstRow(
  db: AccountExportDatabase,
  query: string,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const row = await db.prepare(query).bind(userId).first<Record<string, unknown>>();
  return row ?? null;
}

async function allRows(
  db: AccountExportDatabase,
  query: string,
  userId: string,
): Promise<Record<string, unknown>[]> {
  const result = await db.prepare(query).bind(userId).all?.<Record<string, unknown>>();
  return result?.results ?? [];
}

export async function exportAccountData(
  db: AccountExportDatabase,
  userId: string,
): Promise<AccountExport> {
  const [user, profile, experience, skillRows, unlocks, consent_events, subscription] =
    await Promise.all([
      firstRow(db, `SELECT * FROM users WHERE id = ?`, userId),
      firstRow(db, `SELECT * FROM profiles WHERE user_id = ?`, userId),
      allRows(
        db,
        `SELECT * FROM experience_entries WHERE user_id = ? ORDER BY start_date DESC, company`,
        userId,
      ),
      allRows(
        db,
        `SELECT skill FROM profile_skills WHERE user_id = ? ORDER BY skill`,
        userId,
      ),
      allRows(
        db,
        `SELECT * FROM unlocks WHERE user_id = ? ORDER BY created_at`,
        userId,
      ),
      allRows(
        db,
        `SELECT * FROM consent_events WHERE user_id = ? ORDER BY created_at`,
        userId,
      ),
      firstRow(db, `SELECT * FROM subscriptions WHERE user_id = ?`, userId),
    ]);

  const owned_records:Record<string,Record<string,unknown>[]>={};
  for(const table of ['saved_jobs','job_alerts','employer_orders','bundle_credits','marketplace_orders','recruiter_accounts','support_requests']){
    const exists=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(table).first();
    if(exists)owned_records[table]=await allRows(db,`SELECT * FROM ${table} WHERE user_id=?`,userId);
  }
  return {
    owned_records,
    user,
    profile,
    experience,
    skills: skillRows.map((row) => String(row.skill)),
    unlocks,
    consent_events,
    subscription,
  };
}
