export const PACKAGE_NAME = "@gaming/shared";
export {coinMarketCapSeeds,defiLlamaSeeds,cryptoPortfolioSeeds,discoverCompany,createSiteReader,publicHttps,robotsAllowed,atsBoard,boardMatchesCompany,extractLinks} from './source-discovery.ts';
export type {SourceSeed,SourceCandidate} from './source-discovery.ts';
export {CURATED_WEB3_COMPANIES} from './web3-companies.ts';

export {
  HUB_ROLE_SLUGS,
  hubSlugLabel,
  isHubRoleSlug,
  jobHubSlugs,
  parseRoleHubSegment,
} from "./hubs.ts";
export type { HubRoleSlug } from "./hubs.ts";
export {
  GAMING_ROLES,
  REMOTE_GAMING_QUERIES,
  WORK_LOCATION_MODIFIERS,
} from "./dictionary.ts";
export type { JobDraft, JobSource, QueueMessage, Source } from "./jobs.ts";
export { isQueueMessage } from "./jobs.ts";
export {
  canonicalApplyUrl,
  canonicalKeyFromUrls,
  jobPublicSlug,
  jobSeoSlug,
  normalizeCompanyName,
  slugTitle,
} from "./normalize.ts";
export {
  TENANT_NAME,
  TENANT_SLUG,
  LEGACY_TENANT_ID,
} from "./tenant.ts";
export {
  API_SWEEP_COUNTRIES,
  API_SWEEP_TAGS,
  BENEFITS,
  CITIES,
  CITY_COUNTRY,
  COUNTRIES,
  COUNTRY_REGION,
  FEATURED_TAG_CHIPS,
  GENERIC_ROLE_TAGS,
  JOB_TAGS,
  NON_TECH_SALARY_ROLES,
  REGIONS,
  SALARY_ROLES,
  SENIORITY_RANK,
  SENIORITY_SLUGS,
  apiTagParam,
  citiesInCountry,
  countriesInRegion,
  countryForCity,
  isBenefitSlug,
  isCitySlug,
  isCountrySlug,
  isGenericRoleTag,
  isJobTag,
  isNonTechSalaryRole,
  isRegionSlug,
  isSalaryRole,
  isSenioritySlug,
  regionForCity,
  regionForCountry,
  slugifyTag,
  tagLabel,
} from "./taxonomy.ts";
export type {
  BenefitSlug,
  CitySlug,
  CountrySlug,
  JobTag,
  NonTechSalaryRole,
  RegionSlug,
  SalaryRole,
} from "./taxonomy.ts";
export {
  SEO_MIN_JOBS,
  landingFaq,
  landingHeadline,
  landingPath,
  landingTitle,
  parseLandingSegment,
  parseSalaryPageSlug,
  relatedLandings,
  shouldIndexLanding,
} from "./landings.ts";
export type { LandingKind, SalaryPageSlug } from "./landings.ts";
export { CAREER_FAQ_QUESTIONS, careerFaq } from "./copy/faq.ts";
export type { FaqItem, FaqStats } from "./copy/faq.ts";
export { landingRoleFaq, roleWhatTheyDo } from "./copy/role-blurbs.ts";
export type { LandingRoleFaqStats, RoleFaq } from "./copy/role-blurbs.ts";
export {
  averageSalary,
  buildSalaryRollup,
  formatSalaryRange,
  parseSalaryBounds,
} from "./salary.ts";
export type { SalaryAggregate, SalaryBounds, SalaryRollup } from "./salary.ts";
export {
  decodeHtmlText,
  mapWeb3CareerApiJob,
  parseWeb3CareerApiPayload,
  publicJobPath,
  web3CareerCanonicalKey,
  web3CareerPostedAt,
  web3CareerStatedSalary,
} from "./web3-api.ts";
export type { Web3CareerApiJob } from "./web3-api.ts";
export { acquireHostLock } from "./host-lock.ts";
export type { HostLockKv } from "./host-lock.ts";
export { classifyRemote } from "./remote.ts";
export { isStaffingDraft } from "./staffing.ts";
export {
  computeExclusivity,
  jaccard,
  linkedinTitlesMatch,
} from "./exclusivity.ts";
export type {
  ComputeExclusivityInput,
  Exclusivity,
} from "./exclusivity.ts";
export {
  buildDigestEmail,
  filterDigestRecipients,
  isDigestRecipient,
} from "./digest.ts";
export type {
  DigestEmail,
  DigestJob,
  DigestRecipient,
  DigestRecipientRow,
} from "./digest.ts";
export {deliverNotifications} from './notifications.ts';
export {listingPeriodStatements,reconcileListingPeriods} from './listing-periods.ts';

export {resolveJobLocations} from './job-locations.ts';
export {careerDetailLinks} from './source-discovery.ts';
