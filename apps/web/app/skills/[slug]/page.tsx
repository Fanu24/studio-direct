import {
  hubSlugLabel,
  isHubRoleSlug,
} from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JobHubList } from "../../_components/job-hub-list";
import { listJobs, type JobsDatabase } from "../../../lib/jobs/queries";

export const dynamic = "force-dynamic";

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
    title: `${label} jobs | Studio Direct`,
    description: `Browse listed remote and hybrid gaming jobs matching the ${label} skill.`,
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
  const result = await listJobs(db, tenantId, {
    q: slug.replaceAll("-", " "),
  });

  return (
    <main>
      <header>
        <Link href="/jobs">All jobs</Link>
        <h1>{label} jobs</h1>
        <p>Remote and hybrid gaming jobs matching the {label} skill.</p>
      </header>
      <JobHubList
        emptyMessage={`No jobs matching ${label} are listed right now.`}
        jobs={result.jobs}
      />
      <nav aria-label="Related pages">
        <Link href={`/remote-${slug}-jobs`}>Remote {label} jobs</Link>
      </nav>
    </main>
  );
}
