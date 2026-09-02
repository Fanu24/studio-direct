export type AccountDeleteDatabase = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(column?: string): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
};

export type AccountFiles = {
  delete(key: string): Promise<unknown>;
};

const SQL_DELETE_ORDER = [
  "experience_entries",
  "profile_skills",
  "unlocks",
  "consent_events",
  "subscriptions",
  "profiles",
  "session",
  "account",
] as const;

export async function deleteAccount(input: {
  userId: string;
  db: AccountDeleteDatabase;
  files: AccountFiles;
}): Promise<void> {
  const key = await input.db
    .prepare(`SELECT cv_r2_key FROM profiles WHERE user_id = ?`)
    .bind(input.userId)
    .first<string>("cv_r2_key");

  if (typeof key === "string" && key.trim().length > 0) {
    await input.files.delete(key);
  }

  for (const table of SQL_DELETE_ORDER) {
    await input.db
      .prepare(`DELETE FROM ${table} WHERE user_id = ?`)
      .bind(input.userId)
      .run();
  }

  await input.db
    .prepare(`DELETE FROM users WHERE id = ?`)
    .bind(input.userId)
    .run();
}
