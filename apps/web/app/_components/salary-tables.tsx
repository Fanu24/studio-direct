import {
  NON_TECH_SALARY_ROLES as SHARED_NON_TECH_SALARY_ROLES,
  SALARY_ROLES,
  formatSalaryRange,
  tagLabel,
} from "@gaming/shared";
import Link from "next/link";

import { TABLE_HEADING_STYLE } from "./table-heading";
import type { SalaryBreakdownRow } from "../../lib/jobs/queries";

const NON_TECH = new Set<string>(SHARED_NON_TECH_SALARY_ROLES);

/**
 * P12 task 8 IA decision: keep the two adjacent hub tables/URLs
 * (/web3-salaries for engineering roles, /web3-non-tech-salaries for
 * product/marketing/ops roles) instead of collapsing SALARY_ROLES into one
 * combined ~41-row table with a role-type column. The site already ships a
 * dedicated non-tech hub URL, nav entry and sitemap slice, and splitting
 * keeps each hub's comparison table a length a visitor actually scans
 * instead of one long alphabetic list. Both IAs are defensible (target.com
 * ships the combined form); this is the conscious choice for this site,
 * documented here rather than left to drift.
 */
export const DEVELOPER_SALARY_ROLES = SALARY_ROLES.filter((slug) => !NON_TECH.has(slug));

export interface SalaryTableRow {
  slug: string;
  avg: number | null;
  min: number | null;
  max: number | null;
}

function Dash() {
  return <span className="muted">-</span>;
}

/**
 * Fixed-taxonomy salary table: always renders one row per `slugs` entry, with
 * a dash placeholder wherever no rollup/live stat exists yet. Used for the
 * hub pages and the per-page "compare with other X" tables, where the point
 * is showing the whole taxonomy for internal linking, not just the rows that
 * happen to have data.
 *
 * Each row's position label is an `h2` (see TABLE_HEADING_STYLE) so the page
 * outline lists the roles the table compares, matching the reference salary
 * hub, which marks its row labels the same way and at the same level as its
 * section headings.
 */
export function SalaryStatsTable({
  heading,
  headingLevel = "h2",
  labelHeader,
  slugs,
  rows,
  hrefFor,
}: {
  heading?: string;
  headingLevel?: "h2" | "h3";
  labelHeader: string;
  slugs: readonly string[];
  rows: readonly SalaryTableRow[];
  hrefFor: (slug: string) => string;
}) {
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  const Heading = headingLevel;
  return (
    <>
      {heading ? <Heading>{heading}</Heading> : null}
      <div className="salary-table-wrap">
        <table className="salary-table">
          <thead>
            <tr>
              <th>{labelHeader}</th>
              <th>Average</th>
              <th>Min Yearly Salary</th>
              <th>Max Yearly Salary</th>
            </tr>
          </thead>
          <tbody>
            {slugs.map((slug) => {
              const row = bySlug.get(slug);
              const hasData = Boolean(
                row && row.avg != null && row.min != null && row.max != null,
              );
              return (
                <tr key={slug}>
                  <td>
                    <h2 style={TABLE_HEADING_STYLE}>
                      <Link href={hrefFor(slug)}>{tagLabel(slug)}</Link>
                    </h2>
                  </td>
                  <td className="mono">
                    {hasData ? formatSalaryRange(row!.avg, row!.avg) : <Dash />}
                  </td>
                  <td className="mono">
                    {hasData ? formatSalaryRange(row!.min, row!.min) : <Dash />}
                  </td>
                  <td className="mono">
                    {hasData ? formatSalaryRange(row!.max, row!.max) : <Dash />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * Dynamic-rows salary breakdown table (resolveSalaryBreakdown output): only
 * slugs that actually have a computed average exist in `rows`, so an empty
 * array renders an honest "no data yet" paragraph instead of a table full of
 * dashes that looks broken rather than simply unpopulated. Row labels are
 * headings for the same reason as in SalaryStatsTable.
 */
export function SalaryBreakdownTable({
  heading,
  headingLevel = "h2",
  labelHeader,
  rows,
  hrefFor,
  emptyMessage = "No salary data available yet for this breakdown.",
}: {
  heading?: string;
  headingLevel?: "h2" | "h3";
  labelHeader: string;
  rows: readonly SalaryBreakdownRow[];
  hrefFor?: (slug: string) => string;
  emptyMessage?: string;
}) {
  const Heading = headingLevel;
  return (
    <>
      {heading ? <Heading>{heading}</Heading> : null}
      {rows.length === 0 ? (
        <p className="muted">{emptyMessage}</p>
      ) : (
        <div className="salary-table-wrap">
          <table className="salary-table">
            <thead>
              <tr>
                <th>{labelHeader}</th>
                <th>Average</th>
                <th>Min Yearly Salary</th>
                <th>Max Yearly Salary</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.slug}>
                  <td>
                    <h2 style={TABLE_HEADING_STYLE}>
                      {hrefFor ? (
                        <Link href={hrefFor(row.slug)}>{tagLabel(row.slug)}</Link>
                      ) : (
                        tagLabel(row.slug)
                      )}
                    </h2>
                  </td>
                  <td className="mono">{formatSalaryRange(row.avg, row.avg)}</td>
                  <td className="mono">{formatSalaryRange(row.min, row.min)}</td>
                  <td className="mono">{formatSalaryRange(row.max, row.max)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
