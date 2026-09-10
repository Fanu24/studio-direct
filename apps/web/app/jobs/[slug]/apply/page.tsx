import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { JobApplyForm } from "../../../_components/job-apply-form";
import { remoteLabel } from "../../../_components/job-card";
import {
  getJobBySlug,
  jobApplyHref,
  jobPublicHref,
  type JobsDatabase,
} from "../../../../lib/jobs/queries";
import { requireTenantId } from "../../../../lib/tenant";

export const revalidate = 300;

type ApplyParams = Promise<{ slug: string }>;
type ApplySearch = Promise<{ sent?: string; error?: string }>;

async function loadJob(slug: string) {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await requireTenantId(db);
  return getJobBySlug(db, tenantId, slug);
}

export async function generateMetadata({
  params,
}: {
  params: ApplyParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = await loadJob(slug);
  if (!job) notFound();
  if (job.externalId) {
    return { alternates: { canonical: jobApplyHref(job) } };
  }
  return {
    title: `Apply: ${job.title} at ${job.companyName}`,
    robots: { index: false, follow: true },
    alternates: { canonical: jobApplyHref(job) },
  };
}

export default async function LegacyApplyPage({
  params,
  searchParams,
}: {
  params: ApplyParams;
  searchParams: ApplySearch;
}) {
  const { slug } = await params;
  const job = await loadJob(slug);
  if (!job) notFound();
  if (job.externalId) redirect(jobApplyHref(job));

  const search = await searchParams;
  const next = jobApplyHref(job);

  return (
    <main className="surface surface--data board-main apply-main">
      <p>
        <Link className="text-link" href={jobPublicHref(job)}>
          Back to the listing
        </Link>
      </p>
      <header className="board-hero">
        <p className="board-apply__company">{job.companyName}</p>
        <h1>Apply on Nodework</h1>
        <p className="lead">
          {job.title}. {job.remote === "remote" ? "Remote" : job.location || remoteLabel(job.remote)}.
          The form stays here - we do not bounce you to another job board.
        </p>
        <p className="small muted">
          We store the application against this listing. We do not forward profiles to
          companies, and the recruiter talent pool is a separate opt-in in Settings that is
          off by default.
        </p>
      </header>
      <JobApplyForm
        error={search.error === "1"}
        jobId={job.id}
        next={next}
        sent={search.sent === "1"}
      />
    </main>
  );
}
