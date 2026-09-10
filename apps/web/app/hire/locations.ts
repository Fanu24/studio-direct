import {
  isCitySlug,
  isCountrySlug,
  isRegionSlug,
  tagLabel,
} from "@gaming/shared";

/**
 * Parses the [location] segment of /hire/{skill}/{location}. Accepts
 * "remote" plus any real city, country, or region slug - this stays
 * independent of which locations a given skill actually has live jobs in,
 * so a direct link keeps working even for a slice that later empties out.
 */
export function parseHireLocation(location: string): {
  remoteOnly?: boolean;
  locationSlug?: string;
  label: string;
} | null {
  const slug = location.trim().toLowerCase();
  if (!slug) return null;
  if (slug === "remote") return { remoteOnly: true, label: "Remote" };
  if (isCitySlug(slug) || isCountrySlug(slug) || isRegionSlug(slug)) {
    return { locationSlug: slug, label: tagLabel(slug) };
  }
  return null;
}

const MAX_LOCATION_CHIPS = 6;

export type HireLocationChip = { slug: string; label: string; jobCount: number };

/**
 * Builds the /hire/{skill} location-chip row from live per-tag facet counts
 * (P06's listTagLocationFacets) instead of a fixed six-place list, so every
 * chip this returns is guaranteed to lead to a non-empty page. `remoteCount`
 * comes in separately because remote is a column on jobs, not a
 * job_locations row, so it can't be part of the same facet query.
 *
 * `facets` must already be ordered by jobCount descending (as
 * listTagLocationFacets returns them) - this only filters and caps.
 */
export function buildHireLocationChips(
  facets: { slug: string; jobCount: number }[],
  remoteCount: number,
): HireLocationChip[] {
  const chips: HireLocationChip[] = [];
  if (remoteCount > 0) {
    chips.push({ slug: "remote", label: "Remote", jobCount: remoteCount });
  }
  for (const facet of facets) {
    if (chips.length >= MAX_LOCATION_CHIPS) break;
    if (facet.jobCount <= 0) continue;
    chips.push({
      slug: facet.slug,
      label: tagLabel(facet.slug),
      jobCount: facet.jobCount,
    });
  }
  return chips;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * "September 2026" for the given (default: current) UTC month - keeps the
 * numeric specificity in hire metadata live instead of the one evergreen
 * template every role used to share.
 */
export function currentMonthYear(date: Date = new Date()): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * "$120,000-$180,000" from a tagSalaryRange result, or "" when there is no
 * salary data for the tag yet. Never fabricates a figure - callers drop the
 * clause entirely when this returns "" (today that is true for nearly every
 * tag: salary_min/max is populated on 0 of 1042 jobs).
 */
export function salaryRangePhrase(range: {
  min: number | null;
  max: number | null;
  count: number;
}): string {
  if (range.count <= 0 || range.min == null || range.max == null) return "";
  const format = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
  return range.min === range.max
    ? format(range.min)
    : `${format(range.min)}-${format(range.max)}`;
}
