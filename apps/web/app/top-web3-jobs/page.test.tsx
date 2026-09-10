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

describe("TopWeb3JobsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadCatalogJobs.mockResolvedValue({
      result: { jobs: [], page: 1, pageSize: 20, total: 6, totalPages: 1 },
      selected: null,
    });
  });

  it("lists the live catalog as a ranking board", async () => {
    const { default: Page } = await import("./page");
    const page = await Page({ searchParams: Promise.resolve({}) });
    expect(text(elements(page).find((element) => element.type === "h1"))).toBe(
      "Top Web3 jobs",
    );
    expect(elements(page).some((element) => element.type === JobBoard)).toBe(true);
    expect(mocks.loadCatalogJobs).toHaveBeenCalledWith({ page: 1 });
    expect(text(page)).not.toMatch(/[–—]/);
  });
});
