import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JobBoard } from "../../_components/job-board";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const mocks = vi.hoisted(() => ({
  loadCatalogJobs: vi.fn(),
  getCloudflareContext: vi.fn(),
  listTagLocationFacets: vi.fn(),
  listJobs: vi.fn(),
  tagSalaryRange: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => React.createElement("a", props),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("../../../lib/tenant", () => ({
  requireTenantId: async () => "tenant-gaming",
}));

vi.mock("../../../lib/jobs/queries", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/jobs/queries")>(
    "../../../lib/jobs/queries",
  );
  return {
    ...actual,
    listTagLocationFacets: mocks.listTagLocationFacets,
    listJobs: mocks.listJobs,
    tagSalaryRange: mocks.tagSalaryRange,
  };
});

vi.mock("../../_components/catalog-jobs", async () => {
  const actual = await vi.importActual<typeof import("../../_components/catalog-jobs")>(
    "../../_components/catalog-jobs",
  );
  return {
    ...actual,
    loadCatalogJobs: mocks.loadCatalogJobs,
  };
});

vi.stubGlobal("React", React);

function elements(node: ReactNode): TestElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as TestElement;
  return [element, ...elements(element.props.children)];
}

function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object" || !("props" in node)) return "";
  return text((node as TestElement).props.children);
}

function listed(total = 8) {
  return {
    jobs: [
      {
        id: "sol-role",
        slug: "sol-role",
        externalId: null,
        title: "Solidity Engineer",
        companyId: "studio-a",
        companyName: "Alpha Studio",
        companySlug: "alpha",
        location: "Remote",
        remote: "remote",
        salaryText: null,
        salaryMin: null,
        salaryMax: null,
        highlight: 0,
        featuredUntil: null,
        exclusivity: "unknown",
        postedAt: "2026-09-02T00:00:00Z",
        tags: ["solidity"],
      },
    ],
    page: 1,
    pageSize: 20,
    total,
    totalPages: 1,
  };
}

describe("HireSkillPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: {} } });
    mocks.loadCatalogJobs.mockResolvedValue({
      result: listed(8),
      selected: null,
    });
    mocks.listTagLocationFacets.mockResolvedValue([
      { slug: "berlin", jobCount: 3 },
      { slug: "united-states", jobCount: 5 },
    ]);
    mocks.listJobs.mockResolvedValue({
      jobs: [],
      page: 1,
      pageSize: 1,
      total: 4,
      totalPages: 4,
    });
    mocks.tagSalaryRange.mockResolvedValue({ min: 120000, max: 180000, count: 6 });
  });

  it("lists tagged jobs and real location slices", async () => {
    const { default: HireSkillPage } = await import("./page");
    const page = await HireSkillPage({
      params: Promise.resolve({ skill: "solidity" }),
      searchParams: Promise.resolve({}),
    });
    const copy = text(page);
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(text(elements(page).find((element) => element.type === "h1"))).toBe(
      "Companies hiring Solidity",
    );
    expect(copy).toContain("Companies hiring Solidity on Nodework");
    expect(copy).toContain("8 jobs found");
    expect(copy).not.toMatch(/[–—]/);
    expect(hrefs).toContain("/hire/solidity/remote");
    expect(hrefs).toContain("/hire/solidity/berlin");
    expect(hrefs).toContain("/hire/solidity/united-states");
    expect(hrefs).toContain("/solidity-jobs");
    expect(elements(page).some((element) => element.type === JobBoard)).toBe(true);
    expect(mocks.loadCatalogJobs).toHaveBeenCalledWith({ tag: "solidity", page: 1 });
  });

  it("drops the remote chip when the tag has no remote listings", async () => {
    mocks.listJobs.mockResolvedValue({
      jobs: [],
      page: 1,
      pageSize: 1,
      total: 0,
      totalPages: 0,
    });
    const { default: HireSkillPage } = await import("./page");
    const page = await HireSkillPage({
      params: Promise.resolve({ skill: "solidity" }),
      searchParams: Promise.resolve({}),
    });
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);
    expect(hrefs).not.toContain("/hire/solidity/remote");
  });

  it("404s unknown skills", async () => {
    const { default: HireSkillPage } = await import("./page");
    await expect(
      HireSkillPage({
        params: Promise.resolve({ skill: "not-a-job-tag" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("noindexes when fewer than five jobs are listed", async () => {
    mocks.loadCatalogJobs.mockResolvedValue({
      result: listed(3),
      selected: null,
    });
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata({
      params: Promise.resolve({ skill: "solidity" }),
      searchParams: Promise.resolve({}),
    });
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it("interpolates the live count, salary range, and current month into metadata", async () => {
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata({
      params: Promise.resolve({ skill: "solidity" }),
      searchParams: Promise.resolve({}),
    });
    expect(meta.title).toContain("Companies hiring Solidity");
    expect(meta.title).toContain("8 live roles");
    expect(meta.description).toContain("8 companies are hiring Solidity");
    expect(meta.description).toContain("$120,000-$180,000");
    expect(typeof meta.title).toBe("string");
    expect((meta.title as string)).not.toMatch(/[–—]/);
  });

  it("omits the salary clause when the tag has no salary data", async () => {
    mocks.tagSalaryRange.mockResolvedValue({ min: null, max: null, count: 0 });
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata({
      params: Promise.resolve({ skill: "solidity" }),
      searchParams: Promise.resolve({}),
    });
    expect(meta.description).not.toContain("$");
  });
});
