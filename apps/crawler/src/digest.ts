import {
  buildDigestEmail,
  filterDigestRecipients,
  type DigestJob,
  type DigestRecipientRow,
} from "@gaming/shared";

const DEFAULT_FROM = "noreply@studio-direct.example";
const GAMING_TENANT_SLUG = "gaming";
const HIDDEN_DIGEST_LIMIT = 8;

export const HIDDEN_DIGEST_JOBS_SQL = `
SELECT
  j.title,
  c.name AS companyName,
  j.slug,
  j.location,
  j.remote
FROM jobs j
JOIN companies c ON c.id = j.company_id AND c.tenant_id = j.tenant_id
JOIN tenants t ON t.id = j.tenant_id
WHERE t.slug = ?
  AND j.listed = 1
  AND c.listed = 1
  AND j.remote IN ('remote', 'hybrid')
  AND j.exclusivity = 'hidden_from_linkedin'
ORDER BY j.posted_at DESC, j.id ASC
LIMIT ?
`;

export const PAID_DIGEST_RECIPIENTS_SQL = `
SELECT u.email, s.stripe_status, s.period_end
FROM subscriptions s
JOIN users u ON u.id = s.user_id
WHERE s.stripe_status = 'active'
  AND s.period_end > ?
`;

export type DigestDatabase = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
    };
  };
};

export type DigestEmailBinding = {
  send(message: {
    to: string;
    from: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<unknown>;
};

export type DigestEnv = {
  DB: DigestDatabase;
  EMAIL: DigestEmailBinding;
  EMAIL_FROM?: string;
  SITE_URL?: string;
};

export async function sendHiddenDigest(
  env: DigestEnv,
  now: Date = new Date(),
  log: Pick<Console, "error"> = console,
): Promise<{ sent: number }> {
  const jobs = await loadHiddenJobs(env.DB);
  const rows = await loadPaidRecipientRows(env.DB, now);
  const recipients = filterDigestRecipients(rows, now);
  const email = buildDigestEmail({
    jobs,
    siteUrl: env.SITE_URL,
  });
  const from = env.EMAIL_FROM?.trim() || DEFAULT_FROM;

  let sent = 0;
  for (const { email: to } of recipients) {
    try {
      await env.EMAIL.send({
        to,
        from,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
      sent += 1;
    } catch (error) {
      log.error("Hidden digest email send failed", { email: to, error });
    }
  }

  return { sent };
}

async function loadHiddenJobs(db: DigestDatabase): Promise<DigestJob[]> {
  const { results } = await db
    .prepare(HIDDEN_DIGEST_JOBS_SQL)
    .bind(GAMING_TENANT_SLUG, HIDDEN_DIGEST_LIMIT)
    .all<DigestJob>();
  return results;
}

async function loadPaidRecipientRows(
  db: DigestDatabase,
  now: Date,
): Promise<DigestRecipientRow[]> {
  const { results } = await db
    .prepare(PAID_DIGEST_RECIPIENTS_SQL)
    .bind(now.toISOString())
    .all<DigestRecipientRow>();
  return results;
}
