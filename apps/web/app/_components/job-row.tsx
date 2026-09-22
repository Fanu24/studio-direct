import {jobTagHref} from '../../lib/jobs/tag-links';
import {
  countryForCity,
  formatSalaryRange,
  isCitySlug,
  isCountrySlug,
  landingPath,
  slugifyTag,
  tagLabel,
  type CitySlug,
  type CountrySlug,
} from "@gaming/shared";
import Link from "next/link";
import type { ReactNode } from "react";

import { LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../../lib/copy";
import { showBadge } from "../../lib/jobs/exclusivity";
import { jobPublicHref, type JobListItem } from "../../lib/jobs/queries";
import { formatPosted, remoteLabel } from "./job-card";

export { TagChips } from "./tag-chips";

/**
 * job.location is free text from the source import ("Berlin, Germany",
 * "LND London GB", ...), not a taxonomy slug - the same shape the crawler's
 * own job_locations matcher starts from. We mirror that same
 * slugifyTag + isCitySlug/isCountrySlug check here rather than trust the
 * text is linkable, so this never produces a link to a place that isn't a
 * real hub. Most raw location strings don't reduce to a bare city or
 * country slug (they carry state/country suffixes the crawler also can't
 * parse), so the plain-text fallback is the common case, not an edge case.
 */
function LocationPins({ location }: { location: string | null }) {
  if (!location) return null;
  const slug = slugifyTag(location);

  if (isCitySlug(slug)) {
    const city = slug as CitySlug;
    const country = countryForCity(city);
    // A handful of city-state hubs (Hong Kong, Singapore) map to a country
    // slug identical to their own city slug - skip the second pin there so
    // the label never doubles up as "Hong Kong, Hong Kong".
    const showCountry = country && (country as string) !== (city as string);
    return (
      <span className="small muted job-row__location">
        <Link href={landingPath({ kind: "city", city })}>{tagLabel(city)}</Link>
        {showCountry ? (
          <>
            {", "}
            <Link href={landingPath({ kind: "country", country })}>
              {tagLabel(country)}
            </Link>
          </>
        ) : null}
      </span>
    );
  }

  if (isCountrySlug(slug)) {
    const country = slug as CountrySlug;
    return (
      <span className="small muted job-row__location">
        <Link href={landingPath({ kind: "country", country })}>{tagLabel(country)}</Link>
      </span>
    );
  }

  return <span className="small muted">{location}</span>;
}

/**
 * Every listing title is a heading so the job inventory shows up in the document
 * outline (the reference board does the same). "h2" suits the default placement -
 * a job list sitting directly under the page h1; pass "h3" when the list is
 * introduced by its own section h2.
 */
export type JobHeadingLevel = "h2" | "h3";

export function JobRow({
  job,
  headingLevel = "h2",
}: {
  job: JobListItem;
  headingLevel?: JobHeadingLevel;
}) {
  const Heading = headingLevel;
  const posted = formatPosted(job.postedAt);
  const salary =
    job.salaryText ?? formatSalaryRange(job.salaryMin, job.salaryMax);
  const sticky =
    Boolean(job.featuredUntil) || job.highlight === 1;
  const href = jobPublicHref(job);
  const remote = remoteLabel(job.remote);

  return (
    <article className={`job-row m-lift${sticky ? " job-row--hl" : ""}`}>
      <div className="job-row__main">
        <Heading className="job-row__heading">
          <Link className="job-row__title" href={href}>
            {job.title}
          </Link>
        </Heading>
        <p className="job-row__company">
          <Link href={`/web3-companies/${job.companySlug}`}>{job.companyName}</Link>
        </p>
        {showBadge(job.exclusivity) ? (
          <span className="badge badge--honest job-row__badge" title={LINKEDIN_EXCLUSIVITY_TOOLTIP}>
            Not on LinkedIn
          </span>
        ) : null}
        <div className="job-row__chips">
          {job.tags.slice(0, 4).map((tag) => (
            <Link className="chip" href={jobTagHref(tag)} key={tag}>
              {tagLabel(tag)}
            </Link>
          ))}
        </div>
      </div>
      <div className="job-row__meta">
        {posted ? (
          <time className="mono small muted" dateTime={job.postedAt ?? undefined}>
            {posted}
          </time>
        ) : null}
        {remote ? <span className="small">{remote}</span> : null}
        <LocationPins location={job.location} />
        {job.cryptoPaymentAvailable ? <span className="badge">Crypto pay</span> : null}
        {salary ? <span className="job-row__salary mono">{salary}</span> : null}
      </div>
    </article>
  );
}

export function JobRowList({
  jobs,
  emptyMessage,
  emptyActions,
  headingLevel = "h2",
}: {
  jobs: JobListItem[];
  emptyMessage: string;
  emptyActions?: ReactNode;
  headingLevel?: JobHeadingLevel;
}) {
  if (jobs.length === 0) {
    return (
      <div className="empty">
        <p>{emptyMessage}</p>
        {emptyActions}
      </div>
    );
  }

  return (
    <ul className="job-rows">
      {jobs.map((job) => (
        <li key={job.id}>{JobRow({ job, headingLevel })}</li>
      ))}
    </ul>
  );
}
