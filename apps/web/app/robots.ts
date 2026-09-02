import type { MetadataRoute } from "next";

/** The sitemap refuses this placeholder origin, so robots must not advertise it either. */
const RESERVED_ORIGIN = "https://studio-direct.example";

export const PRIVATE_PATHS = [
  "/api/",
  "/dashboard",
  "/profile",
  "/settings",
  "/onboarding",
] as const;

export const dynamic = "force-dynamic";

/**
 * Returns the absolute sitemap URL for a valid http(s) SITE_URL, or null when the value is
 * missing, blank, not an absolute URL, not http(s), or the reserved example origin.
 */
export function resolveRobotsSitemap(siteUrl: string | null | undefined): string | null {
  const trimmed = siteUrl?.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.origin === RESERVED_ORIGIN) return null;

  return `${parsed.origin}/sitemap.xml`;
}

export function buildRobots(siteUrl: string | null | undefined): MetadataRoute.Robots {
  const sitemap = resolveRobotsSitemap(siteUrl);
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...PRIVATE_PATHS],
      },
    ],
    ...(sitemap ? { sitemap } : {}),
  };
}

export default function robots(): MetadataRoute.Robots {
  return buildRobots(process.env.SITE_URL);
}
