import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "../../_components/breadcrumbs";
import { ArrowRightIcon, CheckIcon, LockIcon } from "../../_components/icons";
import { JsonLd } from "../../_components/json-ld";
import { PageHeader } from "../../_components/page-header";

export const metadata: Metadata = {
  title: "Job post bundles on Nodework",
  description:
    "How a multi-post job bundle would work on Nodework: pack sizes, the 24 month posting window, and the placement formats a bundle would carry. Presentation only, employer checkout is not live.",
  alternates: { canonical: "/post-web3-job/bundle" },
  robots: { index: true, follow: true },
};

/**
 * Presentation-only page. The reference board this IA mirrors sells packs of
 * job posts here with a live order form; Nodework deliberately ships the same
 * URL and the same section anatomy with **no** price, no card field, no Stripe
 * and no order state. Employer checkout is out of scope for this slice
 * (docs/superpowers/specs/2026-09-08-nodework-seo-inventory-design.md), so this
 * page describes the shape of a bundle and routes to the account, and nothing
 * on it may imply that money can change hands today. If you add a price here,
 * you have to add the billing to go with it - the bundle-page test asserts
 * both that no currency figure appears and that no form element is rendered.
 */

const PACKS = [
  {
    size: "3 posts",
    fit: "One team hiring in waves",
    detail:
      "Enough to cover a single squad's open seats across a quarter without re-buying every time a role opens.",
  },
  {
    size: "5 posts",
    fit: "A growing team",
    detail:
      "The usual shape once engineering and non-tech hire on separate calendars and neither wants to wait for the other.",
  },
  {
    size: "10 posts",
    fit: "Continuous hiring",
    detail:
      "For companies that keep two or three roles live at all times and want the posting decision to stop being a purchase decision.",
  },
  {
    size: "25 posts",
    fit: "Agencies and portfolios",
    detail:
      "Recruiters and funds posting on behalf of several companies, where posts are drawn down across more than one employer profile.",
  },
];

const WINDOW_POINTS = [
  "Posts in a bundle stay unused until you spend them, so a hiring freeze does not burn the pack.",
  "Each post, once spent, runs the same way a single post does: full description, search, tag pages, location pages and salary pages.",
  "Unspent posts carry a 24 month window from the day the bundle is bought, which is the shape this page will ship with.",
  "Nothing expires silently: the account that owns the bundle sees the remaining count and the window on every listing screen.",
];

const FORMATS = [
  {
    name: "Standard placement",
    detail:
      "The default. Your listing joins the catalog in posted order and appears on every tag, location and salary page it qualifies for.",
  },
  {
    name: "Pinned placement",
    detail:
      "A listing held at the top of the board for a fixed run. Described on the advertising page; it is a placement format, not a ranking bribe, and the job still has to be real.",
  },
  {
    name: "Company logo",
    detail:
      "The company mark rendered on the row instead of the initial block. Pulled from the company profile, so it applies to every job under that profile.",
  },
  {
    name: "Highlight",
    detail:
      "A tinted row so the listing reads as distinct in a long board. Deliberately one tint, not a colour picker, so the board does not turn into a billboard.",
  },
];

const FAQ = [
  {
    question: "Can I buy a bundle right now?",
    answer:
      "No. This page describes the shape of a bundle so employers can see what is coming. There is no checkout, no card form and no invoice on Nodework yet. Nothing on this page takes money.",
  },
  {
    question: "What does a bundle cost?",
    answer:
      "There is no price, because there is nothing to buy. When employer checkout ships, the price per pack goes on this page and on the pricing page before anyone is asked for a card, not quoted privately over email.",
  },
  {
    question: "How do I get a role listed today?",
    answer:
      "Create a free account and send us the role from the post a job page. We put it into the catalog manually while self-serve posting is unbuilt. That path costs nothing.",
  },
  {
    question: "Are the plans on the pricing page job bundles?",
    answer:
      "No. The paid plans on the pricing page are candidate account features. They do not include a job post, and buying one does not put a listing on this site.",
  },
  {
    question: "Will bundled posts look different from imported jobs?",
    answer:
      "No. Every listing renders through the same job page and the same company profile. A bundle changes how many posts you hold, not what a post is.",
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

export default function PostWeb3JobBundlePage() {
  return (
    <main className="surface surface--stage marketing post-job">
      <JsonLd data={faqJsonLd()} />

      <div className="container container--content">
        {PageHeader({
          crumbs: (
            <Breadcrumbs
              items={[
                { href: "/post-web3-job", label: "Post a job" },
                { label: "Bundles" },
              ]}
            />
          ),
          kicker: "For employers",
          title: "Job post bundles",
          lead: "A bundle is a pack of job posts an employer holds and spends when a seat opens, instead of deciding to buy every time a role comes up. This page describes that shape. It is not a checkout, and Nodework cannot take money for a job post today.",
        })}
      </div>

      <section aria-labelledby="bundle-status" className="marketing-section">
        <div className="container container--content stack">
          <h2 id="bundle-status">Where this stands today</h2>
          <div className="marketing-notice">
            <LockIcon size={18} />
            <p>
              Employer checkout is not built. There is no order form on this page and no
              price attached to any pack below, on purpose. Until posting is self-serve,
              a role reaches the catalog through a free account and a manual import.
            </p>
          </div>
          <p>
            We are publishing the page anyway because the shape of the offer is the part
            employers ask about first: how many posts, how long they last, and what a post
            gets you. Those answers do not need a payment page to be true, and putting a
            fake price on a page that cannot charge would be worse than having no price.
          </p>
        </div>
      </section>

      <section aria-labelledby="bundle-packs" className="band marketing-section">
        <div className="container container--content stack">
          <div className="section-head">
            <span className="kicker">Pack sizes</span>
            <h2 id="bundle-packs">What a bundle would hold</h2>
            <p>
              Four sizes, chosen from how teams actually hire rather than from a pricing
              ladder. The larger the pack, the lower the per post cost will be when pricing
              is published, which is the only reason a bundle exists at all.
            </p>
          </div>
          <div className="marketing-table-wrap">
            <table className="marketing-table">
              <thead>
                <tr>
                  <th scope="col">Pack</th>
                  <th scope="col">Who it is for</th>
                  <th scope="col">Why that size</th>
                </tr>
              </thead>
              <tbody>
                {PACKS.map((pack) => (
                  <tr key={pack.size}>
                    <td>{pack.size}</td>
                    <td>{pack.fit}</td>
                    <td className="marketing-table__desc">{pack.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-labelledby="bundle-window" className="marketing-section">
        <div className="container container--content stack">
          <div className="section-head">
            <span className="kicker">Posting window</span>
            <h2 id="bundle-window">Posts stay valid for 24 months</h2>
          </div>
          <ul className="marketing-card__list">
            {WINDOW_POINTS.map((point) => (
              <li key={point}>
                <CheckIcon size={16} />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="bundle-formats" className="band marketing-section">
        <div className="container container--content stack">
          <div className="section-head">
            <span className="kicker">Placement formats</span>
            <h2 id="bundle-formats">What a post can carry</h2>
            <p>
              These are the formats a bundled post would be able to use. They are described
              here and on the{" "}
              <Link href="/ads">advertising page</Link>; none of them is self-serve yet
              either.
            </p>
          </div>
          <ol className="about-steps">
            {FORMATS.map((format, index) => (
              <li className="panel" key={format.name}>
                <span className="about-steps__num">0{index + 1}</span>
                <h3>{format.name}</h3>
                <p>{format.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="bundle-cta" className="marketing-section">
        <div className="container container--content stack">
          <div className="section-head">
            <span className="kicker">Next step</span>
            <h2 id="bundle-cta">Start with an account, not a card</h2>
            <p>
              Create a free account and send us the role. When bundles become buyable, the
              account you create today is the one that will hold them, and the price will
              be on this page before it is on an invoice.
            </p>
          </div>
          <div className="cluster">
            <Link className="button button--primary" href="/login">
              Create a free account
            </Link>
            <Link className="text-link" href="/post-web3-job">
              Post a single job
              <ArrowRightIcon size={16} />
            </Link>
            <Link className="text-link" href="/pricing">
              See current plans
              <ArrowRightIcon size={16} />
            </Link>
            <Link className="text-link" href="/hire">
              Who is hiring on Nodework
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="bundle-faq" className="band marketing-section">
        <div className="container container--content">
          <div className="section-head">
            <h2 id="bundle-faq">Questions</h2>
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
