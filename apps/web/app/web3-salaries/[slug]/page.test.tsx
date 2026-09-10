import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { tagLabel } from "@gaming/shared";

import { catalogMonthLabel } from "../../_components/board-chrome";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { SalaryBreakdownTable, SalaryStatsTable } from "../../_components/salary-tables";
import { buildLandingTitle } from "../../../lib/jobs/landing-meta";

type TestElement = ReactElement<Record<string, unknown> & { children?: ReactNode }>;

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  listJobs: vi.fn(),
  getJobForListItem: vi.fn(),
  resolveSalaryStats: vi.fn(),
  resolveSalaryBreakdown: vi.fn(),
  listResolvedSalaryStats: vi.fn(),
  headers: vi.fn(async () => new Headers({ host: "nodework.example" })),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("next/headers", () => ({
  headers: () => mocks.headers(),
}));

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => React.createElement("a", props),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("../../../lib/jobs/queries", () => ({
  listJobs: mocks.listJobs,
  getJobForListItem: mocks.getJobForListItem,
  resolveSalaryStats: mocks.resolveSalaryStats,
  resolveSalaryBreakdown: mocks.resolveSalaryBreakdown,
  listResolvedSalaryStats: mocks.listResolvedSalaryStats,
  salaryRoleStem: (role: string) =>
    role.endsWith("-developer") ? role.slice(0, -"-developer".length) : role,
  jobPublicHref: (job: { slug: string; externalId?: string | null }) =>
    job.externalId ? `/${job.slug}/${job.externalId}` : `/jobs/${job.slug}`,
  jobApplyHref: (job: { slug: string; externalId?: string | null }) =>
    job.externalId ? `/${job.slug}/${job.externalId}/apply` : `/jobs/${job.slug}/apply`,
}));

vi.mock("../../../lib/tenant", () => ({
  requireTenantId: async () => "tenant-gaming",
}));

vi.stubGlobal("React", React);

function elements(node: ReactNode): TestElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as TestElement;
  return [element, ...elements(element.props.children)];
}

function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (!node || typeof node !== "object" || !("props" in node)) return "";
  return text((node as ReactElement<{ children?: ReactNode }>).props.children);
}

function render(element: TestElement | undefined): ReactNode {
  if (!element) return null;
  return (element.type as (props: Record<string, unknown>) => ReactNode)(element.props);
}

const emptyList = { jobs: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
const month = catalogMonthLabel();

function titleFor(headline: string) {
  return buildLandingTitle({ headline, month, newJobs: 0 });
}

describe("SalaryRolePage", () => {
  // The page's own applicationVolume() query (app/web3-salaries/queries.ts) is
  // the only direct db.prepare call on this route; everything else goes through
  // the mocked lib/jobs/queries module. `applicationRow` is what that one query
  // returns, so a test can flip the page between "nobody has applied" and a
  // real applicants-per-job figure.
  let applicationRow: { applications: number; jobsWithApplications: number } = {
    applications: 0,
    jobsWithApplications: 0,
  };
  const db = {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => applicationRow),
      })),
    })),
  };

  beforeEach(() => {
    applicationRow = { applications: 0, jobsWithApplications: 0 };
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: db } });
    mocks.listJobs.mockResolvedValue(emptyList);
    mocks.getJobForListItem.mockResolvedValue(null);
    mocks.resolveSalaryStats.mockResolvedValue(null);
    mocks.resolveSalaryBreakdown.mockResolvedValue([]);
    mocks.listResolvedSalaryStats.mockResolvedValue([]);
  });

  it("filters geo salary pages by locationSlug and never lists the full catalog", async () => {
    const { default: SalaryRolePage } = await import("./page");
    const page = await SalaryRolePage({
      params: Promise.resolve({ slug: "united-states" }),
    });

    expect(mocks.listJobs).toHaveBeenCalledWith(db, "tenant-gaming", {
      tag: undefined,
      orTitle: false,
      locationSlug: "united-states",
      seniority: undefined,
      pageSize: 20,
    });
    expect(text(elements(page).find((element) => element.type === "h1"))).toBe(
      titleFor("United States salary"),
    );
    // Non-role kinds never call the tag-scoped breakdown helper.
    expect(mocks.resolveSalaryBreakdown).not.toHaveBeenCalled();
  });

  it("filters role salary pages by the tag stem or title", async () => {
    const { default: SalaryRolePage } = await import("./page");
    const page = await SalaryRolePage({
      params: Promise.resolve({ slug: "solidity-developer" }),
    });

    expect(mocks.listJobs).toHaveBeenCalledWith(db, "tenant-gaming", {
      tag: "solidity",
      orTitle: true,
      locationSlug: undefined,
      seniority: undefined,
      pageSize: 20,
    });
    expect(text(elements(page).find((element) => element.type === "h1"))).toBe(
      titleFor("Solidity Developer salary"),
    );
    expect(text(page)).not.toMatch(/[–—]/);
    expect(elements(page).find((element) => element.type === Breadcrumbs)).toBeDefined();
  });

  it("renders an honest empty state and skips the hourly-rate section with no rollup", async () => {
    const { default: SalaryRolePage } = await import("./page");
    const page = await SalaryRolePage({
      params: Promise.resolve({ slug: "solidity-developer" }),
    });
    const copy = text(page);

    expect(copy).toContain("does not yet have a published salary band");
    expect(copy).not.toContain("hourly rate");
    expect(copy).toContain("does not have any listed");
    // "Average yearly salary" and the two count sections still render, and say
    // there is no data rather than printing a fabricated zero.
    expect(copy).toContain("Average yearly salary");
    expect(copy).toContain("Not enough data yet");
    expect(copy).toContain("How many Solidity Developer jobs are there?");
    expect(copy).toContain("How many applicants per Solidity Developer job?");
    expect(copy).toContain("No one has applied");
  });

  it("builds the full stats article - narrative, hourly rate, remote share and breakdowns - for a role with data", async () => {
    applicationRow = { applications: 5, jobsWithApplications: 2 };
    mocks.resolveSalaryStats.mockResolvedValue({
      dimension: "role",
      slug: "solidity-developer",
      avg: 156000,
      min: 120000,
      max: 200000,
      jobCount30d: 6,
    });
    mocks.listJobs.mockImplementation(
      async (_db: unknown, _tenant: unknown, filters: Record<string, unknown>) => {
        if (filters.remoteOnly) return { ...emptyList, total: 3 };
        return { ...emptyList, total: 10 };
      },
    );
    mocks.resolveSalaryBreakdown.mockImplementation(
      async (_db: unknown, _tenant: unknown, _filter: unknown, by: string) => {
        if (by === "country") {
          return [{ slug: "united-states", min: 130000, avg: 160000, max: 200000, count: 3 }];
        }
        return [{ slug: "senior", min: 140000, avg: 170000, max: 200000, count: 2 }];
      },
    );
    mocks.listResolvedSalaryStats.mockResolvedValue([
      { dimension: "role", slug: "solidity-developer", avg: 156000, min: 120000, max: 200000, jobCount30d: 6 },
    ]);

    const { default: SalaryRolePage } = await import("./page");
    const page = await SalaryRolePage({
      params: Promise.resolve({ slug: "solidity-developer" }),
    });
    const all = elements(page);
    const copy = text(page);

    expect(copy).toContain("$156k");
    expect(copy).toContain("30% of the 10 currently listed");
    expect(copy).toContain("per hour");
    expect(copy).toContain("Solidity Developer salary by country");
    expect(copy).toContain("Solidity Developer salary by seniority");
    expect(copy).toContain("Nodework lists 10 Solidity Developer jobs right now.");
    expect(copy).toContain("6 of them published both a minimum and a maximum");
    expect(copy).toContain("5 applications on Solidity Developer jobs");
    expect(copy).toContain("averages 0.5 per listed role");

    const countryBreakdown = all.find(
      (el) => el.type === SalaryBreakdownTable && el.props.labelHeader === "Country",
    );
    expect(text(render(countryBreakdown))).toContain(tagLabel("united-states"));

    const comparison = all.find(
      (el) => el.type === SalaryStatsTable && el.props.heading === "Compare with other roles",
    );
    expect(comparison).toBeDefined();
    expect((comparison?.props.hrefFor as (s: string) => string)("rust-developer")).toBe(
      "/web3-salaries/rust-developer",
    );

    const hireLinks = all
      .filter((el) => typeof el.props.href === "string")
      .map((el) => el.props.href as string);
    expect(hireLinks).toContain("/post-web3-job");
  });

  it("skips the country/seniority breakdown sections and uses the sibling comparison table for a seniority page", async () => {
    mocks.resolveSalaryStats.mockResolvedValue({
      dimension: "seniority",
      slug: "senior",
      avg: 140000,
      min: 100000,
      max: 180000,
      jobCount30d: 4,
    });
    mocks.listResolvedSalaryStats.mockResolvedValue([]);

    const { default: SalaryRolePage } = await import("./page");
    const page = await SalaryRolePage({ params: Promise.resolve({ slug: "senior" }) });
    const all = elements(page);
    const copy = text(page);

    expect(text(elements(page).find((element) => element.type === "h1"))).toBe(
      titleFor("Senior salary"),
    );
    expect(copy).toContain("How much do Senior Web3 jobs pay?");
    expect(copy).not.toContain("salary by country");
    expect(mocks.resolveSalaryBreakdown).not.toHaveBeenCalled();

    const comparison = all.find(
      (el) => el.type === SalaryStatsTable && el.props.heading === "Compare with other seniority levels",
    );
    expect(comparison).toBeDefined();
  });
});
