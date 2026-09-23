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
  for(const table of ['saved_jobs','job_alerts','employer_orders','bundle_credits','marketplace_orders','recruiter_accounts','employer_accounts','support_requests','job_applications','notification_outbox','candidate_skills','candidate_languages','candidate_links','notification_preferences','candidate_subscriptions','early_access_reminders','product_orders','company_reviews','candidate_verification_requests','company_members','newsletter_subscribers','support_tickets']){
    const exists=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(table).first();
    if(exists)owned_records[table]=await allRows(db,`SELECT * FROM ${table} WHERE user_id=?`,userId);
  }
  const shortlist=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind('recruiter_shortlist').first();
  if(shortlist)owned_records.recruiter_shortlist=await allRows(db,'SELECT * FROM recruiter_shortlist WHERE recruiter_id=?',userId);
  const keys=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind('jobs_api_keys').first();
  if(keys)owned_records.jobs_api_keys=await allRows(db,'SELECT id,prefix,website,created_at,revoked_at,last_used_at FROM jobs_api_keys WHERE user_id=?',userId);
  if(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind('product_invitations').first())owned_records.invitations=await allRows(db,'SELECT * FROM product_invitations WHERE candidate_id=?',userId);
  if(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind('profile_views').first())owned_records.profile_views=await allRows(db,'SELECT viewed_at FROM profile_views WHERE candidate_id=?',userId);
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
