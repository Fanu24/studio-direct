import Link from "next/link";

import { PRICING_COPY } from "../../lib/legal/copy";
import { CheckIcon } from "./icons";

const FREE_FEATURES = [
  "Browse and search every listing",
  "Full job descriptions, not snippets",
  "5 unlocks per UTC week",
  "Apply on the company site",
];

const PAID_FEATURES: { label: string; tag?: string }[] = [
  { label: "Unlimited unlocks" },
  { label: "Hidden digest email", tag: "Not available yet" },
  { label: "Cancel any time" },
];

function featureList(items: { label: string; tag?: string }[]) {
  return (
    <ul className="price-plan__list">
      {items.map((item) => (
        <li className="check" key={item.label}>
          <CheckIcon size={16} />
          <span className="price-plan__feature">
            {item.label}
            {item.tag ? <span className="tag">{item.tag}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function checkout(plan: "monthly" | "yearly", billingLive: boolean, primary: boolean) {
  if (!billingLive) {
    return <p className="price-plan__soon">Checkout opens when billing goes live.</p>;
  }
  return (
    <form action="/api/stripe/checkout" className="price-plan__form" method="post">
      <input name="plan" type="hidden" value={plan} />
      <button
        className={primary ? "button button--primary button--block" : "button button--ghost button--block"}
        type="submit"
      >
        Continue to checkout
      </button>
    </form>
  );
}

/**
 * Three plan cards. Rendered by calling `PricingPlans({ billingLive })` as a function on the
 * pricing page so the plan labels and checkout forms stay in the element tree the tests walk.
 */
export function PricingPlans({ billingLive }: { billingLive: boolean }) {
  return (
    <section aria-label="Plans" className="price-plans">
      <div className="grid grid--3 price-grid">
        <article className="price-plan price-plan--free">
          <header className="price-plan__head">
            <div className="price-plan__tags">
              <span className="tag">Free</span>
            </div>
            <h2>€0</h2>
            <p className="price-plan__note">No card, no trial clock</p>
          </header>
          <p className="price-plan__intro">What you get today.</p>
          {featureList(FREE_FEATURES.map((label) => ({ label })))}
          <div className="price-plan__cta">
            <Link className="button button--ghost button--block" href="/jobs">
              Browse jobs
            </Link>
            <p className="price-plan__hint">
              Sign in and finish a short profile to use your unlocks.
            </p>
          </div>
        </article>

        <article className="price-plan price-plan--monthly">
          <header className="price-plan__head">
            <div className="price-plan__tags">
              <span className="tag">Monthly</span>
            </div>
            <h2>{PRICING_COPY.monthly}</h2>
            <p className="price-plan__note">Billed every month</p>
          </header>
          <p className="price-plan__intro">Everything in Free, plus:</p>
          {featureList(PAID_FEATURES)}
          <div className="price-plan__cta">{checkout("monthly", billingLive, false)}</div>
        </article>

        <article className="price-plan price-plan--yearly">
          <header className="price-plan__head">
            <div className="price-plan__tags">
              <span className="tag tag--accent">Yearly</span>
              <span className="price-plan__flag">Best value</span>
            </div>
            <h2>{PRICING_COPY.yearly}</h2>
            <p className="price-plan__note">About €4.92 a month, billed once a year</p>
          </header>
          <p className="price-plan__intro">Everything in Free, plus:</p>
          {featureList(PAID_FEATURES)}
          <div className="price-plan__cta">{checkout("yearly", billingLive, true)}</div>
        </article>
      </div>
    </section>
  );
}
