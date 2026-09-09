import {
  REGIONS,
  careerFaq,
  landingPath,
  tagLabel,
  type FaqItem,
} from "@gaming/shared";
import Link from "next/link";

import { FOOTER_GROUPS, type FooterLink } from "./footer-data";
import { NON_TECH_SALARY_ROLES } from "./board-chrome";

/** Lookup by heading into P04's FOOTER_GROUPS, so the mega menu and footer never drift apart. */
const FOOTER_LINKS_BY_HEADING = new Map<string, readonly FooterLink[]>(
  FOOTER_GROUPS.map((group) => [group.heading, group.links]),
);

function footerLinks(heading: string): readonly FooterLink[] {
  return FOOTER_LINKS_BY_HEADING.get(heading) ?? [];
}

const TOP_CITIES = [
  "amsterdam",
  "atlanta",
  "austin",
  "bangkok",
  "berlin",
  "boston",
  "chicago",
  "dubai",
  "dublin",
  "hong-kong",
  "lisbon",
  "london",
  "los-angeles",
  "new-york",
  "san-francisco",
  "singapore",
  "sydney",
  "tel-aviv",
  "toronto",
  "vancouver",
] as const;

/**
 * Remote skill landings surfaced on the homepage. Hrefs go through landingPath
 * so they emit the one canonical shape the landing page itself sets as its
 * rel=canonical (the sorted "+" combo, e.g. "/backend+remote-jobs"). The older
 * "/remote-<tag>-jobs" alias still resolves, but linking the alias internally
 * points every homepage chip at a URL that then canonicalises elsewhere.
 * Seniority combos have no LandingKind of their own, so those few are written
 * out in the same sorted shape. Every href below was curled against the dev
 * server and returns 200 - a chip pointing at a 404 is worse than no chip.
 */
const REMOTE_DEV_TAGS = [
  "backend",
  "customer-support",
  "defi",
  "design",
  "dev",
  "front-end",
  "full-stack",
  "golang",
  "javascript",
  "mobile",
  "nft",
  "react",
  "rust",
  "smart-contract",
  "solana",
  "solidity",
  "tech-lead",
] as const;

const REMOTE_DEV_COMBOS = [
  { href: "/dev+entry-level+remote-jobs", label: "Remote entry level dev jobs" },
  { href: "/dev+junior+remote-jobs", label: "Remote junior dev jobs" },
] as const;

const REMOTE_NON_TECH_TAGS = [
  "community-manager",
  "copywriting",
  "hr",
  "marketing",
  "product-manager",
  "project-manager",
  "recruiter",
  "sales",
  "social-media",
] as const;

const REMOTE_NON_TECH_COMBOS = [
  {
    href: "/entry-level+non-tech+remote-jobs",
    label: "Remote entry level non-tech jobs",
  },
  { href: "/junior+non-tech+remote-jobs", label: "Remote junior non-tech jobs" },
] as const;

type MegaLink = { href: string; label: string };

function sortedByLabel(links: readonly MegaLink[]): MegaLink[] {
  return [...links].sort((a, b) => a.label.localeCompare(b.label, "en"));
}

const MEGA_SECTIONS = [
  {
    title: "Remote Web3 Jobs",
    intro:
      "Find remote crypto jobs. Backend, front-end, Solidity, Solana, and more. Apply from anywhere.",
    links: sortedByLabel([
      ...REMOTE_DEV_TAGS.map((tag) => ({
        href: landingPath({ kind: "remote-tag", tag, tags: [tag] }),
        label: `Remote ${tagLabel(tag)} jobs`,
      })),
      ...REMOTE_DEV_COMBOS,
    ]),
  },
  {
    title: "Remote Non-Tech Web3 Jobs",
    intro: "Remote marketing, sales, copywriting, and community roles at crypto companies.",
    links: sortedByLabel([
      ...REMOTE_NON_TECH_TAGS.map((tag) => ({
        href: landingPath({ kind: "remote-tag", tag, tags: [tag] }),
        label: `Remote ${tagLabel(tag)} jobs`,
      })),
      ...REMOTE_NON_TECH_COMBOS,
    ]),
  },
  {
    title: "Web3 Developer Salaries",
    intro:
      "Salary bands by role, updated from jobs that published a minimum and a maximum.",
    links: footerLinks("Developer Salaries"),
  },
  {
    title: "Web3 Non-Tech Salaries",
    intro: "Pay bands for sales, marketing, product, and other non-engineering seats.",
    links: NON_TECH_SALARY_ROLES.map((slug) => ({
      href: `/web3-non-tech-salaries/${slug}`,
      label: `${tagLabel(slug)} salaries`,
    })),
  },
  {
    title: "Top Web3 Cities",
    intro: "Browse cryptocurrency jobs near you. Open a city landing, then filter by skill.",
    links: TOP_CITIES.map((slug) => ({
      href: `/web3-jobs-${slug}`,
      label: `Web3 jobs in ${tagLabel(slug)}`,
    })),
  },
  {
    title: "Top Regions for Web3 Careers",
    intro: "Explore hiring by continent. Remote remains a large share of the catalog.",
    links: REGIONS.map((slug) => ({
      href: `/web3-jobs-${slug}`,
      label: tagLabel(slug),
    })),
  },
  {
    title: "Learn With Our Web3 Job Platform",
    intro:
      "Original Nodework notes on how to learn the stack, then jump back into the catalog. We do not scrape courses.",
    links: footerLinks("Learn Web3"),
  },
  {
    title: "Hire Web3 Developers",
    intro:
      "See which companies are already hiring a skill on Nodework. This is not a talent directory.",
    links: footerLinks("Hire Web3 Talent"),
  },
  {
    title: "Benefits",
    intro:
      "Filter jobs by the employment benefits employers published, from pay in crypto to medical insurance.",
    links: footerLinks("Benefits"),
  },
  {
    title: "More",
    intro: "Editorial pages, company index, and ranking boards on Nodework.",
    links: [
      { href: "/what-is-web3", label: "What is Web3?" },
      { href: "/faq", label: "FAQ" },
      { href: "/web3-companies", label: "Web3 companies" },
      { href: "/web3-companies/top-growing", label: "Top growing Web3 companies" },
      { href: "/hire", label: "Hire Web3 developers" },
      { href: "/post-web3-job", label: "Post a job" },
    ],
  },
] as const;

export function ProfileBanner() {
  return (
    <aside className="profile-banner">
      <div>
        <p className="profile-banner__kicker">Nodework</p>
        <p className="profile-banner__copy">
          Stop applying. Get discovered by hiring teams.
        </p>
      </div>
      <Link className="button button--primary" href="/onboarding">
        Build your profile
      </Link>
    </aside>
  );
}

export function HomeMegaLinks() {
  return (
    <div className="home-mega-stack">
      {MEGA_SECTIONS.map((section) => (
        <section className="home-mega" key={section.title}>
          <h2>{section.title}</h2>
          <p>{section.intro}</p>
          <div className="chips">
            {section.links.map((link) => (
              <Link className="chip" href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * The reference board runs a testimonial carousel in this slot. We keep the
 * slot and the interaction (quoted cards, Previous/Next) but we have collected
 * no customer reviews, so nothing here is attributed to a person and the note
 * above the track says so in plain words. Invented names on a job board is not
 * something we ship.
 *
 * Interaction is CSS only, the same hidden-input pattern TagChips uses: one
 * radio per slide, labels acting as Previous/Next, no client bundle.
 */
const HOME_REVIEWS = [
  {
    id: "catalog",
    quote:
      "One board instead of twenty company career pages. Roles land here as the import runs, so comparing three Solidity openings is a scroll rather than an afternoon of tab management.",
    who: "Illustrative example: a contract engineer comparing offers",
  },
  {
    id: "filters",
    quote:
      "Every filter combination is its own address. Remote plus Rust plus junior is a page you can bookmark, send to a friend, and open again next week without rebuilding the search.",
    who: "Illustrative example: a backend engineer tracking a narrow slice",
  },
  {
    id: "apply",
    quote:
      "The apply form stays on Nodework. You read the description, send what the listing asked for, and the next step belongs to the employer rather than to a third redirect.",
    who: "Illustrative example: a community lead applying to non-tech roles",
  },
] as const;

export function HomeReviews() {
  const count = HOME_REVIEWS.length;

  return (
    <section className="home-reviews">
      <h2>How people use Nodework</h2>
      <p className="home-reviews__note">
        Illustrative examples written by us. Nodework has not collected customer
        reviews yet, so none of the cards below is a quote from a real person.
      </p>
      <div className="home-reviews__carousel">
        {HOME_REVIEWS.map((review, index) => (
          <input
            aria-label={`Example ${index + 1} of ${count}`}
            className="home-reviews__radio"
            defaultChecked={index === 0}
            id={`home-review-${review.id}`}
            key={review.id}
            name="home-review"
            type="radio"
          />
        ))}
        <div className="home-reviews__track">
          {HOME_REVIEWS.map((review) => (
            <blockquote className="home-reviews__slide" key={review.id}>
              <p>{review.quote}</p>
              <footer>{review.who}</footer>
            </blockquote>
          ))}
        </div>
        <div className="home-reviews__controls">
          {HOME_REVIEWS.map((review, index) => (
            <div
              className={`home-reviews__nav home-reviews__nav--${review.id}`}
              key={review.id}
            >
              <label
                className="button button--ghost"
                htmlFor={`home-review-${
                  HOME_REVIEWS[(index - 1 + count) % count].id
                }`}
              >
                Previous
              </label>
              <span className="home-reviews__count">
                {index + 1} / {count}
              </span>
              <label
                className="button button--ghost"
                htmlFor={`home-review-${HOME_REVIEWS[(index + 1) % count].id}`}
              >
                Next
              </label>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The homepage shows six questions, the same count the reference board ends on.
 * The shared careerFaq() list is longer and drives the deeper landing pages;
 * picking by question text here keeps the visible accordion and the FAQPage
 * JSON-LD in page.tsx reading from one list instead of drifting apart.
 */
export const HOME_FAQ_QUESTIONS = [
  "Is a Web3 career legit?",
  "Is it hard to get a Web3 job?",
  "What skills are needed for Web3?",
  "How do I get a job in Web3 development?",
  "Which places hire the most?",
  "Are Web3 jobs remote-friendly?",
] as const;

export function homeCareerFaq(jobCount: number): FaqItem[] {
  const byQuestion = new Map(
    careerFaq({ jobCount }).map((item) => [item.question, item]),
  );
  return HOME_FAQ_QUESTIONS.map((question) => byQuestion.get(question)).filter(
    (item): item is FaqItem => item !== undefined,
  );
}

export function HomeCareerFaq({ jobCount }: { jobCount: number }) {
  return (
    <section className="container jobs-more faq-accordion">
      {homeCareerFaq(jobCount).map((item, index) => (
        <details className="faq-item" key={item.question} open={index === 0}>
          <summary className="faq-item__summary">
            <h2 className="faq-item__q">{item.question}</h2>
            <span aria-hidden="true" className="faq-item__toggle" />
          </summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </section>
  );
}
