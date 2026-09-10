import {
  type CitySlug,
  type CountrySlug,
  type SenioritySlug,
  SENIORITY_RANK,
  canonicalSalaryRole,
  countryForCity,
  isBenefitSlug,
  isCitySlug,
  isCountrySlug,
  isGenericRoleTag,
  isJobTag,
  isNonTechSalaryRole,
  isRegionSlug,
  isSenioritySlug,
  regionForCountry,
  tagLabel,
} from "./taxonomy.ts";

export const SEO_MIN_JOBS = 5;

export type LandingKind =
  | { kind: "tag"; tag: string; tags: string[] }
  | { kind: "remote" }
  | { kind: "remote-tag"; tag: string; tags: string[] }
  | { kind: "city"; city: string }
  | { kind: "country"; country: string }
  | { kind: "region"; region: string }
  | { kind: "benefit"; benefit: string }
  | { kind: "intern" }
  | { kind: "entry-level" };

export function shouldIndexLanding(jobCount: number): boolean {
  return jobCount >= SEO_MIN_JOBS;
}

export function parseLandingSegment(segment: string): LandingKind | null {
  // The router hands us the raw, still percent-encoded path segment, so the
  // "+" in /remote+solidity-jobs arrives as "%2B". Decode first, then fold any
  // space back to "+": no valid slug contains a space, so every encoding of a
  // combo URL parses to the same landing.
  let raw = segment.trim();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Malformed escape sequence: fall back to the segment as given.
  }
  const slug = raw.toLowerCase().replace(/ /g, "+");
  if (!slug) return null;

  if (slug === "remote-jobs") return { kind: "remote" };
  if (slug === "intern-jobs") return { kind: "intern" };
  if (slug === "entry-level-jobs") return { kind: "entry-level" };

  // Multi-facet combo URLs: /dev+remote-jobs, /remote+solidity-jobs,
  // /junior+dev+remote-jobs. Geo facets never combine in this shape, so any
  // city/country/region part (or anything else that isn't a job tag or the
  // literal "remote") rejects the whole slug rather than falling through.
  const comboMatch = /^(.+)-jobs$/.exec(slug);
  if (comboMatch) {
    const rawParts = comboMatch[1]!.split("+");
    if (rawParts.length >= 2) {
      const parts = Array.from(new Set(rawParts));
      let isRemote = false;
      const tags: string[] = [];
      for (const part of parts) {
        if (part === "remote") {
          isRemote = true;
          continue;
        }
        if (!isJobTag(part)) return null;
        tags.push(part);
      }
      if (tags.length === 0) {
        return isRemote ? { kind: "remote" } : null;
      }
      tags.sort();
      return isRemote
        ? { kind: "remote-tag", tag: tags[0]!, tags }
        : { kind: "tag", tag: tags[0]!, tags };
    }
  }

  const remoteTag = /^remote-(.+)-jobs$/.exec(slug);
  if (remoteTag) {
    const tag = remoteTag[1]!;
    return isJobTag(tag) ? { kind: "remote-tag", tag, tags: [tag] } : null;
  }

  const geo = /^web3-jobs-(.+)$/.exec(slug);
  if (geo) {
    const place = geo[1]!;
    if (isCitySlug(place)) return { kind: "city", city: place };
    if (isCountrySlug(place)) return { kind: "country", country: place };
    if (isRegionSlug(place)) return { kind: "region", region: place };
    return null;
  }

  const jobsSuffix = /^(.+)-jobs$/.exec(slug);
  if (jobsSuffix) {
    const name = jobsSuffix[1]!;
    if (isBenefitSlug(name)) return { kind: "benefit", benefit: name };
    if (isJobTag(name)) return { kind: "tag", tag: name, tags: [name] };
    return null;
  }

  return null;
}

export function landingPath(landing: LandingKind): string {
  switch (landing.kind) {
    case "tag":
      return landing.tags.length > 1
        ? `/${[...landing.tags].sort().join("+")}-jobs`
        : `/${landing.tag}-jobs`;
    case "remote":
      return "/remote-jobs";
    case "remote-tag":
      return `/${[...landing.tags, "remote"].sort().join("+")}-jobs`;
    case "city":
      return `/web3-jobs-${landing.city}`;
    case "country":
      return `/web3-jobs-${landing.country}`;
    case "region":
      return `/web3-jobs-${landing.region}`;
    case "benefit":
      return `/${landing.benefit}-jobs`;
    case "intern":
      return "/intern-jobs";
    case "entry-level":
      return "/entry-level-jobs";
  }
}

const COARSE_TAGS = new Set(["dev", "non-tech"]);

function lowestSeniority(tags: string[]): string | undefined {
  const seniorities = tags.filter((tag) => isSenioritySlug(tag));
  if (seniorities.length === 0) return undefined;
  return seniorities.reduce((lowest, tag) =>
    SENIORITY_RANK[tag as SenioritySlug] < SENIORITY_RANK[lowest as SenioritySlug]
      ? tag
      : lowest,
  );
}

/**
 * Builds the "[Remote] [Seniority] [Coarse] [Specific]" word order shared by
 * landingHeadline and landingTitle for tag/remote-tag combos, plus whether
 * "in Web3" belongs on the end (no SPECIFIC tag survived, or the lone tag is
 * a generic role term that reads better disambiguated).
 */
function comboPrefix(tags: string[], remote: boolean): { prefix: string; appendWeb3: boolean } {
  const seniority = lowestSeniority(tags);
  const coarse = tags.filter((tag) => COARSE_TAGS.has(tag));
  const specific = tags.filter((tag) => !isSenioritySlug(tag) && !COARSE_TAGS.has(tag));

  const words: string[] = [];
  if (remote) words.push("Remote");
  if (seniority) words.push(tagLabel(seniority));
  for (const tag of coarse) words.push(tagLabel(tag));
  for (const tag of specific) words.push(tagLabel(tag));

  const isSingleGeneric = tags.length === 1 && isGenericRoleTag(tags[0]!);
  const appendWeb3 = specific.length === 0 || isSingleGeneric;

  return { prefix: words.join(" "), appendWeb3 };
}

function placeSlug(landing: Extract<LandingKind, { kind: "city" | "country" | "region" }>): string {
  return landing.kind === "city"
    ? landing.city
    : landing.kind === "country"
      ? landing.country
      : landing.region;
}

export function landingTitle(landing: LandingKind): string {
  switch (landing.kind) {
    case "tag": {
      const { prefix, appendWeb3 } = comboPrefix(landing.tags, false);
      return appendWeb3 ? `${prefix} jobs in Web3` : `${prefix} jobs`;
    }
    case "remote":
      return "Remote Web3 jobs";
    case "remote-tag": {
      const { prefix, appendWeb3 } = comboPrefix(landing.tags, true);
      return appendWeb3 ? `${prefix} jobs in Web3` : `${prefix} jobs`;
    }
    case "city": {
      const country = countryForCity(landing.city as CitySlug);
      const suffix = country ? `, ${tagLabel(country)}` : "";
      return `Web3 jobs in ${tagLabel(landing.city)}${suffix}`;
    }
    case "country":
      return `Web3 jobs in ${tagLabel(landing.country)}`;
    case "region":
      return `Web3 jobs in ${tagLabel(landing.region)}`;
    case "benefit":
      return landing.benefit === "pay-in-crypto"
        ? "Web3 jobs that pay in crypto"
        : `Web3 jobs with ${tagLabel(landing.benefit)}`;
    case "intern":
      return "Web3 internships";
    case "entry-level":
      return "Entry level Web3 jobs";
  }
}

/** web3.career-style H1, e.g. "Solana Jobs". */
export function landingHeadline(landing: LandingKind): string {
  switch (landing.kind) {
    case "tag": {
      const { prefix, appendWeb3 } = comboPrefix(landing.tags, false);
      return appendWeb3 ? `${prefix} Jobs in Web3` : `${prefix} Jobs`;
    }
    case "remote":
      return "Remote Jobs";
    case "remote-tag": {
      const { prefix, appendWeb3 } = comboPrefix(landing.tags, true);
      return appendWeb3 ? `${prefix} Jobs in Web3` : `${prefix} Jobs`;
    }
    case "city": {
      const country = countryForCity(landing.city as CitySlug);
      const suffix = country ? `, ${tagLabel(country)}` : "";
      return `Web3 Jobs in ${tagLabel(landing.city)}${suffix}`;
    }
    case "country":
      return `Web3 Jobs in ${tagLabel(landing.country)}`;
    case "region":
      return `Web3 Jobs in ${tagLabel(landing.region)}`;
    case "benefit":
      return landing.benefit === "pay-in-crypto"
        ? "Web3 Jobs That Pay in Crypto"
        : `Web3 Jobs with ${tagLabel(landing.benefit)}`;
    case "intern":
      return "Intern Jobs";
    case "entry-level":
      return "Entry Level Jobs";
  }
}

export type SalaryPageSlug =
  | { kind: "role"; role: string }
  | { kind: "country"; country: string }
  | { kind: "region"; region: string }
  | { kind: "city"; city: string }
  | { kind: "seniority"; seniority: string };

export function parseSalaryPageSlug(slug: string): SalaryPageSlug | null {
  const value = slug.trim().toLowerCase();
  const role = canonicalSalaryRole(value);
  if (role) return { kind: "role", role };
  if (isSenioritySlug(value)) return { kind: "seniority", seniority: value };
  if (isNonTechSalaryRole(value)) return { kind: "role", role: value };
  if (isCountrySlug(value)) return { kind: "country", country: value };
  if (isRegionSlug(value)) return { kind: "region", region: value };
  if (isCitySlug(value)) return { kind: "city", city: value };
  return null;
}

export function relatedLandings(landing: LandingKind): LandingKind[] {
  const related: LandingKind[] = [{ kind: "remote" }];

  if (landing.kind === "tag" || landing.kind === "remote-tag") {
    if (landing.tags.length > 1) {
      for (const tag of landing.tags) {
        related.push({ kind: "tag", tag, tags: [tag] });
      }
    } else if (landing.kind === "tag") {
      related.push({ kind: "remote-tag", tag: landing.tag, tags: [landing.tag] });
    } else {
      related.push({ kind: "tag", tag: landing.tag, tags: [landing.tag] });
    }
  }

  if (landing.kind === "city") {
    const country = countryForCity(landing.city as CitySlug);
    if (country) {
      related.push({ kind: "country", country });
      related.push({ kind: "region", region: regionForCountry(country) });
    }
  }

  if (landing.kind === "country") {
    related.push({ kind: "region", region: regionForCountry(landing.country as CountrySlug) });
  }

  if (landing.kind !== "intern") related.push({ kind: "intern" });
  if (landing.kind !== "entry-level") related.push({ kind: "entry-level" });

  return related.slice(0, 8);
}

export function landingFaq(
  landing: LandingKind,
  total: number,
  salaryRange?: string | null,
): { question: string; answer: string }[] {
  const isPlace = landing.kind === "city" || landing.kind === "country" || landing.kind === "region";
  const placeLabel = isPlace
    ? tagLabel(placeSlug(landing as Extract<LandingKind, { kind: "city" | "country" | "region" }>))
    : null;
  const noun = placeLabel ? `${placeLabel} Web3 jobs` : landingTitle(landing);
  const question = placeLabel
    ? `How many Web3 jobs are listed in ${placeLabel}?`
    : `How many ${noun} are listed?`;
  return [
    {
      question,
      answer:
        total === 1
          ? `Nodework currently shows 1 listing in this ${noun} slice. That count moves when the catalog refreshes.`
          : `Nodework currently shows ${total} listings in this ${noun} slice. Those counts move when the catalog refreshes.`,
    },
    {
      question: "Is salary data included?",
      answer: salaryRange
        ? `Roles with a published band currently span ${salaryRange}. Only jobs that printed both a minimum and a maximum enter that range.`
        : "Salary ranges appear when imported jobs include a published minimum and a maximum. Listings without a band still show in the catalog and are skipped in the rollup.",
    },
    {
      question: "How do I apply?",
      answer:
        "Open a job on this landing and use Apply. The form stays on Nodework. We do not send you to another job board as the public apply action.",
    },
  ];
}
