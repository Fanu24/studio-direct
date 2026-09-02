import {
  hubSlugLabel,
  parseRoleHubSegment,
} from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "../_components/breadcrumbs";
import { HubLinks } from "../_components/hub-links";
import { ArrowRightIcon } from "../_components/icons";
import { JobHubList } from "../_components/job-hub-list";
import { listHubJobs, type JobsDatabase } from "../../lib/jobs/queries";

export const revalidate = 300;

type HubParams = Promise<{ hub: string }>;

export async function generateMetadata({
  params,
}: {
  params: HubParams;
}): Promise<Metadata> {
  const role = parseRoleHubSegment((await params).hub);
  if (!role) notFound();
  const label = hubSlugLabel(role);
  return {
    title: `Remote ${label} jobs`,
    description: `Remote and hybrid ${label} jobs at game studios, collected from studio career pages. See which roles are not posted on LinkedIn, then apply on the studio site.`,
    alternates: { canonical: `/remote-${role}-jobs` },
  };
}

export default async function RoleHubPage({ params }: { params: HubParams }) {
  const role = parseRoleHubSegment((await params).hub);
  if (!role) notFound();

  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await db
    .prepare("SELECT id FROM tenants WHERE slug = ?")
    .bind("gaming")
    .first<string>("id");
  if (!tenantId) throw new Error("Gaming tenant was not found");

  const label = hubSlugLabel(role);
  const result = await listHubJobs(db, tenantId, role);
  const hidden = result.jobs.filter(
    (job) => job.exclusivity === "hidden_from_linkedin",
  ).length;

  return (
    <main>
      <header className="page-header">
        <Breadcrumbs
          items={[
            { href: "/jobs", label: "Jobs" },
            { href: "/roles", label: "Roles" },
            { label: `Remote ${label} jobs` },
          ]}
        />
        <h1>Remote {label} jobs</h1>
        <p className="lead">
          Remote and hybrid {label} roles from gaming studio career pages, with the full
          description on every listing.
        </p>
      </header>

      <section aria-label={`Remote ${label} jobs`} className="jobs-results">
        <div className="jobs-results__head">
          <p className="count">
            <span className="jobs-num">{result.total}</span>{" "}
            {result.total === 1 ? "role" : "roles"}
            {hidden > 0 ? `, ${hidden} not on LinkedIn` : ""}
          </p>
          <div className="jobs-results__aside">
            <Link className="text-link" href={`/skills/${role}`}>
              {label} skill jobs
              <ArrowRightIcon size={15} />
            </Link>
          </div>
        </div>
        <JobHubList
          emptyActions={
            <Link className="button button--secondary" href="/jobs">
              Browse all jobs
            </Link>
          }
          emptyMessage={`No remote ${label} jobs are listed right now. New roles land here as studios post them.`}
          jobs={result.jobs}
        />
      </section>

      <section aria-labelledby="hub-other-roles" className="jobs-more">
        <div className="jobs-more__head">
          <div>
            <h2 id="hub-other-roles">Other roles</h2>
            <p>Same board, different discipline.</p>
          </div>
          <Link className="text-link" href="/roles">
            All roles
            <ArrowRightIcon size={16} />
          </Link>
        </div>
        <HubLinks exclude={role} limit={9} />
      </section>
    </main>
  );
}
