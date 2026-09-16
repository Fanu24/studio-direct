export type ApplyDatabase = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(column?: string): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
};

export type ApplyInput = {
  tenantId: string;
  jobId: string;
  name: string;
  email: string;
  profileUrl: string;
  note: string;
  honeypot: string;
};

export type ApplyResult =
  | { ok: true; duplicate: boolean }
  | { ok: false; error: "invalid" | "missing_job" };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTTP_URL = /^https?:\/\/[^\s]+$/i;

function isUniqueConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /UNIQUE constraint failed: job_applications\.job_id, job_applications\.email/i.test(message);
}

export function safeNextPath(value: string, fallback = "/jobs"): string {
  const next = value.trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://") || /[\\\u0000-\u001f]/.test(next)) {
    return fallback;
  }
  return next;
}

function cleanText(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function parseApplyInput(raw: {
  tenantId: string;
  jobId: string;
  name: string;
  email: string;
  profileUrl: string;
  note: string;
  honeypot: string;
}): ApplyInput {
  return {
    tenantId: raw.tenantId.trim(),
    jobId: raw.jobId.trim(),
    name: cleanText(raw.name, 120),
    email: raw.email.trim().toLowerCase(),
    profileUrl: raw.profileUrl.trim(),
    note: raw.note.trim().slice(0, 4000),
    honeypot: raw.honeypot.trim(),
  };
}

export async function submitJobApplication(
  db: ApplyDatabase,
  raw: ApplyInput,
): Promise<ApplyResult> {
  if (raw.honeypot) return { ok: true, duplicate: false };

  if (!raw.tenantId || !raw.jobId || raw.name.length < 2 || !EMAIL.test(raw.email)) {
    return { ok: false, error: "invalid" };
  }
  if (raw.profileUrl && !HTTP_URL.test(raw.profileUrl)) {
    return { ok: false, error: "invalid" };
  }

  const job = await db
    .prepare(
      `SELECT j.id
       FROM jobs j JOIN employer_listings l ON l.job_id=j.id
       WHERE j.id = ? AND j.tenant_id = ? AND j.listed = 1
         AND l.apply_mode='internal' AND l.closed_at IS NULL AND julianday(l.expires_at)>julianday('now')`,
    )
    .bind(raw.jobId, raw.tenantId)
    .first<{ id: string }>();
  if (!job) return { ok: false, error: "missing_job" };

  try {
    await db
      .prepare(
        `INSERT INTO job_applications (
          id, tenant_id, job_id, name, email, profile_url, note, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        raw.tenantId,
        raw.jobId,
        raw.name,
        raw.email,
        raw.profileUrl || null,
        raw.note || null,
        new Date().toISOString(),
      )
      .run();
    return { ok: true, duplicate: false };
  } catch (error) {
    if (isUniqueConflict(error)) return { ok: true, duplicate: true };
    throw error;
  }
}
