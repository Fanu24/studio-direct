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
    <ul>
      {jobs.map((job) => (
        <li key={job.id}>
          <article>
            <h2>
              <Link href={`/jobs/${job.slug}`}>{job.title}</Link>
            </h2>
            <p>
              <Link href={`/companies/${job.companySlug}`}>{job.companyName}</Link>
              {" · "}
              {job.remote}
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
  );
}
