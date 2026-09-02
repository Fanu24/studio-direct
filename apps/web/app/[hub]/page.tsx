import {
  hubSlugLabel,
  parseRoleHubSegment,
} from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JobHubList } from "../_components/job-hub-list";
import { listJobs, type JobsDatabase } from "../../lib/jobs/queries";

export const dynamic = "force-dynamic";

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
    title: `Remote ${label} jobs | Studio Direct`,
    description: `Browse listed remote and hybrid ${label} jobs from gaming studios.`,
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
  const result = await listJobs(db, tenantId, {
    q: role.replaceAll("-", " "),
  });

  return (
    <main>
      <header>
        <Link href="/jobs">All jobs</Link>
        <h1>Remote {label} jobs</h1>
        <p>Listed remote and hybrid {label} roles from gaming studios.</p>
      </header>
      <JobHubList
        emptyMessage={`No remote ${label} jobs are listed right now.`}
        jobs={result.jobs}
      />
      <nav aria-label="Related pages">
        <Link href={`/skills/${role}`}>{label} skill jobs</Link>
      </nav>
    </main>
  );
}
