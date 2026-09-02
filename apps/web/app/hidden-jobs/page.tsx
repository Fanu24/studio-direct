import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";

import { JobHubList } from "../_components/job-hub-list";
import { listJobs, type JobsDatabase } from "../../lib/jobs/queries";

export const metadata: Metadata = {
  title: "Gaming jobs not posted on LinkedIn | Studio Direct",
  description:
    "Browse listed remote and hybrid gaming jobs confirmed absent from LinkedIn.",
};

export const revalidate = 300;
export const dynamic = "force-dynamic";

export default async function HiddenJobsPage() {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await db
    .prepare("SELECT id FROM tenants WHERE slug = ?")
    .bind("gaming")
    .first<string>("id");

  if (!tenantId) {
    throw new Error("Gaming tenant was not found");
  }

  const result = await listJobs(db, tenantId, { hidden: true });

  return (
    <main>
      <header>
        <Link href="/jobs">All jobs</Link>
        <h1>Jobs not posted on LinkedIn</h1>
        <p>
          Listed remote and hybrid gaming roles confirmed absent from LinkedIn.
        </p>
      </header>
      <JobHubList
        emptyMessage="No confirmed hidden jobs are available right now."
        jobs={result.jobs}
      />
    </main>
  );
}
