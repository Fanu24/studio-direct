import { formatSalaryRange, tagLabel } from "@gaming/shared";
import Link from "next/link";
import type { ReactNode } from "react";

import { LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../../lib/copy";
import { showBadge } from "../../lib/jobs/exclusivity";
import {
  jobApplyHref,
  jobPublicHref,
  type JobDetail,
  type JobListItem,
} from "../../lib/jobs/queries";
import { sanitizeJobDescriptionHtml } from "../../lib/jobs/sanitize-description";
import { formatPosted, remoteLabel } from "./job-card";

function companyMark(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = `${parts[0]?.[0] ?? "?"}${parts[1]?.[0] ?? ""}`;
  return letters.toUpperCase();
}

function relativePosted(iso: string | null) {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return formatPosted(iso);
  const minutes = Math.max(0, Math.round((Date.now() - then.getTime()) / 60_000));
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 21) return `${days}d`;
  return formatPosted(iso);
}

function salaryLabel(job: {
  salaryText: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
}) {
  return job.salaryText ?? formatSalaryRange(job.salaryMin, job.salaryMax);
}

function placeLabel(job: { remote: string; location: string | null }) {
  if (job.remote === "remote") return "Remote";
  return job.location || remoteLabel(job.remote);
}

export function JobBoard({
  jobs,
  selected,
  details,
  pickedId,
  selectHref = "?job=",
  emptyMessage,
  emptyActions,
  pager,
  titleAs = "h2",
  rowTitleAs = "h2",
  rankOffset,
}: {
  jobs: JobListItem[];
  selected: JobDetail | null;
  /**
   * Details for every row, aligned with `jobs`. When present the board becomes a real
   * split view: clicking a listing swaps the right-hand pane instead of navigating away.
   * Without it the board keeps its original behaviour and every row is a plain link, so
   * the 15 landing pages that render a board are unaffected.
   */
  details?: (JobDetail | null)[];
  /** Currently selected job id, read from the page's `job` search param. */
  pickedId?: string | null;
  /** Where a row points to select itself, e.g. "/jobs?job=". Defaults to the current page. */
  selectHref?: string;
  emptyMessage: string;
  emptyActions?: ReactNode;
  pager?: ReactNode;
  /** "h1" only where this pane's title is the page's single crawlable heading - i.e. the
   * standalone job route. Every other page that embeds JobBoard already owns its own h1. */
  titleAs?: "h1" | "h2";
  /**
   * Heading level for every listing row's job title. The reference board gives each
   * listing a heading (title, then company one level down) so the job inventory shows
   * up in the document outline instead of being anonymous table text. "h2" is right
   * wherever the board sits directly under the page h1; pass "h3" when the board is
   * introduced by its own section h2, so the outline stays well-formed.
   */
  rowTitleAs?: "h2" | "h3";
  /**
   * 1-based rank of the *first* row in `jobs` within the full, unpaginated result set - e.g.
   * 20 on page 2 at pageSize 20, so that page's first row renders as rank 21. When set, every
   * row gets a leading rank number (mono, tabular, right-aligned) overlaid on the job column
   * rather than inserted as a real `<table>` column, so it never disturbs the nth-child
   * column widths a caller's own stylesheet may already rely on. Omit it and the board
   * renders exactly as before: no column, no layout shift.
   *
   * The table also gets a `board-table--ranked` class whenever this is set, and
   * `board-table--ranked-top` *in addition* when it is exactly 0 - i.e. only on the page
   * that actually contains ranks 1-3. CSS can't see `rankOffset` on its own (only which
   * child a row is), so a page-2+ accent wash keyed off `:nth-child(-n+3)` would tint
   * rows 21-23 as if they were the podium; this second class is the hook a caller's own
   * stylesheet needs to scope that wash to the page it's actually true for.
   */
  rankOffset?: number;
}) {
  if (jobs.length === 0) {
    return (
      <div className="empty board-empty">
        <p className="board-empty__title">No jobs match yet</p>
        <p>{emptyMessage}</p>
        {emptyActions ? <div className="cluster board-empty__actions">{emptyActions}</div> : null}
      </div>
    );
  }

  // Selection lives in the URL rather than in component state. This board is rendered by
  // server components and this repo's page tests invoke those components as plain
  // functions, so a hook here throws "Invalid hook call" in every one of them. Putting the
  // choice in a query parameter avoids that, and buys three things a useState would not:
  // the selection is linkable, the back button steps through it, and it still works with
  // JavaScript disabled.
  const picked = pickedId
    ? (details?.find((d) => d && d.id === pickedId) ?? null)
    : null;
  const active = picked ?? selected;

  const selectedId = active?.id;
  const descriptionHtml = active
    ? sanitizeJobDescriptionHtml(active.descriptionHtml)
    : "";
  const selectedSalary = active ? salaryLabel(active) : null;
  const selectedPlace = active ? placeLabel(active) : null;
  const TitleTag = titleAs;
  const RowTitleTag = rowTitleAs;
  const RowCompanyTag = rowTitleAs === "h2" ? "h3" : "h4";

  return (
    <div className="board m-reveal" data-reveal>
      <section aria-label="Job listings" className="board__list">
        <table
          className={`board-table${
            rankOffset !== undefined
              ? rankOffset === 0
                ? " board-table--ranked board-table--ranked-top"
                : " board-table--ranked"
              : ""
          }`}
        >
          <thead>
            <tr>
              <th scope="col">Job Position and Company</th>
              <th scope="col">Posted</th>
              <th scope="col">Location</th>
              <th scope="col">Salary</th>
              <th scope="col">Tags</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job, index) => {
              const rank = rankOffset !== undefined ? rankOffset + index + 1 : null;
              const canSelect = details?.some((d) => d && d.id === job.id) ?? false;
              // With details loaded the row selects in place; without them it behaves as
              // it always did and links straight to the job page.
              const href = canSelect
                ? `${selectHref}${encodeURIComponent(job.id)}`
                : jobPublicHref(job);
              const isActive = job.id === selectedId;
              const posted = relativePosted(job.postedAt);
              const salary = salaryLabel(job);
              const place = placeLabel(job);
              return (
                <tr
                  className={`board-tr m-lift${isActive ? " is-active" : ""}`}
                  key={job.id}
                >
                  <td className="board-col-job">
                    {rank !== null ? (
                      <span className="board-row__rank">
                        <span className="visually-hidden">Rank </span>
                        {rank}
                      </span>
                    ) : null}
                    <Link
                      aria-current={isActive ? "true" : undefined}
                      className={`board-row${isActive ? " is-active" : ""}`}
                      href={href}
                      scroll={false}
                    >
                      <span className="board-row__mark" aria-hidden="true">
                        {job.companyLogoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt="" className="board-row__logo" src={job.companyLogoUrl} />
                        ) : (
                          companyMark(job.companyName)
                        )}
                      </span>
                      <div className="board-row__identity">
                        <RowTitleTag className="board-row__title">
                          {job.title}
                        </RowTitleTag>
                        <RowCompanyTag className="board-row__company">
                          {job.companyName}
                        </RowCompanyTag>
                        {showBadge(job.exclusivity) ? (
                          <span
                            className="badge badge--honest board-row__badge"
                            title={LINKEDIN_EXCLUSIVITY_TOOLTIP}
                          >
                            Not on LinkedIn
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  </td>
                  <td className="board-col-posted">
                    {posted ? (
                      <time dateTime={job.postedAt ?? undefined}>{posted}</time>
                    ) : null}
                  </td>
                  <td className="board-col-loc">
                    {place ? (
                      <span className="board-loc">
                        <span aria-hidden="true" className="board-loc__pin">
                          ⌖
                        </span>
                        <span className="board-loc__text">{place}</span>
                      </span>
                    ) : null}
                  </td>
                  <td className="board-col-pay">
                    {salary ? <span className="board-row__pay">{salary}</span> : null}
                  </td>
                  <td className="board-col-tags">
                    {job.tags.length > 0 ? (
                      <span className="board-row__tags">
                        {job.tags.slice(0, 4).map((tag) => (
                          <Link className="chip" href={`/${tag}-jobs`} key={tag}>
                            {tagLabel(tag)}
                          </Link>
                        ))}
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pager}
      </section>
      <aside aria-label="Job description" className="board__pane">
        {active ? (
          <>
            <div className="board-apply">
              <div className="board-apply__copy">
                <span className="board-row__mark" aria-hidden="true">
                  {active.companyLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="board-row__logo" src={active.companyLogoUrl} />
                  ) : (
                    companyMark(active.companyName)
                  )}
                </span>
                <div className="board-apply__meta">
                  <p className="board-apply__company">
                    <Link href={`/web3-companies/${active.companySlug}`}>
                      {active.companyName}
                    </Link>
                  </p>
                  <TitleTag className="board-apply__title">{active.title}</TitleTag>
                  <p className="board-apply__place">
                    {selectedPlace}
                    {selectedSalary ? ` / ${selectedSalary}` : ""}
                  </p>
                  {showBadge(active.exclusivity) ? (
                    <span className="badge badge--honest" title={LINKEDIN_EXCLUSIVITY_TOOLTIP}>
                      Not on LinkedIn
                    </span>
                  ) : null}
                </div>
              </div>
              <Link
                className="button button--primary board-apply__btn"
                href={jobApplyHref(active)}
              >
                Apply
              </Link>
            </div>
            <div
              className="board-body jd-body"
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />
            {active.tags.length > 0 ? (
              <nav className="board-pane-tags">
                {active.tags.map((tag) => (
                  <Link className="chip" href={`/${tag}-jobs`} key={tag}>
                    {tagLabel(tag)}
                  </Link>
                ))}
              </nav>
            ) : null}
          </>
        ) : (
          <p className="board-pane-empty">Select a job to read the description.</p>
        )}
      </aside>
      {active ? (
        <div className="board-apply-fixed">
          <span className="board-apply-fixed__title">{active.title}</span>
          <Link
            className="button button--primary board-apply-fixed__btn"
            href={jobApplyHref(active)}
          >
            Apply
          </Link>
        </div>
      ) : null}
    </div>
  );
}
