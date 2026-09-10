import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadCatalogJobs: vi.fn(),
  getCloudflareContext: vi.fn(),
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

vi.mock("../../../../lib/tenant", () => ({
  requireTenantId: async () => "tenant-gaming",
}));

vi.mock("../../../../lib/jobs/queries", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/jobs/queries")>(
    "../../../../lib/jobs/queries",
  );
  return {
    ...actual,
    tagSalaryRange: mocks.tagSalaryRange,
  };
});

vi.mock("../../../_components/catalog-jobs", async () => {
  const actual = await vi.importActual<typeof import("../../../_components/catalog-jobs")>(
    "../../../_components/catalog-jobs",
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

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

describe("HireSkillLocationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: {} } });
    mocks.tagSalaryRange.mockResolvedValue({ min: null, max: null, count: 0 });
    mocks.loadCatalogJobs.mockResolvedValue({
      result: {
        jobs: [],
        page: 1,
        pageSize: 20,
        total: 2,
        totalPages: 0,
      },
      selected: null,
    });
  });

  it("filters remote and still renders under five jobs", async () => {
    const { default: HireSkillLocationPage, generateMetadata } = await import("./page");
    const page = await HireSkillLocationPage({
      params: Promise.resolve({ skill: "solidity", location: "remote" }),
      searchParams: Promise.resolve({}),
    });

    expect(text(elements(page).find((element) => element.type === "h1"))).toBe(
      "Companies hiring Solidity in Remote",
    );
    expect(text(page)).toContain("Companies hiring Solidity in Remote on Nodework");
    expect(mocks.loadCatalogJobs).toHaveBeenCalledWith({
      tag: "solidity",
      page: 1,
      remoteOnly: true,
      locationSlug: undefined,
    });

    const meta = await generateMetadata({
      params: Promise.resolve({ skill: "solidity", location: "remote" }),
      searchParams: Promise.resolve({}),
    });
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it("filters a city slug", async () => {
    const { default: HireSkillLocationPage } = await import("./page");
    await HireSkillLocationPage({
      params: Promise.resolve({ skill: "solidity", location: "berlin" }),
      searchParams: Promise.resolve({}),
    });
    expect(mocks.loadCatalogJobs).toHaveBeenCalledWith({
      tag: "solidity",
      page: 1,
      remoteOnly: undefined,
      locationSlug: "berlin",
    });
  });

  it("404s unknown locations", async () => {
    const { default: HireSkillLocationPage } = await import("./page");
    await expect(
      HireSkillLocationPage({
        params: Promise.resolve({ skill: "solidity", location: "not-a-place" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("interpolates the live count and current month into metadata", async () => {
    mocks.loadCatalogJobs.mockResolvedValue({
      result: {
        jobs: [],
        page: 1,
        pageSize: 20,
        total: 9,
        totalPages: 1,
      },
      selected: null,
    });
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata({
      params: Promise.resolve({ skill: "solidity", location: "berlin" }),
      searchParams: Promise.resolve({}),
    });
    expect(meta.title).toContain("Companies hiring Solidity in Berlin");
    expect(meta.title).toContain("9 live roles");
    expect(meta.description).toContain("9 companies are hiring Solidity in Berlin");
    expect((meta.title as string)).not.toMatch(/[–—]/);
  });

  it("adds the tag-wide salary clause to metadata when salary data exists", async () => {
    mocks.tagSalaryRange.mockResolvedValue({ min: 90000, max: 150000, count: 4 });
    mocks.loadCatalogJobs.mockResolvedValue({
      result: {
        jobs: [],
        page: 1,
        pageSize: 20,
        total: 9,
        totalPages: 1,
      },
      selected: null,
    });
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata({
      params: Promise.resolve({ skill: "solidity", location: "berlin" }),
      searchParams: Promise.resolve({}),
    });
    expect(meta.description).toContain("$90,000-$150,000");
  });
});
