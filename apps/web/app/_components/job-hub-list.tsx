import Link from "next/link";

import { LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../../lib/copy";
import { showBadge } from "../../lib/jobs/exclusivity";
import type { JobListItem } from "../../lib/jobs/queries";

export function JobHubList({
  emptyMessage,
  jobs,
}: {
  emptyMessage: string;
  jobs: JobListItem[];
}) {
  if (jobs.length === 0) return <p>{emptyMessage}</p>;

  return (
    <ul className="job-list">
      {jobs.map((job) => (
        <li key={job.id}>
          <article className="job-card">
            <h2>
              <Link href={`/jobs/${job.slug}`}>{job.title}</Link>
            </h2>
            <p className="job-meta">
              <Link href={`/companies/${job.companySlug}`}>{job.companyName}</Link>
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
  );
}
