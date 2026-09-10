import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JsonLd } from "../_components/json-ld";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  listCompanyDirectory: vi.fn(),
  listCompanyCategories: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("../../lib/companies/queries", async () => {
  const actual = await vi.importActual<typeof import("../../lib/companies/queries")>(
    "../../lib/companies/queries",
  );
  return {
    ...actual,
    listCompanyDirectory: mocks.listCompanyDirectory,
    listCompanyCategories: mocks.listCompanyCategories,
  };
});

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
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object" || !("props" in node)) return "";
  return text((node as TestElement).props.children);
}

function hrefsOf(node: ReactNode): string[] {
  return elements(node)
    .filter((element) => typeof element.props.href === "string")
    .map((element) => element.props.href as string);
}

const COMPANIES = [
  {
    id: "studio-a",
    name: "Alpha Studio",
    slug: "alpha",
    domain: null,
    logoUrl: "https://cdn.example.com/alpha.png",
    category: "solidity",
    jobCount: 3,
    lastPostedAt: "2026-09-02T00:00:00Z",
    avgSalary: 140000,
  },
  {
    id: "studio-b",
    name: "Beta Forge",
    slug: "betaforge",
    domain: null,
    logoUrl: null,
    category: null,
    jobCount: 0,
    lastPostedAt: null,
    avgSalary: null,
  },
];

const CATEGORIES = [
  { slug: "solidity", companyCount: 4 },
  { slug: "design", companyCount: 2 },
];

describe("Web3CompaniesPage", () => {
  const db = {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn().mockResolvedValue("tenant-gaming"),
      })),
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: db } });
    mocks.listCompanyDirectory.mockResolvedValue(COMPANIES);
    mocks.listCompanyCategories.mockResolvedValue(CATEGORIES);
  });

  it("ranks every company with logo, category, role count, average salary and last-posted date under the canonical /web3-companies paths", async () => {
    const { DIRECTORY_LIMIT } = await import("../../lib/companies/queries");
    const { default: Web3CompaniesPage } = await import("./page");
    const page = await Web3CompaniesPage();
    const copy = text(page);
    const hrefs = hrefsOf(page);

    expect(mocks.listCompanyDirectory).toHaveBeenCalledWith(db, "tenant-gaming", {
      limit: DIRECTORY_LIMIT,
    });
    expect(text(elements(page).find((element) => element.type === "h1"))).toContain(
      "Top Web3 Companies",
    );
    expect(copy).toContain("Alpha Studio");
    expect(copy).toContain("Beta Forge");
    expect(copy).toContain("3 roles");
    expect(copy).toContain("No listed roles right now");
    // Average salary rollup: Alpha has one, Beta doesn't (the honest empty
    // state must not fabricate a number for Beta).
    expect(copy).toContain("$140k");

    // Canonical taxonomy - never the old /companies paths.
    expect(hrefs).toContain("/web3-companies/alpha");
    expect(hrefs).toContain("/web3-companies/betaforge");
    expect(hrefs).toContain("/web3-companies/top-growing");
    expect(hrefs.every((href) => !href.startsWith("/companies"))).toBe(true);
    expect(hrefs).not.toContain("/top-growing-web3-companies");

    const jsonLd = elements(page).find((element) => element.type === JsonLd);
    const data = jsonLd?.props.data as {
      itemListElement: { item: { "@type": string; name: string; url: string } }[];
    };
    expect(data.itemListElement[0]?.item).toMatchObject({
      "@type": "Organization",
      name: "Alpha Studio",
      url: "/web3-companies/alpha",
    });
  });

  it("renders the reference's column inventory plus a category facet cloud", async () => {
    const { default: Web3CompaniesPage } = await import("./page");
    const page = await Web3CompaniesPage();
    const headers = elements(page)
      .filter((element) => element.type === "th")
      .map((element) => text(element));

    expect(headers).toEqual([
      "Rank",
      "Logo",
      "Company Name",
      "Category",
      "Jobs Count",
      "Average Yearly Salary",
      "Last Job Posted",
    ]);

    const hrefs = hrefsOf(page);
    expect(hrefs).toContain("/web3-companies/tag/solidity");
    expect(hrefs).toContain("/web3-companies/tag/design");

    const logo = elements(page).find((element) => element.type === "img");
    expect(logo?.props.src).toBe("https://cdn.example.com/alpha.png");
  });

  it("shows an empty state when no company is listed", async () => {
    mocks.listCompanyDirectory.mockResolvedValue([]);
    mocks.listCompanyCategories.mockResolvedValue([]);
    const { default: Web3CompaniesPage } = await import("./page");
    const page = await Web3CompaniesPage();

    expect(text(page)).toContain("No companies are listed right now.");
  });
});

describe("Web3CompaniesPage generateMetadata", () => {
  const db = { prepare: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: db } });
    mocks.listCompanyDirectory.mockResolvedValue(COMPANIES);
    mocks.listCompanyCategories.mockResolvedValue(CATEGORIES);
  });

  it("names real hiring companies instead of a static sentence and canonicalises to /web3-companies", async () => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata();

    expect(metadata.title).toContain("Top Web3 Companies");
    expect(metadata.description).toContain("Alpha Studio");
    expect(metadata.alternates).toMatchObject({ canonical: "/web3-companies" });
  });

  it("falls back to an honest sentence when nobody is hiring", async () => {
    mocks.listCompanyDirectory.mockResolvedValue([]);
    mocks.listCompanyCategories.mockResolvedValue([]);
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata();

    expect(metadata.description).not.toMatch(/undefined|null/);
  });
});
