import { describe, expect, it } from "vitest";

import {
  decodeCompanySlug,
  isReservedCompanySlug,
  listCompanyCategories,
  listCompanyDirectory,
  listCompanyGrowth,
  listMonthlyPostings,
  monthLabel,
  RESERVED_COMPANY_SLUGS,
} from "./queries";
import type { JobsDatabase } from "../jobs/queries";

/**
 * Routes every prepare() to the first fixture whose key appears in the SQL,
 * so one fake covers listCompanies' own two statements plus this module's
 * logo, category and monthly-posting queries without pretending to be D1.
 */
const seenSql: string[] = [];

function fakeDb(fixtures: Record<string, unknown[]>): JobsDatabase {
  return {
    prepare(sql: string) {
      seenSql.push(sql);
      const key = Object.keys(fixtures).find((needle) => sql.includes(needle));
      const results = key ? fixtures[key]! : [];
      const statement = {
        bind: () => statement,
        first: async () => (results[0] ?? null) as never,
        all: async () => ({ results: results as never[] }),
        run: async () => undefined,
      };
      return statement;
    },
  };
}

const COMPANY_ROWS = [
  { id: "a", name: "Alpha Studio", nameNorm: "alpha-studio", domain: "alpha.xyz", jobCount: 5, lastPostedAt: "2026-09-01T00:00:00Z" },
  { id: "b", name: "Beta Forge", nameNorm: "beta-forge", domain: null, jobCount: 2, lastPostedAt: null },
  { id: "c", name: "Gamma Labs", nameNorm: "gamma-labs", domain: null, jobCount: 0, lastPostedAt: null },
];

const LOGO_ROWS = [{ id: "a", logoUrl: "https://cdn.example.com/a.png" }];

const CATEGORY_ROWS = [
  // Ordered the way the query orders them: per company, most common tag first.
  { companyId: "a", slug: "solidity", count: 4 },
  { companyId: "a", slug: "design", count: 1 },
  { companyId: "b", slug: "solidity", count: 2 },
];

const ROLLUP_ROWS = [
  { dimension: "company", slug: "alpha-studio", avg: 140000, min: 100000, max: 180000, jobCount30d: 5 },
];

const LAST_POSTED_ROWS = [
  { companyId: "a", lastPostedAt: "2026-09-07" },
  { companyId: "b", lastPostedAt: "not-a-date" },
];

function directoryDb() {
  return fakeDb({
    "FROM companies c": COMPANY_ROWS,
    "logo_url AS logoUrl": LOGO_ROWS,
    "FROM job_tags jt": CATEGORY_ROWS,
    "AS lastPostedAt": LAST_POSTED_ROWS,
    "FROM salary_rollups": ROLLUP_ROWS,
  });
}

describe("listCompanyDirectory", () => {
  it("joins the ranked index to its logo and to a category derived from the company's most common tag", async () => {
    const items = await listCompanyDirectory(directoryDb(), "tenant-gaming");

    expect(items.map((item) => item.slug)).toEqual([
      "alpha-studio",
      "beta-forge",
      "gamma-labs",
    ]);
    expect(items[0]).toMatchObject({
      logoUrl: "https://cdn.example.com/a.png",
      category: "solidity",
      avgSalary: 140000,
      // The normalised MAX wins over listCompanies' raw MAX(posted_at),
      // which cannot compare the two stored date formats.
      lastPostedAt: "2026-09-07",
    });
    // Beta's runner-up tag never wins, and a company with no tagged listing
    // gets an honest null rather than an invented category.
    // An unparseable normalised value falls back to the raw column rather
    // than replacing a real date with garbage.
    expect(items[1]).toMatchObject({ category: "solidity", logoUrl: null, lastPostedAt: null });
    expect(items[2]).toMatchObject({ category: null, logoUrl: null, avgSalary: null });
  });

  it("filters to one category and caps the leaderboard", async () => {
    const filtered = await listCompanyDirectory(directoryDb(), "tenant-gaming", {
      category: "design",
    });
    expect(filtered).toEqual([]);

    const capped = await listCompanyDirectory(directoryDb(), "tenant-gaming", { limit: 2 });
    expect(capped.map((item) => item.slug)).toEqual(["alpha-studio", "beta-forge"]);
  });
});

describe("listCompanyCategories", () => {
  it("counts companies per derived category, busiest first, skipping the uncategorised", async () => {
    const categories = await listCompanyCategories(directoryDb(), "tenant-gaming");
    expect(categories).toEqual([{ slug: "solidity", companyCount: 2 }]);
  });
});

describe("listMonthlyPostings", () => {
  it("keeps the most recent buckets in ascending order and drops malformed months", async () => {
    const db = fakeDb({
      "AS month": [
        { month: "2026-06", count: 10 },
        { month: null, count: 99 },
        { month: "not-a-month", count: 99 },
        { month: "2026-13", count: 99 },
        { month: "2026-07", count: 20 },
        { month: "2026-08", count: 30 },
      ],
    });

    expect(await listMonthlyPostings(db, "tenant-gaming", 2)).toEqual([
      { month: "2026-07", count: 20 },
      { month: "2026-08", count: 30 },
    ]);
    expect(await listMonthlyPostings(db, "tenant-gaming", 0)).toHaveLength(3);
  });
});

describe("listCompanyGrowth", () => {
  it("derives the difference and rate, and reports no baseline as null rather than a fabricated percent", async () => {
    const db = fakeDb({
      "AS newJobs": [
        { id: "a", name: "Alpha", nameNorm: "alpha", newJobs: 8, previousPeriod: 2 },
        { id: "b", name: "Beta", nameNorm: "beta", newJobs: 3, previousPeriod: 0 },
        { id: "c", name: "Gamma", nameNorm: "gamma", newJobs: 1, previousPeriod: 4 },
      ],
    });

    const rows = await listCompanyGrowth(db, "tenant-gaming");

    // Measurable growth descending leads; the no-baseline company ranks last
    // rather than displacing the rates the page exists to show.
    expect(rows.map((row) => row.name)).toEqual(["Alpha", "Gamma", "Beta"]);
    expect(rows[0]).toMatchObject({ difference: 6, growthPct: 300, slug: "alpha" });
    expect(rows[1]).toMatchObject({ difference: -3, growthPct: -75 });
    expect(rows[2]).toMatchObject({ difference: 3, growthPct: null });
  });

  it("compares normalised dates, not raw posted_at strings", async () => {
    seenSql.length = 0;
    await listCompanyGrowth(fakeDb({}), "tenant-gaming");
    const sql = seenSql.join(" ");

    // jobs.posted_at holds both ISO and RFC 1123 values; every "Fri, ..."
    // string sorts above every "2026-..." one, so a raw comparison scores the
    // whole legacy backlog as posted today.
    expect(sql).not.toMatch(/j\.posted_at\s*>=\s*date/);
    expect(sql).toContain("WHEN 'Jan' THEN '01'");
    expect(sql).toContain("WHEN 'Dec' THEN '12'");
    expect(sql).toContain("date('now', '-30 days')");
    expect(sql).toContain("date('now', '-60 days')");
  });
});

describe("monthLabel", () => {
  it("renders YYYY-MM as a short month and returns anything else unchanged", () => {
    expect(monthLabel("2026-09")).toBe("Sep 2026");
    expect(monthLabel("2026-01")).toBe("Jan 2026");
    expect(monthLabel("2026-13")).toBe("2026-13");
    expect(monthLabel("nonsense")).toBe("nonsense");
  });
});

describe("company slug guards", () => {
  it("reserves every static segment that lives beside /web3-companies/[slug]", () => {
    expect(RESERVED_COMPANY_SLUGS).toEqual(["top-growing", "tag"]);
    expect(isReservedCompanySlug("top-growing")).toBe(true);
    expect(isReservedCompanySlug("TAG")).toBe(true);
    expect(isReservedCompanySlug("alpha")).toBe(false);
  });

  it("decodes a percent-encoded segment and survives a malformed escape", () => {
    expect(decodeCompanySlug("alpha%2Bbeta")).toBe("alpha+beta");
    expect(decodeCompanySlug("alpha")).toBe("alpha");
    expect(decodeCompanySlug("%E0%A4%A")).toBe("%E0%A4%A");
  });
});
