const COMPANY_SUFFIXES = new Set([
  "entertainment",
  "inc",
  "ltd",
  "games",
  "studio",
  "studios",
]);

function tokensFromName(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function normalizeCompanyName(name: string): string {
  const tokens = tokensFromName(name);
  while (tokens.length > 1 && COMPANY_SUFFIXES.has(tokens[tokens.length - 1]!)) {
    tokens.pop();
  }
  return tokens.join("");
}

export function slugTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function canonicalApplyUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const drop = (key: string) =>
    key === "fbclid" || key === "gclid" || key.startsWith("utm_");

  for (const key of [...parsed.searchParams.keys()]) {
    if (drop(key)) parsed.searchParams.delete(key);
  }

  return parsed.toString();
}

export function canonicalKeyFromUrls(
  applyUrl: string | null,
  companyName: string,
  title: string,
): string {
  if (applyUrl) {
    const canonical = canonicalApplyUrl(applyUrl);
    if (canonical) return canonical;
  }
  return `${normalizeCompanyName(companyName)}:${slugTitle(title)}`;
}
