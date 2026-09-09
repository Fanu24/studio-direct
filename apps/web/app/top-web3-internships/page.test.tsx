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

describe("TopWeb3InternshipsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadCatalogJobs.mockResolvedValue({
      result: {
        jobs: [
          {
            id: "intern-1",
            slug: "intern-1",
            externalId: null,
            title: "Protocol Intern",
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
            tags: ["intern"],
          },
        ],
        page: 1,
        pageSize: 20,
        total: 6,
        totalPages: 1,
      },
      selected: null,
    });
  });

  it("renders intern jobs instead of redirecting", async () => {
    const { default: TopWeb3InternshipsPage } = await import("./page");
    const page = await TopWeb3InternshipsPage({
      searchParams: Promise.resolve({}),
    });
    const copy = text(page);
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(text(elements(page).find((element) => element.type === "h1"))).toBe(
      "Top Web3 internships",
    );
    expect(copy).toContain("not a redirect");
    expect(copy).toContain("6 jobs found");
    expect(copy).not.toMatch(/[–—]/);
    expect(hrefs).toContain("/intern-jobs");
    expect(hrefs).toContain("/entry-developer-jobs");
    expect(elements(page).some((element) => element.type === JobBoard)).toBe(true);
    expect(mocks.loadCatalogJobs).toHaveBeenCalledWith({
      tag: "intern",
      orderBy: "posted",
      page: 1,
    });
  });
});
