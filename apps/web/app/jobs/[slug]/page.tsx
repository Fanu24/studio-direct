import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { RelatedBrowseLinks } from "../../_components/board-chrome";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { remoteLabel } from "../../_components/job-card";
import { JsonLd } from "../../_components/json-ld";
import { JobDetailBody } from "../../[slug]/[id]/job-detail-view";
import {
  EMPTY_JOB_DETAIL_SECTIONS,
  loadJobDetailSections,
} from "../../../lib/jobs/job-detail-sections";
import { buildJobPostingJsonLd } from "../../../lib/jobs/jsonld";
import { buildJobTitle, buildMetaDescription } from "../../../lib/jobs/meta";
import {
  getJobBySlug,
  jobPublicHref,
  type JobDetail,
  type JobsDatabase,
} from "../../../lib/jobs/queries";
import { requireTenantId } from "../../../lib/tenant";

// Read live D1 data at request time; builds must not depend on a local database.
export const dynamic = "force-dynamic";

type JobParams = Promise<{ slug: string }>;

function requestOrigin(requestHeaders: Headers) {
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host");

  if (!host) {
    throw new Error("Request host was not found");
  }

  const forwardedProto = requestHeaders
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const protocol = forwardedProto === "http" ? "http" : "https";

  return `${protocol}://${host}`;
}

const loadJob = cache(async (slug: string): Promise<JobDetail | null> => {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await requireTenantId(db);
  return getJobBySlug(db, tenantId, slug);
});

export async function generateMetadata({
  params,
}: {
  params: JobParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = await loadJob(slug);
  if (!job) notFound();

  const place = job.location || remoteLabel(job.remote);
  const where = job.location
    ? `${remoteLabel(job.remote)}, ${job.location}`
    : remoteLabel(job.remote);
  const title = buildJobTitle({
    title: job.title,
    companyName: job.companyName,
    place,
    salaryText: job.salaryText,
  });
  const description = buildMetaDescription({
    title: job.title,
    companyName: job.companyName,
    where,
    salaryText: job.salaryText,
    descriptionHtml: job.descriptionHtml,
  });
  const path = jobPublicHref(job);

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function JobPage({ params }: { params: JobParams }) {
  const { slug } = await params;
  const job = await loadJob(slug);

  if (!job) {
    notFound();
  }

  if (job.externalId) {
    redirect(jobPublicHref(job));
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await requireTenantId(db);
  const sections = await loadJobDetailSections(db, tenantId, job).catch(
    () => EMPTY_JOB_DETAIL_SECTIONS,
  );

  return (
    <main className="surface surface--data jd">
      <JsonLd data={buildJobPostingJsonLd(job, requestOrigin(await headers()))} />

      <Breadcrumbs
        items={[
          { href: "/jobs", label: "Jobs" },
          { href: `/web3-companies/${job.companySlug}`, label: job.companyName },
          { label: job.title },
        ]}
      />

      {JobDetailBody({ job, sections })}
      <RelatedBrowseLinks tag={sections.primaryTag ?? undefined} />
    </main>
  );
}
