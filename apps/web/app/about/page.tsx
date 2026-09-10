import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRightIcon, CheckIcon, MinusIcon } from "../_components/icons";
import { JsonLd } from "../_components/json-ld";
import { PageHeader } from "../_components/page-header";
import { HOMEPAGE_CLAIM } from "../../lib/copy";
import { TERMS_COPY } from "../../lib/legal/copy";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Where Nodework listings come from, how Apply works, and what the board never does.",
  alternates: { canonical: "/about" },
};

const SOURCES = [
  {
    title: "Public Web3 job feeds",
    detail: "Bootstrap inventory from the web3.career API, stored on Nodework.",
  },
  {
    title: "Career pages later",
    detail: "First-party ATS crawls can replace the feed without changing public pages.",
  },
  {
    title: "Full descriptions",
    detail: "Each listing carries the complete description, not a snippet.",
  },
];

const STEPS = [
  {
    title: "Import listed jobs",
    detail: "A scheduled import upserts companies, jobs, tags, locations and salary bands.",
  },
  {
    title: "Build programmatic pages",
    detail: "Tag, remote, geo and salary landings are generated from that catalog.",
  },
  {
    title: "Apply on Nodework",
    detail: "The Apply button opens a form on this site. We do not send you to another job board.",
  },
];

const NOTS = [
  {
    title: "Send you to another job board",
    detail: "Apply stays on Nodework. Imported apply URLs are not used as the public button.",
  },
  {
    title: "Gate applications behind unlocks",
    detail: "Listed jobs are readable and Apply is public. No weekly quota on Apply.",
  },
  {
    title: "Sell access to your profile",
    detail: "Companies and recruiters only see your profile if you opt in from Settings. It is off by default.",
  },
  {
    title: "Invent salary numbers",
    detail: "Rollups only include jobs that published both a minimum and a maximum.",
  },
];

const FAQ = [
  {
    question: "Do I need an account to browse?",
    answer:
      "No. Search, filters, full descriptions and Apply are public.",
  },
  {
    question: "Why is a role I know about missing?",
    answer:
      "The catalog starts from an API feed with a 100-result cap per query. A missing listing is not a sign that the role is closed.",
  },
  {
    question: "Can I get new roles by email?",
    answer: "Not yet. Job alerts are a later slice.",
  },
  {
    question: "Where do I apply?",
    answer:
      "On Nodework. Open a job, press Apply, and submit the form on this site.",
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

export default function AboutPage() {
  return (
    <main className="surface surface--stage marketing about">
      <JsonLd data={faqJsonLd()} />

      <div className="container container--content">
        {PageHeader({
          kicker: "How it works",
          title: "How Nodework works",
          lead: HOMEPAGE_CLAIM,
        })}
      </div>

      <section aria-labelledby="about-sources" className="about-section">
        <div className="container container--content about-split">
          <div className="about-split__copy">
            <span className="kicker">Where listings come from</span>
            <h2 id="about-sources">A Web3 job catalog, not a gated board.</h2>
            <p>{TERMS_COPY.thirdParties}</p>
            <p>{TERMS_COPY.incomplete}</p>
          </div>
          <ul aria-label="Sources we read" className="panel about-sources">
            {SOURCES.map((source) => (
              <li key={source.title}>
                <CheckIcon size={16} />
                <div>
                  <strong>{source.title}</strong>
                  <span>{source.detail}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="about-badge" className="band about-section">
        <div className="container container--content">
          <div className="section-head">
            <span className="kicker">How the catalog works</span>
            <h2 id="about-badge">Import, landings, then Apply.</h2>
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

      <section aria-labelledby="about-nots" className="about-section">
        <div className="container container--content">
          <div className="section-head">
            <span className="kicker">What we do not do</span>
            <h2 id="about-nots">What Nodework never does.</h2>
          </div>
          <ul className="about-nots">
            {NOTS.map((item) => (
              <li key={item.title}>
                <span aria-hidden="true" className="about-nots__icon">
                  <MinusIcon size={16} />
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="about-faq" className="band about-section">
        <div className="container container--content">
          <div className="section-head">
            <h2 id="about-faq">Questions</h2>
            <p>Short answers. The terms and privacy pages have the full wording.</p>
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

      <section aria-labelledby="about-close" className="about-section about-close">
        <div className="container container--content">
          <h2 id="about-close">See the board.</h2>
          <div className="cluster">
            <Link className="button button--primary" href="/jobs">
              Browse jobs
            </Link>
            <Link className="button button--ghost" href="/remote-jobs">
              Remote jobs
            </Link>
            <Link className="text-link" href="/pricing">
              See pricing
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
