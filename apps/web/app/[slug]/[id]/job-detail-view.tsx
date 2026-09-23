import {FeaturedMember} from '../../_components/product/featured-member';
import {ProductApplyAction,JobProductDetails} from '../../_components/product/job-product-details';
import {JobViewTracker} from '../../_components/product/view-tracker';
import {JobRequirements} from '../../_components/product/job-requirements';
import {jobTagHref} from '../../../lib/jobs/tag-links';
import { formatSalaryRange, landingPath, tagLabel } from "@gaming/shared";
import Link from "next/link";

import { LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../../../lib/copy";
import { showBadge } from "../../../lib/jobs/exclusivity";
import {
  jobDetailHireHref,
  jobDetailSalaryHref,
  type JobDetailSections,
} from "../../../lib/jobs/job-detail-sections";
import {
  jobApplyHref,
  jobPublicHref,
  type JobDetail,
  type JobListItem,
} from "../../../lib/jobs/queries";
import { sanitizeJobDescriptionHtml } from "../../../lib/jobs/sanitize-description";
import { LockIcon } from "../../_components/icons";
import { remoteLabel } from "../../_components/job-card";
import { UnlockApplyForm } from "../../jobs/[slug]/unlock-form";

/**
 * Everything on a job page below the breadcrumbs, shared by the canonical
 * `/{slug}/{externalId}` route and the `/jobs/{slug}` alias.
 *
 * These are plain functions, not components: both pages call them as
 * `{JobDetailBody({ ... })}` so the returned elements land in the page's own tree. The
 * page tests walk `props.children` only, and a `<JobDetailBody />` element would hide
 * every string in here from that walk.
 */

const POSTED_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatPostedLong(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return POSTED_FORMAT.format(date);
}

/** "4h", "6d", then an absolute date - the same ladder the board rows use. */
export function postedAge(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const minutes = Math.max(0, Math.round((Date.now() - then.getTime()) / 60_000));
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 21) return `${days}d ago`;
  return formatPostedLong(iso);
}

export function jobPlaceLabel(job: { remote: string; location: string | null }): string {
  if (job.remote === "remote") return job.location || "Remote";
  return job.location || remoteLabel(job.remote) || "Location not listed";
}

export function jobSalaryLabel(job: {
  salaryText: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
}): string | null {
  return job.salaryText ?? formatSalaryRange(job.salaryMin, job.salaryMax);
}

function companyMark(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "?"}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

function tagHref(tag: string) {
  return jobTagHref(tag);
}

function JobDetailRows({ jobs }: { jobs: JobListItem[] }) {
  return (
    <div className="jd-table-wrap">
      <table className="board-table jd-table">
        <thead>
          <tr>
            <th scope="col">Job Position and Company</th>
            <th scope="col">Location</th>
            <th scope="col">Salary</th>
            <th scope="col">Posted</th>
            <th scope="col">Apply</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((item) => {
            const salary = jobSalaryLabel(item);
            const age = postedAge(item.postedAt);
            return (
              <tr className="board-tr" key={item.id}>
                <td className="board-col-job">
                  <Link className="board-row" href={jobPublicHref(item)}>
                    <span aria-hidden="true" className="board-row__mark">
                      {companyMark(item.companyName)}
                    </span>
                    <span className="board-row__identity">
                      <span className="board-row__title">{item.title}</span>
                      <span className="board-row__company">{item.companyName}</span>
                    </span>
                  </Link>
                </td>
                <td className="board-col-loc">
                  <span className="board-loc">
                    <span className="board-loc__text">{jobPlaceLabel(item)}</span>
                  </span>
                </td>
                <td className="board-col-pay">
                  {salary ? <span className="board-row__pay">{salary}</span> : null}
                </td>
                <td className="board-col-posted">
                  {age ? (
                    <time dateTime={item.postedAt ?? undefined}>{age}</time>
                  ) : null}
                </td>
                <td className="board-col-apply">
                  <Link className="button button--sm" href={jobApplyHref(item)}>
                    Apply
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function JobDetailBody({
  job,
  sections,
}: {
  job: JobDetail;
  sections: JobDetailSections;
}) {
  const descriptionHtml = sanitizeJobDescriptionHtml(job.descriptionHtml);
  const companyHref = `/web3-companies/${job.companySlug}`;
  const applyHref = jobApplyHref(job);
  const place = jobPlaceLabel(job);
  const salary = jobSalaryLabel(job);
  const posted = formatPostedLong(job.postedAt);
  const age = postedAge(job.postedAt);
  // Exclusive listings (not sighted on LinkedIn) route through the unlock quota instead of
  // the plain on-site form: the company's own apply link is only ever revealed by /api/unlock,
  // server-side, after login + onboarding + the weekly quota check - it never reaches this
  // markup. Every other listing keeps the always-available on-site apply form unchanged.
  const gated = false;

  const tag = sections.primaryTag;
  const label = tag ? tagLabel(tag) : null;
  const salaryHref = tag ? jobDetailSalaryHref(tag) : null;
  const hireHref = tag ? jobDetailHireHref(tag) : null;
  const roleRange = sections.salary
    ? formatSalaryRange(sections.salary.min, sections.salary.max)
    : null;

  return (
    <>
      <header className="jd-hero m-reveal" data-reveal>
        <h1 className="jd-hero__title">
          <span className="jd-hero__hiring">{job.companyName} is hiring</span>
          {job.title}
        </h1>
        <p className="jd-hero__studio">
          <Link className="jd-hero__studio-link" href={companyHref}>
            <span aria-hidden="true" className="jd-hero__studio-mark" />
            {job.companyName}
          </Link>
        </p>
        {gated ? (
          <p className="jd-hero__badge">
            <span
              className="badge badge--honest badge--lg"
              title={LINKEDIN_EXCLUSIVITY_TOOLTIP}
            >
              Not on LinkedIn
            </span>
          </p>
        ) : null}
        <ul aria-label="Role details" className="jd-meta">
          <li className="chip chip--on">{place}</li>
          {job.cryptoPaymentAvailable ? <li className="chip">Crypto pay</li> : null}
          {salary ? (
            <li className="chip jd-meta__salary">Compensation: {salary}</li>
          ) : (
            <li className="chip">Compensation not listed</li>
          )}
          {posted ? (
            <li className="chip">
              <time dateTime={job.postedAt ?? undefined}>Posted {posted}</time>
            </li>
          ) : null}
        </ul>
      </header>

      <div className="jd-layout">
        <article className="jd-main m-reveal" data-reveal data-reveal-delay="1">
          <section aria-labelledby="job-description" className="jd-description">
            <h2 className="jd-section-title" id="job-description">
              Job description
            </h2>
            <div
              className="jd-body"
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />
          </section>

          <JobRequirements job={job}/><JobProductDetails jobId={job.id}/><JobViewTracker jobId={job.id}/>
          <div className="jd-apply-inline">
            {gated ? (
              <>
                <p className="jd-apply-inline__label">
                  <LockIcon size={14} /> This role is not on LinkedIn
                </p>
                <a className="button button--primary" href="#jd-apply-title">
                  Unlock the apply link
                </a>
              </>
            ) : (
              <>
                <p className="jd-apply-inline__label">Apply for this role:</p>
                <ProductApplyAction jobId={job.id} href={applyHref}/>
              </>
            )}
          </div>
        </article>

        <aside aria-labelledby="jd-apply-title" className="jd-aside m-reveal" data-reveal data-reveal-delay="2">
          <div className={`jd-apply apply-public${gated ? " jd-apply--gated" : ""}`}>
            <p className="jd-apply__studio">
              <span aria-hidden="true" className="board-row__mark">
                {companyMark(job.companyName)}
              </span>
              <Link className="jd-apply__studio-link" href={companyHref}>
                {job.companyName}
              </Link>
            </p>
            <h2 className="jd-apply__title" id="jd-apply-title">
              {gated ? "Unlock to apply" : "Apply"}
            </h2>
            <dl className="jd-apply__facts">
              <div>
                <dt>Compensation</dt>
                <dd>{salary ?? "Not listed"}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{place}</dd>
              </div>
              {age ? (
                <div>
                  <dt>Posted</dt>
                  <dd>
                    <time dateTime={job.postedAt ?? undefined}>{age}</time>
                  </dd>
                </div>
              ) : null}
            </dl>
            {gated ? (
              <div className="jd-unlock-gate">
                <p className="jd-unlock-gate__lead">
                  This company does not post to LinkedIn - unlocking reveals the apply
                  link and sends you straight to the company&apos;s own page.
                </p>
                <ul className="jd-unlock-gate__list">
                  <li>The real apply link, not a redirect through a public board</li>
                  <li>Up to 5 free unlocks every UTC week, unlimited on a paid plan</li>
                  <li>One unlock per job - reopen it any time, it stays unlocked</li>
                </ul>
                <UnlockApplyForm jobId={job.id} next={jobPublicHref(job)} />
              </div>
            ) : (
              <>
                <ProductApplyAction jobId={job.id} href={applyHref}/>
                <p className="small muted">
                  Your application stays on Nodework. We never hand a profile to a company, and
                  the recruiter talent pool is a separate opt-in that is off by default.
                </p>
              </>
            )}
            <hr className="jd-apply__rule" />
            <p className="jd-apply__more-label">More roles like this</p>
            <ul className="jd-apply__more">
              {tag && label ? (
                <li>
                  <Link className="text-link" href={tagHref(tag)}>
                    All {label} jobs
                  </Link>
                </li>
              ) : null}
              {tag && label ? (
                <li>
                  <Link
                    className="text-link"
                    href={landingPath({ kind: "remote-tag", tag, tags: [tag] })}
                  >
                    Remote {label} jobs
                  </Link>
                </li>
              ) : null}
              <li>
                <Link className="text-link" href={companyHref}>
                  More at {job.companyName}
                </Link>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <div className="jd-apply-fixed">
        <span className="jd-apply-fixed__title">{job.title}</span>
        {gated ? (
          <a className="button button--primary jd-apply-fixed__btn" href="#jd-apply-title">
            <LockIcon size={16} /> Unlock link
          </a>
        ) : (
          <ProductApplyAction jobId={job.id} href={applyHref}/>
        )}
      </div>

      <footer className="jd-foot">
        {job.tags.length > 0 ? (
          <nav aria-labelledby="related-hubs" className="jd-related">
            <h2 className="jd-section-title" id="related-hubs">
              Tags
            </h2>
            <ul className="jd-related__list">
              {job.tags.map((item) => (
                <li key={item}>
                  <Link className="chip" href={tagHref(item)}>
                    {tagLabel(item)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <p className="jd-more">
          <Link className="text-link" href={companyHref}>
            More at {job.companyName}
          </Link>
        </p>
      </footer>

      {tag && label && roleRange && sections.salary ? (
        <section aria-labelledby="jd-salary" className="jd-panel m-reveal" data-reveal>
          <h2 className="jd-panel__title" id="jd-salary">
            {label} salary
          </h2>
          <p className="jd-panel__lead">
            {sections.salary.count} externally scraped {label} roles publish a range, and
            together they span {roleRange}. Use it as a floor for the conversation, not a
            promise about this listing.
          </p>
          {salaryHref ? (
            <p className="jd-panel__link">
              <Link className="text-link" href={salaryHref}>
                {label} salary breakdown
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}

      {sections.relatedJobs.length > 0 && label && tag ? (
        <section aria-labelledby="jd-related-jobs" className="jd-panel m-reveal" data-reveal>
          <h2 className="jd-panel__title" id="jd-related-jobs">
            More {label} jobs
          </h2>
          {JobDetailRows({ jobs: sections.relatedJobs })}
          <p className="jd-panel__link">
            <Link className="text-link" href={tagHref(tag)}>
              Every {label} job on Nodework
            </Link>
          </p>
        </section>
      ) : null}

      {sections.companyJobs.length > 0 ? (
        <section aria-labelledby="jd-company-jobs" className="jd-panel m-reveal" data-reveal>
          <h2 className="jd-panel__title" id="jd-company-jobs">
            Other roles at {job.companyName}
          </h2>
          {JobDetailRows({ jobs: sections.companyJobs })}
          <p className="jd-panel__link">
            <Link className="text-link" href={companyHref}>
              {job.companyName} on Nodework
            </Link>
          </p>
        </section>
      ) : null}

      {hireHref && label ? (
        <section
          aria-labelledby="jd-hire"
          className="jd-panel jd-panel--hire m-reveal"
          data-reveal
        >
          <h2 className="jd-panel__title" id="jd-hire">
            Hiring {label}?
          </h2>
          <p className="jd-panel__lead">
            Explore candidate profiles and see which companies are already advertising
            {" "}
            {label} work, then list your own role next to theirs.
          </p>
          <p className="jd-panel__link">
            <Link className="text-link" href={hireHref}>
              Hire {label} on Nodework
            </Link>
          </p>
        </section>
      ) : null}
      <FeaturedMember/>
    </>
  );
}
