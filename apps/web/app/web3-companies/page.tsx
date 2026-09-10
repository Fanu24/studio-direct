import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";

import {
  CompanyCategoryChips,
  CompanyDirectoryTable,
  CompanyLeaderGrid,
  companyListJsonLd,
  joinNatural,
} from "./_directory";
import { catalogMonthLabel } from "../_components/board-chrome";
import { ArrowRightIcon } from "../_components/icons";
import { JsonLd } from "../_components/json-ld";
import {
  DIRECTORY_LIMIT,
  listCompanyCategories,
  listCompanyDirectory,
  type CompanyCategoryFacet,
  type CompanyDirectoryItem,
} from "../../lib/companies/queries";
import type { JobsDatabase } from "../../lib/jobs/queries";
import { requireTenantId } from "../../lib/tenant";

export const revalidate = 300;
export const dynamic = "force-dynamic";

/**
 * Cached per request so generateMetadata and the page component - which both
 * need the same ranked list - only pay for the directory query once instead
 * of twice.
 */
const loadDirectory = cache(
  async (): Promise<{
    companies: CompanyDirectoryItem[];
    categories: CompanyCategoryFacet[];
  }> => {
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
    const tenantId = await requireTenantId(db);
    const companies = await listCompanyDirectory(db, tenantId, { limit: DIRECTORY_LIMIT });
    const categories = await listCompanyCategories(db, tenantId);
    return { companies, categories };
  },
);

export async function generateMetadata(): Promise<Metadata> {
  const { companies } = await loadDirectory();
  const month = catalogMonthLabel();
  const hiring = companies.filter((company) => company.jobCount > 0);
  const names = hiring.slice(0, 4).map((company) => company.name);
  const title = `Top Web3 Companies - ${month}`;
  const description =
    names.length > 0
      ? `${hiring.length} web3 companies with open roles for ${month}, ranked by listed job count. ${joinNatural(names)} are hiring right now.`
      : `Web3 companies with open roles on Nodework for ${month}, ranked by listed job count.`;
  return {
    title,
    description,
    alternates: { canonical: "/web3-companies" },
  };
}

export default async function Web3CompaniesPage() {
  const { companies, categories } = await loadDirectory();
  const roles = companies.reduce((total, company) => total + company.jobCount, 0);
  const leaders = companies
    .filter((company) => company.jobCount > 0)
    .slice(0, 4)
    .map((company) => company.name);

  return (
    <main className="surface surface--data board-main">
      <JsonLd data={companyListJsonLd("Web3 companies hiring on Nodework", companies)} />

      <header className="board-hero">
        <h1>Top Web3 Companies - {catalogMonthLabel()}</h1>
        <p className="lead">
          {leaders.length > 0
            ? `The ${companies.length} web3 employers with the most listed roles on Nodework, led by ${joinNatural(leaders)}.`
            : "Every web3 employer we index, ranked by listed role count."}{" "}
          Every number below - role count, average salary, last posting date - comes from the
          listings themselves, so a quiet company reads as quiet rather than as a blank.
        </p>
        <p className="count">
          <span className="jobs-num">{companies.length}</span>{" "}
          {companies.length === 1 ? "company" : "companies"},{" "}
          <span className="jobs-num">{roles}</span>{" "}
          {roles === 1 ? "listed role" : "listed roles"}
        </p>
        {CompanyCategoryChips({ categories })}
        <p className="muted">
          Check also{" "}
          <Link className="text-link" href="/web3-companies/top-growing">
            top growing Web3 companies
            <ArrowRightIcon size={15} />
          </Link>
        </p>
      </header>

      {companies.some((company) => company.jobCount > 0) ? (
        <section aria-labelledby="company-leaders" className="container jobs-more">
          <h2 id="company-leaders">Hiring the most right now</h2>
          {CompanyLeaderGrid({ companies })}
        </section>
      ) : null}

      {CompanyDirectoryTable({
        companies,
        emptyMessage: "No companies are listed right now.",
      })}
    </main>
  );
}
