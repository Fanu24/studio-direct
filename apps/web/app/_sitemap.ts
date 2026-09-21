import { TENANT_SLUG, landingPath } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { MetadataRoute } from "next";

import { LEARN_CATEGORIES } from "./learn-web3/categories";
import {
  jobPublicHref,
  listSitemapEntries,
  type JobsDatabase,
  type SitemapEntries,
} from "../lib/jobs/queries";

/**
 * Placeholder origins from local scaffolding; never advertise them in a live sitemap.
 * "studio-direct.example" is the real scaffolding placeholder (crawler UA,
 * apps/crawler/src/digest.ts, both wrangler.jsonc files, packages/db/seed/studio-direct.sql);
 * "placeholder.example" is kept too so a future rename can't quietly disarm this guard again.
 */
const RESERVED_SITEMAP_ORIGINS = ["https://studio-direct.example", "https://placeholder.example"];

/** Google's per-file cap: at most 50,000 URLs (and 50MB) per sitemap file. */
export const SITEMAP_URL_LIMIT = 50_000;

export const dynamic = "force-dynamic";

/** The child sitemap paths when no kind exceeds SITEMAP_URL_LIMIT (the common case). */
export const SITEMAP_INDEX_PATHS = [
  "/sitemaps/static.xml",
  "/sitemaps/jobs.xml",
  "/sitemaps/tags.xml",
  "/sitemaps/geo.xml",
  "/sitemaps/salaries.xml",
  "/sitemaps/companies.xml",
  "/sitemaps/hire.xml",
  "/sitemaps/learn.xml",
] as const;

export const SITEMAP_KINDS = [
  "static",
  "jobs",
  "tags",
  "geo",
  "salaries",
  "companies",
  "hire",
  "learn",
] as const;

export type SitemapKind = (typeof SITEMAP_KINDS)[number];

/** Public catalog + editorial hubs. Intern/entry landings live here, not in tags. */
export const STATIC_PATHS = [
  "/",
  "/jobs",
  "/web3-companies",
  "/roles",
  "/hire",
  "/learn-web3",
  "/remote-jobs",
  "/intern-jobs",
  "/entry-level-jobs",
  "/entry-developer-jobs",
  "/entry-non-tech-jobs",
  "/entry-designer-jobs",
  "/top-web3-internships",
  "/highest-paying-web3-jobs",
  "/highest-paid-developer-jobs",
  "/highest-paid-non-tech-jobs",
  "/highest-paid-designers-jobs",
  "/top-web3-jobs",
  "/most-popular-developer-jobs",
  "/most-popular-non-tech-jobs",
  "/most-popular-designers-jobs",
  "/web3-companies/top-growing",
  "/web3-salaries",
  "/web3-salaries/solana-vs-ethereum",
  "/web3-non-tech-salaries",
  "/web3-cities",
  "/faq",
  "/what-is-web3",
  "/about",
  "/terms",
  "/privacy",
] as const;

const STATIC_TAG_HUBS = new Set(["intern", "entry-level"]);

/**
 * Resolves SITE_URL to an absolute origin, or null when it is missing, blank, not an
 * absolute http(s) URL, or the reserved placeholder origin. Callers fall back to
 * relative paths instead of throwing (see toSitemapUrl), so a missing env var never
 * 500s a public route.
 */
export function resolveSitemapOrigin(siteUrl = process.env.SITE_URL): string | null {
  const origin = siteUrl?.trim();
  if (!origin) return null;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (RESERVED_SITEMAP_ORIGINS.includes(parsed.origin)) return null;

  return parsed.origin;
}

/** Absolute URL when an origin is available, otherwise the bare path. */
export function toSitemapUrl(path: string, origin: string | null): string {
  return origin ? new URL(path, origin).toString() : path;
}

export function sitemapPathsForKind(kind: SitemapKind, entries: SitemapEntries): string[] {
  switch (kind) {
    case "static":
      return STATIC_PATHS.filter(path => !["/intern-jobs", "/entry-level-jobs"].includes(path) || entries.tagSlugs.includes(path.slice(1, -5)));
    case "jobs":
      return entries.jobs.map((job) => jobPublicHref(job));
    case "tags": {
      const tagSet = new Set(entries.tagSlugs);
      const paths: string[] = [];
      for (const slug of entries.tagSlugs) {
        if (!STATIC_TAG_HUBS.has(slug)) {
          paths.push(`/${slug}-jobs`);
        }

      }
      for (const slug of entries.remoteTagSlugs) {
        paths.push(landingPath({kind: "remote-tag", tag: slug, tags: [slug]}));
      }
      for (const slug of entries.benefitSlugs) {
        if (tagSet.has(slug) || STATIC_TAG_HUBS.has(slug)) continue;
        paths.push(`/${slug}-jobs`);
      }
      return paths;
    }
    case "geo":
      return entries.geoSlugs.map((slug) => `/web3-jobs-${slug}`);
    case "salaries":
      return [
        "/web3-salaries",
        ...entries.salarySlugs.map((slug) => `/web3-salaries/${slug}`),
      ];
    case "companies":
      return entries.companySlugs.map((slug) => `/web3-companies/${slug}`);
    case "hire":
      return entries.tagSlugs.map((slug) => `/hire/${slug}`);
    case "learn":
      return LEARN_CATEGORIES.map((slug) => `/learn-web3/${slug}`);
  }
}

/**
 * File names for one sitemap kind, split so no single file lists more than
 * SITEMAP_URL_LIMIT URLs. A kind under the limit keeps its plain "/sitemaps/<kind>.xml"
 * name; a kind over the limit becomes "/sitemaps/<kind>-1.xml", "-2.xml", etc.
 */
export function sitemapChildPaths(kind: SitemapKind, urlCount: number): string[] {
  const pageCount = Math.max(1, Math.ceil(urlCount / SITEMAP_URL_LIMIT));
  if (pageCount === 1) return [`/sitemaps/${kind}.xml`];
  return Array.from({ length: pageCount }, (_, index) => `/sitemaps/${kind}-${index + 1}.xml`);
}

export async function loadSitemapEntries(): Promise<SitemapEntries> {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  return listSitemapEntries(db, TENANT_SLUG);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = resolveSitemapOrigin();
  const entries = await loadSitemapEntries();
  const paths = SITEMAP_KINDS.flatMap((kind) =>
    sitemapChildPaths(kind, sitemapPathsForKind(kind, entries).length),
  );
  return paths.map((path) => ({ url: toSitemapUrl(path, origin) }));
}
