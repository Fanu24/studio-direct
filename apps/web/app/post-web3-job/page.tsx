import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRightIcon, CheckIcon, LockIcon } from "../_components/icons";
import { JsonLd } from "../_components/json-ld";
import { PageHeader } from "../_components/page-header";
import { PLAN_COPY } from "../../lib/billing/plans";

export const metadata: Metadata = {
  title: "Post a Web3 job on Nodework",
  description:
    "What a Nodework job listing includes, how posting will work, and how to get in line for employer access before self-serve checkout is live.",
  alternates: { canonical: "/post-web3-job" },
};

const INCLUDED = [
  "The full job description, not a truncated snippet",
  "Placement in search plus the matching tag, location and salary pages",
  "Apply stays on Nodework: candidates submit on this site, not a redirect chain",
  "A company page pulling every open role together under one profile",
];

const STEPS = [
  {
    title: "Create an account",
    detail: "Sign in with a magic link or Google so we know who to contact about your listing.",
  },
  {
    title: "Send us the role",
    detail: "Title, description, location, remote status, tags and a salary range if you can share one.",
  },
  {
    title: "It goes live",
    detail: "The listing is published with a full description and joins search, tags, location and salary pages like every other job.",
  },
];

const FAQ = [
  {
    question: "Can I check out and post a job today?",
    answer:
      "Not yet. Employer job-posting checkout is not live. The €9 a month and €59 a year plans on the pricing page are candidate account plans, not job posting.",
  },
  {
    question: "So how do I post a job right now?",
    answer:
      "Create a free account and tell us about the role. We will get it into the catalog manually until self-serve posting ships.",
  },
  {
    question: "Will the listing look different from imported jobs?",
    answer:
      "No. It renders through the same job page, company page and full-description view every listing uses. There is no separate, lesser employer template.",
  },
  {
    question: "Do you sell packs of job posts?",
    answer:
      "Not yet. The bundle page describes the pack sizes and the 24 month posting window a bundle would carry, so employers can see the shape of it, but there is no checkout behind that page either.",
  },
  {
    question: "Can I pay to feature it?",
    answer:
      "There is a featured placement format described on the advertising page. It is also not self-serve yet.",
  },
];

function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export default function PostWeb3JobPage() {
  return (
    <main className="marketing post-job">
      <JsonLd data={faqJsonLd()} />

      <div className="container container--content">
        {PageHeader({
          kicker: "For employers",
          title: "Post a Web3 job on Nodework",
          lead: "Get a role in front of Web3 candidates already searching by skill, location and salary. Self-serve checkout is not live yet, so today this starts with an account, not a card form.",
        })}
      </div>

      <section aria-labelledby="post-status" className="marketing-section">
        <div className="container container--content stack">
          <h2 id="post-status">Where this stands today</h2>
          <div className="marketing-notice">
            <LockIcon size={18} />
            <p>
              Employer posting checkout is not built yet. The listing itself is real once
              it is in the catalog, but getting it there today is a manual step through
              the account route below, not an automated purchase.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="post-included" className="band marketing-section">
        <div className="container container--content stack">
          <div className="section-head">
            <span className="kicker">What a listing includes</span>
            <h2 id="post-included">The same catalog candidates already search</h2>
          </div>
          <ul className="marketing-card__list">
            {INCLUDED.map((item) => (
              <li key={item}>
                <CheckIcon size={16} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="post-steps" className="marketing-section">
        <div className="container container--content stack">
          <div className="section-head">
            <span className="kicker">How it works today</span>
            <h2 id="post-steps">Three steps, no checkout yet</h2>
          </div>
          <ol className="about-steps">
            {STEPS.map((step, index) => (
              <li className="panel" key={step.title}>
                <span className="about-steps__num">0{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="post-pricing" className="band marketing-section">
        <div className="container container--content stack">
          <div className="section-head">
            <span className="kicker">Pricing</span>
            <h2 id="post-pricing">Not the candidate plans</h2>
            <p>
              Nodework&apos;s existing paid plans, {PLAN_COPY.monthly.label} or{" "}
              {PLAN_COPY.yearly.label}, are candidate account features: unlimited unlocks
              and account extras. They are not an employer job-posting product. When
              self-serve posting ships, its price will be published on this page and on{" "}
              <Link href="/pricing">/pricing</Link> first, not decided ad hoc over email.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="post-cta" className="marketing-section">
        <div className="container container--content stack">
          <div className="section-head">
            <span className="kicker">Get in line</span>
            <h2 id="post-cta">Start with an account</h2>
            <p>
              Create a free account now. We will reach out through it once we have your
              role details, and again when self-serve posting is ready.
            </p>
          </div>
          <div className="cluster">
            <Link className="button button--lg" href="/login">
              Create a free account
            </Link>
            <Link className="text-link" href="/post-web3-job/bundle">
              Multi-post bundles
              <ArrowRightIcon size={16} />
            </Link>
            <Link className="text-link" href="/ads">
              Featured placement details
              <ArrowRightIcon size={16} />
            </Link>
            <Link className="text-link" href="/pricing">
              See current plans
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="post-faq" className="band marketing-section">
        <div className="container container--content">
          <div className="section-head">
            <h2 id="post-faq">Questions</h2>
          </div>
          <dl className="about-faq__list">
            {FAQ.map((item) => (
              <div className="about-faq__item" key={item.question}>
                <dt>{item.question}</dt>
                <dd>{item.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </main>
  );
}
