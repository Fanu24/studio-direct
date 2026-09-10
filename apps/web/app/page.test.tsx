import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JobBoard } from "./_components/job-board";
import { BoardSearch } from "./_components/board-chrome";
import { HomeMegaLinks } from "./_components/home-mega";
import { TagChips } from "./_components/job-row";
import { JsonLd } from "./_components/json-ld";
import { LINKEDIN_EXCLUSIVITY_TOOLTIP, homepageSummary } from "../lib/copy";
import type { JobsDatabase } from "../lib/jobs/queries";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  listJobs: vi.fn(),
  getJobsForListItems: vi.fn(),
  countHiringCompanies: vi.fn(),
  headers: vi.fn(async () => new Headers({ host: "nodework.example.com" })),
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

vi.mock("../lib/jobs/queries", () => ({
  listJobs: mocks.listJobs,
  getJobsForListItems: mocks.getJobsForListItems,
  countHiringCompanies: mocks.countHiringCompanies,
  jobPublicHref: (job: { slug: string; externalId?: string | null }) =>
    job.externalId ? `/${job.slug}/${job.externalId}` : `/jobs/${job.slug}`,
  jobApplyHref: (job: { slug: string; externalId?: string | null }) =>
    job.externalId ? `/${job.slug}/${job.externalId}/apply` : `/jobs/${job.slug}/apply`,
}));

vi.mock("../lib/tenant", () => ({
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

describe("HomePage", () => {
  const db = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: db } });
    mocks.countHiringCompanies.mockResolvedValue(3);
    mocks.listJobs.mockResolvedValue({
      jobs: [
        {
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
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    mocks.getJobsForListItems.mockResolvedValue([
      {
        id: "latest-role",
        slug: "latest-role",
        externalId: null,
        title: "Latest Solidity Role",
        companyName: "Alpha Studio",
        companySlug: "alpha",
        location: "London",
        remote: "remote",
        descriptionHtml: "<p>Ship contracts.</p>",
        salaryText: null,
        salaryMin: null,
        salaryMax: null,
        highlight: 0,
        exclusivity: "unknown",
        postedAt: "2026-09-02T00:00:00Z",
        tags: ["solidity"],
      },
    ]);
  });

  it("loads the latest listed jobs for the Nodework tenant", async () => {
    const { default: HomePage } = await import("./page");
    const page = await HomePage({ searchParams: Promise.resolve({}) });

    expect(mocks.listJobs).toHaveBeenCalledWith(db, "tenant-gaming", {
      pageSize: 20,
      page: 1,
    });
    const board = elements(page).find((element) => element.type === JobBoard);
    expect(board).toBeDefined();
    const rendered = JobBoard(
      board?.props as React.ComponentProps<typeof JobBoard>,
    );
    expect(text(rendered)).toContain("Latest Solidity Role");
    expect(text(rendered)).toContain("Apply");
    const apply = elements(rendered).find(
      (element) =>
        typeof element.props.href === "string"
        && String(element.props.href).endsWith("/apply")
        && String(element.props.className ?? "").includes("button--primary"),
    );
    expect(apply?.props.href).toBe("/jobs/latest-role/apply");
    expect(String(apply?.props.href)).not.toContain("web3.career");
  });

  it("renders catalog chrome with search, chips, count, and a keyword-led H1", async () => {
    const { default: HomePage, generateMetadata } = await import("./page");
    const page = await HomePage({ searchParams: Promise.resolve({}) });
    const meta = await generateMetadata();
    const h1 = elements(page).find((element) => element.type === "h1");
    const search = elements(page).find((element) => element.type === BoardSearch);
    const mega = elements(page).find((element) => element.type === HomeMegaLinks);
    const chips = elements(page).find((element) => element.type === TagChips);
    const searchTree = BoardSearch(
      search?.props as React.ComponentProps<typeof BoardSearch>,
    );
    const megaTree = HomeMegaLinks();
    const chipTree = TagChips(chips?.props as React.ComponentProps<typeof TagChips>);
    const form = elements(searchTree).find((element) => element.type === "form");
    const searchInput = elements(searchTree).find(
      (element) => element.type === "input" && element.props.name === "q",
    );
    const hrefs = [
      ...elements(searchTree),
      ...elements(chipTree),
      ...elements(megaTree),
    ]
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);
    const jsonLdPayloads = elements(page)
      .filter((element) => element.type === JsonLd)
      .map((element) => (element.props as { data: Record<string, unknown> }).data);
    const jobPostings = jsonLdPayloads.filter(
      (payload) => payload["@type"] === "JobPosting",
    );

    expect(text(h1)).toContain("Web3 Jobs");
    expect(text(h1)).not.toBe("WEB3 IS THE FUTURE");
    // The counts are stated once, inline under the title. They used to be said
    // twice - a lead sentence and a two-number band - which cost about 220px
    // above the jobs. The lead survives only as the meta description.
    expect(text(page)).toContain("1 live Web3 job at 3 hiring companies");
    expect(text(page)).not.toContain("1 live Web3 jobs");
    expect(text(page)).not.toContain("blockchain jobs in web3 at");
    // The extra "Related pages" rail is gone: the reference homepage has no
    // such section, and its links already live in the mega link stack.
    expect(text(page)).not.toContain("Related pages");
    expect(mega).toBeDefined();
    expect(form?.props).toMatchObject({ action: "/jobs", method: "get" });
    expect(searchInput?.props.placeholder).toBe("Search");
    expect(hrefs).toContain("/remote-jobs");
    expect(hrefs).toContain("/solidity-jobs");
    expect(hrefs).toContain("/web3-jobs-europe");
    expect(text(page)).not.toMatch(/Bondex|wagmi|WxRK/i);
    expect(meta.description).toBe(homepageSummary(1, 3));
    expect(jobPostings).toHaveLength(1);
    expect(jobPostings[0]).toMatchObject({ title: "Latest Solidity Role" });
    // No FAQPage JSON-LD: the FAQ section it described no longer exists on
    // the page, and structured data has to describe visible content.
    expect(jsonLdPayloads.some((payload) => payload["@type"] === "FAQPage")).toBe(
      false,
    );
  });

  it("is a jobs page, not a pitch: hero, board and links, nothing between them", async () => {
    const { default: HomePage } = await import("./page");
    const tree = await HomePage({ searchParams: Promise.resolve({}) });
    const rendered = text(tree);

    // The board is the page.
    expect(rendered).toContain("Web3 Jobs");

    // None of the narrative sections survive. The three FeatureRow wedges
    // (career pages / browse / search) named their headings via a `title`
    // prop, which the `text()` helper above cannot see since it only walks
    // `props.children` - so asserting on those headings would pass whether
    // or not the sections existed. Assert instead on strings that were real
    // JSX children in the pre-cut page (git show 552a062:apps/web/app/page.tsx):
    // the "See the roles..." link text from the deleted wedge, and the two
    // teaser <a> button labels, all of which text() actually walks into.
    expect(rendered).not.toMatch(/See the roles we did not find on LinkedIn/);
    expect(rendered).not.toMatch(/Explore salary bands/);
    expect(rendered).not.toMatch(/Explore companies/);
    expect(rendered).not.toMatch(/The studios in the index/);
    expect(rendered).not.toMatch(/Salary data from real jobs/);
  });

  it("states what the 'Not on LinkedIn' badge means as visible text, not just a title attribute", async () => {
    const { default: HomePage } = await import("./page");
    const page = await HomePage({ searchParams: Promise.resolve({}) });

    expect(text(page)).toContain(LINKEDIN_EXCLUSIVITY_TOOLTIP);
  });
});

// The real implementation, not the mock ../lib/jobs/queries above stands in
// for HomePage - the bulk loader's own order/null-fill contract has to be
// exercised against actual code, not a test double.
describe("getJobsForListItems", () => {
  it("returns details in the same order as the input, with null for misses", async () => {
    const { getJobsForListItems } =
      await vi.importActual<typeof import("../lib/jobs/queries")>(
        "../lib/jobs/queries",
      );

    // Shaped like a mapped D1 row (camelCase aliases, companyNameNorm
    // present) since getJobsForListItems shares loadJob's row mapper, which
    // derives companySlug from companyNameNorm via slugTitle.
    const rows = [
      { externalId: "b", slug: "beta", title: "Beta", companyNameNorm: "beta inc", tagCsv: null },
      { externalId: "a", slug: "alpha", title: "Alpha", companyNameNorm: "alpha inc", tagCsv: null },
    ];
    const db = {
      prepare: (sql: string) => ({
        bind: (..._args: unknown[]) => ({
          all: async () => ({ results: rows }),
          first: async () => rows[0],
        }),
      }),
    } as unknown as JobsDatabase;

    const out = await getJobsForListItems(db, "t", [
      { slug: "alpha", externalId: "a" },
      { slug: "missing", externalId: "zzz" },
      { slug: "beta", externalId: "b" },
    ]);

    expect(out.map((j) => j?.externalId ?? null)).toEqual(["a", null, "b"]);
  });
});
