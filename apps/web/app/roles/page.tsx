import { FEATURED_TAG_CHIPS, tagLabel } from "@gaming/shared";
import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRightIcon } from "../_components/icons";
import { JsonLd, absoluteUrl } from "../_components/json-ld";

export const metadata: Metadata = {
  title: "Web3 jobs by tag",
  description:
    "Programmatic Nodework landings for Solidity, Rust, Solana, marketing, internships and other Web3 skills.",
  alternates: { canonical: "/roles" },
};

export const revalidate = 300;

export default function RolesPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Web3 job tags on Nodework",
    numberOfItems: FEATURED_TAG_CHIPS.length,
    itemListElement: FEATURED_TAG_CHIPS.map((slug, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `${tagLabel(slug)} jobs`,
      url: absoluteUrl(`/${slug}-jobs`),
    })),
  };

  return (
    <main>
      <JsonLd data={jsonLd} />

      <header className="page-header">
        <span className="kicker">Browse by skill</span>
        <h1>Web3 jobs by tag</h1>
        <p className="lead">
          Each landing lists imported jobs tagged with that skill, plus a remote variant.
        </p>
      </header>

      <section aria-label="Tag hubs" className="jobs-results">
        <div className="jobs-results__head">
          <p className="count">
            <span className="jobs-num">{FEATURED_TAG_CHIPS.length}</span> featured tags
          </p>
          <div className="jobs-results__aside">
            <Link className="text-link" href="/jobs">
              Search every role
              <ArrowRightIcon size={15} />
            </Link>
          </div>
        </div>

        <ul className="jobs-role-grid">
          {FEATURED_TAG_CHIPS.map((slug) => {
            const label = tagLabel(slug);
            return (
              <li className="jobs-role-card" key={slug}>
                <h2 className="jobs-role-card__title">
                  <Link href={`/${slug}-jobs`}>{label} jobs</Link>
                </h2>
                <p className="jobs-role-card__note">
                  Open {label} roles imported into the Nodework catalog.
                </p>
                <Link className="jobs-role-card__skill chip" href={`/remote-${slug}-jobs`}>
                  Remote {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="roles-note" className="jobs-more">
        <div className="jobs-more__head">
          <div>
            <h2 id="roles-note">Nothing matching your skill?</h2>
            <p>
              Search the full catalog instead. Tags come from the import; unusual titles still
              show up in search.
            </p>
          </div>
          <Link className="text-link" href="/jobs">
            Search all jobs
            <ArrowRightIcon size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
