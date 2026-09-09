import { notFound } from "next/navigation";

import { parseSalaryPageSlug } from "@gaming/shared";

import { NON_TECH_SALARY_ROLES } from "../../_components/board-chrome";
import SalaryRolePage, {
  generateMetadata as salaryMetadata,
} from "../../web3-salaries/[slug]/page";

type Params = Promise<{ slug: string }>;

/**
 * This hub carries two dimensions, and the gate used to allow only the first.
 *
 * A non-tech role (`/marketing`, `/community-manager`) is one. The other is geography:
 * the reference serves a country, region or city here as well, and gating on
 * `NON_TECH_SALARY_ROLES` membership alone 404'd all 38 of the geo URLs it links.
 * `SalaryRolePage` already renders every one of those kinds — `/web3-salaries/germany`
 * has always worked — so only the guard needed widening.
 *
 * Tech roles stay out deliberately: `/web3-non-tech-salaries/solidity-developer` is not a
 * page this hub should answer.
 */
function isNonTechSalarySlug(slug: string): boolean {
  if (NON_TECH_SALARY_ROLES.includes(slug as (typeof NON_TECH_SALARY_ROLES)[number])) {
    return true;
  }
  const parsed = parseSalaryPageSlug(slug);
  return parsed?.kind === "country" || parsed?.kind === "region" || parsed?.kind === "city";
}

export async function generateMetadata({ params }: { params: Params }) {
  const slug = (await params).slug;
  if (!isNonTechSalarySlug(slug)) {
    notFound();
  }
  return salaryMetadata({ params: Promise.resolve({ slug }) });
}

export default async function NonTechSalarySlugPage({ params }: { params: Params }) {
  const slug = (await params).slug;
  if (!isNonTechSalarySlug(slug)) {
    notFound();
  }
  return SalaryRolePage({ params: Promise.resolve({ slug }) });
}
