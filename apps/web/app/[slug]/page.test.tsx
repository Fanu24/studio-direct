import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogPager } from "../_components/catalog-jobs";
import { JobBoard } from "../_components/job-board";
import {
  BoardFaq,
  BoardSearch,
  catalogMonthLabel,
} from "../_components/board-chrome";
import { TagChips } from "../_components/job-row";
import { JsonLd } from "../_components/json-ld";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  listLandingJobs: vi.fn(),
  getJobForListItem: vi.fn(),
  getSalaryRollup: vi.fn(),
  countNewJobs: vi.fn(),
  headers: vi.fn(async () => new Headers({ host: "jobs.example.com" })),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("next/headers", () => ({
  headers: () => mocks.headers(),
}));

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement("a", props),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  permanentRedirect: (href: string) => {
    throw new Error(`REDIRECT:${href}`);
  },
}));

vi.mock("../../lib/jobs/queries", () => ({
  listLandingJobs: mocks.listLandingJobs,
  getJobForListItem: mocks.getJobForListItem,
  getSalaryRollup: mocks.getSalaryRollup,
  countNewJobs: mocks.countNewJobs,
  landingIndexable: (total: number) => total >= 5,
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

function jsonLdBlocks(node: ReactNode): Record<string, unknown>[] {
  return elements(node)
    .filter((element) => element.type === JsonLd)
    .map((element) => element.props.data as Record<string, unknown>);
}

const SOLANA_JOB = {
  id: "solana-role",
  slug: "solana-role",
  externalId: null,
  title: "Solana Engineer",
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
  tags: ["solana"],
};

describe("LandingPage", () => {
  const db = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: db } });
    mocks.getSalaryRollup.mockResolvedValue(null);
    mocks.countNewJobs.mockResolvedValue(0);
    mocks.listLandingJobs.mockResolvedValue({
      jobs: [SOLANA_JOB],
      page: 1,
      pageSize: 20,
      total: 8,
      totalPages: 1,
    });
    mocks.getJobForListItem.mockResolvedValue(null);
  });

  it("renders Solana Jobs chrome with count, chips, remote tag link, and original FAQ", async () => {
    const { default: LandingPage } = await import("./page");
    const page = await LandingPage({
      params: Promise.resolve({ slug: "solana-jobs" }),
      searchParams: Promise.resolve({}),
    });
    const h1 = elements(page).find((element) => element.type === "h1");
    const search = elements(page).find((element) => element.type === BoardSearch);
    const faq = elements(page).find((element) => element.type === BoardFaq);
    const chips = elements(page).find((element) => element.type === TagChips);
    const searchTree = BoardSearch(
      search?.props as React.ComponentProps<typeof BoardSearch>,
    );
    const faqTree = BoardFaq(faq?.props as React.ComponentProps<typeof BoardFaq>);
    const chipTree = TagChips(chips?.props as React.ComponentProps<typeof TagChips>);
    const form = elements(searchTree).find((element) => element.type === "form");
    const searchInput = elements(searchTree).find(
      (element) => element.type === "input" && element.props.name === "q",
    );
    const hrefs = [
      ...elements(page),
      ...elements(searchTree),
      ...elements(chipTree),
    ]
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);
    const copy = `${text(page)} ${text(faqTree)}`;

    expect(text(h1)).toBe("Solana Jobs");
    expect(copy).toContain(catalogMonthLabel());
    expect(copy).toContain("8 jobs found");
    expect(copy).not.toMatch(/\d+ New/);
    expect(text(faqTree)).toContain("What does a Solana developer do?");
    expect(text(faqTree)).toContain("How many Solana jobs are listed?");
    expect(text(faqTree)).not.toContain("Solana software development kit");
    expect(text(faqTree)).not.toMatch(/[–—]/);
    expect(form?.props).toMatchObject({ action: "/jobs", method: "get" });
    expect(searchTree).toBeTruthy(); // Interactive combobox is rendered by SearchInput.
    expect(chips?.props).toMatchObject({ active: ["solana"], remote: false });
    expect(hrefs).toContain("/remote+solana-jobs");
    expect(hrefs).toContain("/remote-jobs");
    expect(hrefs).toContain("/web3-salaries/solana-developer");
    expect(hrefs).toContain("/web3-jobs-asia");
    expect(hrefs).toContain("/web3-companies");
    expect(elements(page).some((element) => element.type === JobBoard)).toBe(true);
    // getJobForListItem resolves null in this suite's default mock, so no
    // detail is available for JobPosting - the empty state is honest, not a
    // fabricated block.
    expect(jsonLdBlocks(page).filter((block) => block["@type"] === "JobPosting")).toHaveLength(0);
  });

  it("uses a unique Front End FAQ instead of a mad-lib", async () => {
    const { default: LandingPage } = await import("./page");
    const page = await LandingPage({
      params: Promise.resolve({ slug: "front-end-jobs" }),
      searchParams: Promise.resolve({}),
    });
    const faq = elements(page).find((element) => element.type === BoardFaq);
    const faqTree = BoardFaq(faq?.props as React.ComponentProps<typeof BoardFaq>);
    const copy = text(faqTree);

    expect(text(elements(page).find((element) => element.type === "h1"))).toBe(
      "Front End Jobs",
    );
    expect(copy).toContain("What does a Front End developer do?");
    expect(copy).not.toContain("depends on Front End skills");
    expect(copy).not.toMatch(/[–—]/);
  });

  it("emits one JobPosting block per rendered row when detail lookups succeed", async () => {
    mocks.listLandingJobs.mockResolvedValue({
      jobs: [
        SOLANA_JOB,
        {
          ...SOLANA_JOB,
          id: "solana-role-2",
          slug: "solana-role-2",
          title: "Senior Solana Engineer",
        },
      ],
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
    });
    mocks.getJobForListItem.mockImplementation(
      async (_db: unknown, _tenantId: unknown, job: { slug: string; title?: string } | undefined) =>
        job
          ? {
              ...SOLANA_JOB,
              slug: job.slug,
              title: job.title ?? SOLANA_JOB.title,
              descriptionHtml: "<p>Build Solana programs.</p>",
            }
          : null,
    );

    const { default: LandingPage } = await import("./page");
    const page = await LandingPage({
      params: Promise.resolve({ slug: "solana-jobs" }),
      searchParams: Promise.resolve({}),
    });

    const jobPostings = jsonLdBlocks(page).filter((block) => block["@type"] === "JobPosting");
    expect(jobPostings).toHaveLength(2);
    expect(jobPostings.map((posting) => posting.title)).toEqual([
      "Solana Engineer",
      "Senior Solana Engineer",
    ]);
  });

  it("gates the salary rollup on a single-tag landing and adds the city lookup", async () => {
    const { default: LandingPage } = await import("./page");

    await LandingPage({
      params: Promise.resolve({ slug: "dev+senior-jobs" }),
      searchParams: Promise.resolve({}),
    });
    expect(mocks.getSalaryRollup).not.toHaveBeenCalled();

    mocks.getSalaryRollup.mockClear();
    await LandingPage({
      params: Promise.resolve({ slug: "web3-jobs-berlin" }),
      searchParams: Promise.resolve({}),
    });
    expect(mocks.getSalaryRollup).toHaveBeenCalledWith(db, "city", "berlin");
  });

  it("wires the numbered pager and honest count formatting", async () => {
    mocks.listLandingJobs.mockResolvedValue({
      jobs: [SOLANA_JOB],
      page: 1,
      pageSize: 20,
      total: 1234,
      totalPages: 3,
    });
    const { default: LandingPage } = await import("./page");
    const page = await LandingPage({
      params: Promise.resolve({ slug: "solana-jobs" }),
      searchParams: Promise.resolve({}),
    });

    expect(text(page)).toContain("1,234 jobs found");
    const board = elements(page).find((element) => element.type === JobBoard);
    const pagerElement = board?.props.pager as TestElement | undefined;
    expect(pagerElement?.type).toBe(CatalogPager);
    const pagerTree = CatalogPager(
      pagerElement?.props as React.ComponentProps<typeof CatalogPager>,
    );
    expect(pagerTree?.props["aria-label"]).toBe("Jobs pagination");
    expect(text(pagerTree)).toContain("2");
    expect(text(pagerTree)).toContain("3");
    expect(text(pagerTree)).toContain("Next");
    expect(text(pagerTree)).not.toContain("Previous");
  });

  it("renders the by-the-numbers block from the slice stats and the rollup", async () => {
    mocks.getSalaryRollup.mockResolvedValue({
      dimension: "role",
      slug: "solana-developer",
      avg: 140000,
      min: 80000,
      max: 200000,
      jobCount30d: 46,
    });
    mocks.countNewJobs.mockImplementation(
      async (
        _db: unknown,
        _tenantId: unknown,
        _filters: unknown,
        sinceHours: number,
      ) => (sinceHours === 24 ? 2 : 11),
    );

    const { default: LandingPage } = await import("./page");
    const page = await LandingPage({
      params: Promise.resolve({ slug: "solana-jobs" }),
      searchParams: Promise.resolve({}),
    });
    const copy = text(page);

    expect(copy).toContain("Solana Jobs by the numbers");
    expect(copy).toContain("Open roles");
    expect(copy).toContain("Posted this week");
    // The week number, not the 24h one that drives the title suffix.
    expect(copy).toContain("11");
    expect(copy).toContain("$80k - $200k");
    expect(copy).toContain("averaging $140k");
    expect(copy).toContain("46 priced roles");
    expect(copy).toContain("Companies on this page");
  });

  it("says the salary band is unpublished when no rollup covers the slice", async () => {
    const { default: LandingPage } = await import("./page");
    const page = await LandingPage({
      params: Promise.resolve({ slug: "solana-jobs" }),
      searchParams: Promise.resolve({}),
    });

    expect(text(page)).toContain("Not published");
    expect(text(page)).toContain("No salary rollup covers this slice yet");
  });

  it("offers 5 to 10 contextual related links instead of one shared chip row", async () => {
    const { default: LandingPage } = await import("./page");
    const page = await LandingPage({
      params: Promise.resolve({ slug: "web3-jobs-berlin" }),
      searchParams: Promise.resolve({}),
    });
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(hrefs).toContain("/web3-jobs-germany");
    expect(hrefs).toContain("/web3-jobs-europe");
    expect(hrefs).not.toContain("/web3-jobs-berlin");
  });

  // Trap: the router hands this page a still-encoded segment, so the redirect
  // has to decode before it compares - "%2B" is the same URL as "+".
  it("308s the non-canonical combo order and leaves the canonical one alone", async () => {
    const { default: LandingPage } = await import("./page");

    await expect(
      LandingPage({
        params: Promise.resolve({ slug: "solana%2Bremote-jobs" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("REDIRECT:/remote+solana-jobs");

    await expect(
      LandingPage({
        params: Promise.resolve({ slug: "solana+remote-jobs" }),
        searchParams: Promise.resolve({ page: "2" }),
      }),
    ).rejects.toThrow("REDIRECT:/remote+solana-jobs?page=2");

    const page = await LandingPage({
      params: Promise.resolve({ slug: "remote%2Bsolana-jobs" }),
      searchParams: Promise.resolve({}),
    });
    expect(text(elements(page).find((element) => element.type === "h1"))).toBe(
      "Remote Solana Jobs",
    );
  });

  it("reports a singular count for exactly one job", async () => {
    mocks.listLandingJobs.mockResolvedValue({
      jobs: [SOLANA_JOB],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    const { default: LandingPage } = await import("./page");
    const page = await LandingPage({
      params: Promise.resolve({ slug: "solana-jobs" }),
      searchParams: Promise.resolve({}),
    });

    expect(text(page)).toContain("1 job found");
    expect(text(page)).not.toContain("1 jobs found");
  });
});

describe("LandingPage generateMetadata", () => {
  const db = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: db } });
    mocks.getSalaryRollup.mockResolvedValue(null);
    mocks.countNewJobs.mockResolvedValue(0);
    mocks.listLandingJobs.mockResolvedValue({
      jobs: [SOLANA_JOB],
      page: 1,
      pageSize: 20,
      total: 8,
      totalPages: 1,
    });
    mocks.getJobForListItem.mockResolvedValue(null);
  });

  it("builds a title and description from the live slots, with the canonical + form", async () => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "remote-solana-jobs" }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).toBe(`Remote Solana Jobs - ${catalogMonthLabel()}`);
    expect(metadata.description).toContain("8 remote solana jobs");
    expect(metadata.description).toContain("Alpha Studio");
    expect(metadata.description).toContain("Solana Engineer");
    expect(metadata.alternates).toMatchObject({ canonical: "/remote+solana-jobs" });
  });

  it("adds the New suffix when jobs posted in the last day", async () => {
    mocks.countNewJobs.mockResolvedValue(3);
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "solana-jobs" }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).toBe(`Solana Jobs - ${catalogMonthLabel()} (3 New)`);
  });
});
