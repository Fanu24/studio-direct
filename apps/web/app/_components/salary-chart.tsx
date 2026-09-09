import { formatSalaryRange, tagLabel } from "@gaming/shared";
import Link from "next/link";

import "../styles/salary.css";

/**
 * Server-rendered inline SVG charts for the salary stats articles - no chart
 * library (custom-CSS-only constraint), no client JS, degrades to an honest
 * "no salary data yet" paragraph when rows are empty. salary_rollups has 0
 * rows locally and no job has salary_min/max, so that empty path is the one
 * every one of these renders today - it must look intentional, not broken.
 */

export interface SalaryChartRow {
  slug: string;
  /** Defaults to tagLabel(slug) - pass a label for slugs tagLabel doesn't know (e.g. a
   * two-role comparison row keyed by role slug already covers this, so this is rarely needed). */
  label?: string;
  href?: string;
  avg: number;
  min: number;
  max: number;
}

const DEFAULT_EMPTY_MESSAGE = "No salary data available yet.";

function domainMaxFor(rows: readonly SalaryChartRow[]): number {
  const max = rows.reduce((acc, row) => Math.max(acc, row.max, row.avg), 0);
  return max > 0 ? max * 1.08 : 1;
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Horizontal range-bar chart: one row per slug, a light track spanning the shared
 * domain, a filled segment from min to max, and a marker at the average. */
export function SalaryBarChart({
  rows,
  chartLabel = "Salary comparison chart",
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
}: {
  rows: SalaryChartRow[];
  chartLabel?: string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <p className="salary-chart__empty muted">{emptyMessage}</p>;
  }

  const domainMax = domainMaxFor(rows);

  return (
    <div aria-label={chartLabel} className="salary-chart" role="img">
      {rows.map((row) => {
        const minPct = clampPct((row.min / domainMax) * 100);
        const maxPct = clampPct((row.max / domainMax) * 100);
        const avgPct = clampPct((row.avg / domainMax) * 100);
        const rangeWidth = Math.max(maxPct - minPct, 0.8);
        const rowLabel = row.label ?? tagLabel(row.slug);
        return (
          <div className="salary-chart__row" key={row.slug}>
            <span className="salary-chart__label">
              {row.href ? <Link href={row.href}>{rowLabel}</Link> : rowLabel}
            </span>
            <svg
              aria-hidden="true"
              className="salary-chart__bar"
              preserveAspectRatio="none"
              viewBox="0 0 100 12"
            >
              <rect className="salary-chart__track" height="12" width="100" x="0" y="0" />
              <rect
                className="salary-chart__range"
                height="12"
                width={rangeWidth}
                x={minPct}
                y="0"
              />
              <rect
                className="salary-chart__avg"
                height="12"
                width="1.4"
                x={Math.max(0, avgPct - 0.7)}
                y="0"
              />
            </svg>
            <span className="salary-chart__value mono">
              {formatSalaryRange(row.avg, row.avg)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export interface SalarySeniorityPoint {
  slug: string;
  label: string;
  href?: string;
  avg: number | null;
  max?: number | null;
}

type SeniorityCoord = SalarySeniorityPoint & { x: number; y: number | null };

/** Line chart across an ordered seniority axis (intern -> junior -> ... -> cto). Points
 * without data leave a gap in the line rather than interpolating a value nobody reported. */
export function SalarySeniorityChart({
  points,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
}: {
  points: SalarySeniorityPoint[];
  emptyMessage?: string;
}) {
  const withData = points.filter((point) => point.avg != null);
  if (withData.length === 0) {
    return <p className="salary-chart__empty muted">{emptyMessage}</p>;
  }

  const domainMax =
    Math.max(...withData.map((point) => (point.max ?? point.avg)!)) * 1.08 || 1;
  const total = points.length;
  const width = 100;
  const height = 40;
  const stepX = total > 1 ? width / (total - 1) : 0;
  const top = 6;
  const plotHeight = height - top * 2;

  const coords: SeniorityCoord[] = points.map((point, index) => ({
    ...point,
    x: total > 1 ? index * stepX : width / 2,
    y: point.avg == null ? null : top + plotHeight * (1 - point.avg / domainMax),
  }));

  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (const coord of coords) {
    if (coord.y == null) {
      if (current.length > 1) segments.push(current);
      current = [];
      continue;
    }
    current.push({ x: coord.x, y: coord.y });
  }
  if (current.length > 1) segments.push(current);

  // Named outright below the chart, so an empty column is understood as "nobody published
  // a number" rather than as a chart that failed to draw.
  const missingLabels = points.filter((point) => point.avg == null).map((point) => point.label);

  const plotted = coords.filter(
    (coord): coord is SeniorityCoord & { y: number } => coord.y != null,
  );

  return (
    <div className="salary-line">
      <svg
        aria-label="Salary by seniority"
        className="salary-line__svg"
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        {segments.map((segment, index) => (
          <polyline
            className="salary-line__path"
            key={index}
            points={segment.map((point) => `${point.x},${point.y}`).join(" ")}
          />
        ))}
        {plotted.map((point) => (
          <circle className="salary-line__dot" cx={point.x} cy={point.y} key={point.slug} r="2" />
        ))}
      </svg>
      <div
        className="salary-line__labels"
        style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}
      >
        {points.map((point) => (
          <div
            className={`salary-line__label${point.avg == null ? " is-empty" : ""}`}
            key={point.slug}
          >
            <span>{point.href ? <Link href={point.href}>{point.label}</Link> : point.label}</span>
            <span className="mono">
              {point.avg == null ? (
                /*
                 * A bare dash reads as a rendering fault rather than as an absence: on a
                 * chart titled "from intern to CTO", two mute dashes look like the chart
                 * broke. The dash stays because the columns are only ~65px wide on mobile,
                 * but it now carries its meaning for screen readers and on hover, and the
                 * caption below names the levels outright.
                 */
                <span aria-label="no published pay" className="muted" title="No listings with published pay at this level">
                  &mdash;
                </span>
              ) : (
                formatSalaryRange(point.avg, point.avg)
              )}
            </span>
          </div>
        ))}
      </div>
      {missingLabels.length > 0 ? (
        <p className="salary-line__note muted">
          {missingLabels.length === 1
            ? `No listings with published pay at ${missingLabels[0]} level yet.`
            : `No listings with published pay yet at these levels: ${missingLabels.join(", ")}.`}
        </p>
      ) : null}
    </div>
  );
}
