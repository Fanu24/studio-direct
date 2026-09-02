import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const applyUrl = "https://studio.example/careers/secret-apply";

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  getJobBySlug: vi.fn(),
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
}));

vi.stubGlobal("React", React);

function elements(node: ReactNode): TestElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];

  const element = node as TestElement;
  return [element, ...elements(element.props.children)];
}

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
    mocks.getJobBySlug.mockResolvedValue({
      id: "job-1",
      slug: "gameplay-engineer",
      title: "Gameplay Engineer",
      companyName: "Alpha Studio",
      companySlug: "alpha",
      location: "London",
      remote: "remote",
      descriptionHtml: "<p>Build combat systems.</p>",
      applyUrl,
      salaryText: null,
      exclusivity: "unknown",
      postedAt: "2026-09-01T00:00:00Z",
    });
  });

  it("does not put apply_url in an HTML link for anonymous visitors", async () => {
    const { default: JobPage } = await import("./page");
    const page = await JobPage({ params: Promise.resolve({ slug: "gameplay-engineer" }) });
    const tree = elements(page);
    const anchors = tree.filter((element) => element.type === "a");
    const applyControl = tree.find(
      (element) =>
        typeof element.type === "function"
        && element.type.name === "UnlockApplyForm",
    );

    expect(anchors.map((anchor) => anchor.props.href)).not.toContain(applyUrl);
    expect(applyControl?.props).toMatchObject({
      jobId: "job-1",
      next: "/jobs/gameplay-engineer",
    });
    expect(applyControl?.props).not.toHaveProperty("applyUrl");
    expect(applyControl?.props).not.toHaveProperty("apply_url");
  });
});
