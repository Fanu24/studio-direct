import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRightIcon, CheckIcon } from "../_components/icons";
import { PageHeader } from "../_components/page-header";
import { TERMS_COPY } from "../../lib/legal/copy";

export const metadata: Metadata = {
  title: "Legal",
  description:
    "A short hub for Nodework's legal pages: what the Terms of Service and Privacy Policy each cover, and where to read the full text.",
  alternates: { canonical: "/legal" },
};

const TERMS_TOPICS = [
  "Where job listings come from and why our inventory can be incomplete",
  "How the LinkedIn-exclusivity badge on a job is decided",
  "What using the account and Apply flow means for you",
];

const PRIVACY_TOPICS = [
  "The job-board purpose: account, profile, unlocks, CV and billing data",
  "The separate, opt-in recruiter talent pool purpose",
  "That applying for a job does not opt you into anything else",
];

export default function LegalPage() {
  return (
    <main className="marketing legal">
      <div className="container container--content">
        {PageHeader({
          kicker: "Legal",
          title: "Legal information",
          lead: "Two documents, kept short and separate on purpose: the Terms of Service and the Privacy Policy. This page just points to each and says what it covers.",
        })}
      </div>

      <section aria-labelledby="legal-docs" className="marketing-section">
        <div className="container container--content marketing-grid marketing-grid--2">
          <article className="panel marketing-card">
            <h2>Terms of Service</h2>
            <p>Where listings come from, what the catalog promises, and what it does not.</p>
            <ul className="marketing-card__list">
              {TERMS_TOPICS.map((item) => (
                <li key={item}>
                  <CheckIcon size={16} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link className="text-link" href="/terms">
              Read the Terms of Service
              <ArrowRightIcon size={16} />
            </Link>
          </article>

          <article className="panel marketing-card">
            <h2>Privacy Policy</h2>
            <p>How account, profile and billing data is used, and the separate opt-in for recruiters.</p>
            <ul className="marketing-card__list">
              {PRIVACY_TOPICS.map((item) => (
                <li key={item}>
                  <CheckIcon size={16} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link className="text-link" href="/privacy">
              Read the Privacy Policy
              <ArrowRightIcon size={16} />
            </Link>
          </article>
        </div>
      </section>

      <section aria-labelledby="legal-entity" className="band marketing-section">
        <div className="container container--content stack">
          <div className="section-head">
            <span className="kicker">Entity</span>
            <h2 id="legal-entity">Who operates Nodework</h2>
            <p>{TERMS_COPY.legalEntity}</p>
            <p>
              We have not published a separate legal-enquiries address yet. The note
              above is the current, honest status rather than a placeholder we are
              hiding.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
