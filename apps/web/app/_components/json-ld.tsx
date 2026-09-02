export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replaceAll("<", "\\u003c"),
      }}
      type="application/ld+json"
    />
  );
}

export function siteOrigin(): string | null {
  const siteUrl = process.env.SITE_URL?.trim();
  if (!siteUrl) return null;
  try {
    return new URL(siteUrl).origin;
  } catch {
    return null;
  }
}

export function absoluteUrl(path: string): string {
  const origin = siteOrigin();
  return origin ? new URL(path, origin).toString() : path;
}
