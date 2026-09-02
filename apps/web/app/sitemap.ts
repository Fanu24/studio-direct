import { HUB_ROLE_SLUGS } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { MetadataRoute } from "next";

import {
  listSitemapEntries,
  type JobsDatabase,
} from "../lib/jobs/queries";

const RESERVED_SITEMAP_ORIGIN = "https://studio-direct.example";

export const dynamic = "force-dynamic";

export function resolveSitemapOrigin(siteUrl = process.env.SITE_URL): string {
  const origin = siteUrl?.trim();
  if (!origin) {
    throw new Error("SITE_URL is required to generate the sitemap");
  }

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error("SITE_URL must be a valid absolute origin");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("SITE_URL must be a valid absolute origin");
  }

  if (parsed.origin === RESERVED_SITEMAP_ORIGIN) {
    throw new Error(
      "SITE_URL must not use the reserved origin https://studio-direct.example",
    );
  }

  return parsed.origin;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = resolveSitemapOrigin();
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const { companySlugs, jobSlugs } = await listSitemapEntries(db, "gaming");
  const paths = [
    "/",
    "/jobs",
    "/hidden-jobs",
    ...HUB_ROLE_SLUGS.map((slug) => `/remote-${slug}-jobs`),
    ...HUB_ROLE_SLUGS.map((slug) => `/skills/${slug}`),
    ...jobSlugs.map((slug) => `/jobs/${slug}`),
    ...companySlugs.map((slug) => `/companies/${slug}`),
  ];

  return paths.map((path) => ({
    url: new URL(path, origin).toString(),
  }));
}
