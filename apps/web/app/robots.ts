import type { MetadataRoute } from "next";

/**
 * The sitemap refuses these placeholder origins, so robots must not advertise them
 * either. "studio-direct.example" is the real scaffolding placeholder (crawler UA,
 * apps/crawler/src/digest.ts, both wrangler.jsonc files, packages/db/seed/studio-direct.sql);
 * "placeholder.example" is kept too so a future rename can't quietly disarm this guard again.
 */
const RESERVED_ORIGINS = ["https://studio-direct.example", "https://placeholder.example"];

export const PRIVATE_PATHS = [
  "/api/",
  "/admin",
  "/employer",
  "/recruiter",
  "/api-access",
  "/applications",
  "/notifications",
  "/saved-jobs",
  "/alerts",
  "/dashboard",
  "/profile",
  "/settings",
  "/onboarding",
] as const;

export const dynamic = "force-dynamic";

/**
 * Returns the absolute sitemap URL for a valid http(s) SITE_URL, or the relative
 * "/sitemap.xml" fallback when the value is missing, blank, not an absolute URL, not
 * http(s), or the reserved example origin. Always returns a usable value so robots.txt
 * always advertises its sitemap.
 */
export function resolveRobotsSitemap(siteUrl: string | null | undefined): string {
  const trimmed = siteUrl?.trim();
  if (!trimmed) return "/sitemap.xml";

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "/sitemap.xml";
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "/sitemap.xml";
  if (RESERVED_ORIGINS.includes(parsed.origin)) return "/sitemap.xml";

  return `${parsed.origin}/sitemap.xml`;
}

export function buildRobots(siteUrl: string | null | undefined): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...PRIVATE_PATHS],
      },
    ],
    sitemap: resolveRobotsSitemap(siteUrl),
  };
}

export default function robots(): MetadataRoute.Robots {
  if (process.env.SITE_INDEXING_ENABLED === "false") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return buildRobots(process.env.SITE_URL);
}
