import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";

import {
  HOMEPAGE_CLAIM,
  LINKEDIN_EXCLUSIVITY_TOOLTIP,
} from "../lib/copy";
import { showBadge } from "../lib/jobs/exclusivity";
import { listJobs, type JobsDatabase } from "../lib/jobs/queries";

export const revalidate = 300;
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
      <div className="hero">
        <header>
          <p className="kicker">Gaming studios, first-party listings</p>
          <h1>Studio Direct</h1>
          <p>{HOMEPAGE_CLAIM}</p>
        </header>
        <form action="/jobs" method="get">
          <label>
            Search jobs
            <input name="q" placeholder="Gameplay engineer" type="search" />
          </label>
          <button type="submit">Search</button>
        </form>
      </div>

      <section aria-labelledby="latest-hidden-jobs">
        <h2 id="latest-hidden-jobs">Latest jobs not on LinkedIn</h2>
        {jobs.length === 0 ? (
          <p>No confirmed hidden jobs are available right now.</p>
        ) : (
          <ul className="job-list">
            {jobs.map((job) => (
              <li key={job.id}>
                <article className="job-card">
                  <h3>
                    <Link href={`/jobs/${job.slug}`}>{job.title}</Link>
                  </h3>
                  <p className="job-meta">
                    {job.companyName}
                    {job.location ? ` / ${job.location}` : ""}
                  </p>
                  <p className="job-meta">{job.remote}</p>
                  {job.salaryText ? <p>{job.salaryText}</p> : null}
                  {showBadge(job.exclusivity) ? (
                    <p className="badge" title={LINKEDIN_EXCLUSIVITY_TOOLTIP}>
                      Not on LinkedIn
                    </p>
                  ) : null}
                </article>
              </li>
            ))}
          </ul>
        )}
        <p>
          <Link className="button secondary" href="/hidden-jobs">
            View all jobs not on LinkedIn
          </Link>
        </p>
      </section>
    </main>
  );
}
