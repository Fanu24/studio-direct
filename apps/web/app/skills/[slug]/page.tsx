import {
  hubSlugLabel,
  isHubRoleSlug,
} from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "../../_components/breadcrumbs";
import { HubLinks } from "../../_components/hub-links";
import { ArrowRightIcon } from "../../_components/icons";
import { JobHubList } from "../../_components/job-hub-list";
import { listHubJobs, type JobsDatabase } from "../../../lib/jobs/queries";

export const revalidate = 300;

type SkillParams = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: SkillParams;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isHubRoleSlug(slug)) notFound();
  const label = hubSlugLabel(slug);
  return {
    title: `${label} jobs`,
    description: `Gaming jobs that match the ${label} skill, remote and hybrid, collected from studio career pages and listed with the full description.`,
    alternates: { canonical: `/skills/${slug}` },
  };
}

export default async function SkillPage({
  params,
}: {
  params: SkillParams;
}) {
  const { slug } = await params;
  if (!isHubRoleSlug(slug)) notFound();

  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await db
    .prepare("SELECT id FROM tenants WHERE slug = ?")
    .bind("gaming")
    .first<string>("id");
  if (!tenantId) throw new Error("Gaming tenant was not found");

  const label = hubSlugLabel(slug);
  const result = await listHubJobs(db, tenantId, slug);

  return (
    <main>
      <header className="page-header">
        <Breadcrumbs
          items={[
            { href: "/jobs", label: "Jobs" },
            { href: "/roles", label: "Roles" },
            { label: `${label} jobs` },
          ]}
        />
        <h1>{label} jobs</h1>
        <p className="lead">
          Remote and hybrid gaming jobs matching the {label} skill, from studio career
          pages.
        </p>
      </header>

      <section aria-label={`${label} jobs`} className="jobs-results">
        <div className="jobs-results__head">
          <p className="count">
            <span className="jobs-num">{result.total}</span>{" "}
            {result.total === 1 ? "role" : "roles"}
          </p>
          <div className="jobs-results__aside">
            <Link className="text-link" href={`/remote-${slug}-jobs`}>
              Remote {label} jobs
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
          emptyMessage={`No jobs matching ${label} are listed right now. New roles land here as studios post them.`}
          jobs={result.jobs}
        />
      </section>

      <section aria-labelledby="skill-other-roles" className="jobs-more">
        <div className="jobs-more__head">
          <div>
            <h2 id="skill-other-roles">Other skills</h2>
            <p>The same board, filtered by another discipline.</p>
          </div>
          <Link className="text-link" href="/roles">
            All roles
            <ArrowRightIcon size={16} />
          </Link>
        </div>
        <HubLinks exclude={slug} limit={9} variant="skill" />
      </section>
    </main>
  );
}
