import type { JobDraft } from "@gaming/shared";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isJobPosting(value: JsonObject): boolean {
  const types = Array.isArray(value["@type"])
    ? value["@type"]
    : [value["@type"]];

  return types.some(
    (type) =>
      typeof type === "string" &&
      (type === "JobPosting" || type.endsWith("/JobPosting")),
  );
}

function collectJobPostings(value: unknown, postings: JsonObject[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectJobPostings(item, postings);
    }
    return;
  }

  if (!isObject(value)) {
    return;
  }

  if (isJobPosting(value)) {
    postings.push(value);
  }

  if ("@graph" in value) {
    collectJobPostings(value["@graph"], postings);
  }
}

function jsonLdScripts(html: string): string[] {
  const scripts: string[] = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;

  for (const match of html.matchAll(scriptPattern)) {
    const attributes = match[1];
    const typeMatch = attributes.match(
      /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
    );
    const type = typeMatch?.[1] ?? typeMatch?.[2] ?? typeMatch?.[3];

    if (type?.toLowerCase() === "application/ld+json") {
      scripts.push(match[2]);
    }
  }

  return scripts;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function countryName(value: unknown): string | null {
  if (typeof value === "string") {
    return text(value);
  }

  return isObject(value) ? text(value.name) : null;
}

function addressLocation(value: unknown): string | null {
  if (typeof value === "string") {
    return text(value);
  }

  if (!isObject(value)) {
    return null;
  }

  const address = isObject(value.address) ? value.address : value;
  const parts = [
    text(address.streetAddress),
    text(address.addressLocality),
    text(address.addressRegion),
    text(address.postalCode),
    countryName(address.addressCountry),
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(", ") : text(value.name);
}

function locationFor(posting: JsonObject): string | null {
  const jobLocations = Array.isArray(posting.jobLocation)
    ? posting.jobLocation
    : [posting.jobLocation];
  const locations = jobLocations
    .map(addressLocation)
    .filter((location): location is string => location !== null);

  if (locations.length > 0) {
    return locations.join("; ");
  }

  const requirements = Array.isArray(posting.applicantLocationRequirements)
    ? posting.applicantLocationRequirements
    : [posting.applicantLocationRequirements];
  const applicantLocations = requirements
    .map((requirement) =>
      isObject(requirement)
        ? text(requirement.name) ?? addressLocation(requirement)
        : text(requirement),
    )
    .filter((location): location is string => location !== null);

  return applicantLocations.length > 0 ? applicantLocations.join("; ") : null;
}

function remoteType(posting: JsonObject): JobDraft["remote"] {
  const locationType = text(posting.jobLocationType)?.toUpperCase();

  if (locationType === "TELECOMMUTE" || locationType === "REMOTE") {
    return "remote";
  }

  if (locationType === "HYBRID") {
    return "hybrid";
  }

  return posting.jobLocation === undefined ? "unknown" : "onsite";
}

function absoluteUrl(value: unknown, pageUrl: string): string {
  const candidate = text(value) ?? pageUrl;

  try {
    return new URL(candidate, pageUrl).toString();
  } catch {
    return pageUrl;
  }
}

export function parseJobPostingJsonLd(
  html: string,
  companyName: string,
  pageUrl: string,
): JobDraft[] {
  const postings: JsonObject[] = [];

  for (const script of jsonLdScripts(html)) {
    try {
      collectJobPostings(JSON.parse(script), postings);
    } catch {
      // Ignore malformed metadata while continuing to inspect the page.
    }
  }

  return postings.flatMap((posting) => {
    const title = text(posting.title);
    if (title === null) {
      return [];
    }

    const sourceUrl = absoluteUrl(posting.url, pageUrl);

    return [{
      source: "career_page",
      sourceUrl,
      companyName,
      title,
      location: locationFor(posting),
      remote: remoteType(posting),
      descriptionHtml: text(posting.description) ?? "",
      applyUrl: sourceUrl,
      postedAt: text(posting.datePosted),
      rawJson: JSON.stringify(posting),
    }];
  });
}
