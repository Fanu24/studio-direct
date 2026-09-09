import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JobBoard } from "../_components/job-board";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const mocks = vi.hoisted(() => ({
  loadCatalogJobs: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => React.createElement("a", props),
}));

vi.mock("../_components/catalog-jobs", async () => {
  const actual = await vi.importActual<typeof import("../_components/catalog-jobs")>(
    "../_components/catalog-jobs",
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

describe("HighestPaidDeveloperJobsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadCatalogJobs.mockResolvedValue({
      result: { jobs: [], page: 1, pageSize: 20, total: 4, totalPages: 1 },
      selected: null,
    });
  });

  it("serves the singular spelling web3.career links, with its own canonical", async () => {
    const { default: HighestPaidDeveloperJobsPage, generateMetadata } = await import(
      "./page"
    );
    const metadata = await generateMetadata();
    const page = await HighestPaidDeveloperJobsPage({
      searchParams: Promise.resolve({}),
    });
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(metadata.alternates).toMatchObject({
      canonical: "/highest-paid-developer-jobs",
    });
    expect(text(elements(page).find((element) => element.type === "h1"))).toBe(
      "Highest paid developer jobs",
    );
    expect(text(page)).toContain("published a salary minimum and maximum");
    expect(text(page)).not.toMatch(/[–—]/);
    expect(hrefs).toContain("/web3-salaries");
    expect(elements(page).some((element) => element.type === JobBoard)).toBe(true);
    expect(mocks.loadCatalogJobs).toHaveBeenCalledWith({
      hasSalary: true,
      orderBy: "salary",
      page: 1,
    });
  });
});
