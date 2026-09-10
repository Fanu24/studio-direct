import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { JOB_TAGS as SHARED_JOB_TAGS, decodeHtmlText } from "@gaming/shared";

const root = dirname(fileURLToPath(import.meta.url));
const crawlerRoot = join(root, "..");
const token = readFileSync(join(crawlerRoot, ".dev.vars"), "utf8")
  .split("\n")
  .map((line) => line.trim())
  .find((line) => line.startsWith("WEB3_CAREER_API_TOKEN="))
  ?.slice("WEB3_CAREER_API_TOKEN=".length)
  .trim();

if (!token) {
  throw new Error("WEB3_CAREER_API_TOKEN is missing from apps/crawler/.dev.vars");
}

const QUERIES = [
  { remote: true },
  { tag: "solidity" },
  { tag: "rust" },
  { tag: "solana" },
  { tag: "front-end" },
  { tag: "backend" },
  { tag: "defi" },
  { tag: "blockchain" },
  { tag: "marketing" },
  { tag: "intern" },
  { country: "united-states" },
  { country: "united-kingdom" },
  { country: "germany" },
  { country: "singapore" },
];

// The tag whitelist is the shared taxonomy, imported rather than copied. This file used
// to carry its own hardcoded Set of ~41 tags while packages/shared listed 404. Every tag
// outside the stale copy was silently dropped at import, so landings like /engineer-jobs
// (384 jobs in the payload) and /security-jobs (28) resolved 200 and listed nothing.
// Requires: node --experimental-strip-types
const JOB_TAGS = new Set(SHARED_JOB_TAGS);

const COUNTRY_ALIASES = [
  ["united-states", ["united states", "usa", "u.s.", "u.s.a", "america"]],
  ["united-kingdom", ["united kingdom", "uk", "england", "britain"]],
  ["germany", ["germany"]],
  ["france", ["france"]],
  ["canada", ["canada"]],
  ["singapore", ["singapore"]],
  ["australia", ["australia"]],
  ["india", ["india"]],
  ["netherlands", ["netherlands"]],
  ["portugal", ["portugal"]],
  ["spain", ["spain"]],
  ["switzerland", ["switzerland"]],
  ["united-arab-emirates", ["united arab emirates", "uae", "dubai"]],
];

const cacheDir = join(crawlerRoot, ".wrangler", "tmp");
const cachePath = join(cacheDir, "web3-jobs-cache.json");
const refresh = process.argv.includes("--refresh");

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function companyNorm(name) {
  const tokens = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const suffixes = new Set(["entertainment", "inc", "ltd", "games", "studio", "studios"]);
  while (tokens.length > 1 && suffixes.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join("");
}

function parseSalary(value) {
  if (!value) return { min: null, max: null };
  const amounts = [];
  for (const match of value.matchAll(/\$?\s*(\d+(?:\.\d+)?)\s*(k)?/gi)) {
    const n = Number.parseFloat(match[1]);
    if (!Number.isFinite(n) || n <= 0) continue;
    const scaled = match[2] ? Math.round(n * 1000) : Math.round(n);
    if (scaled >= 1000) amounts.push(scaled);
  }
  if (amounts.length === 0) return { min: null, max: null };
  return { min: Math.min(...amounts), max: Math.max(...amounts) };
}

function geoLabel(slug) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizePostedAt(row) {
  const seconds = Number.parseInt(String(row.date_epoch ?? ""), 10);
  if (Number.isFinite(seconds) && seconds > 0) return new Date(seconds * 1000).toISOString();
  for (const candidate of [row.published_at, row.date]) {
    if (candidate == null || !String(candidate).trim()) continue;
    const parsed = new Date(String(candidate));
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function amount(value) {
  if (value == null) return null;
  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * Pay the employer actually stated, from the API's `salary_min_value` / `salary_max_value`
 * pair. Null unless both bounds are there and the pair is yearly USD: nothing is currency
 * converted and nothing hourly is annualised, so every stored bound is comparable.
 * Mirrors `web3CareerStatedSalary` in packages/shared.
 */
function statedSalary(row) {
  const min = amount(row.salary_min_value);
  const max = amount(row.salary_max_value);
  if (min == null || max == null) return null;
  const currency = row.salary_currency == null ? "" : String(row.salary_currency).toUpperCase();
  if (currency && currency !== "USD") return null;
  const unit = row.salary_unit == null ? "" : String(row.salary_unit).toUpperCase();
  if (unit && unit !== "YEAR" && unit !== "YEARLY" && unit !== "ANNUAL") return null;
  return min <= max ? { min, max } : { min: max, max: min };
}

function formatSalary(bounds) {
  if (!bounds || bounds.min == null || bounds.max == null) return null;
  const k = (n) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);
  return bounds.min === bounds.max ? k(bounds.min) : `${k(bounds.min)} - ${k(bounds.max)}`;
}

function extractJobs(payload) {
  if (!Array.isArray(payload)) {
    if (payload && typeof payload === "object" && Array.isArray(payload.jobs)) {
      return payload.jobs;
    }
    return [];
  }
  const nested = payload.find((item) => Array.isArray(item));
  if (Array.isArray(nested)) return nested;
  if (payload[0] && typeof payload[0] === "object" && !Array.isArray(payload[0])) {
    return payload;
  }
  return [];
}

async function fetchQuery(query) {
  const url = new URL("https://web3.career/api/v1");
  url.searchParams.set("token", token);
  url.searchParams.set("limit", "100");
  url.searchParams.set("show_description", "true");
  if (query.tag) url.searchParams.set("tag", query.tag.replaceAll("-", " "));
  if (query.country) url.searchParams.set("country", query.country);
  if (query.remote) url.searchParams.set("remote", "true");
  // Without a browser-shaped User-Agent Cloudflare refuses this endpoint with 403
  // "Error 1010" before it ever reads the token.
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent":
        "Mozilla/5.0 (compatible; NodeworkBot/1.0; +https://nodework.app/about) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
  });
  if (!response.ok) {
    throw new Error(`web3.career API ${response.status}`);
  }
  return extractJobs(await response.json());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function locationSlug(location, remote) {
  if (!location || remote === "remote") return null;
  const hay = location.toLowerCase();
  for (const [slug, aliases] of COUNTRY_ALIASES) {
    if (aliases.some((alias) => hay.includes(alias))) return slug;
  }
  return null;
}

async function loadJobs() {
  if (!refresh) {
    try {
      const cached = JSON.parse(readFileSync(cachePath, "utf8"));
      if (Array.isArray(cached) && cached.length > 0) {
        console.log(`using ${cached.length} cached jobs`);
        return cached;
      }
    } catch {
      // fetch live
    }
  }

  const jobsById = new Map();
  for (const [index, query] of QUERIES.entries()) {
    const rows = await fetchQuery(query);
    for (const row of rows) {
      const id = row?.id == null ? "" : String(row.id);
      const title = String(row?.title ?? "").trim();
      const company = String(row?.company ?? "").trim();
      const applyUrl = String(row?.apply_url ?? row?.applyUrl ?? "").trim();
      if (!id || !title || !company || !applyUrl) continue;
      jobsById.set(id, row);
    }
    console.log(`fetched ${rows.length} rows for ${JSON.stringify(query)}`);
    if (index < QUERIES.length - 1) await sleep(800);
  }

  const jobs = [...jobsById.values()];
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cachePath, JSON.stringify(jobs));
  return jobs;
}

function findLocalD1(appRoot) {
  const dir = join(appRoot, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
  const file = readdirSync(dir).find(
    (name) => name.endsWith(".sqlite") && !name.startsWith("metadata"),
  );
  if (!file) {
    throw new Error(`No local D1 sqlite found under ${dir}`);
  }
  return join(dir, file);
}

function importInto(dbPath, rows) {
  const db = new DatabaseSync(dbPath);
  const now = new Date().toISOString();
  const tenantId = "tenant:gaming";

  db.exec("PRAGMA foreign_keys = ON");
  db.exec("BEGIN");
  db.prepare(
    `INSERT OR IGNORE INTO tenants (id, slug, name) VALUES (?, 'nodework', 'Nodework')`,
  ).run(tenantId);
  db.prepare(
    `UPDATE tenants SET slug = 'nodework', name = 'Nodework' WHERE id = ?`,
  ).run(tenantId);
  db.exec(
    `DELETE FROM job_tags WHERE job_id IN (SELECT id FROM jobs WHERE source = 'web3_career_api')`,
  );

  const upsertCompany = db.prepare(
    `INSERT INTO companies (id, tenant_id, name, name_norm, listed, created_at)
     VALUES (?, ?, ?, ?, 1, ?)
     ON CONFLICT (tenant_id, name_norm) DO UPDATE SET name = excluded.name`,
  );
  const getCompany = db.prepare(
    `SELECT id FROM companies WHERE tenant_id = ? AND name_norm = ? LIMIT 1`,
  );
  const upsertJob = db.prepare(
    `INSERT INTO jobs (
        id, tenant_id, company_id, canonical_key, title, title_norm, slug, location, remote,
        description_html, apply_url, salary_text, salary_min, salary_max, source, external_id,
        highlight, exclusivity, seen_on_indeed, posted_at, listed, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'web3_career_api', ?,
        0, 'unknown', 0, ?, 1, ?, ?
      )
      ON CONFLICT (tenant_id, canonical_key) DO UPDATE SET
        title = excluded.title,
        company_id = excluded.company_id,
        description_html = excluded.description_html,
        apply_url = excluded.apply_url,
        salary_text = excluded.salary_text,
        salary_min = excluded.salary_min,
        salary_max = excluded.salary_max,
        location = excluded.location,
        remote = excluded.remote,
        -- Refreshed too: the same instant, but re-normalised. Without this, rows imported
        -- before the fix keep their RFC 1123 string and the column stays mixed-format.
        posted_at = excluded.posted_at,
        listed = 1,
        updated_at = excluded.updated_at`,
  );
  const upsertSighting = db.prepare(
    `INSERT INTO job_sightings (id, job_id, source, source_url, seen_at)
     VALUES (?, ?, 'web3_career_api', ?, ?)
     ON CONFLICT (id) DO UPDATE SET seen_at = excluded.seen_at`,
  );
  const insertTag = db.prepare(`INSERT OR IGNORE INTO tags (slug, label) VALUES (?, ?)`);
  const insertJobTag = db.prepare(
    `INSERT OR IGNORE INTO job_tags (job_id, tag_slug) VALUES (?, ?)`,
  );
  const insertLocation = db.prepare(
    `INSERT OR IGNORE INTO locations (slug, kind, label) VALUES (?, ?, ?)`,
  );
  const insertJobLocation = db.prepare(
    `INSERT OR IGNORE INTO job_locations (job_id, location_slug) VALUES (?, ?)`,
  );

  for (const row of rows) {
    const externalId = String(row.id);
    // The API returns these already HTML-escaped ("Digital Assets &amp; Tokenization").
    // Stored raw, React escapes them again and the reader sees the literal "&amp;".
    const title = decodeHtmlText(String(row.title).trim());
    const company = decodeHtmlText(String(row.company).trim());
    const applyUrl = String(row.apply_url ?? row.applyUrl).trim();
    const location = decodeHtmlText(row.location == null ? "" : String(row.location).trim());
    const description = String(row.description ?? "");
    const descriptionHtml = description.includes("<")
      ? description
      : `<p>${description || title}</p>`;
    const tags = Array.isArray(row.tags)
      ? [...new Set(row.tags.map((tag) => slugify(String(tag))).filter((tag) => JOB_TAGS.has(tag)))]
      : [];
    // The live API sends `is_remote`; `remote` only ever existed in our own fixtures.
    const remoteRaw = row.is_remote ?? row.remote;
    const remoteFlag =
      remoteRaw === true || remoteRaw === "true" || /remote/i.test(location);
    const remote = remoteFlag ? "remote" : "unknown";
    // Structured pair first — the live payload has no free-text `salary` field at all.
    // Only yearly USD is stored, so every bound in the table is comparable. The payload's
    // `estimated_*` fields are the upstream provider's own guesses and are not imported.
    const bounds = statedSalary(row) ?? parseSalary(row.salary == null ? "" : String(row.salary));
    const salaryText =
      row.salary != null && String(row.salary).trim()
        ? String(row.salary).trim()
        : formatSalary(bounds);
    // One comparable shape. Storing the API's RFC 1123 `date` verbatim left the column
    // holding two formats, and SQLite compares them as text, so every "Fri, ..." sorted
    // above every "2026-...". Mirrors `web3CareerPostedAt` in packages/shared.
    const postedAt = normalizePostedAt(row) ?? now;
    const nameNorm = companyNorm(company) || slugify(company);
    const titleSlug = slugify(title);
    const companySlug = slugify(nameNorm) || nameNorm;
    const slug = `${titleSlug}-${companySlug}-${externalId}`.slice(0, 180);
    const canonicalKey = `web3_career:${externalId}`;
    const jobId = `job:web3:${externalId}`;

    upsertCompany.run(`company:${nameNorm}`, tenantId, company, nameNorm, now);
    const stored = getCompany.get(tenantId, nameNorm);
    const companyId = stored?.id ?? `company:${nameNorm}`;

    upsertJob.run(
      jobId,
      tenantId,
      companyId,
      canonicalKey,
      title,
      titleSlug,
      slug,
      location || null,
      remote,
      descriptionHtml,
      applyUrl,
      salaryText || null,
      bounds.min,
      bounds.max,
      externalId,
      postedAt,
      now,
      now,
    );
    upsertSighting.run(`sighting:${externalId}`, jobId, applyUrl, now);

    // Cap at 20, not 8. Jobs carry a median of 6 taxonomy tags and 15 at the 99th
    // percentile, so a cap of 8 truncated 218 of 1035 rows — dropping a job off landings it
    // genuinely belongs to (/solidity-jobs lost 55 listings that way). At 20 only 3 rows are
    // touched, while still guarding against a pathologically over-tagged listing.
    for (const tag of tags.slice(0, 20)) {
      insertTag.run(tag, tag);
      insertJobTag.run(jobId, tag);
    }

    // The API sends `city` and `country` already slugified ("new-york", "united-states"),
    // so use them directly. Deriving a country by matching aliases against the free-text
    // `location` produced country rows only, and skipped remote jobs entirely, which is
    // why job_locations held no city at all and every city landing showed zero jobs.
    // "remote" appears in both fields as a placeholder and is a remote flag, not a place.
    for (const [kind, value] of [
      ["city", row.city],
      ["country", row.country],
    ]) {
      const slug = value == null ? "" : slugify(String(value));
      if (!slug || slug === "remote") continue;
      insertLocation.run(slug, kind, geoLabel(slug));
      insertJobLocation.run(jobId, slug);
    }

    // Fallback for rows with no structured country: recover one from the location text.
    if (!row.country) {
      const geo = locationSlug(location, remote);
      if (geo) {
        insertLocation.run(geo, "country", geoLabel(geo));
        insertJobLocation.run(jobId, geo);
      }
    }
  }

  db.exec("COMMIT");
  const count = db
    .prepare(`SELECT COUNT(*) AS total FROM jobs WHERE source = 'web3_career_api' AND listed = 1`)
    .get();
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  db.close();
  return count?.total ?? 0;
}

const jobs = await loadJobs();
console.log(`importing ${jobs.length} unique jobs`);

const targets = [crawlerRoot, join(crawlerRoot, "..", "web")];
for (const appRoot of targets) {
  const dbPath = findLocalD1(appRoot);
  const total = importInto(dbPath, jobs);
  console.log(`${total} listed web3 jobs in ${dbPath}`);
}
