import { formatSalaryRange, tagLabel } from "@gaming/shared";
import Link from "next/link";

/**
 * Server-rendered inline SVG charts for the salary stats articles - no chart
 * library (custom-CSS-only constraint), no client JS, degrades to an honest
 * "no salary data yet" paragraph when rows are empty. salary_rollups has 0
 * rows locally and no job has salary_min/max, so that empty path is the one
 * every one of these renders today - it must look intentional, not broken.
 *
 * Colour is never the only signal: the seniority line uses a dashed stroke
 * for a comparison series, every point carries a mono value label, and the
 * "no data" gap is spelled out in text next to the chart, not just implied
 * by an absent dot. Below 480px a line chart reads as noise, so it hands off
 * to a plain table instead of shrinking further - see .chart__table in
 * styles/salary.css.
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

/** A muted, screen-reader-honest stand-in for a missing figure - never a bare "-", which
 * reads as a rendering fault next to numbers that did render. */
function MissingValue() {
  return (
    <span
      aria-label="no published pay"
      className="muted"
      title="No listings with published pay at this level"
    >
      &mdash;
    </span>
  );
}

function domainMaxFor(rows: readonly SalaryChartRow[]): number {
  const max = rows.reduce((acc, row) => Math.max(acc, row.max, row.avg), 0);
  return max > 0 ? max * 1.08 : 1;
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Horizontal range-bar chart: one row per slug, a light track spanning the shared
 * domain, a filled segment from min to max, and a marker at the average. A shared
 * scale header names both ends of that domain so the bars read as measurements,
 * not just relative shapes. */
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
  const topLabel = formatSalaryRange(Math.round(domainMax / 1.08), Math.round(domainMax / 1.08));

  return (
    <div aria-label={chartLabel} className="salary-chart" role="group">
      <div aria-hidden="true" className="salary-chart__row salary-chart__scale">
        <span />
        <span className="salary-chart__scale-track">
          <span className="mono">$0</span>
          <span className="mono">{topLabel}</span>
        </span>
        <span />
      </div>
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

function seniorityCoords(
  points: readonly SalarySeniorityPoint[],
  domainMax: number,
  width: number,
  top: number,
  plotHeight: number,
): SeniorityCoord[] {
  const total = points.length;
  const stepX = total > 1 ? width / (total - 1) : 0;
  return points.map((point, index) => ({
    ...point,
    x: total > 1 ? index * stepX : width / 2,
    y: point.avg == null ? null : top + plotHeight * (1 - point.avg / domainMax),
  }));
}

function seniorityLineSegments(coords: readonly SeniorityCoord[]): { x: number; y: number }[][] {
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
  return segments;
}

/** Line chart across an ordered seniority axis (intern -> junior -> ... -> cto). Points
 * without data leave a gap in the line rather than interpolating a value nobody reported.
 * An optional `compare` series overlays a second stack (e.g. Solana vs Ethereum) as a
 * dashed cool-coloured line with its own legend entry, so the two are distinguishable
 * without relying on colour alone. Below 480px both series fall back to a plain table. */
export function SalarySeniorityChart({
  points,
  label,
  compare,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
}: {
  points: SalarySeniorityPoint[];
  /** Series label, used only for the legend/table header when `compare` is set. */
  label?: string;
  compare?: { label: string; points: SalarySeniorityPoint[] };
  emptyMessage?: string;
}) {
  const withData = points.filter((point) => point.avg != null);
  const compareWithData = compare ? compare.points.filter((point) => point.avg != null) : [];
  if (withData.length === 0 && compareWithData.length === 0) {
    return <p className="salary-chart__empty muted">{emptyMessage}</p>;
  }

  const rawMax = Math.max(
    0,
    ...withData.map((point) => (point.max ?? point.avg)!),
    ...compareWithData.map((point) => (point.max ?? point.avg)!),
  );
  const domainMax = rawMax > 0 ? rawMax * 1.08 : 1;
  const total = points.length;
  const width = 100;
  const height = 40;
  const top = 6;
  const plotHeight = height - top * 2;
  const gridY = [top, top + plotHeight / 2, top + plotHeight];
  const topAxisLabel = formatSalaryRange(Math.round(rawMax), Math.round(rawMax));

  const coords = seniorityCoords(points, domainMax, width, top, plotHeight);
  const segments = seniorityLineSegments(coords);
  const plotted = coords.filter((coord): coord is SeniorityCoord & { y: number } => coord.y != null);

  const compareCoords = compare
    ? seniorityCoords(compare.points, domainMax, width, top, plotHeight)
    : [];
  const compareSegments = seniorityLineSegments(compareCoords);
  const comparePlotted = compareCoords.filter(
    (coord): coord is SeniorityCoord & { y: number } => coord.y != null,
  );

  // Named outright below the chart, so an empty column is understood as "nobody published
  // a number" rather than as a chart that failed to draw.
  const missingLabels = points.filter((point) => point.avg == null).map((point) => point.label);

  return (
    <div className="chart">
      {compare ? (
        <div aria-hidden="true" className="chart__legend">
          <span className="chart__legend-item">
            <i className="chart__swatch chart__swatch--primary" />
            {label ?? "This role"}
          </span>
          <span className="chart__legend-item">
            <i className="chart__swatch chart__swatch--compare" />
            {compare.label}
          </span>
        </div>
      ) : null}

      <div className="chart__viz">
        <div className="chart__plot">
          <div aria-hidden="true" className="chart__axis">
            <span className="mono">{topAxisLabel}</span>
            <span className="mono">$0</span>
          </div>
          <svg
            aria-label={compare ? `${label ?? "Salary"} vs ${compare.label} by seniority` : "Salary by seniority"}
            className="chart__svg"
            preserveAspectRatio="none"
            role="img"
            viewBox={`0 0 ${width} ${height}`}
          >
            {gridY.map((y) => (
              <line className="chart__gridline" key={y} x1="0" x2={width} y1={y} y2={y} />
            ))}
            {segments.map((segment, index) => (
              <polyline
                className="chart__path chart__path--primary"
                key={`primary-${index}`}
                points={segment.map((point) => `${point.x},${point.y}`).join(" ")}
              />
            ))}
            {compareSegments.map((segment, index) => (
              <polyline
                className="chart__path chart__path--compare"
                key={`compare-${index}`}
                points={segment.map((point) => `${point.x},${point.y}`).join(" ")}
              />
            ))}
            {plotted.map((point) => (
              <circle
                className="chart__dot chart__dot--primary"
                cx={point.x}
                cy={point.y}
                key={`primary-${point.slug}`}
                r="2"
              />
            ))}
            {comparePlotted.map((point) => (
              <circle
                className="chart__dot chart__dot--compare"
                cx={point.x}
                cy={point.y}
                key={`compare-${point.slug}`}
                r="2"
              />
            ))}
          </svg>
        </div>
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
                {point.avg == null ? <MissingValue /> : formatSalaryRange(point.avg, point.avg)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="chart__table table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th scope="col">Level</th>
              <th scope="col">{compare ? (label ?? "Average") : "Average"}</th>
              {compare ? <th scope="col">{compare.label}</th> : null}
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => {
              const comparePoint = compare?.points[index];
              return (
                <tr key={point.slug}>
                  <td>{point.href ? <Link href={point.href}>{point.label}</Link> : point.label}</td>
                  <td className="table__num">
                    {point.avg == null ? <MissingValue /> : formatSalaryRange(point.avg, point.avg)}
                  </td>
                  {compare ? (
                    <td className="table__num">
                      {comparePoint?.avg == null ? (
                        <MissingValue />
                      ) : (
                        formatSalaryRange(comparePoint.avg, comparePoint.avg)
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
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
