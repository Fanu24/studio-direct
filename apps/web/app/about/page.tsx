import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRightIcon, CheckIcon, MinusIcon } from "../_components/icons";
import { JsonLd } from "../_components/json-ld";
import { PageHeader } from "../_components/page-header";
import { HOMEPAGE_CLAIM, LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../../lib/copy";
import { TERMS_COPY } from "../../lib/legal/copy";

export const metadata: Metadata = {
  // The layout template appends the brand, so the title must not repeat it. The h1 still can.
  title: "How it works",
  description:
    "Where the gaming job listings come from, what the Not on LinkedIn badge means, how the 5 free unlocks per UTC week are counted, and what Studio Direct never does.",
  alternates: { canonical: "/about" },
};

const SOURCES = [
  {
    title: "Studio career pages",
    detail: "The studio's own jobs page, read directly and re-indexed on a schedule.",
  },
  {
    title: "Applicant tracking boards",
    detail: "Greenhouse and Lever boards where studios publish the same roles.",
  },
  {
    title: "Full descriptions",
    detail: "Each listing carries the studio's complete description, not a snippet.",
  },
];

const STEPS = [
  {
    title: "Index the studio page",
    detail: "We read the listing from the studio's career page or board.",
  },
  {
    title: "Compare with LinkedIn",
    detail: "After a successful index pass we look for the same role on LinkedIn.",
  },
  {
    title: "Badge on, or off",
    detail: "Not found there: the badge goes on. Not sure: it stays off.",
  },
];

const NOTS = [
  {
    title: "Apply for you",
    detail: "We never apply on your behalf. The studio's form is the only place an application happens.",
  },
  {
    title: "Write your application",
    detail: "No generated letters or answers. What you send to a studio is yours.",
  },
  {
    title: "Sell access to your profile",
    detail: "Studios and recruiters only see your profile if you opt in from Settings. It is off by default.",
  },
  {
    title: "Check LinkedIn live",
    detail: "The badge reflects our last successful index, not a live look at LinkedIn.",
  },
];

const FAQ = [
  {
    question: "Do I need an account to browse?",
    answer:
      "No. Search, filters and full descriptions are public. Sign in when you want to unlock an apply link.",
  },
  {
    question: "Why is a role I know about missing?",
    answer:
      "We only list roles found on the studio pages and boards we index. A missing listing is not a sign that the role is closed.",
  },
  {
    question: "Can I get new roles by email?",
    answer:
      "Not yet. A short digest of roles not on LinkedIn is planned for the paid plan. It is not available yet.",
  },
  {
    question: "Is Studio Direct connected to LinkedIn?",
    answer:
      "No. We are not affiliated with LinkedIn. The badge only records what our last successful index could not find there.",
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
    <main className="marketing about">
      <JsonLd data={faqJsonLd()} />

      <div className="container container--content">
        {/* Called as a function so the h1 and lead stay in the element tree the tests walk. */}
        {PageHeader({
          kicker: "How it works",
          title: "How Studio Direct works",
          lead: HOMEPAGE_CLAIM,
        })}
      </div>

      <section aria-labelledby="about-sources" className="about-section">
        <div className="container container--content about-split">
          <div className="about-split__copy">
            <span className="kicker">Where listings come from</span>
            <h2 id="about-sources">Listings start at the studio, not on a feed.</h2>
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
            <span className="kicker">What the badge means</span>
            <h2 id="about-badge">One badge, one meaning.</h2>
          </div>
          <figure className="panel panel--lg panel--accent about-badge">
            <span className="badge badge--lg" title={LINKEDIN_EXCLUSIVITY_TOOLTIP}>
              Not on LinkedIn
            </span>
            <blockquote>
              <p>{LINKEDIN_EXCLUSIVITY_TOOLTIP}</p>
            </blockquote>
            <figcaption>{TERMS_COPY.noRealtimeLinkedIn}</figcaption>
          </figure>
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

      <section aria-labelledby="about-unlocks" className="about-section">
        <div className="container container--content">
          <div className="section-head">
            <span className="kicker">Unlocks and applying</span>
            <h2 id="about-unlocks">Read everything free. Unlock the link when you are ready.</h2>
            <p>
              Every listing is public with its full description. The studio&apos;s apply link
              is the one thing you unlock.
            </p>
          </div>
          <dl className="about-stats">
            <div>
              <dt>Free unlocks</dt>
              <dd>
                <span className="about-stats__value about-stats__value--accent">5</span>
                <span>per UTC week, Monday to Sunday</span>
              </dd>
            </div>
            <div>
              <dt>Counting</dt>
              <dd>
                <span className="about-stats__value">1</span>
                <span>per distinct job, opening it again is free</span>
              </dd>
            </div>
            <div>
              <dt>Where you apply</dt>
              <dd>
                <span className="about-stats__value">Studio site</span>
                <span>we show the link, the studio gets the application</span>
              </dd>
            </div>
            <div>
              <dt>Paid plans</dt>
              <dd>
                <span className="about-stats__value">Unlimited</span>
                <span>
                  unlocks, see <Link href="/pricing">pricing</Link>
                </span>
              </dd>
            </div>
          </dl>
          <p className="about-hint">
            Unlocks need a signed-in account with a short profile: display name, target role
            and remote preference.
          </p>
        </div>
      </section>

      <section aria-labelledby="about-nots" className="about-section">
        <div className="container container--content">
          <div className="section-head">
            <span className="kicker">What we do not do</span>
            <h2 id="about-nots">What Studio Direct never does.</h2>
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
            <Link className="button button--lg" href="/jobs">
              Browse jobs
            </Link>
            <Link className="button button--secondary button--lg" href="/hidden-jobs">
              Jobs not on LinkedIn
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
