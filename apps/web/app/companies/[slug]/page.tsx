import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JobHubList } from "../../_components/job-hub-list";
import {
  getCompanyBySlug,
  listJobs,
  type JobsDatabase,
} from "../../../lib/jobs/queries";

export const dynamic = "force-dynamic";

type CompanyParams = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: CompanyParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await db
    .prepare("SELECT id FROM tenants WHERE slug = ?")
    .bind("gaming")
    .first<string>("id");
  if (!tenantId) throw new Error("Gaming tenant was not found");

  const company = await getCompanyBySlug(db, tenantId, slug);
  if (!company) notFound();
  return {
    title: `Remote jobs at ${company.name} | Studio Direct`,
    description: `Browse listed remote and hybrid gaming jobs at ${company.name}.`,
  };
}

export default async function CompanyPage({
  params,
}: {
  params: CompanyParams;
}) {
  const { slug } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await db
    .prepare("SELECT id FROM tenants WHERE slug = ?")
    .bind("gaming")
    .first<string>("id");
  if (!tenantId) throw new Error("Gaming tenant was not found");

  const company = await getCompanyBySlug(db, tenantId, slug);
  if (!company) notFound();

  const result = await listJobs(db, tenantId, { companyId: company.id });

  return (
    <main>
      <header>
        <Link href="/jobs">All jobs</Link>
        <h1>Remote jobs at {company.name}</h1>
        <p>Listed remote and hybrid roles from {company.name}.</p>
      </header>
      <JobHubList
        emptyMessage={`${company.name} has no listed remote or hybrid jobs right now.`}
        jobs={result.jobs}
      />
    </main>
  );
}
