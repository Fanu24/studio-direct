import Link from "next/link";

import { PRICING_COPY } from "../../../lib/legal/copy";
import { ArrowRightIcon } from "../icons";

export function PricingTeaser({ billingLive }: { billingLive: boolean }) {
  return (
    <section className="section price-teaser">
      <div className="container">
        <div className="section-head" data-reveal>
          <h2>Simple pricing, when billing goes live.</h2>
          <p>{billingLive ? PRICING_COPY.billingLive : PRICING_COPY.billingNotLive}</p>
        </div>
        <div className="price-teaser__grid">
          <div className="panel price-teaser__plan" data-reveal>
            <span className="tag">Monthly</span>
            <h3>{PRICING_COPY.monthly}</h3>
            <p>Unlimited unlocks. Cancel any time.</p>
          </div>
          <div className="panel panel--accent price-teaser__plan" data-reveal data-reveal-delay="1">
            <span className="tag tag--accent">Yearly</span>
            <h3>{PRICING_COPY.yearly}</h3>
            <p>Unlimited unlocks, twelve months for the price of about six and a half.</p>
          </div>
        </div>
        <div className="price-teaser__free" data-reveal>
          <p>
            <strong>Free stays free.</strong> Browse and search every listing, read full
            descriptions, and unlock 5 apply links per UTC week.
          </p>
          <Link className="text-link" href="/pricing">
            See pricing
            <ArrowRightIcon size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
