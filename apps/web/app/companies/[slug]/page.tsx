import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "../../_components/breadcrumbs";
import { ArrowRightIcon } from "../../_components/icons";
import { JobHubList } from "../../_components/job-hub-list";
import {
  getCompanyBySlug,
  listJobs,
  type JobsDatabase,
} from "../../../lib/jobs/queries";

export const revalidate = 300;

type CompanyParams = Promise<{ slug: string }>;

async function tenantDatabase() {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await db
    .prepare("SELECT id FROM tenants WHERE slug = ?")
    .bind("gaming")
    .first<string>("id");
  if (!tenantId) throw new Error("Gaming tenant was not found");
  return { db, tenantId };
}

export async function generateMetadata({
  params,
}: {
  params: CompanyParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const { db, tenantId } = await tenantDatabase();

  const company = await getCompanyBySlug(db, tenantId, slug);
  if (!company) notFound();
  return {
    title: `Remote jobs at ${company.name}`,
    description: `Remote and hybrid roles at ${company.name}, taken from the studio's own career page and listed with the full description.`,
    alternates: { canonical: `/companies/${company.slug}` },
  };
}

export default async function CompanyPage({
  params,
}: {
  params: CompanyParams;
}) {
  const { slug } = await params;
  const { db, tenantId } = await tenantDatabase();

  const company = await getCompanyBySlug(db, tenantId, slug);
  if (!company) notFound();

  const result = await listJobs(db, tenantId, { companyId: company.id });
  const hidden = result.jobs.filter(
    (job) => job.exclusivity === "hidden_from_linkedin",
  ).length;
  const initial = company.name.trim().charAt(0).toUpperCase();

  return (
    <main>
      <header className="page-header jobs-studio-header">
        <Breadcrumbs
          items={[
            { href: "/jobs", label: "Jobs" },
            { href: "/companies", label: "Studios" },
            { label: company.name },
          ]}
        />
        <div className="jobs-studio-header__row">
          <span aria-hidden="true" className="jobs-studio-mark">
            {initial}
          </span>
          <div>
            <h1>Remote jobs at {company.name}</h1>
            <p className="lead">
              Listed remote and hybrid roles from the {company.name} career page.
            </p>
          </div>
        </div>
      </header>

      <section aria-label={`Jobs at ${company.name}`} className="jobs-results">
        <div className="jobs-results__head">
          <p className="count">
            <span className="jobs-num">{result.total}</span>{" "}
            {result.total === 1 ? "role" : "roles"}
            {hidden > 0 ? `, ${hidden} not on LinkedIn` : ""}
          </p>
          <div className="jobs-results__aside">
            <Link href="/companies">All studios</Link>
          </div>
        </div>
        <JobHubList
          emptyActions={
            <Link className="button button--secondary" href="/jobs">
              Browse all jobs
            </Link>
          }
          emptyMessage={`${company.name} has no listed remote or hybrid jobs right now. New roles appear here after the next index.`}
          jobs={result.jobs}
        />
      </section>

      <p className="jobs-back">
        <Link className="text-link" href="/companies">
          See every studio in the index
          <ArrowRightIcon size={16} />
        </Link>
      </p>
    </main>
  );
}
