import {ProductJobBadges} from './product/job-badges';
import Link from "next/link";
import type { ReactNode } from "react";

import { LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../../lib/copy";
import { showBadge } from "../../lib/jobs/exclusivity";
import { jobPublicHref, type JobListItem } from "../../lib/jobs/queries";

const POSTED_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/**
 * Only these three arrangement values have a real label. Everything else -
 * including the literal string "unknown", which 952 of 1042 local rows
 * carry - falls to "" rather than rendering the raw column value verbatim
 * in a live meta description or on-page badge.
 */
export function remoteLabel(remote: string): string {
  if (remote === "remote") return "Remote";
  if (remote === "hybrid") return "Hybrid";
  if (remote === "onsite") return "On-site";
  return "";
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
  const remote = remoteLabel(job.remote);

  return (
    <article className="job-card">
      <div className="job-card__head">
        {job.companySlug ? (
          <Link className="job-card__company" href={`/web3-companies/${job.companySlug}`}>
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
        <Link href={jobPublicHref(job)}>{job.title}</Link>
      </Heading>
      <p className="job-card__meta">
        {remote}
        {job.location ? `${remote ? " · " : ""}${job.location}` : ""}
      </p>
      <div className="job-card__foot">
        {showBadge(job.exclusivity) ? (
          <span className="badge" title={LINKEDIN_EXCLUSIVITY_TOOLTIP}>
            Not on LinkedIn
          </span>
        ) : null}
        <ProductJobBadges job={job}/>{job.cryptoPaymentAvailable ? <span className="badge">Crypto pay</span> : null}
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
