import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HOMEPAGE_CLAIM } from "../lib/copy";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  listJobs: vi.fn(),
  listCompanies: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("../lib/jobs/queries", () => ({
  listJobs: mocks.listJobs,
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
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (!node || typeof node !== "object" || !("props" in node)) return "";
  return text((node as ReactElement<{ children?: ReactNode }>).props.children);
}

describe("HomePage", () => {
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
    mocks.listCompanies.mockResolvedValue([
      { id: "studio-a", name: "Alpha Studio", slug: "alpha", jobCount: 1 },
    ]);
    mocks.listJobs.mockResolvedValue({
      jobs: [
        {
          id: "latest-hidden",
          slug: "latest-hidden",
          title: "Latest Hidden Role",
          companyId: "studio-a",
          companyName: "Alpha Studio",
          location: "London",
          remote: "remote",
          salaryText: null,
          exclusivity: "hidden_from_linkedin",
          postedAt: "2026-09-02T00:00:00Z",
        },
      ],
      page: 1,
      pageSize: 8,
      total: 1,
      totalPages: 1,
    });
  });

  it("loads the latest eight confirmed hidden jobs for the gaming tenant", async () => {
    const { default: HomePage } = await import("./page");
    const page = await HomePage();

    expect(db.prepare).toHaveBeenCalledWith("SELECT id FROM tenants WHERE slug = ?");
    expect(mocks.listJobs).toHaveBeenCalledWith(db, "tenant-gaming", {
      hidden: true,
      pageSize: 8,
    });
    expect(text(page)).toContain("Latest Hidden Role");
  });

  it("keeps the honest homepage claim and submits search to the jobs page", async () => {
    const { default: HomePage } = await import("./page");
    const page = await HomePage();
    const form = elements(page).find((element) => element.type === "form");
    const searchInput = elements(page).find(
      (element) => element.type === "input" && element.props.name === "q",
    );

    expect(text(page)).toContain(HOMEPAGE_CLAIM);
    expect(HOMEPAGE_CLAIM).toBe(
      "Jobs from studio career pages, including roles not posted on LinkedIn.",
    );
    expect(form?.props).toMatchObject({ action: "/jobs", method: "get" });
    expect(searchInput).toBeDefined();
  });
});
