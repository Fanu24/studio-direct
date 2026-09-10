import {
  BENEFITS,
  CITY_COUNTRY,
  FEATURED_TAG_CHIPS,
  NON_TECH_SALARY_ROLES,
  REGIONS,
  SALARY_ROLES,
  tagLabel,
  type CitySlug,
} from "@gaming/shared";

import { HIRE_TAGS } from "../hire/tags";
import { NON_TECH_SALARY_ROLES as NON_TECH_SALARY_PAGE_ROLES } from "./board-chrome";

import {
  LEARN_FORMATS,
  LEARN_LEVELS,
  LEARN_TOPICS,
  learnCategoryLabel,
} from "../learn-web3/categories";

export type FooterLink = { href: string; label: string };

export type FooterGroup = {
  heading: string;
  hubHref?: string;
  links: FooterLink[];
};

/** How many CITY_COUNTRY hub cities to surface in the footer. */
const TOP_CITY_COUNT = 20;

const NON_TECH_REMOTE_TAG_SET = new Set<string>(NON_TECH_SALARY_ROLES);

/** Curated skill/role tags, minus the non-tech roles that get their own group. */
const REMOTE_WEB3_TAGS = FEATURED_TAG_CHIPS.filter(
  (tag) => !NON_TECH_REMOTE_TAG_SET.has(tag),
);

/** First N hub cities CITY_COUNTRY actually maps, in source order. */
const TOP_CITIES = (Object.keys(CITY_COUNTRY) as CitySlug[]).slice(0, TOP_CITY_COUNT);

const LEARN_CATEGORIES_FOR_FOOTER = [...LEARN_FORMATS, ...LEARN_LEVELS, ...LEARN_TOPICS];

/**
 * /web3-non-tech-salaries/[slug] gates on board-chrome's own (narrower, stale)
 * NON_TECH_SALARY_ROLES rather than the taxonomy's 14-role list, so five taxonomy
 * roles (junior, lead, project-manager, senior, social-media) 404 there today.
 * Intersect until that route is repointed at the taxonomy list (see needsFollowUp).
 */
const NON_TECH_SALARY_PAGE_ROLE_SET = new Set<string>(NON_TECH_SALARY_PAGE_ROLES);
const LIVE_NON_TECH_SALARY_ROLES = NON_TECH_SALARY_ROLES.filter((role) =>
  NON_TECH_SALARY_PAGE_ROLE_SET.has(role),
);

export const FOOTER_GROUPS: readonly FooterGroup[] = [
  {
    heading: "Remote Web3 Jobs",
    hubHref: "/remote-jobs",
    links: REMOTE_WEB3_TAGS.map((tag) => ({
      href: `/remote-${tag}-jobs`,
      label: `Remote ${tagLabel(tag)}`,
    })),
  },
  {
    heading: "Remote Non-Tech Jobs",
    hubHref: "/remote-jobs",
    links: NON_TECH_SALARY_ROLES.map((tag) => ({
      href: `/remote-${tag}-jobs`,
      label: `Remote ${tagLabel(tag)}`,
    })),
  },
  {
    heading: "Developer Salaries",
    hubHref: "/web3-salaries",
    links: SALARY_ROLES.map((role) => ({
      href: `/web3-salaries/${role}`,
      label: `${tagLabel(role)} salary`,
    })),
  },
  {
    heading: "Non-Tech Salaries",
    hubHref: "/web3-non-tech-salaries",
    links: LIVE_NON_TECH_SALARY_ROLES.map((role) => ({
      href: `/web3-non-tech-salaries/${role}`,
      label: `${tagLabel(role)} salary`,
    })),
  },
  {
    heading: "Top Web3 Cities",
    hubHref: "/web3-cities",
    links: TOP_CITIES.map((city) => ({
      href: `/web3-jobs-${city}`,
      label: tagLabel(city),
    })),
  },
  {
    heading: "Regions",
    hubHref: "/web3-cities",
    links: REGIONS.map((region) => ({
      href: `/web3-jobs-${region}`,
      label: `Web3 jobs in ${tagLabel(region)}`,
    })),
  },
  {
    heading: "Learn Web3",
    hubHref: "/learn-web3",
    links: LEARN_CATEGORIES_FOR_FOOTER.map((category) => ({
      href: `/learn-web3/${category}`,
      label: learnCategoryLabel(category),
    })),
  },
  {
    heading: "Hire Web3 Talent",
    hubHref: "/hire",
    links: HIRE_TAGS.map((tag) => ({
      href: `/hire/${tag}`,
      label: `Hire ${tagLabel(tag)}`,
    })),
  },
  {
    heading: "Benefits",
    links: BENEFITS.map((benefit) => ({
      href: `/${benefit}-jobs`,
      label: `${tagLabel(benefit)} jobs`,
    })),
  },
  {
    heading: "More",
    links: [
      { href: "/jobs", label: "All jobs" },
      { href: "/intern-jobs", label: "Internships" },
      { href: "/web3-companies", label: "Companies" },
      { href: "/highest-paying-web3-jobs", label: "Highest paying jobs" },
      { href: "/top-web3-jobs", label: "Top Web3 jobs" },
      { href: "/highest-paid-non-tech-jobs", label: "Highest paid non-tech jobs" },
      { href: "/web3-companies/top-growing", label: "Growing companies" },
      { href: "/web3-salaries/solana-vs-ethereum", label: "Solana vs Ethereum salary" },
      { href: "/about", label: "About" },
      { href: "/faq", label: "FAQ" },
      { href: "/what-is-web3", label: "What is Web3" },
      { href: "/post-web3-job", label: "Post a job" },
      { href: "/pricing", label: "Pricing" },
      { href: "/ads", label: "Advertise" },
      { href: "/crypto-events", label: "Web3 events" },
      { href: "/web3-jobs-api", label: "Web3 jobs API" },
      { href: "/legal", label: "Legal" },
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/login", label: "Login" },
    ],
  },
];

/**
 * The rendered footer. Three columns, matching the reference board's footer
 * information architecture: the hub column (jobs / salaries / cities / learn / hire),
 * a Regions column, and an "Other" long tail that closes on account links.
 *
 * FOOTER_GROUPS above is the deep browse taxonomy; it is no longer rendered in the
 * footer (the reference keeps no link farm down there) and now serves the homepage
 * mega-link sections in home-mega.tsx.
 *
 * Every href in this list returns 200 on the dev server. Links the reference carries
 * that we deliberately do not have -- their partner talent pool, their Twitter and
 * Discord, their podcast and their separate sign-up route -- are left out rather than
 * pointed at a placeholder.
 */
export const FOOTER_COLUMNS: readonly FooterGroup[] = [
  {
    heading: "Browse",
    links: [
      { href: "/remote-jobs", label: "Remote Web3 jobs" },
      { href: "/remote-non-tech-jobs", label: "Remote non-tech Web3 jobs" },
      { href: "/web3-salaries", label: "Web3 salaries" },
      { href: "/web3-non-tech-salaries", label: "Web3 non-tech salaries" },
      { href: "/web3-cities", label: "Top Web3 cities" },
      { href: "/learn-web3", label: "Learn Web3" },
      { href: "/hire", label: "Hire Web3 developers" },
    ],
  },
  {
    heading: "Regions",
    hubHref: "/web3-cities",
    links: REGIONS.map((region) => ({
      href: `/web3-jobs-${region}`,
      label: tagLabel(region),
    })),
  },
  {
    heading: "Other",
    links: [
      { href: "/what-is-web3", label: "What is Web3?" },
      { href: "/faq", label: "FAQ" },
      { href: "/web3-companies", label: "Web3 companies" },
      { href: "/jobs", label: "All Web3 jobs" },
      { href: "/about", label: "About Nodework" },
      { href: "/ads", label: "Advertise" },
      { href: "/crypto-events", label: "Crypto events" },
      { href: "/web3-jobs-api", label: "Web3 jobs API" },
      { href: "/pricing", label: "Pricing" },
      { href: "/terms", label: "Terms of service" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/legal", label: "Legal notices" },
      { href: "/login", label: "Login" },
      { href: "/login?intent=start", label: "Create a profile" },
    ],
  },
];
