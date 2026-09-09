import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { COUNTRIES, tagLabel } from "@gaming/shared";

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

/** Manually invoke a component instance found in the tree - the harness only walks
 * props.children, so a function component's own output is otherwise invisible to it. */
function render(element: TestElement | undefined): ReactNode {
  if (!element) return null;
  return (element.type as (props: Record<string, unknown>) => ReactNode)(element.props);
}

const emptyList = { jobs: [], page: 1, pageSize: 10, total: 0, totalPages: 0 };

describe("SalariesHubPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: {} } });
    mocks.listResolvedSalaryStats.mockResolvedValue([]);
    mocks.listJobs.mockResolvedValue(emptyList);
    mocks.getJobForListItem.mockResolvedValue(null);
  });

  it("always iterates taxonomy tables and uses dash placeholders when rollups are empty", async () => {
    const { default: SalariesHubPage } = await import("./page");
    const page = await SalariesHubPage();
    const all = elements(page);

    const statsTables = all.filter((el) => el.type === SalaryStatsTable);
    const tablesCopy = statsTables.map((el) => text(render(el))).join(" ");
    const copy = `${text(page)} ${tablesCopy}`;

    expect(text(all.find((el) => el.type === "h1"))).toContain("Web3 salaries");
    expect(all.find((el) => el.type === Breadcrumbs)).toBeDefined();
    expect(copy).toContain("By role");
    expect(copy).toContain("By non-tech");
    expect(copy).toContain("Salary by seniority");
    expect(copy).toContain("Salary by region");
    expect(copy).toContain("Salary by country");
    expect(copy).toContain("Min Yearly Salary");
    expect(copy).toContain("Max Yearly Salary");
    expect(copy).toContain("No role on this hub has a published minimum and maximum yet");

    const hrefs = all
      .filter((el) => typeof el.props.href === "string")
      .map((el) => el.props.href as string);
    expect(hrefs).toContain("/web3-non-tech-salaries");
    expect(hrefs).toContain("/highest-paying-web3-jobs");
    expect(hrefs).toContain("/web3-salaries/solana-vs-ethereum");

    const nonTechTable = all.find(
      (el) =>
        el.type === SalaryStatsTable &&
        JSON.stringify(el.props.slugs) === JSON.stringify(NON_TECH_SALARY_ROLES),
    );
    const nonTechHrefFor = nonTechTable?.props.hrefFor as (s: string) => string;
    expect(nonTechHrefFor("product-manager")).toBe("/web3-non-tech-salaries/product-manager");
    const countryTable = all.find(
      (el) =>
        el.type === SalaryStatsTable && JSON.stringify(el.props.slugs) === JSON.stringify(COUNTRIES),
    );
    const countryHrefFor = countryTable?.props.hrefFor as (s: string) => string;
    expect(countryHrefFor(COUNTRIES[0])).toBe(`/web3-salaries/${COUNTRIES[0]}`);
    expect(text(page)).not.toMatch(/[–—]/);
  });

  it("computes a live overview and highest/lowest paid callouts from role rollups", async () => {
    mocks.listResolvedSalaryStats.mockImplementation(
      async (_db: unknown, _tenant: unknown, dimension: string) => {
        if (dimension !== "role") return [];
        return [
          { dimension: "role", slug: "solidity-developer", avg: 160000, min: 120000, max: 200000, jobCount30d: 4 },
          { dimension: "role", slug: "front-end-developer", avg: 90000, min: 70000, max: 110000, jobCount30d: 3 },
        ];
      },
    );

    const { default: SalariesHubPage } = await import("./page");
    const page = await SalariesHubPage();
    const copy = text(page);

    expect(copy).toContain("$160k");
    expect(copy).toContain(tagLabel("solidity-developer"));
    expect(copy).toContain(tagLabel("front-end-developer"));
  });
});
