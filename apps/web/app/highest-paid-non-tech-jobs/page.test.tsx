import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JobBoard } from "../_components/job-board";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const mocks = vi.hoisted(() => ({
  loadCatalogJobs: vi.fn(),
  listCompanies: vi.fn(),
  getCloudflareContext: vi.fn(),
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

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("../../lib/jobs/queries", () => ({
  listCompanies: mocks.listCompanies,
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
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object" || !("props" in node)) return "";
  return text((node as TestElement).props.children);
}

describe("ranking pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: {} } });
    mocks.loadCatalogJobs.mockResolvedValue({
      result: { jobs: [], page: 1, pageSize: 20, total: 6, totalPages: 1 },
      selected: null,
    });
    mocks.listCompanies.mockResolvedValue([
      { id: "a", name: "Alpha", slug: "alpha", jobCount: 8 },
      { id: "b", name: "Beta", slug: "beta", jobCount: 0 },
    ]);
  });

  it("lists highest-paid non-tech jobs by salary", async () => {
    const { default: Page } = await import("./page");
    const page = await Page({ searchParams: Promise.resolve({}) });
    expect(text(elements(page).find((element) => element.type === "h1"))).toBe(
      "Highest paid non-tech jobs",
    );
    expect(elements(page).some((element) => element.type === JobBoard)).toBe(true);
    expect(mocks.loadCatalogJobs).toHaveBeenCalledWith({
      tag: "non-tech",
      hasSalary: true,
      orderBy: "salary",
      page: 1,
    });
    expect(text(page)).not.toMatch(/[–—]/);
  });
});
