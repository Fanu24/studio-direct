import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BoardSearch } from "../../_components/board-chrome";
import { TagChips } from "../../_components/job-row";
import { JsonLd } from "../../_components/json-ld";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  listCompanyGrowth: vi.fn(),
  listMonthlyPostings: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => React.createElement("a", props),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("../../../lib/companies/queries", async () => {
  const actual = await vi.importActual<
    typeof import("../../../lib/companies/queries")
  >("../../../lib/companies/queries");
  return {
    ...actual,
    listCompanyGrowth: mocks.listCompanyGrowth,
    listMonthlyPostings: mocks.listMonthlyPostings,
  };
});

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
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object" || !("props" in node)) return "";
  return text((node as TestElement).props.children);
}

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

function headings(node: ReactNode): TestElement[] {
  return elements(node).filter(
    (element) => typeof element.type === "string" && HEADING_TAGS.has(element.type),
  );
}

const GROWERS = [
  { id: "a", name: "Alpha", slug: "alpha", newJobs: 8, previousPeriod: 2, difference: 6, growthPct: 300 },
  { id: "b", name: "Beta", slug: "beta", newJobs: 3, previousPeriod: 0, difference: 3, growthPct: null },
];

const TREND = [
  { month: "2026-07", count: 40 },
  { month: "2026-08", count: 80 },
  { month: "2026-09", count: 20 },
];

describe("TopGrowingWeb3CompaniesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: {} } });
    mocks.listCompanyGrowth.mockResolvedValue(GROWERS);
    mocks.listMonthlyPostings.mockResolvedValue(TREND);
  });

  it("ranks companies by hiring velocity and labels an unmeasurable rate as New instead of fabricating a percent", async () => {
    const { default: Page } = await import("./page");
    const page = await Page();
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(text(elements(page).find((element) => element.type === "h1"))).toContain(
      "Growing Web3 and Crypto Companies",
    );
    expect(hrefs).toContain("/web3-companies/alpha");
    expect(hrefs).toContain("/web3-companies/beta");
    expect(hrefs).toContain("/web3-companies");
    expect(hrefs.every((href) => !href.startsWith("/companies"))).toBe(true);
    expect(text(page)).toContain("Alpha");
    expect(text(page)).toContain("+300%");
    expect(text(page)).toContain("New");
    expect(text(page)).not.toMatch(/[–—]/);

    // The job-board search box and tag chips filter nothing on this table
    // and were copied over from the job-board template - they must be gone.
    expect(elements(page).every((element) => element.type !== BoardSearch)).toBe(true);
    expect(elements(page).every((element) => element.type !== TagChips)).toBe(true);

    const jsonLd = elements(page).find((element) => element.type === JsonLd);
    const data = jsonLd?.props.data as {
      itemListElement: { item: { "@type": string; name: string; url: string } }[];
    };
    expect(data.itemListElement[0]?.item).toMatchObject({
      "@type": "Organization",
      name: "Alpha",
      url: "/web3-companies/alpha",
    });
  });

  it("puts every ranked company in the page outline under a single h1", async () => {
    const { default: Page } = await import("./page");
    const page = await Page();
    const all = headings(page);

    expect(all.filter((heading) => heading.type === "h1")).toHaveLength(1);
    expect(new Set(all.map((heading) => heading.type))).toEqual(new Set(["h1", "h2"]));

    const rowHeadings = elements(page)
      .filter((element) => element.type === "tr")
      .flatMap((row) => headings(row));
    expect(rowHeadings.map(text)).toEqual(["Alpha", "Beta"]);
    expect(rowHeadings.every((heading) => heading.type === "h2")).toBe(true);
  });

  it("charts monthly posting volume relative to the busiest month", async () => {
    const { default: Page } = await import("./page");
    const page = await Page();

    expect(text(page)).toContain("Roles posted per month");
    expect(text(page)).toContain("Aug 2026");

    const bars = elements(page)
      .map((element) => (element.props.style as { width?: string } | undefined)?.width)
      .filter((width): width is string => typeof width === "string" && width.endsWith("%"));

    // 40/80, 80/80, 20/80 of the busiest month.
    expect(bars).toEqual(["50%", "100%", "25%"]);
  });

  it("degrades to an honest sentence when no listing carries a posting date", async () => {
    mocks.listMonthlyPostings.mockResolvedValue([]);
    const { default: Page } = await import("./page");
    const page = await Page();

    expect(text(page)).toContain("No listing carries a posting date yet.");
  });

  it("caps the leaderboard at a defensible top N instead of listing every hiring company", async () => {
    const many = Array.from({ length: 80 }, (_, index) => ({
      id: `c${index}`,
      name: `Company ${index}`,
      slug: `company-${index}`,
      newJobs: 80 - index,
      previousPeriod: 1,
      difference: 79 - index,
      growthPct: 1000 - index,
    }));
    mocks.listCompanyGrowth.mockResolvedValue(many);

    const { TOP_GROWING_LIMIT } = await import("../../../lib/companies/queries");
    const { default: Page } = await import("./page");
    const page = await Page();
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string)
      .filter((href) => href.startsWith("/web3-companies/company-"));

    expect(TOP_GROWING_LIMIT).toBe(20);
    expect(hrefs).toHaveLength(TOP_GROWING_LIMIT);
    expect(hrefs).toContain("/web3-companies/company-0");
    expect(hrefs).not.toContain("/web3-companies/company-20");
  });

  it("shows an honest empty state when nobody has hired recently", async () => {
    mocks.listCompanyGrowth.mockResolvedValue([]);
    const { default: Page } = await import("./page");
    const page = await Page();

    expect(text(page)).toContain("No companies have posted new jobs in the last 60 days.");
  });
});

describe("TopGrowingWeb3CompaniesPage generateMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: {} } });
    mocks.listCompanyGrowth.mockResolvedValue(GROWERS);
    mocks.listMonthlyPostings.mockResolvedValue(TREND);
  });

  it("names a real top mover and canonicalises to /web3-companies/top-growing", async () => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata();

    expect(metadata.title).toContain("Growing Web3 Companies");
    expect(metadata.description).toContain("Alpha");
    expect(metadata.alternates).toMatchObject({
      canonical: "/web3-companies/top-growing",
    });
  });
});
