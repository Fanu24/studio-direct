import { TENANT_SLUG } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { listSitemapEntries, type JobsDatabase } from "../../../lib/jobs/queries";
import {
  SITEMAP_KINDS,
  SITEMAP_URL_LIMIT,
  resolveSitemapOrigin,
  sitemapPathsForKind,
  toSitemapUrl,
  type SitemapKind,
} from "../../sitemap";

function xmlEscape(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

const CHILD_KIND_PATTERN = /^([a-z]+)(?:-(\d+))?$/;

/** Parses "jobs" (page 1) or "jobs-3" (page 3) into a known kind + 1-based page number. */
function parseChildKind(raw: string): { kind: SitemapKind; page: number } | null {
  const match = CHILD_KIND_PATTERN.exec(raw);
  if (!match) return null;

  const kind = match[1] as SitemapKind;
  if (!SITEMAP_KINDS.includes(kind)) return null;

  const page = match[2] ? Number(match[2]) : 1;
  if (!Number.isInteger(page) || page < 1) return null;

  return { kind, page };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ kind: string }> },
) {
  const parsed = parseChildKind((await context.params).kind.replace(/\.xml$/, ""));
  if (!parsed) {
    return new Response("Not Found", { status: 404 });
  }
  const { kind, page } = parsed;

  const origin = resolveSitemapOrigin();
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const entries = await listSitemapEntries(db, TENANT_SLUG);
  const allPaths = sitemapPathsForKind(kind, entries);
  const start = (page - 1) * SITEMAP_URL_LIMIT;
  const paths = allPaths.slice(start, start + SITEMAP_URL_LIMIT);

  if (paths.length === 0 && start > 0) {
    return new Response("Not Found", { status: 404 });
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths
  .map((path) => `  <url><loc>${xmlEscape(toSitemapUrl(path, origin))}</loc></url>`)
  .join("\n")}
</urlset>`;

  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
