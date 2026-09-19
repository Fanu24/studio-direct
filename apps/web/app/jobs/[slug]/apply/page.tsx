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
import {currentUser, type PlatformEnv} from '../../../../lib/platform';

import { applicationDestination } from '../../../../lib/jobs/application-destination';
export const dynamic = 'force-dynamic';

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

  const {env}=await getCloudflareContext({async:true});
  const db=(env as unknown as {DB:JobsDatabase}).DB;
  const destination=await applicationDestination(db,await requireTenantId(db),job.id);
  if(!destination)notFound();
  if(destination.mode==='external')redirect(destination.url);
  const search = await searchParams;
  const next = jobApplyHref(job);
  const user=await currentUser(env as unknown as PlatformEnv);
  if(!user)redirect('/login?next='+encodeURIComponent(next));

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
          Your application will be shared with the employer for this role.
        </p>
        <p className="small muted">
          The employer can review your application in their dashboard. Joining the recruiter talent pool is a separate, optional choice in Settings.
        </p>
      </header>
      <JobApplyForm
        email={user.email}
        name={user.name}
        error={search.error === "1"}
        jobId={job.id}
        next={next}
        sent={search.sent === "1"}
      />
    </main>
  );
}
