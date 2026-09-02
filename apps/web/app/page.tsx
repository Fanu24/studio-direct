import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";

import {
  HOMEPAGE_CLAIM,
  LINKEDIN_EXCLUSIVITY_TOOLTIP,
} from "../lib/copy";
import { showBadge } from "../lib/jobs/exclusivity";
import { listJobs, type JobsDatabase } from "../lib/jobs/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await db
    .prepare("SELECT id FROM tenants WHERE slug = ?")
    .bind("gaming")
    .first<string>("id");

  if (!tenantId) {
    throw new Error("Gaming tenant was not found");
  }

  const { jobs } = await listJobs(db, tenantId, {
    hidden: true,
    pageSize: 8,
  });

  return (
    <main>
      <header>
        <h1>Studio Direct</h1>
        <p>{HOMEPAGE_CLAIM}</p>

        <form action="/jobs" method="get">
          <label>
            Search jobs
            <input name="q" placeholder="Gameplay engineer" type="search" />
          </label>
          <button type="submit">Search</button>
        </form>
      </header>

      <section aria-labelledby="latest-hidden-jobs">
        <h2 id="latest-hidden-jobs">Latest jobs not on LinkedIn</h2>
        {jobs.length === 0 ? (
          <p>No confirmed hidden jobs are available right now.</p>
        ) : (
          <ul>
            {jobs.map((job) => (
              <li key={job.id}>
                <article>
                  <h3>
                    <Link href={`/jobs/${job.slug}`}>{job.title}</Link>
                  </h3>
                  <p>
                    {job.companyName} · {job.remote}
                    {job.location ? ` · ${job.location}` : ""}
                  </p>
                  {job.salaryText ? <p>{job.salaryText}</p> : null}
                  {showBadge(job.exclusivity) ? (
                    <p title={LINKEDIN_EXCLUSIVITY_TOOLTIP}>Not on LinkedIn</p>
                  ) : null}
                </article>
              </li>
            ))}
          </ul>
        )}
        <Link href="/jobs?hidden=1">View all jobs not on LinkedIn</Link>
      </section>
    </main>
  );
}
