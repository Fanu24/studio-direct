/**
 * Pure slot-filling for the ~380 programmatic landing pages
 * (apps/web/app/[slug]/page.tsx) and /jobs: turns a small set of live facts
 * into a title and description that change per page and per crawl, instead
 * of the one static sentence every tag/remote/geo/benefit URL used to share.
 *
 * Kept free of Next.js, D1 and @gaming/shared imports on purpose - callers
 * resolve the landing-specific pieces (headline, topic, month, salary band,
 * sampled jobs) and hand them in as plain data, which keeps this file cheap
 * to unit test and reusable from both page types.
 */

export interface LandingMetaJob {
  companyName: string;
  title: string;
}

export interface LandingMetaSlots {
  /** e.g. "Solidity Jobs" (landingHeadline output) or "Web3 Jobs". */
  headline: string;
  /** Lowercase noun phrase for what is on the page, e.g. "solidity jobs in web3". */
  topic: string;
  /** Catalog month label, e.g. "Sep 2026". Passed in (not computed here) so this stays pure. */
  month: string;
  total: number;
  /** Jobs posted in roughly the last day. 0 suppresses the "(N New)" title suffix. */
  newJobs: number;
  /** Formatted salary band ("$80k - $140k") when a rollup exists for this slice, else null/undefined. */
  salaryRange?: string | null;
  /** The rendered page's own rows - up to 3 distinct companies and 5 distinct titles are sampled from here. */
  jobs: readonly LandingMetaJob[];
}

function distinct(values: readonly string[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= limit) break;
  }
  return out;
}

/** "A" / "A and B" / "A, B and C" - never an Oxford comma, never a bare list. */
function joinNatural(items: readonly string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Every `topic` string contains the word "jobs" exactly once - singularize it for a count of 1. */
function singularizeTopic(topic: string, total: number): string {
  return total === 1 ? topic.replace(/\bjobs\b/, "job") : topic;
}

export function buildLandingTitle(
  slots: Pick<LandingMetaSlots, "headline" | "month" | "newJobs">,
): string {
  const suffix = slots.newJobs > 0 ? ` (${slots.newJobs} New)` : "";
  return `${slots.headline} - ${slots.month}${suffix}`;
}

export function buildLandingDescription(
  slots: Pick<LandingMetaSlots, "topic" | "month" | "total" | "salaryRange" | "jobs">,
): string {
  const count = slots.total.toLocaleString("en-US");
  const topic = singularizeTopic(slots.topic, slots.total);
  const companies = distinct(
    slots.jobs.map((job) => job.companyName),
    3,
  );
  const titles = distinct(
    slots.jobs.map((job) => job.title),
    5,
  );

  let sentence = `${count} ${topic} live on Nodework for ${slots.month}`;
  if (slots.salaryRange) {
    sentence += `, with published salaries spanning ${slots.salaryRange}`;
  }
  sentence += ".";

  if (companies.length > 0) {
    sentence += ` Companies hiring now include ${joinNatural(companies)}.`;
  }
  if (titles.length > 0) {
    sentence += ` Open roles include ${joinNatural(titles)}.`;
  }
  return sentence;
}
