export type SalaryBounds = {
  min: number;
  max: number;
};

/** Parse strings like "$105k - $180k", "100000-150000", "$90k". Returns USD integers. */
export function parseSalaryBounds(value: string | null | undefined): SalaryBounds | null {
  if (!value) return null;
  const matches = [...value.matchAll(/\$?\s*(\d+(?:\.\d+)?)\s*(k)?/gi)];
  const amounts: number[] = [];
  for (const match of matches) {
    const n = Number.parseFloat(match[1]!);
    if (!Number.isFinite(n) || n <= 0) continue;
    const scaled = match[2] ? Math.round(n * 1000) : Math.round(n);
    if (scaled >= 1000) amounts.push(scaled);
  }
  if (amounts.length === 0) return null;
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  return { min, max };
}

export function formatSalaryRange(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  const fmt = (n: number) => {
    // Executive bands are real — one listing states $1M-$5M in its own title — and reading
    // them as "$5,000k" makes a genuine figure look like a units bug.
    if (n >= 1_000_000) {
      const millions = n / 1_000_000;
      return `$${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
    }
    if (n >= 1000) return `$${Math.round(n / 1000)}k`;
    return `$${n}`;
  };
  if (min != null && max != null && min !== max) return `${fmt(min)} - ${fmt(max)}`;
  return fmt(min ?? max!);
}

export type SalaryAggregate = SalaryBounds & { avg: number };

export function averageSalary(
  rows: readonly { min: number | null; max: number | null }[],
): SalaryAggregate | null {
  const mids: number[] = [];
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const row of rows) {
    if (row.min == null || row.max == null) continue;
    mids.push((row.min + row.max) / 2);
    min = Math.min(min, row.min);
    max = Math.max(max, row.max);
  }
  if (mids.length === 0) return null;
  const avg = Math.round(mids.reduce((sum, n) => sum + n, 0) / mids.length);
  return { min, max, avg };
}

export type SalaryRollup = {
  dimension: "role" | "country" | "seniority" | "region";
  slug: string;
  avg: number;
  min: number;
  max: number;
  jobCount30d: number;
};

export function buildSalaryRollup(
  dimension: SalaryRollup["dimension"],
  slug: string,
  rows: readonly { min: number | null; max: number | null }[],
): SalaryRollup | null {
  const stats = averageSalary(rows);
  if (!stats) return null;
  return {
    dimension,
    slug,
    avg: stats.avg,
    min: stats.min,
    max: stats.max,
    jobCount30d: rows.filter((row) => row.min != null && row.max != null).length,
  };
}
