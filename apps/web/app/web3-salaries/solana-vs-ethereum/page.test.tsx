import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogMonthLabel } from "../../_components/board-chrome";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { SalaryStatsTable } from "../../_components/salary-tables";
import { buildLandingTitle } from "../../../lib/jobs/landing-meta";

type TestElement = ReactElement<Record<string, unknown> & { children?: ReactNode }>;

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  resolveSalaryStats: vi.fn(),
  resolveSalaryBreakdown: vi.fn(),
  listJobs: vi.fn(),
  getJobForListItem: vi.fn(),
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

vi.mock("../../../lib/jobs/queries", () => ({
  resolveSalaryStats: mocks.resolveSalaryStats,
  resolveSalaryBreakdown: mocks.resolveSalaryBreakdown,
  listJobs: mocks.listJobs,
  getJobForListItem: mocks.getJobForListItem,
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

const emptyList = { jobs: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
const month = catalogMonthLabel();
const title = buildLandingTitle({ headline: "Solana vs Ethereum salary", month, newJobs: 0 });

describe("SolanaVsEthereumSalaryPage", () => {
  const db = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: db } });
    mocks.resolveSalaryStats.mockResolvedValue(null);
    mocks.resolveSalaryBreakdown.mockResolvedValue([]);
    mocks.listJobs.mockResolvedValue(emptyList);
    mocks.getJobForListItem.mockResolvedValue(null);
  });

  it("compares solana, ethereum, and solidity stats with an honest empty state when unpublished", async () => {
    const { default: SolanaVsEthereumSalaryPage } = await import("./page");
    const page = await SolanaVsEthereumSalaryPage();
    const all = elements(page);
    const hrefs = all
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(mocks.resolveSalaryStats).toHaveBeenCalledWith(db, "tenant-gaming", "role", "solana-developer");
    expect(mocks.resolveSalaryStats).toHaveBeenCalledWith(db, "tenant-gaming", "role", "ethereum-developer");
    expect(mocks.resolveSalaryStats).toHaveBeenCalledWith(db, "tenant-gaming", "role", "solidity-developer");
    expect(text(all.find((element) => element.type === "h1"))).toBe(title);
    expect(all.find((element) => element.type === Breadcrumbs)).toBeDefined();
    expect(hrefs).toContain("/solana-jobs");
    expect(hrefs).toContain("/solidity-jobs");

    const comparison = all.find((element) => element.type === SalaryStatsTable);
    expect((comparison?.props.hrefFor as (s: string) => string)("solana-developer")).toBe(
      "/web3-salaries/solana-developer",
    );

    const copy = text(page);
    expect(copy).toContain("does not yet have a published salary band");
    expect(copy).toContain("does not have enough published salary bands");
    expect(copy).not.toMatch(/[–—]/);
  });

  it("computes a live percentage delta, job-count ratio, and a winner in the Conclusion", async () => {
    mocks.resolveSalaryStats.mockImplementation(
      async (_db: unknown, _tenant: unknown, _dimension: string, role: string) => {
        if (role === "solana-developer") {
          return { dimension: "role", slug: role, avg: 180000, min: 140000, max: 220000, jobCount30d: 5 };
        }
        if (role === "ethereum-developer") {
          return { dimension: "role", slug: role, avg: 150000, min: 120000, max: 190000, jobCount30d: 8 };
        }
        return null;
      },
    );
    mocks.listJobs.mockImplementation(
      async (_db: unknown, _tenant: unknown, filters: Record<string, unknown>) => {
        if (filters.tag === "solana") return { ...emptyList, total: 6 };
        if (filters.tag === "ethereum") return { ...emptyList, total: 9 };
        return emptyList;
      },
    );

    const { default: SolanaVsEthereumSalaryPage } = await import("./page");
    const page = await SolanaVsEthereumSalaryPage();
    const copy = text(page);

    expect(copy).toContain("$180k");
    expect(copy).toContain("20% higher");
    expect(copy).toContain("6 Solana developer jobs versus 9 Ethereum developer jobs, a ratio of 6:9");
    expect(copy).toContain("Solana developer roles pay more on average");
  });
});
