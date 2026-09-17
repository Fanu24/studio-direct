vi.mock('../../../../lib/jobs/application-destination',()=>({applicationDestination:vi.fn(async()=>({mode:'internal'}))}));
import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JobApplyForm } from "../../../_components/job-apply-form";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const applyUrl = "https://studio.example/careers/secret-apply";

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  getJobByExternalId: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => React.createElement("a", props),
}));

vi.mock("../../../../lib/jobs/queries", () => ({
  getJobByExternalId: mocks.getJobByExternalId,
  jobPublicHref: (job: { slug: string; externalId: string | null }) =>
    job.externalId ? `/${job.slug}/${job.externalId}` : `/jobs/${job.slug}`,
  jobApplyHref: (job: { slug: string; externalId: string | null }) =>
    job.externalId ? `/${job.slug}/${job.externalId}/apply` : `/jobs/${job.slug}/apply`,
}));

vi.mock("../../../../lib/tenant", () => ({
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

const params = Promise.resolve({ slug: "solidity-engineer-alpha", id: "991" });
const searchParams = Promise.resolve({});

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
  tags: ["solidity"],
};

describe("On-site apply page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: {} } });
    mocks.getJobByExternalId.mockResolvedValue(job);
  });

  it("posts the form to our own handler and never exposes the studio apply URL", async () => {
    const { default: ApplyPage } = await import("./page");
    const page = await ApplyPage({ params, searchParams });
    const tree = elements(page);
    const form = tree.find((element) => element.type === JobApplyForm);
    const hrefs = tree
      .map((element) => element.props.href)
      .filter((href): href is string => typeof href === "string");

    expect(form?.props).toMatchObject({ jobId: "job-1" });
    expect(hrefs).toContain("/solidity-engineer-alpha-991/991");
    expect(hrefs).not.toContain(applyUrl);
    expect(text(page)).not.toContain(applyUrl);
  });

  it("explains delivery to the employer and separates talent-pool consent", async () => {
    const { default: ApplyPage } = await import("./page");
    const content = text(await ApplyPage({ params, searchParams }));

    expect(content).toContain("The employer can review your application in their dashboard");
    expect(content).toContain("separate, optional choice");
    expect(content).not.toMatch(/sen[dt] (?:your|the) (?:profile|application) to/i);
  });

  it("stays out of the index but keeps its links crawlable", async () => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({ params });

    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe(
      "/solidity-engineer-alpha-991/991/apply",
    );
  });
});
