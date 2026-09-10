import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const applyUrl = "https://studio.example/careers/secret-apply";

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  getJobBySlug: vi.fn(),
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
  getJobBySlug: mocks.getJobBySlug,
  listJobs: mocks.listJobs,
  tagSalaryRange: mocks.tagSalaryRange,
  jobPublicHref: (job: { slug: string; externalId: string | null }) =>
    job.externalId ? `/${job.slug}/${job.externalId}` : `/jobs/${job.slug}`,
  jobApplyHref: (job: { slug: string; externalId: string | null }) =>
    job.externalId ? `/${job.slug}/${job.externalId}/apply` : `/jobs/${job.slug}/apply`,
}));

vi.mock("../../../lib/tenant", () => ({
  requireTenantId: async () => "tenant-1",
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

const params = Promise.resolve({ slug: "gameplay-engineer" });

const job = {
  id: "job-1",
  slug: "gameplay-engineer",
  externalId: null,
  title: "Gameplay Engineer",
  companyName: "Alpha Studio",
  companySlug: "alpha",
  location: "London",
  remote: "remote",
  descriptionHtml: "<p>Build combat systems.</p>",
  applyUrl,
  salaryText: null,
  salaryMin: null,
  salaryMax: null,
  highlight: 0,
  exclusivity: "unknown",
  postedAt: "2026-09-01T00:00:00Z",
  tags: [] as string[],
};

describe("Job page apply control", () => {
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
    mocks.getJobBySlug.mockResolvedValue({ ...job });
    mocks.listJobs.mockResolvedValue({
      jobs: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
    mocks.tagSalaryRange.mockResolvedValue({ min: null, max: null, count: 0 });
  });

  it("sends visitors to the on-site apply form", async () => {
    const { default: JobPage } = await import("./page");
    const page = await JobPage({ params });
    const hrefs = elements(page)
      .map((element) => element.props.href)
      .filter((href): href is string => typeof href === "string");

    expect(hrefs).toContain("/jobs/gameplay-engineer/apply");
    expect(hrefs).not.toContain(applyUrl);
  });

  it("renders the title, company link and public apply copy", async () => {
    const { default: JobPage } = await import("./page");
    const page = await JobPage({ params });
    const tree = elements(page);
    const content = text(page);
    const hrefs = tree
      .map((element) => element.props.href)
      .filter((href): href is string => typeof href === "string");

    expect(text(tree.find((element) => element.type === "h1"))).toBe(
      "Alpha Studio is hiringGameplay Engineer",
    );
    expect(hrefs).toContain("/web3-companies/alpha");
    expect(content).toContain("Apply now");
    expect(content).toContain("More at Alpha Studio");
    expect(content).not.toContain("Not on LinkedIn");
    expect(content).not.toContain("5 free unlocks");
  });
});

describe("Job page metadata", () => {
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
    mocks.getJobBySlug.mockResolvedValue({ ...job });
    mocks.listJobs.mockResolvedValue({
      jobs: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
    mocks.tagSalaryRange.mockResolvedValue({ min: null, max: null, count: 0 });
  });

  it("builds a title with pay and geo modifiers, a plain-text description and a canonical path", async () => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({ params });

    expect(metadata.title).toBe("Gameplay Engineer in London at Alpha Studio");
    expect(metadata.description).toBe(
      "Gameplay Engineer at Alpha Studio. Remote, London. Build combat systems.",
    );
    expect(metadata.alternates?.canonical).toBe("/jobs/gameplay-engineer");
    expect(metadata.description).not.toContain(applyUrl);
  });

  it("carries the salary in the title when known", async () => {
    mocks.getJobBySlug.mockResolvedValue({ ...job, salaryText: "$160k - $220k" });
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({ params });

    expect(metadata.title).toBe(
      "Gameplay Engineer $160k - $220k in London at Alpha Studio",
    );
  });

  it("falls back to the remote label in the title when location is unknown", async () => {
    mocks.getJobBySlug.mockResolvedValue({ ...job, location: null });
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({ params });

    expect(metadata.title).toBe("Gameplay Engineer in Remote at Alpha Studio");
  });

  it("includes salary, skips heading-only blocks and stays under 160 characters", async () => {
    mocks.getJobBySlug.mockResolvedValue({
      ...job,
      remote: "hybrid",
      salaryText: "$160k - $220k",
      descriptionHtml:
        "<h2>About the role</h2><p>Lead the combat team on a live multiplayer title, own the "
        + "feel of every weapon and ability, and mentor three engineers across two time zones. "
        + "Then a second sentence.</p>",
    });
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({ params });
    const description = String(metadata.description);

    expect(description.startsWith(
      "Gameplay Engineer at Alpha Studio. Hybrid, London. $160k - $220k. Lead the combat team",
    )).toBe(true);
    expect(description).not.toContain("About the role");
    expect(description).not.toContain("<");
    expect(description.length).toBeLessThan(160);
    expect(description.endsWith(" ")).toBe(false);
  });
});
