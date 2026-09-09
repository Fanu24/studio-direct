import { permanentRedirect } from "next/navigation";

import { decodeCompanySlug } from "../../../lib/companies/queries";

/**
 * /companies/:slug was the old canonical company profile path; the canonical
 * path is now /web3-companies/:slug. Route params arrive percent-encoded, so
 * the segment is decoded and re-encoded rather than concatenated raw - a
 * company slug carrying a "+" would otherwise redirect to a 404.
 */
export default async function CompanyRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/web3-companies/${encodeURIComponent(decodeCompanySlug(slug))}`);
}
