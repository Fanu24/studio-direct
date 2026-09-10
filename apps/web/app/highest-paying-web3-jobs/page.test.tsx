import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JobBoard } from "../_components/job-board";
import { catalogMonthLabel } from "../_components/board-chrome";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { buildLandingTitle } from "../../lib/jobs/landing-meta";

type TestElement = ReactElement<Record<string, unknown> & { children?: ReactNode }>;

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  listJobs: vi.fn(),
  getJobForListItem: vi.fn(),
  countNewJobs: vi.fn(),
  headers: vi.fn(async () => new Headers({ host: "nodework.example" })),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("next/headers", () => ({
  headers: () => mocks.headers(),
}));

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => React.createElement("a", props),
}));

vi.mock("../../lib/jobs/queries", () => ({
  listJobs: mocks.listJobs,
  getJobForListItem: mocks.getJobForListItem,
  countNewJobs: mocks.countNewJobs,
  jobPublicHref: (job: { slug: string; externalId?: string | null }) =>
    job.externalId ? `/${job.slug}/${job.externalId}` : `/jobs/${job.slug}`,
  jobApplyHref: (job: { slug: string; externalId?: string | null }) =>
    job.externalId ? `/${job.slug}/${job.externalId}/apply` : `/jobs/${job.slug}/apply`,
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
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (!node || typeof node !== "object" || !("props" in node)) return "";
  return text((node as ReactElement<{ children?: ReactNode }>).props.children);
}

const month = catalogMonthLabel();

describe("HighestPayingWeb3JobsPage", () => {
  const db = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: db } });
    mocks.listJobs.mockResolvedValue({
      jobs: [],
      page: 1,
      pageSize: 40,
      total: 0,
      totalPages: 0,
    });
    mocks.getJobForListItem.mockResolvedValue(null);
    mocks.countNewJobs.mockResolvedValue(0);
  });

  it("lists published salaries by salary_max on Nodework", async () => {
    const { default: HighestPayingWeb3JobsPage } = await import("./page");
    const page = await HighestPayingWeb3JobsPage();

    expect(mocks.listJobs).toHaveBeenCalledWith(db, "tenant-gaming", {
      hasSalary: true,
      orderBy: "salary",
      pageSize: 40,
    });
    expect(mocks.countNewJobs).toHaveBeenCalledWith(db, "tenant-gaming", { hasSalary: true }, 24);
    expect(text(elements(page).find((element) => element.type === "h1"))).toBe(
      buildLandingTitle({ headline: "Highest paying Web3 jobs", month, newJobs: 0 }),
    );
    expect(elements(page).find((element) => element.type === JobBoard)).toBeDefined();
    expect(elements(page).find((element) => element.type === Breadcrumbs)).toBeDefined();
    expect(text(page)).not.toMatch(/[–—]/);
  });

  it("appends the freshness and new-jobs suffix and names the top listing", async () => {
    mocks.countNewJobs.mockResolvedValue(5);
    mocks.listJobs.mockResolvedValue({
      jobs: [
        {
          id: "job-1",
          slug: "top-role",
          externalId: null,
          title: "Staff Solidity Engineer",
          companyId: "c1",
          companyName: "Acme Chain",
          companySlug: "acme-chain",
          location: null,
          remote: "remote",
          salaryText: null,
          salaryMin: 200000,
          salaryMax: 260000,
          highlight: 0,
          featuredUntil: null,
          exclusivity: "public",
          postedAt: "2026-09-01T00:00:00.000Z",
          tags: [],
        },
      ],
      page: 1,
      pageSize: 40,
      total: 1,
      totalPages: 1,
    });

    const { default: HighestPayingWeb3JobsPage } = await import("./page");
    const page = await HighestPayingWeb3JobsPage();
    const copy = text(page);

    expect(text(elements(page).find((element) => element.type === "h1"))).toBe(
      buildLandingTitle({ headline: "Highest paying Web3 jobs", month, newJobs: 5 }),
    );
    expect(copy).toContain("Staff Solidity Engineer");
    expect(copy).toContain("Acme Chain");
    expect(copy).toContain("$200k - $260k");
  });
});
