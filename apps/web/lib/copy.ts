export const HOMEPAGE_CLAIM =
  "Browse Web3, blockchain and crypto jobs. Filter by skill, location and salary.";

/**
 * Homepage lead sentence and meta description builder, shared so the on-page
 * copy and the crawlable <meta name="description"> always agree. Interpolates
 * the live job and company counts so the sentence changes as the catalog does.
 */
export function homepageSummary(jobCount: number, companyCount: number): string {
  const jobs = jobCount.toLocaleString("en-US");
  const companies = companyCount.toLocaleString("en-US");
  const jobWord = jobCount === 1 ? "job" : "jobs";
  const companyWord = companyCount === 1 ? "company" : "companies";
  return `${jobs} live Web3 ${jobWord} from ${companies} hiring ${companyWord}. Filter blockchain, crypto and DeFi roles by skill, remote status and salary.`;
}

export const LINKEDIN_EXCLUSIVITY_TOOLTIP =
  "We did not find this role on LinkedIn in our last successful index.";
