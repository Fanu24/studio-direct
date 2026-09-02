import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  listCompanies: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("../../lib/jobs/queries", () => ({
  listCompanies: mocks.listCompanies,
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

describe("CompaniesPage", () => {
  const db = {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn().mockResolvedValue("tenant-gaming"),
      })),
    })),
  };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: db } });
    mocks.listCompanies.mockResolvedValue([
      { id: "studio-a", name: "Alpha Studio", slug: "alpha", jobCount: 3 },
      { id: "studio-b", name: "Beta Forge", slug: "betaforge", jobCount: 0 },
    ]);
  });

  it("lists every studio with its role count and links to the studio page", async () => {
    const { default: CompaniesPage } = await import("./page");
    const page = await CompaniesPage();
    const copy = text(page);
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(mocks.listCompanies).toHaveBeenCalledWith(db, "tenant-gaming");
    expect(copy).toContain("Studios in the index");
    expect(copy).toContain("Alpha Studio");
    expect(copy).toContain("Beta Forge");
    expect(copy).toContain("3 remote or hybrid roles");
    expect(copy).toContain("No listed roles right now");
    expect(copy).not.toContain("Trusted by");
    expect(hrefs).toContain("/companies/alpha");
    expect(hrefs).toContain("/companies/betaforge");
  });

  it("shows an empty state when no studio is listed", async () => {
    mocks.listCompanies.mockResolvedValue([]);
    const { default: CompaniesPage } = await import("./page");
    const page = await CompaniesPage();

    expect(text(page)).toContain("No studios are listed right now.");
  });
});
