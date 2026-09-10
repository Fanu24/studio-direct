import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";

import { ArticleLayout } from "../_components/article-layout";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { JsonLd } from "../_components/json-ld";
import {
  LEARN_CATEGORIES,
  LEARN_CATALOG_LINKS,
  LEARN_FACETS,
  learnCategoryLabel,
} from "./categories";
import {
  LEARN_CAREER_LANES,
  LEARN_COPY,
  LEARN_HUB_DESCRIPTION,
  LEARN_HUB_FAQ,
  LEARN_HUB_PARAGRAPHS,
  LEARN_HUB_TITLE,
} from "./copy";

export const metadata: Metadata = {
  title: LEARN_HUB_TITLE,
  description: LEARN_HUB_DESCRIPTION,
  alternates: { canonical: "/learn-web3" },
};

export const revalidate = 300;

/**
 * The two `.about-faq__item dt` / `dd` rules from styles/pricing.css, restated
 * so the FAQ block below renders exactly as it does on every other page that
 * uses the shared FAQ list while its questions are headings rather than terms.
 * Inline rather than a new class because pricing.css is not ours to edit and a
 * fresh component-level CSS import reorders the emitted CSS chunks.
 */
const FAQ_QUESTION_STYLE: CSSProperties = {
  color: "var(--text)",
  fontSize: "1.05rem",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  // The dt inherited body's 1.6; the global h1..h4 rule would impose 1.08.
  lineHeight: "inherit",
  margin: "0 0 8px",
  textWrap: "balance",
};

const FAQ_ANSWER_STYLE: CSSProperties = {
  color: "var(--muted)",
  lineHeight: 1.55,
  margin: 0,
  maxWidth: "none",
  textWrap: "pretty",
};

export default function LearnWeb3HubPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Learn Web3 on Nodework",
    itemListElement: LEARN_CATEGORIES.map((slug, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: LEARN_COPY[slug].title,
      url: `/learn-web3/${slug}`,
    })),
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: LEARN_HUB_FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />
      <ArticleLayout
        breadcrumbs={
          <Breadcrumbs
            items={[
              { href: "/jobs", label: "Jobs" },
              { label: LEARN_HUB_TITLE },
            ]}
          />
        }
        lead={LEARN_HUB_DESCRIPTION}
        related={
          <>
            <h2>Open the catalog</h2>
            <div className="chips">
              {LEARN_CATALOG_LINKS.map((link) => (
                <Link className="chip" href={link.href} key={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </>
        }
        title={LEARN_HUB_TITLE}
        toc={[
          { href: "#browse", label: "Browse by format, level, topic" },
          { href: "#career", label: "Start your Web3 career" },
          { href: "#faq", label: "FAQ" },
          { href: "/learn-web3/all", label: "All formats" },
          ...LEARN_CATALOG_LINKS.slice(0, 3).map((link) => ({
            href: link.href,
            label: link.label,
          })),
        ]}
      >
        {LEARN_HUB_PARAGRAPHS.map((paragraph) => (
          <p key={paragraph.slice(0, 32)}>{paragraph}</p>
        ))}
        <section
          aria-label="Browse Learn Web3 by facet"
          className="learn-facets m-sheen"
          id="browse"
        >
          {LEARN_FACETS.map((facet) => (
            <div className="learn-facet-group" key={facet.key}>
              <h2>{facet.label}</h2>
              <div className="chips">
                {facet.slugs.map((slug) => (
                  <Link
                    className="chip"
                    href={`/learn-web3/${slug}`}
                    key={slug}
                  >
                    {learnCategoryLabel(slug)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section aria-labelledby="learn-career" className="learn-facets" id="career">
          <h2 id="learn-career">Start your Web3 career</h2>
          <p>
            Each lane below is a way into the same catalog, not a different one. Pick the
            one that matches the work you can already describe, then read listings until
            the gap between you and the role is a sentence you could write down.
          </p>
          {LEARN_CAREER_LANES.map((lane) => (
            <div className="learn-facet-group m-reveal" data-reveal key={lane.key}>
              <h3>{lane.heading}</h3>
              <p>{lane.blurb}</p>
              <div className="chips">
                {lane.links.map((link) => (
                  <Link className="chip" href={link.href} key={link.href}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section aria-labelledby="learn-faq" id="faq">
          <h2 id="learn-faq">FAQ</h2>
          {/*
            Questions are headings, not <dt>s, so each one lands in the page
            outline - the reference learn hub marks its FAQ questions the same
            way and at the same level as the "FAQ" heading itself. HTML forbids
            heading content inside a <dt>, so the list is a plain <div> here
            instead of the site's shared <dl> FAQ pattern; the two container
            classes are class selectors and still apply, and the two element
            rules that keyed off dt/dd are restated inline so the block renders
            byte-identically. The other five pages using about-faq__list still
            use the <dl> form - aligning them needs styles/pricing.css.
          */}
          <div className="about-faq__list">
            {LEARN_HUB_FAQ.map((item) => (
              <div className="about-faq__item m-reveal" data-reveal key={item.question}>
                <h2 style={FAQ_QUESTION_STYLE}>{item.question}</h2>
                <p style={FAQ_ANSWER_STYLE}>{item.answer}</p>
              </div>
            ))}
          </div>
          <p>
            More career questions, including how applying on this site works, are answered
            on the <Link href="/faq">FAQ page</Link>.
          </p>
        </section>
      </ArticleLayout>
    </>
  );
}
