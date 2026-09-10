import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { tagLabel } from "@gaming/shared";

import { NON_TECH_SALARY_ROLES } from "../_components/board-chrome";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { SalaryStatsTable } from "../_components/salary-tables";

type TestElement = ReactElement<Record<string, unknown> & { children?: ReactNode }>;

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  listResolvedSalaryStats: vi.fn(),
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

vi.mock("../../lib/jobs/queries", () => ({
  listResolvedSalaryStats: mocks.listResolvedSalaryStats,
  listJobs: mocks.listJobs,
  getJobForListItem: mocks.getJobForListItem,
  jobPublicHref: (job: { slug: string; externalId?: string | null }) =>
    job.externalId ? `/${job.slug}/${job.externalId}` : `/jobs/${job.slug}`,
  jobApplyHref: (job: { slug: string; externalId?: string | null }) =>
    job.externalId ? `/${job.slug}/${job.externalId}/apply` : `/jobs/${job.slug}/apply`,
}));

vi.mock("../../lib/tenant", () => ({
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

const emptyList = { jobs: [], page: 1, pageSize: 10, total: 0, totalPages: 0 };

describe("Web3NonTechSalariesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: {} } });
    mocks.listResolvedSalaryStats.mockResolvedValue([]);
    mocks.listJobs.mockResolvedValue(emptyList);
    mocks.getJobForListItem.mockResolvedValue(null);
  });

  it("links every non-tech salary page and uses dash placeholders when rollups are empty", async () => {
    const { default: Web3NonTechSalariesPage } = await import("./page");
    const page = await Web3NonTechSalariesPage();
    const all = elements(page);

    const roleTable = all.find((el) => el.type === SalaryStatsTable && el.props.labelHeader === "Position");
    const copy = `${text(page)} ${text(render(roleTable))}`;

    expect(text(all.find((el) => el.type === "h1"))).toContain("Web3 non-tech salaries");
    expect(all.find((el) => el.type === Breadcrumbs)).toBeDefined();
    const hrefFor = roleTable?.props.hrefFor as (s: string) => string;
    for (const slug of NON_TECH_SALARY_ROLES) {
      expect(hrefFor(slug)).toBe(`/web3-non-tech-salaries/${slug}`);
    }
    expect(copy).toContain("Min Yearly Salary");
    expect(copy).toContain("Max Yearly Salary");
    expect(copy).toContain("No non-tech role has a published minimum and maximum yet");

    const hrefs = all.filter((el) => typeof el.props.href === "string").map((el) => el.props.href as string);
    expect(hrefs).toContain("/non-tech-jobs");
    expect(hrefs).toContain("/web3-salaries");
    expect(text(page)).not.toMatch(/[–—]/);
  });

  it("computes a live overview and highest/lowest paid callouts from non-tech role rollups", async () => {
    mocks.listResolvedSalaryStats.mockImplementation(
      async (_db: unknown, _tenant: unknown, dimension: string) => {
        if (dimension !== "role") return [];
        return [
          { dimension: "role", slug: "product-manager", avg: 140000, min: 100000, max: 180000, jobCount30d: 2 },
          { dimension: "role", slug: "hr", avg: 70000, min: 50000, max: 90000, jobCount30d: 1 },
        ];
      },
    );

    const { default: Web3NonTechSalariesPage } = await import("./page");
    const page = await Web3NonTechSalariesPage();
    const copy = text(page);

    expect(copy).toContain("$140k");
    expect(copy).toContain(tagLabel("product-manager"));
    expect(copy).toContain(tagLabel("hr"));
  });
});
