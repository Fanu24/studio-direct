import type { JobDraft } from "./jobs.ts";
import { jobSeoSlug } from "./normalize.ts";
import { formatSalaryRange, parseSalaryBounds, type SalaryBounds } from "./salary.ts";
import { slugifyTag } from "./taxonomy.ts";

export type Web3CareerApiJob = {
  id?: unknown;
  title?: unknown;
  company?: unknown;
  location?: unknown;
  remote?: unknown;
  is_remote?: unknown;
  salary?: unknown;
  salary_min_value?: unknown;
  salary_max_value?: unknown;
  salary_currency?: unknown;
  salary_unit?: unknown;
  tags?: unknown;
  apply_url?: unknown;
  applyUrl?: unknown;
  description?: unknown;
  published_at?: unknown;
  date?: unknown;
  date_epoch?: unknown;
};

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * Plain-text fields arrive HTML-escaped from the API: a title reads
 * "Digital Assets &amp; Tokenization". Stored as-is, React escapes it a second time when
 * rendering it as text and the reader sees the literal "&amp;" on the page. 44 job titles
 * and 4 company names were affected.
 *
 * Only for fields that are text. `description` is real HTML and must not be decoded.
 */
export function decodeHtmlText(value: string | null): string | null {
  if (!value) return value;
  return value
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

function asTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const tags: string[] = [];
  for (const item of value) {
    const raw = asString(item);
    if (!raw) continue;
    const slug = slugifyTag(raw);
    if (slug) tags.push(slug);
  }
  return tags;
}

export function web3CareerCanonicalKey(externalId: string): string {
  return `web3_career:${externalId}`;
}

/**
 * A single comparable ISO timestamp for when a listing was posted.
 *
 * The API sends `date` as an RFC 1123 string ("Sat, 29 Aug 2026 09:35:17 +0100"), which
 * used to be stored verbatim. Because a few rows carry ISO instead, the column ended up
 * holding two shapes, and SQLite compares them as text: every "Fri, ..." sorts above every
 * "2026-...". That silently broke date ordering, the 30-day windows behind the new-jobs
 * counts, and the company growth leaderboard. `date_epoch` is preferred when present
 * because it needs no parsing at all.
 */
export function web3CareerPostedAt(raw: Web3CareerApiJob): string | null {
  const epoch = asString(raw.date_epoch);
  if (epoch) {
    const seconds = Number.parseInt(epoch, 10);
    if (Number.isFinite(seconds) && seconds > 0) {
      return new Date(seconds * 1000).toISOString();
    }
  }

  for (const candidate of [asString(raw.published_at), asString(raw.date)]) {
    if (!candidate) continue;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function asAmount(value: unknown): number | null {
  const raw = asString(value);
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * Salary bounds the employer stated, from the API's `salary_min_value` /
 * `salary_max_value` pair. Returns null unless BOTH bounds are present and the pair is a
 * yearly USD figure: we store one comparable number and never convert a currency or
 * annualise an hourly rate, so a row that survives here is safe to average in a rollup.
 *
 * The payload also carries `estimated_min_salary` / `estimated_max_salary` /
 * `estimated_avg_salary`, which are the upstream provider's own guesses for listings that
 * state no pay. Those are deliberately NOT read: they are someone else's derived figures,
 * and republishing them as our salary data would be both a data-provenance problem and a
 * claim we cannot stand behind.
 */
export function web3CareerStatedSalary(raw: Web3CareerApiJob): SalaryBounds | null {
  const min = asAmount(raw.salary_min_value);
  const max = asAmount(raw.salary_max_value);
  if (min == null || max == null) return null;

  const currency = asString(raw.salary_currency)?.toUpperCase();
  if (currency && currency !== "USD") return null;

  const unit = asString(raw.salary_unit)?.toUpperCase();
  if (unit && unit !== "YEAR" && unit !== "YEARLY" && unit !== "ANNUAL") return null;

  return min <= max ? { min, max } : { min: max, max: min };
}

export function mapWeb3CareerApiJob(raw: Web3CareerApiJob): JobDraft | null {
  const title = decodeHtmlText(asString(raw.title));
  const companyName = decodeHtmlText(asString(raw.company));
  const applyUrl = asString(raw.apply_url) ?? asString(raw.applyUrl);
  const externalId = asString(raw.id);
  if (!title || !companyName || !applyUrl || !externalId) return null;

  const location = decodeHtmlText(asString(raw.location));
  // The live API sends `is_remote`; `remote` only ever appeared in our own fixtures.
  const remoteRaw = raw.is_remote ?? raw.remote;
  const remoteFlag = remoteRaw === true || remoteRaw === "true" || remoteRaw === 1;
  // Prefer the structured pair the API actually sends. `salary` is a free-text field that
  // the live payload does not carry at all, so it is only a fallback for fixtures and for
  // any future source that supplies a string.
  const stated = web3CareerStatedSalary(raw);
  const salaryFallbackText = asString(raw.salary);
  const bounds = stated ?? parseSalaryBounds(salaryFallbackText);
  const salaryText =
    salaryFallbackText ?? (bounds ? formatSalaryRange(bounds.min, bounds.max) : null);
  const tags = asTags(raw.tags);
  const postedAt = web3CareerPostedAt(raw);
  const description = asString(raw.description) ?? "";

  return {
    source: "web3_career_api",
    sourceUrl: applyUrl,
    companyName,
    title,
    location,
    remote: remoteFlag || /remote/i.test(location ?? "") ? "remote" : "unknown",
    descriptionHtml: description.includes("<") ? description : `<p>${description}</p>`,
    applyUrl,
    postedAt,
    rawJson: JSON.stringify(raw),
    externalId,
    tags,
    salaryMin: bounds?.min ?? null,
    salaryMax: bounds?.max ?? null,
    salaryText,
    keepApplyUrl: true,
  };
}

function extractJobRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    const nested = payload.find((item) => Array.isArray(item));
    if (Array.isArray(nested)) return nested;
    if (
      payload.length > 0
      && typeof payload[0] === "object"
      && payload[0] !== null
      && !Array.isArray(payload[0])
    ) {
      return payload;
    }
    return [];
  }

  if (
    payload
    && typeof payload === "object"
    && Array.isArray((payload as { jobs?: unknown }).jobs)
  ) {
    return (payload as { jobs: unknown[] }).jobs;
  }

  return [];
}

export function parseWeb3CareerApiPayload(payload: unknown): JobDraft[] {
  const drafts: JobDraft[] = [];
  for (const row of extractJobRows(payload)) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const draft = mapWeb3CareerApiJob(row as Web3CareerApiJob);
    if (draft) drafts.push(draft);
  }
  return drafts;
}

export function publicJobPath(title: string, companyName: string, externalId: string): string {
  return `/${jobSeoSlug(title, companyName)}/${encodeURIComponent(externalId)}`;
}
