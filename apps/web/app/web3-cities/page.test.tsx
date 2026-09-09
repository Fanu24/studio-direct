import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  listLocationJobCounts: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("../../lib/jobs/queries", () => ({
  listLocationJobCounts: mocks.listLocationJobCounts,
}));

vi.mock("../../lib/tenant", () => ({
  requireTenantId: async () => "tenant-gaming",
}));

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => React.createElement("a", props),
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
  return text((node as TestElement).props.children);
}

function rows(node: ReactNode): TestElement[] {
  return elements(node).filter((element) => element.type === "tr");
}

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

function headings(node: ReactNode): TestElement[] {
  return elements(node).filter(
    (element) => typeof element.type === "string" && HEADING_TAGS.has(element.type),
  );
}

describe("Web3CitiesPage", () => {
  const db = { prepare: vi.fn() };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: db } });
    mocks.listLocationJobCounts.mockResolvedValue([
      { slug: "new-york", jobCount: 1234 },
      { slug: "london", jobCount: 87 },
      { slug: "dubai", jobCount: 13 },
    ]);
  });

  it("renders a ranked table with three distinct links per city and comma-formatted counts", async () => {
    const { default: Web3CitiesPage } = await import("./page");
    const page = await Web3CitiesPage();
    const copy = text(page);

    expect(mocks.listLocationJobCounts).toHaveBeenCalledWith(db, "tenant-gaming", "city");
    expect(text(elements(page).find((element) => element.type === "h1"))).toBe(
      "Top web3 cities in the world",
    );

    const bodyRows = rows(page).filter(
      (row) => elements(row).filter((el) => el.type === "td").length > 0,
    );
    expect(bodyRows).toHaveLength(3);

    for (const row of bodyRows) {
      const hrefs = elements(row)
        .filter((element) => typeof element.props.href === "string")
        .map((element) => element.props.href as string);
      expect(hrefs).toHaveLength(3);
      expect(new Set(hrefs).size).toBe(3);
    }

    expect(copy).toContain("New York");
    expect(copy).toContain("United States");
    expect(copy).toContain("North America");
    expect(copy).toContain("1,234");

    expect(copy).toContain("London");
    expect(copy).toContain("United Kingdom");
    expect(copy).toContain("Europe");
    expect(copy).toContain("87");

    expect(copy).toContain("Dubai");
    expect(copy).toContain("United Arab Emirates");
    expect(copy).toContain("Asia");
    expect(copy).toContain("13");

    expect(copy).not.toMatch(/[–—]/);
  });

  it("puts the directory in the page outline: one h1, then a heading per linked cell", async () => {
    const { default: Web3CitiesPage } = await import("./page");
    const page = await Web3CitiesPage();
    const all = headings(page);

    expect(all.filter((heading) => heading.type === "h1")).toHaveLength(1);
    // No level is skipped: everything below the h1 is an h2.
    expect(new Set(all.map((heading) => heading.type))).toEqual(new Set(["h1", "h2"]));

    // One section heading plus city, country and region for each of the three
    // rows - the rank and job-count cells stay plain text.
    expect(all).toHaveLength(1 + 1 + 3 * 3);
    expect(all.map(text)).toContain("New York");
    expect(all.map(text)).toContain("United States");
    expect(all.map(text)).toContain("North America");
    expect(all.map(text)).not.toContain("1,234");

    for (const row of rows(page).filter(
      (candidate) => elements(candidate).filter((el) => el.type === "td").length > 0,
    )) {
      expect(headings(row)).toHaveLength(3);
    }
  });

  it("skips the heading for a location cell that has nothing to link to", async () => {
    mocks.listLocationJobCounts.mockResolvedValue([
      { slug: "atlantis", jobCount: 4 },
    ]);
    const { default: Web3CitiesPage } = await import("./page");
    const page = await Web3CitiesPage();

    const bodyRow = rows(page).find(
      (row) => elements(row).filter((el) => el.type === "td").length > 0,
    );
    expect(bodyRow).toBeDefined();
    expect(headings(bodyRow)).toHaveLength(1);
    expect(text(bodyRow)).toContain("Not mapped");
  });

  it("builds the intro sentence from the top cities and the remainder count", async () => {
    const { default: Web3CitiesPage } = await import("./page");
    const page = await Web3CitiesPage();
    const copy = text(page);

    expect(copy).toContain("New York, London, and Dubai");
    expect(copy).not.toContain("more cities with live roles");
  });

  it("shows a truthful empty state when no city has a live job", async () => {
    mocks.listLocationJobCounts.mockResolvedValue([]);
    const { default: Web3CitiesPage } = await import("./page");
    const page = await Web3CitiesPage();

    expect(text(page)).toContain("No city has a live Web3 role right now.");
    expect(rows(page)).toHaveLength(0);
  });

  it("mentions the remainder count when more than three cities have live jobs", async () => {
    mocks.listLocationJobCounts.mockResolvedValue([
      { slug: "new-york", jobCount: 40 },
      { slug: "london", jobCount: 30 },
      { slug: "dubai", jobCount: 20 },
      { slug: "berlin", jobCount: 10 },
      { slug: "toronto", jobCount: 5 },
    ]);
    const { default: Web3CitiesPage } = await import("./page");
    const page = await Web3CitiesPage();

    expect(text(page)).toContain("2 more cities with live roles below");
  });
});
