import { tagLabel } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import {
  CompanyCategoryChips,
  CompanyDirectoryTable,
  CompanyLeaderGrid,
  companyListJsonLd,
  joinNatural,
} from "../../_directory";
import { catalogMonthLabel } from "../../../_components/board-chrome";
import { Breadcrumbs } from "../../../_components/breadcrumbs";
import { ArrowRightIcon } from "../../../_components/icons";
import { JsonLd } from "../../../_components/json-ld";
import {
  decodeCompanySlug,
  listCompanyCategories,
  listCompanyDirectory,
  type CompanyCategoryFacet,
  type CompanyDirectoryItem,
} from "../../../../lib/companies/queries";
import type { JobsDatabase } from "../../../../lib/jobs/queries";
import { requireTenantId } from "../../../../lib/tenant";

export const revalidate = 300;
export const dynamic = "force-dynamic";

type TagParams = Promise<{ tag: string }>;

/**
 * Cached per request (by the decoded category slug) so generateMetadata and
 * the page component only pay for the directory query once instead of twice.
 */
const loadCategory = cache(
  async (
    category: string,
  ): Promise<{
    companies: CompanyDirectoryItem[];
    categories: CompanyCategoryFacet[];
  } | null> => {
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
    const tenantId = await requireTenantId(db);
    const companies = await listCompanyDirectory(db, tenantId, { category });
    if (companies.length === 0) return null;
    const categories = await listCompanyCategories(db, tenantId);
    return { companies, categories };
  },
);

export async function generateMetadata({
  params,
}: {
  params: TagParams;
}): Promise<Metadata> {
  const category = decodeCompanySlug((await params).tag);
  const loaded = await loadCategory(category);
  if (!loaded) notFound();

  const month = catalogMonthLabel();
  const label = tagLabel(category);
  const names = loaded.companies.slice(0, 4).map((company) => company.name);
  return {
    title: `Top ${label} Web3 Companies - ${month}`,
    description:
      names.length > 0
        ? `${loaded.companies.length} web3 companies hiring for ${label} work in ${month}, ranked by listed job count. ${joinNatural(names)} lead the category.`
        : `Web3 companies hiring for ${label} work in ${month}, ranked by listed job count.`,
    alternates: { canonical: `/web3-companies/tag/${category}` },
  };
}

export default async function Web3CompanyCategoryPage({
  params,
}: {
  params: TagParams;
}) {
  const category = decodeCompanySlug((await params).tag);
  const loaded = await loadCategory(category);
  if (!loaded) notFound();

  const { companies, categories } = loaded;
  const label = tagLabel(category);
  const roles = companies.reduce((total, company) => total + company.jobCount, 0);

  return (
    <main className="surface surface--data board-main">
      <JsonLd
        data={companyListJsonLd(`Web3 companies hiring for ${label} work`, companies)}
      />

      <header className="board-hero">
        <Breadcrumbs
          items={[
            { href: "/web3-companies", label: "Web3 companies" },
            { label },
          ]}
        />
        <h1>
          Top {label} Web3 Companies - {catalogMonthLabel()}
        </h1>
        <p className="lead">
          Every company we index whose listings lean {label} more than any other category.
          Ranked by listed role count, with the same salary and last-posted columns as the
          full index.
        </p>
        <p className="count">
          <span className="jobs-num">{companies.length}</span>{" "}
          {companies.length === 1 ? "company" : "companies"},{" "}
          <span className="jobs-num">{roles}</span>{" "}
          {roles === 1 ? "listed role" : "listed roles"}
        </p>
        {CompanyCategoryChips({ categories, active: category })}
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
          <h2 id="company-leaders">Leading {label} employers</h2>
          {CompanyLeaderGrid({ companies, limit: 3 })}
        </section>
      ) : null}

      {CompanyDirectoryTable({
        companies,
        emptyMessage: `No company leads with ${label} work right now.`,
      })}
    </main>
  );
}
