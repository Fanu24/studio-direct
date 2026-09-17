import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JobBoard } from "../_components/job-board";
import {
  BoardFaq,
  BoardSearch,
  RelatedBrowseLinks,
  catalogMonthLabel,
} from "../_components/board-chrome";
import { TagChips } from "../_components/job-row";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  listJobs: vi.fn(),
  getJobsForListItems: vi.fn(),
  countNewJobs: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement("a", props),
}));

vi.mock("../../lib/jobs/queries", () => ({
  listJobs: mocks.listJobs,
  getJobsForListItems: mocks.getJobsForListItems,
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

const LATEST_ROLE = {
  id: "latest-role",
  slug: "latest-role",
  externalId: null,
  title: "Latest Solidity Role",
  companyId: "studio-a",
  companyName: "Alpha Studio",
  companySlug: "alpha",
  location: "London",
  remote: "remote",
  salaryText: null,
  salaryMin: null,
  salaryMax: null,
  highlight: 0,
  featuredUntil: null,
  exclusivity: "unknown",
  postedAt: "2026-09-02T00:00:00Z",
  tags: ["solidity"],
};

describe("JobsPage", () => {
  const db = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: db } });
    mocks.countNewJobs.mockResolvedValue(0);
    mocks.listJobs.mockResolvedValue({
      jobs: [LATEST_ROLE],
      page: 1,
      pageSize: 20,
      total: 12,
      totalPages: 1,
    });
    mocks.getJobsForListItems.mockResolvedValue([null]);
  });

  it("renders the same catalog chrome as home", async () => {
    const { default: JobsPage } = await import("./page");
    const page = await JobsPage({ searchParams: Promise.resolve({}) });
    const h1 = elements(page).find((element) => element.type === "h1");
    const search = elements(page).find((element) => element.type === BoardSearch);
    const faq = elements(page).find((element) => element.type === BoardFaq);
    const related = elements(page).find((element) => element.type === RelatedBrowseLinks);
    const chips = elements(page).find((element) => element.type === TagChips);
    const searchTree = BoardSearch(
      search?.props as React.ComponentProps<typeof BoardSearch>,
    );
    const faqTree = BoardFaq(faq?.props as React.ComponentProps<typeof BoardFaq>);
    const relatedTree = RelatedBrowseLinks(
      related?.props as React.ComponentProps<typeof RelatedBrowseLinks>,
    );
    const chipTree = TagChips(chips?.props as React.ComponentProps<typeof TagChips>);
    const form = elements(searchTree).find((element) => element.type === "form");
    const searchInput = elements(searchTree).find(
      (element) => element.type === "input" && element.props.name === "q",
    );
    const hrefs = [
      ...elements(searchTree),
      ...elements(chipTree),
      ...elements(relatedTree),
    ]
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);
    const board = elements(page).find((element) => element.type === JobBoard);

    expect(text(h1)).toBe("Web3 Jobs");
    expect(text(page)).toContain(catalogMonthLabel());
    expect(text(page)).toContain("12 jobs found");
    expect(text(faqTree)).toContain("What does a Web3 developer do?");
    expect(form?.props).toMatchObject({ action: "/jobs", method: "get" });
    expect(searchTree).toBeTruthy(); // Interactive combobox is rendered by SearchInput.
    expect(hrefs).toContain("/remote-jobs");
    expect(hrefs).toContain("/solana-jobs");
    expect(hrefs).toContain("/web3-companies");
    expect(board).toBeDefined();
  });

  it("formats a large count with commas and singularizes a count of one", async () => {
    mocks.listJobs.mockResolvedValue({
      jobs: [LATEST_ROLE],
      page: 1,
      pageSize: 20,
      total: 1042,
      totalPages: 53,
    });
    const { default: JobsPage } = await import("./page");
    const page = await JobsPage({ searchParams: Promise.resolve({}) });
    expect(text(page)).toContain("1,042 jobs found");

    mocks.listJobs.mockResolvedValue({
      jobs: [LATEST_ROLE],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    const singular = await JobsPage({ searchParams: Promise.resolve({}) });
    expect(text(singular)).toContain("1 job found");
    expect(text(singular)).not.toContain("1 jobs found");
  });
});

describe("JobsPage generateMetadata", () => {
  const db = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: db } });
    mocks.countNewJobs.mockResolvedValue(0);
    mocks.listJobs.mockResolvedValue({
      jobs: [LATEST_ROLE],
      page: 1,
      pageSize: 20,
      total: 12,
      totalPages: 1,
    });
    mocks.getJobsForListItems.mockResolvedValue([null]);
  });

  it("builds a dynamic title and description from the live catalog", async () => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({ searchParams: Promise.resolve({}) });

    expect(metadata.title).toBe(`Web3 Jobs - ${catalogMonthLabel()}`);
    expect(metadata.description).toContain("12 web3, blockchain and crypto jobs");
    expect(metadata.description).toContain("Alpha Studio");
    expect(metadata.description).toContain("Latest Solidity Role");
    expect(metadata.alternates).toMatchObject({ canonical: "/jobs" });
  });

  it("adds the New suffix and noindexes page 2+", async () => {
    mocks.countNewJobs.mockResolvedValue(5);
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ page: "2" }),
    });

    expect(metadata.title).toBe(`Web3 Jobs - ${catalogMonthLabel()} (5 New)`);
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });
});
