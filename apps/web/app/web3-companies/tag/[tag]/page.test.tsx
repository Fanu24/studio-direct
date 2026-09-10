import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  listCompanyDirectory: vi.fn(),
  listCompanyCategories: vi.fn(),
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

vi.mock("../../../../lib/companies/queries", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../lib/companies/queries")
  >("../../../../lib/companies/queries");
  return {
    ...actual,
    listCompanyDirectory: mocks.listCompanyDirectory,
    listCompanyCategories: mocks.listCompanyCategories,
  };
});

vi.mock("../../../../lib/tenant", () => ({
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
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object" || !("props" in node)) return "";
  return text((node as TestElement).props.children);
}

const COMPANIES = [
  {
    id: "studio-a",
    name: "Alpha Studio",
    slug: "alpha",
    domain: null,
    logoUrl: null,
    category: "solidity",
    jobCount: 3,
    lastPostedAt: "2026-09-02T00:00:00Z",
    avgSalary: 140000,
  },
];

const CATEGORIES = [
  { slug: "solidity", companyCount: 4 },
  { slug: "design", companyCount: 2 },
];

describe("Web3CompanyCategoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: {} } });
    mocks.listCompanyDirectory.mockResolvedValue(COMPANIES);
    mocks.listCompanyCategories.mockResolvedValue(CATEGORIES);
  });

  it("filters the index to one category and keeps the full facet cloud with the active chip marked", async () => {
    const { default: Page } = await import("./page");
    const page = await Page({ params: Promise.resolve({ tag: "solidity" }) });
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(mocks.listCompanyDirectory).toHaveBeenCalledWith({}, "tenant-gaming", {
      category: "solidity",
    });
    expect(text(elements(page).find((element) => element.type === "h1"))).toContain(
      "Top Solidity Web3 Companies",
    );
    expect(text(page)).toContain("Alpha Studio");
    expect(hrefs).toContain("/web3-companies/alpha");
    expect(hrefs).toContain("/web3-companies");
    expect(hrefs).toContain("/web3-companies/tag/design");

    const active = elements(page).find(
      (element) => element.props.href === "/web3-companies/tag/solidity",
    );
    expect(active?.props.className).toContain("chip--on");
  });

  it("decodes a percent-encoded category segment", async () => {
    const { default: Page } = await import("./page");
    await Page({ params: Promise.resolve({ tag: "smart%2Dcontracts" }) });

    expect(mocks.listCompanyDirectory).toHaveBeenCalledWith({}, "tenant-gaming", {
      category: "smart-contracts",
    });
  });

  it("404s a category no company leads with instead of rendering an empty table", async () => {
    mocks.listCompanyDirectory.mockResolvedValue([]);
    const { default: Page } = await import("./page");

    await expect(Page({ params: Promise.resolve({ tag: "ghost" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });
});

describe("Web3CompanyCategoryPage generateMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: {} } });
    mocks.listCompanyDirectory.mockResolvedValue(COMPANIES);
    mocks.listCompanyCategories.mockResolvedValue(CATEGORIES);
  });

  it("canonicalises to the category path and names a real company", async () => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({
      params: Promise.resolve({ tag: "solidity" }),
    });

    expect(metadata.title).toContain("Top Solidity Web3 Companies");
    expect(metadata.description).toContain("Alpha Studio");
    expect(metadata.alternates).toMatchObject({
      canonical: "/web3-companies/tag/solidity",
    });
  });
});
