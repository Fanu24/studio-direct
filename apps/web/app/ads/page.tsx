import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRightIcon, CheckIcon, LockIcon } from "../_components/icons";
import { JsonLd } from "../_components/json-ld";
import { PageHeader } from "../_components/page-header";

export const metadata: Metadata = {
  title: "Advertise on Nodework",
  description:
    "Sponsor a featured job placement on Nodework's Web3 jobs board. What the format actually is, where it shows up, and how to request one.",
  alternates: { canonical: "/ads" },
};

const FEATURED_FACTS = [
  "Sorts to the top of every list the job already qualifies for",
  "Shown with a distinct highlighted row style, not a separate banner slot",
  "Applies wherever that job already appears: search, its tag pages and its location page",
  "Runs for a fixed window you agree with us, then the job goes back to normal sort order",
];

const NOT_OFFERED = [
  "Homepage takeover or hero banner placements",
  "Display or image ad units anywhere on the site",
  "Newsletter or email sponsorships",
  "Guaranteed click or impression counts",
];

const FAQ = [
  {
    question: "What is the actual ad format?",
    answer:
      "A featured job listing. It is the same job row candidates already see, sorted to the top of matching results and given a highlighted style, for a fixed window.",
  },
  {
    question: "Do you sell banner ads?",
    answer:
      "No. Nodework does not have a banner, display or homepage takeover placement built. If that changes, this page will change with it.",
  },
  {
    question: "Can I buy this today?",
    answer:
      "There is no self-serve checkout for featured placement yet. Reach out through the account route below and we will set it up manually.",
  },
  {
    question: "Do you publish audience numbers?",
    answer:
      "Not yet. We are not publishing traffic or audience figures until we have verified numbers worth standing behind.",
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

export default function AdsPage() {
  return (
    <main className="marketing ads">
      <JsonLd data={faqJsonLd()} />

      <div className="container container--content">
        {PageHeader({
          kicker: "For employers",
          title: "Advertise on Nodework",
          lead: "One real placement: a featured job listing that sorts to the top of the board. No banner inventory, no audience numbers we have not verified.",
        })}
      </div>

      <section aria-labelledby="ads-format" className="marketing-section">
        <div className="container container--content marketing-grid marketing-grid--2">
          <article className="panel marketing-card">
            <h3>Featured listing</h3>
            <p>
              A highlighted version of a job already on Nodework. It reuses the same
              highlighted row treatment the board already renders for a featured job, so
              it looks like part of the catalog rather than an inserted ad unit.
            </p>
            <ul className="marketing-card__list">
              {FEATURED_FACTS.map((item) => (
                <li key={item}>
                  <CheckIcon size={16} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel marketing-card">
            <h3>Not offered yet</h3>
            <p>Being direct about what this page is not selling.</p>
            <ul className="marketing-card__list">
              {NOT_OFFERED.map((item) => (
                <li key={item}>
                  <LockIcon size={16} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section aria-labelledby="ads-where" className="band marketing-section">
        <div className="container container--content stack">
          <div className="section-head">
            <span className="kicker">Where it shows</span>
            <h2 id="ads-where">One job, every page it already qualifies for</h2>
            <p>
              A featured job is not a separate page. It is the same listing shown on the
              main jobs board, its tag pages, and its location page, sorted first and
              styled differently for as long as the featured window runs. When the window
              ends, the job returns to normal date-based sort order like every other
              listing.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="ads-request" className="marketing-section">
        <div className="container container--content stack">
          <div className="section-head">
            <span className="kicker">Request a placement</span>
            <h2 id="ads-request">How to get a featured listing</h2>
            <p>
              There is no self-serve checkout for this yet. Create a free Nodework
              account so we have a way to reach you, then tell us which listing you want
              featured and for how long.
            </p>
          </div>
          <div className="cluster">
            <Link className="button button--lg" href="/login">
              Create a free account
            </Link>
            <Link className="text-link" href="/post-web3-job">
              Not listed yet? Start with posting the job
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="ads-faq" className="band marketing-section">
        <div className="container container--content">
          <div className="section-head">
            <h2 id="ads-faq">Questions</h2>
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
