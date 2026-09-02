export type DigestRecipientRow = {
  email: string | null;
  stripe_status: string | null;
  period_end: string | null;
};

export type DigestRecipient = {
  email: string;
};

export type DigestJob = {
  title: string;
  companyName: string;
  slug: string;
  location: string | null;
  remote: string;
};

export type DigestEmail = {
  subject: string;
  text: string;
  html: string;
};

const EMPTY_HIDDEN_COPY =
  "No confirmed hidden jobs are available right now.";

const INDEX_DISCLAIMER =
  "We did not find these roles on LinkedIn in our last successful index. This is not a real-time LinkedIn check, and we do not claim complete coverage.";

export function isDigestRecipient(
  row: DigestRecipientRow,
  now: Date,
): boolean {
  const email = row.email?.trim();
  if (!email) return false;
  if (row.stripe_status !== "active") return false;
  if (!row.period_end) return false;
  return Date.parse(row.period_end) > now.getTime();
}

export function filterDigestRecipients(
  rows: readonly DigestRecipientRow[],
  now: Date,
): DigestRecipient[] {
  return rows.flatMap((row) => {
    if (!isDigestRecipient(row, now)) return [];
    return [{ email: row.email!.trim() }];
  });
}

function jobUrl(slug: string, siteUrl?: string): string | null {
  const origin = siteUrl?.trim().replace(/\/$/, "");
  if (!origin) return null;
  return `${origin}/jobs/${slug}`;
}

function formatJobLine(job: DigestJob, siteUrl?: string): string {
  const url = jobUrl(job.slug, siteUrl);
  const location = job.location ? ` · ${job.location}` : "";
  const line = `${job.title} at ${job.companyName} (${job.remote}${location})`;
  return url ? `${line} — ${url}` : line;
}

function formatJobHtml(job: DigestJob, siteUrl?: string): string {
  const url = jobUrl(job.slug, siteUrl);
  const location = job.location ? ` · ${job.location}` : "";
  const label = `${escapeHtml(job.title)} at ${escapeHtml(job.companyName)} (${escapeHtml(job.remote)}${escapeHtml(location)})`;
  if (!url) return `<li>${label}</li>`;
  return `<li><a href="${escapeHtml(url)}">${label}</a></li>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildDigestEmail({
  jobs,
  siteUrl,
}: {
  jobs: readonly DigestJob[];
  siteUrl?: string;
}): DigestEmail {
  const subject = "Studio Direct: latest jobs not on LinkedIn";

  if (jobs.length === 0) {
    const text = `${EMPTY_HIDDEN_COPY}\n\n${INDEX_DISCLAIMER}`;
    const html = `<p>${EMPTY_HIDDEN_COPY}</p><p>${INDEX_DISCLAIMER}</p>`;
    return { subject, text, html };
  }

  const intro =
    "Latest jobs we did not find on LinkedIn in our last successful index:";
  const text = [
    intro,
    "",
    ...jobs.map((job) => `- ${formatJobLine(job, siteUrl)}`),
    "",
    INDEX_DISCLAIMER,
  ].join("\n");
  const html = [
    `<p>${intro}</p>`,
    `<ul>${jobs.map((job) => formatJobHtml(job, siteUrl)).join("")}</ul>`,
    `<p>${INDEX_DISCLAIMER}</p>`,
  ].join("");

  return { subject, text, html };
}
