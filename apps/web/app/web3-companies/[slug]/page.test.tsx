import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JsonLd } from "../../_components/json-ld";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  getCompanyBySlug: vi.fn(),
  listJobs: vi.fn(),
  getJobForListItem: vi.fn(),
  listCompanyTopTags: vi.fn(),
  listCompanyLocations: vi.fn(),
  countNewJobs: vi.fn(),
  headers: vi.fn(async () => new Headers({ host: "jobs.example.com" })),
}));

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => React.createElement("a", props),
}));

vi.mock("next/headers", () => ({
  headers: () => mocks.headers(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("../../../lib/jobs/queries", () => ({
  getCompanyBySlug: mocks.getCompanyBySlug,
  listJobs: mocks.listJobs,
  getJobForListItem: mocks.getJobForListItem,
  listCompanyTopTags: mocks.listCompanyTopTags,
  listCompanyLocations: mocks.listCompanyLocations,
  countNewJobs: mocks.countNewJobs,
  jobPublicHref: (job: { slug: string; externalId?: string | null }) =>
    job.externalId ? `/${job.slug}/${job.externalId}` : `/jobs/${job.slug}`,
  jobApplyHref: (job: { slug: string; externalId?: string | null }) =>
    job.externalId ? `/${job.slug}/${job.externalId}/apply` : `/jobs/${job.slug}/apply`,
}));

vi.mock("../../../lib/tenant", () => ({
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

function jsonLdBlocks(node: ReactNode): Record<string, unknown>[] {
  return elements(node)
    .filter((element) => element.type === JsonLd)
    .map((element) => element.props.data as Record<string, unknown>);
}

const COMPANY = { id: "studio-a", name: "Alpha Studio", slug: "alpha", domain: null };

const JOB_A = {
  id: "job-a",
  slug: "job-a",
  externalId: null,
  title: "Solidity Engineer",
  companyId: "studio-a",
  companyName: "Alpha Studio",
  companySlug: "alpha",
  companyLogoUrl: null,
  location: "Berlin",
  remote: "hybrid",
  salaryText: null,
  salaryMin: null,
  salaryMax: null,
  highlight: 0,
  featuredUntil: null,
  exclusivity: "unknown",
  postedAt: "2026-09-02T00:00:00Z",
  tags: ["solidity"],
};

function detailFor(job: { slug: string; title?: string } | undefined) {
  if (!job) return null;
  return {
    ...JOB_A,
    slug: job.slug,
    title: job.title ?? JOB_A.title,
    descriptionHtml: "<p>Ship contracts.</p>",
  };
}

describe("CompanyPage", () => {
  const db = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: db } });
    mocks.getCompanyBySlug.mockResolvedValue(COMPANY);
    mocks.listJobs.mockResolvedValue({
      jobs: [JOB_A],
      page: 1,
      pageSize: 20,
      total: 45,
      totalPages: 3,
    });
    mocks.getJobForListItem.mockImplementation(
      async (_db: unknown, _tenantId: unknown, job: unknown) =>
        detailFor(job as { slug: string; title?: string } | undefined),
    );
    mocks.listCompanyTopTags.mockResolvedValue([
      { slug: "solidity", count: 5 },
      { slug: "design", count: 2 },
    ]);
    mocks.listCompanyLocations.mockResolvedValue([{ slug: "berlin", count: 3 }]);
    mocks.countNewJobs.mockResolvedValue(0);
  });

  it("renders the reference's heading, role-count sentence and profile CTA, plus a tag/location filter and a numbered pager", async () => {
    const { default: CompanyPage } = await import("./page");
    const page = await CompanyPage({
      params: Promise.resolve({ slug: "alpha" }),
      searchParams: Promise.resolve({}),
    });
    const copy = text(page);
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(mocks.listJobs).toHaveBeenCalledWith(db, "tenant-gaming", {
      companyId: "studio-a",
      tag: undefined,
      locationSlug: undefined,
      page: undefined,
    });
    expect(text(elements(page).find((element) => element.type === "h1"))).toBe(
      "Alpha Studio Jobs",
    );
    expect(copy).toContain("There are 45 Web3 jobs at Alpha Studio.");
    expect(copy).toContain("Build your profile");
    expect(hrefs).toContain("/profile");
    expect(hrefs).toContain("/web3-companies/alpha?tag=solidity");
    expect(hrefs).toContain("/web3-companies/alpha?location=berlin");
    expect(hrefs).toContain("/web3-companies");
    // Every link this page owns points at the canonical taxonomy. The one
    // remaining /companies/:slug href comes from the shared JobRow component
    // (app/_components/job-row.tsx), which this page does not own.
    expect(hrefs).not.toContain("/companies");
    expect(hrefs).not.toContain("/companies/alpha?tag=solidity");

    const pager = elements(page).find(
      (element) => element.props["aria-label"] === "Company jobs pagination",
    );
    expect(pager).toBeDefined();
    expect(text(pager)).toContain("2");
    expect(text(pager)).toContain("3");
    expect(text(pager)).toContain("Next");
    expect(text(pager)).not.toContain("Previous");

    const jobPostings = jsonLdBlocks(page).filter((block) => block["@type"] === "JobPosting");
    expect(jobPostings).toHaveLength(1);
    expect(jobPostings[0]?.title).toBe("Solidity Engineer");

    const organization = jsonLdBlocks(page).find(
      (block) => block["@type"] === "Organization",
    );
    expect(organization).toMatchObject({
      name: "Alpha Studio",
      url: "/web3-companies/alpha",
    });
  });

  it("uses the singular sentence for a company with exactly one role", async () => {
    mocks.listJobs.mockResolvedValue({
      jobs: [JOB_A],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    const { default: CompanyPage } = await import("./page");
    const page = await CompanyPage({
      params: Promise.resolve({ slug: "alpha" }),
      searchParams: Promise.resolve({}),
    });

    expect(text(page)).toContain("There is 1 Web3 job at Alpha Studio.");
  });

  it("combines an active tag, location and page number instead of dropping filters on paginate", async () => {
    mocks.listJobs.mockResolvedValue({
      jobs: [JOB_A],
      page: 2,
      pageSize: 20,
      total: 45,
      totalPages: 3,
    });
    const { default: CompanyPage } = await import("./page");
    const page = await CompanyPage({
      params: Promise.resolve({ slug: "alpha" }),
      searchParams: Promise.resolve({ tag: "solidity", location: "berlin", page: "2" }),
    });

    expect(mocks.listJobs).toHaveBeenCalledWith(db, "tenant-gaming", {
      companyId: "studio-a",
      tag: "solidity",
      locationSlug: "berlin",
      page: 2,
    });

    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(hrefs).toContain("/web3-companies/alpha?tag=solidity&location=berlin&page=1");
    expect(hrefs).toContain("/web3-companies/alpha?tag=solidity&location=berlin&page=3");
  });

  it("shows an honest filtered-empty message distinct from a company with no jobs at all", async () => {
    mocks.listJobs.mockResolvedValue({ jobs: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
    const { default: CompanyPage } = await import("./page");
    const page = await CompanyPage({
      params: Promise.resolve({ slug: "alpha" }),
      searchParams: Promise.resolve({ tag: "design" }),
    });

    expect(text(page)).toContain("No roles at Alpha Studio match this filter right now.");
    expect(text(page)).not.toContain("has no listed jobs right now.");
  });

  it("404s when the company slug doesn't resolve", async () => {
    mocks.getCompanyBySlug.mockResolvedValue(null);
    const { default: CompanyPage } = await import("./page");

    await expect(
      CompanyPage({
        params: Promise.resolve({ slug: "ghost" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("decodes a percent-encoded slug segment before looking the company up", async () => {
    const { default: CompanyPage } = await import("./page");
    await CompanyPage({
      params: Promise.resolve({ slug: "alpha%20studio" }),
      searchParams: Promise.resolve({}),
    });

    expect(mocks.getCompanyBySlug).toHaveBeenCalledWith(db, "tenant-gaming", "alpha studio");
  });
});

/**
 * /web3-companies/top-growing and /web3-companies/tag/... are static routes
 * inside the same segment as this dynamic [slug] route. Next resolves the
 * static segment first, so a company that slugged to one of those names
 * would render a page no URL can reach - the route must 404 instead.
 */
describe("CompanyPage route precedence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: {} } });
    mocks.getCompanyBySlug.mockResolvedValue({
      id: "x",
      name: "Top Growing",
      slug: "top-growing",
      domain: null,
    });
  });

  it("declares the static sibling routes explicitly so they win over [slug]", () => {
    const here = fileURLToPath(new URL(".", import.meta.url));
    expect(existsSync(new URL("../top-growing/page.tsx", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../tag/[tag]/page.tsx", import.meta.url))).toBe(true);
    expect(here).toContain("web3-companies");
  });

  it.each(["top-growing", "tag", "TOP-GROWING"])(
    "404s the reserved segment %s instead of shadowing it with a company",
    async (slug) => {
      const { default: CompanyPage } = await import("./page");
      await expect(
        CompanyPage({
          params: Promise.resolve({ slug }),
          searchParams: Promise.resolve({}),
        }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mocks.getCompanyBySlug).not.toHaveBeenCalled();
    },
  );
});

describe("CompanyPage company description", () => {
  const db = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: db } });
    mocks.listJobs.mockResolvedValue({
      jobs: [JOB_A],
      page: 1,
      pageSize: 20,
      total: 45,
      totalPages: 3,
    });
    mocks.getJobForListItem.mockImplementation(
      async (_db: unknown, _tenantId: unknown, job: unknown) =>
        detailFor(job as { slug: string; title?: string } | undefined),
    );
    mocks.listCompanyTopTags.mockResolvedValue([]);
    mocks.listCompanyLocations.mockResolvedValue([]);
    mocks.countNewJobs.mockResolvedValue(0);
  });

  it("renders a description when the company has one", async () => {
    mocks.getCompanyBySlug.mockResolvedValue({
      ...COMPANY,
      slug: "acme",
      description: "Acme builds settlement rails.",
    });
    const { default: CompanyPage } = await import("./page");
    const page = await CompanyPage({
      params: Promise.resolve({ slug: "acme" }),
      searchParams: Promise.resolve({}),
    });

    expect(text(page)).toContain("Acme builds settlement rails.");
  });

  it("shows no description block at all when the column is empty", async () => {
    mocks.getCompanyBySlug.mockResolvedValue({
      ...COMPANY,
      slug: "empty-co",
      description: null,
    });
    const { default: CompanyPage } = await import("./page");
    const page = await CompanyPage({
      params: Promise.resolve({ slug: "empty-co" }),
      searchParams: Promise.resolve({}),
    });

    const copy = text(page);
    expect(copy).not.toMatch(/About this company/i);
    expect(copy).not.toMatch(/No description/i);
  });
});

describe("CompanyPage generateMetadata", () => {
  const db = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: db } });
    mocks.getCompanyBySlug.mockResolvedValue(COMPANY);
    mocks.listJobs.mockResolvedValue({
      jobs: [JOB_A],
      page: 1,
      pageSize: 20,
      total: 45,
      totalPages: 3,
    });
    mocks.getJobForListItem.mockResolvedValue(null);
    mocks.listCompanyTopTags.mockResolvedValue([]);
    mocks.listCompanyLocations.mockResolvedValue([]);
  });

  it("names the company twice for the two search intents and adds an honest New count", async () => {
    mocks.countNewJobs.mockResolvedValue(4);
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "alpha" }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).toContain("Alpha Studio Careers");
    expect(metadata.title).toContain("Jobs at Alpha Studio");
    expect(metadata.title).toContain("(4 New)");
    expect(metadata.alternates).toMatchObject({ canonical: "/web3-companies/alpha" });
  });

  it("omits the New suffix when nothing new was posted today", async () => {
    mocks.countNewJobs.mockResolvedValue(0);
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "alpha" }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).not.toContain("New)");
  });
});
