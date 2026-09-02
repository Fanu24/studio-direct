import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRightIcon } from "../_components/icons";
import { JsonLd, absoluteUrl } from "../_components/json-ld";
import { listCompanies, type JobsDatabase } from "../../lib/jobs/queries";

export const metadata: Metadata = {
  title: "Game studios in the index",
  description:
    "Every game studio whose career page we index, with the number of remote and hybrid roles listed right now.",
  alternates: { canonical: "/companies" },
};

export const revalidate = 300;
export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await db
    .prepare("SELECT id FROM tenants WHERE slug = ?")
    .bind("gaming")
    .first<string>("id");

  if (!tenantId) {
    throw new Error("Gaming tenant was not found");
  }

  const companies = await listCompanies(db, tenantId);
  const roles = companies.reduce((total, company) => total + company.jobCount, 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Game studios in the Studio Direct index",
    numberOfItems: companies.length,
    itemListElement: companies.map((company, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: company.name,
      url: absoluteUrl(`/companies/${company.slug}`),
    })),
  };

  return (
    <main>
      <JsonLd data={jsonLd} />

      <header className="page-header">
        <span className="kicker">Career pages first</span>
        <h1>Studios in the index</h1>
        <p className="lead">
          We read each studio&apos;s own career page and its applicant tracking board, then
          list the remote and hybrid roles here.
        </p>
      </header>

      <section aria-label="Studios" className="jobs-results">
        <div className="jobs-results__head">
          <p className="count">
            <span className="jobs-num">{companies.length}</span>{" "}
            {companies.length === 1 ? "studio" : "studios"},{" "}
            <span className="jobs-num">{roles}</span>{" "}
            {roles === 1 ? "listed role" : "listed roles"}
          </p>
          <div className="jobs-results__aside">
            <Link className="text-link" href="/jobs">
              Browse every role
              <ArrowRightIcon size={15} />
            </Link>
          </div>
        </div>

        {companies.length === 0 ? (
          <div className="empty">
            <p>No studios are listed right now.</p>
            <div className="cluster">
              <Link className="button button--secondary" href="/jobs">
                Browse all jobs
              </Link>
            </div>
          </div>
        ) : (
          <ul className="jobs-studio-grid">
            {companies.map((company) => (
              <li key={company.id}>
                <Link className="jobs-studio-card" href={`/companies/${company.slug}`}>
                  <span aria-hidden="true" className="jobs-studio-mark">
                    {company.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="jobs-studio-card__body">
                    <span className="jobs-studio-card__name">{company.name}</span>
                    <span className="jobs-studio-card__count">
                      {company.jobCount === 0
                        ? "No listed roles right now"
                        : `${company.jobCount} remote or hybrid ${
                            company.jobCount === 1 ? "role" : "roles"
                          }`}
                    </span>
                  </span>
                  <ArrowRightIcon size={16} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="studios-note" className="jobs-more">
        <div className="jobs-more__head">
          <div>
            <h2 id="studios-note">Missing a studio?</h2>
            <p>
              The index grows as we add reviewed career pages. A studio without listed roles
              stays here so you can see what we cover.
            </p>
          </div>
          <Link className="text-link" href="/about">
            How the index works
            <ArrowRightIcon size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
