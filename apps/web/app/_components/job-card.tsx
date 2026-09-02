import Link from "next/link";
import type { ReactNode } from "react";

import { LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../../lib/copy";
import { showBadge } from "../../lib/jobs/exclusivity";
import type { JobListItem } from "../../lib/jobs/queries";

const POSTED_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function remoteLabel(remote: string): string {
  if (remote === "remote") return "Remote";
  if (remote === "hybrid") return "Hybrid";
  if (remote === "onsite") return "On-site";
  return remote;
}

export function formatPosted(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return POSTED_FORMAT.format(date);
}

export function JobCard({
  job,
  headingLevel = "h3",
}: {
  job: JobListItem;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const posted = formatPosted(job.postedAt);

  return (
    <article className="job-card">
      <div className="job-card__head">
        {job.companySlug ? (
          <Link className="job-card__company" href={`/companies/${job.companySlug}`}>
            {job.companyName}
          </Link>
        ) : (
          <span className="job-card__company">{job.companyName}</span>
        )}
        {posted ? (
          <time className="job-card__posted" dateTime={job.postedAt ?? undefined}>
            {posted}
          </time>
        ) : null}
      </div>
      <Heading className="job-card__title">
        <Link href={`/jobs/${job.slug}`}>{job.title}</Link>
      </Heading>
      <p className="job-card__meta">
        {remoteLabel(job.remote)}
        {job.location ? ` · ${job.location}` : ""}
      </p>
      <div className="job-card__foot">
        {showBadge(job.exclusivity) ? (
          <span className="badge" title={LINKEDIN_EXCLUSIVITY_TOOLTIP}>
            Not on LinkedIn
          </span>
        ) : null}
        {job.salaryText ? <span className="job-card__salary">{job.salaryText}</span> : null}
      </div>
    </article>
  );
}

export function JobCardGrid({
  jobs,
  headingLevel = "h3",
  columns = 2,
  emptyMessage,
  emptyActions,
}: {
  jobs: JobListItem[];
  headingLevel?: "h2" | "h3";
  columns?: 1 | 2;
  emptyMessage: string;
  emptyActions?: ReactNode;
}) {
  if (jobs.length === 0) {
    return (
      <div className="empty">
        <p>{emptyMessage}</p>
        {emptyActions ? <div className="cluster">{emptyActions}</div> : null}
      </div>
    );
  }

  return (
    <ul className={columns === 1 ? "job-grid job-grid--1" : "job-grid"}>
      {jobs.map((job) => (
        <li key={job.id}>
          <JobCard headingLevel={headingLevel} job={job} />
        </li>
      ))}
    </ul>
  );
}
