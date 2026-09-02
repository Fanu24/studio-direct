import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRightIcon, CheckIcon } from "../_components/icons";
import { JsonLd } from "../_components/json-ld";
import { PageHeader } from "../_components/page-header";
import { PricingPlans } from "../_components/pricing-plans";
import { isStripeCheckoutEnabled } from "../../lib/billing/plans";
import { LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../../lib/copy";
import { PRICING_COPY } from "../../lib/legal/copy";

export const metadata: Metadata = {
  title: "Pricing: free plan, €9 a month or €59 a year",
  description:
    "Browse and search every remote gaming job for free with 5 apply-link unlocks per UTC week. Unlimited unlocks cost €9 a month or €59 a year.",
  alternates: { canonical: "/pricing" },
};

export const dynamic = "force-dynamic";

const INCLUDED = [
  "Full descriptions on every listing",
  "Honest Not on LinkedIn badge",
  "Applications happen on the studio site",
];

const FAQ = [
  {
    question: "What does Not on LinkedIn mean?",
    answer: `${LINKEDIN_EXCLUSIVITY_TOOLTIP} The badge goes on only after an index pass finished. When we are not sure, it stays off.`,
  },
  {
    question: "Do you apply for me?",
    answer:
      "No, never. We show the studio's own apply link after you unlock a job. Every application happens on the studio site.",
  },
  {
    question: "How are unlocks counted?",
    answer:
      "Each distinct job you unlock counts once. Free accounts get 5 per UTC week, Monday to Sunday. Opening a job you already unlocked does not count again.",
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
    <main className="price">
      <JsonLd data={faqJsonLd()} />

      {/* Called as functions so the tested strings and checkout forms stay in the element tree. */}
      {PageHeader({
        kicker: "Plans",
        title: PRICING_COPY.title,
        lead: billingLive ? PRICING_COPY.billingLive : PRICING_COPY.billingNotLive,
      })}

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
        <p>Not sure yet? The board is free to read, and the badge works the same on every plan.</p>
        <div className="cluster">
          <Link className="button button--secondary" href="/jobs">
            Browse jobs
          </Link>
          <Link className="text-link" href="/about">
            How Studio Direct works
            <ArrowRightIcon size={16} />
          </Link>
        </div>
      </div>
    </main>
  );
}
