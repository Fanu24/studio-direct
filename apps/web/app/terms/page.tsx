import type { Metadata } from "next";

import { TERMS_COPY } from "../../lib/legal/copy";

export const metadata: Metadata = {
  title: TERMS_COPY.title,
  description:
    "Terms of Service for Nodework: listings come from third parties and may be incomplete.",
  alternates: { canonical: "/terms" },
};

const SECTIONS = [
  { id: "operator", label: "Who operates this site" },
  { id: "sources", label: "Where listings come from" },
  { id: "inventory", label: "Incomplete inventory" },
  { id: "linkedin", label: "LinkedIn coverage" },
  { id: "badge", label: "The badge" },
] as const;

export default function TermsPage() {
  return (
    <main className="legal-page">
      <header className="legal-page__head">
        <span className="kicker">Legal</span>
        <h1>{TERMS_COPY.title}</h1>
      </header>
      <div className="legal-page__grid">
        <nav aria-label="On this page" className="legal-toc">
          <span className="tag">On this page</span>
          <ol>
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.label}</a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="legal-body">
          <section aria-labelledby="operator-title" id="operator">
            <h2 id="operator-title">Who operates this site</h2>
            <p>{TERMS_COPY.legalEntity}</p>
          </section>
          <section aria-labelledby="sources-title" id="sources">
            <h2 id="sources-title">Where listings come from</h2>
            <p>{TERMS_COPY.thirdParties}</p>
          </section>
          <section aria-labelledby="inventory-title" id="inventory">
            <h2 id="inventory-title">Incomplete inventory</h2>
            <p>{TERMS_COPY.incomplete}</p>
          </section>
          <section aria-labelledby="linkedin-title" id="linkedin">
            <h2 id="linkedin-title">LinkedIn coverage</h2>
            <p>{TERMS_COPY.noRealtimeLinkedIn}</p>
          </section>
          <section aria-labelledby="badge-title" id="badge">
            <h2 id="badge-title">The badge</h2>
            <p>
              A “Not on LinkedIn” badge means: {TERMS_COPY.badgeMeaning}
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
