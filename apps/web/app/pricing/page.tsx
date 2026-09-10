import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRightIcon, CheckIcon, LockIcon } from "../_components/icons";
import { JsonLd } from "../_components/json-ld";
import { PageHeader } from "../_components/page-header";
import { PricingPlans } from "../_components/pricing-plans";
import { isStripeCheckoutEnabled } from "../../lib/billing/plans";
import { PRICING_COPY } from "../../lib/legal/copy";

export const metadata: Metadata = {
  title: "Pricing: free plan, €9 a month or €59 a year",
  description:
    "Browse every listed Web3 job for free. Paid plans for extra account features cost €9 a month or €59 a year. Employer posting is a later slice.",
  alternates: { canonical: "/pricing" },
};

export const dynamic = "force-dynamic";

const INCLUDED = [
  "Full descriptions on every listing",
  "Public Apply on Nodework",
  "Programmatic salary, tag and location pages",
];

const FAQ = [
  {
    question: "Do I need to pay to apply?",
    answer:
      "No. Apply is public and stays on Nodework.",
  },
  {
    question: "Do you apply for me?",
    answer:
      "No. You submit the application on Nodework. We do not send you to another job board.",
  },
  {
    question: "What does the paid plan include today?",
    answer:
      "Account features from the existing billing tables. Employer post-a-job checkout is not in this slice.",
  },
  {
    question: "Can I cancel?",
    answer:
      "Yes. Paid plans renew until you cancel, and you keep paid access until the end of the period you paid for.",
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

export default async function PricingPage() {
  const { env } = await getCloudflareContext({ async: true });
  const billingLive = isStripeCheckoutEnabled(
    (env as { STRIPE_ENABLED?: string }).STRIPE_ENABLED,
  );

  return (
    <main className="surface surface--stage price">
      <div className="container">
        <JsonLd data={faqJsonLd()} />

        {PageHeader({
          kicker: "Plans",
          title: PRICING_COPY.title,
          lead: billingLive ? PRICING_COPY.billingLive : PRICING_COPY.billingNotLive,
        })}

        {!billingLive ? (
          <div className="notice notice--accent price-billing-notice" role="status">
            <LockIcon size={18} />
            <div>
              <strong>{PRICING_COPY.billingNotLive}</strong>
              <p>
                We are holding checkout until the catalog holds roughly 300 real
                career-page jobs, not seed data, so a paid plan is worth paying for. The
                figures below are what it will cost when that switch flips.
              </p>
            </div>
          </div>
        ) : null}

        {PricingPlans({ billingLive })}

        <ul aria-label="Included in every plan" className="price-includes">
          {INCLUDED.map((item) => (
            <li key={item}>
              <CheckIcon size={16} />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <section aria-labelledby="pricing-faq" className="price-faq">
          <div className="section-head price-faq__head">
            <h2 id="pricing-faq">Questions</h2>
            <p>Short answers. The terms page has the full wording.</p>
          </div>
          <dl className="price-faq__list">
            {FAQ.map((item) => (
              <div className="price-faq__item" key={item.question}>
                <dt>{item.question}</dt>
                <dd>{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="price-close">
          <p>Not sure yet? The catalog is free to read, and Apply is public on every plan.</p>
          <div className="cluster">
            <Link className="button button--ghost" href="/jobs">
              Browse jobs
            </Link>
            <Link className="text-link" href="/about">
              How Nodework works
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
