import { HUB_ROLE_SLUGS } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { MetadataRoute } from "next";

import {
  listSitemapEntries,
  type JobsDatabase,
} from "../lib/jobs/queries";

const SITE_URL = process.env.SITE_URL ?? "https://studio-direct.example";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
    url: new URL(path, SITE_URL).toString(),
  }));
}
