import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";

import { isStripeCheckoutEnabled } from "../../lib/billing/plans";
import { PRICING_COPY } from "../../lib/legal/copy";

export const metadata: Metadata = {
  title: "Pricing | Studio Direct",
  description: "Studio Direct plans: €9 / month or €59 / year.",
};

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const { env } = await getCloudflareContext({ async: true });
  const billingLive = isStripeCheckoutEnabled(
    (env as { STRIPE_ENABLED?: string }).STRIPE_ENABLED,
  );

  return (
    <main>
      <h1>{PRICING_COPY.title}</h1>
      <p>{billingLive ? PRICING_COPY.billingLive : PRICING_COPY.billingNotLive}</p>
      <div className="pricing-grid">
        <section className="price-card">
          <h2>{PRICING_COPY.monthly}</h2>
          {billingLive ? (
            <form action="/api/stripe/checkout" method="post">
              <input name="plan" type="hidden" value="monthly" />
              <button type="submit">Continue to checkout</button>
            </form>
          ) : null}
        </section>
        <section className="price-card">
          <h2>{PRICING_COPY.yearly}</h2>
          {billingLive ? (
            <form action="/api/stripe/checkout" method="post">
              <input name="plan" type="hidden" value="yearly" />
              <button type="submit">Continue to checkout</button>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}
