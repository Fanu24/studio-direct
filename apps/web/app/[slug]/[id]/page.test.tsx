import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Breadcrumbs } from "../../_components/breadcrumbs";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const applyUrl = "https://studio.example/careers/secret-apply";

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  getJobByExternalId: vi.fn(),
  listJobs: vi.fn(),
  tagSalaryRange: vi.fn(),
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

vi.mock("../../../lib/jobs/queries", () => ({
  getJobByExternalId: mocks.getJobByExternalId,
  listJobs: mocks.listJobs,
  tagSalaryRange: mocks.tagSalaryRange,
  jobPublicHref: (job: { slug: string; externalId: string | null }) =>
    job.externalId ? `/${job.slug}/${job.externalId}` : `/jobs/${job.slug}`,
  jobApplyHref: (job: { slug: string; externalId: string | null }) =>
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

function hrefs(page: ReactNode): string[] {
  return elements(page)
    .map((element) => element.props.href)
    .filter((href): href is string => typeof href === "string");
}

const params = Promise.resolve({ slug: "solidity-engineer-alpha", id: "991" });

const job = {
  id: "job-1",
  slug: "solidity-engineer-alpha-991",
  externalId: "991",
  title: "Solidity Engineer",
  companyName: "Alpha Studio",
  companySlug: "alpha-studio",
  location: "London",
  remote: "remote",
  descriptionHtml: "<p>Ship contracts.</p>",
  applyUrl,
  salaryText: null,
  salaryMin: null,
  salaryMax: null,
  highlight: 0,
  exclusivity: "unknown",
  postedAt: "2026-09-02T00:00:00Z",
  tags: ["senior", "solidity"],
};

const relatedJob = {
  id: "job-2",
  slug: "solidity-lead-beta-992",
  externalId: "992",
  title: "Solidity Lead",
  companyId: "studio-b",
  companyName: "Beta Studio",
  companySlug: "beta-studio",
  location: "Berlin",
  remote: "remote",
  salaryText: "$150k - $190k",
  salaryMin: 150000,
  salaryMax: 190000,
  highlight: 0,
  featuredUntil: null,
  exclusivity: "unknown",
  postedAt: "2026-09-01T00:00:00Z",
  tags: ["solidity"],
};

describe("Public job URL", () => {
  const db = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: db } });
    mocks.getJobByExternalId.mockResolvedValue(job);
    mocks.listJobs.mockResolvedValue({
      jobs: [relatedJob],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    mocks.tagSalaryRange.mockResolvedValue({ min: 120000, max: 200000, count: 12 });
  });

  it("leads with the job itself, not with a board of other listings", async () => {
    const { default: PublicJobPage } = await import("./page");
    const page = await PublicJobPage({ params });
    const tree = elements(page);
    const main = tree.find((element) => element.type === "main");
    const h1s = tree.filter((element) => element.type === "h1");

    expect(String(main?.props.className)).toContain("jd");
    expect(mocks.getJobByExternalId).toHaveBeenCalledWith(db, "tenant-gaming", "991");
    expect(h1s).toHaveLength(1);
    expect(text(h1s[0])).toBe("Alpha Studio is hiringSolidity Engineer");
    expect(text(page)).toContain("Job description");
  });

  it("repeats the on-site apply control and never links the studio apply URL", async () => {
    const { default: PublicJobPage } = await import("./page");
    const page = await PublicJobPage({ params });
    const links = hrefs(page);
    const applyLinks = links.filter(
      (href) => href === "/solidity-engineer-alpha-991/991/apply",
    );

    expect(applyLinks.length).toBeGreaterThanOrEqual(2);
    expect(links).not.toContain(applyUrl);
    expect(links.some((href) => href.includes("web3.career"))).toBe(false);
  });

  it("carries the role metadata block", async () => {
    mocks.getJobByExternalId.mockResolvedValue({ ...job, salaryText: "$120k - $160k" });
    const { default: PublicJobPage } = await import("./page");
    const content = text(await PublicJobPage({ params }));

    expect(content).toContain("Remote");
    expect(content).toContain("Compensation: $120k - $160k");
    expect(content).toMatch(/Posted 2 Sept? 2026/);
  });

  it("builds the tail around the craft tag, not the seniority tag", async () => {
    const { default: PublicJobPage } = await import("./page");
    const page = await PublicJobPage({ params });
    const content = text(page);

    expect(content).toContain("Solidity salary");
    expect(content).toContain("More Solidity jobs");
    expect(content).toContain("Hiring Solidity?");
    expect(content).not.toContain("More Senior jobs");
    expect(hrefs(page)).toContain("/hire/solidity");
    expect(hrefs(page)).toContain("/web3-salaries/solidity-developer");
  });

  it("lists other roles on the same tag and at the same studio", async () => {
    const { default: PublicJobPage } = await import("./page");
    const page = await PublicJobPage({ params });
    const content = text(page);
    const links = hrefs(page);

    expect(content).toContain("Solidity Lead");
    expect(content).toContain("Other roles at Alpha Studio");
    expect(links).toContain("/solidity-lead-beta-992/992");
    expect(links).toContain("/solidity-jobs");
    expect(links).toContain("/remote+solidity-jobs");
    expect(links).toContain("/web3-companies/alpha-studio");
  });

  it("drops the job itself out of its own related tables", async () => {
    mocks.listJobs.mockResolvedValue({
      jobs: [{ ...relatedJob, id: job.id }],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    const { default: PublicJobPage } = await import("./page");
    const content = text(await PublicJobPage({ params }));

    expect(content).not.toContain("More Solidity jobs");
    expect(content).not.toContain("Other roles at Alpha Studio");
  });

  it("renders Jobs > Company > Title breadcrumbs", async () => {
    const { default: PublicJobPage } = await import("./page");
    const page = await PublicJobPage({ params });
    const crumbs = elements(page).find((element) => element.type === Breadcrumbs);

    expect(crumbs?.props.items).toEqual([
      { href: "/jobs", label: "Jobs" },
      { href: "/web3-companies/alpha-studio", label: "Alpha Studio" },
      { label: "Solidity Engineer" },
    ]);
  });

  it("keeps the page up when the tail queries fail", async () => {
    mocks.listJobs.mockRejectedValue(new Error("no such table: job_tags"));
    const { default: PublicJobPage } = await import("./page");
    const content = text(await PublicJobPage({ params }));

    expect(content).toContain("Job description");
    expect(content).not.toContain("More Solidity jobs");
  });
});

describe("Public job URL metadata", () => {
  const db = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: db } });
    mocks.getJobByExternalId.mockResolvedValue(job);
  });

  it("builds a title with pay and geo modifiers and a matching description", async () => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({ params });

    expect(metadata.title).toBe("Solidity Engineer in London at Alpha Studio");
    expect(metadata.description).toBe(
      "Solidity Engineer at Alpha Studio. Remote, London. Ship contracts.",
    );
    expect(metadata.alternates?.canonical).toBe("/solidity-engineer-alpha-991/991");
    expect(String(metadata.description)).not.toContain(applyUrl);
  });

  it("carries the salary in the title when known", async () => {
    mocks.getJobByExternalId.mockResolvedValue({ ...job, salaryText: "$120k - $160k" });
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({ params });

    expect(metadata.title).toBe(
      "Solidity Engineer $120k - $160k in London at Alpha Studio",
    );
  });
});
