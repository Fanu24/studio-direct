import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../../../lib/copy";

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
  });

  it("does not put apply_url in an HTML link for anonymous visitors", async () => {
    const { default: JobPage } = await import("./page");
    const page = await JobPage({ params });
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

  it("renders the title, studio link, apply panel copy and related hub links", async () => {
    const { default: JobPage } = await import("./page");
    const page = await JobPage({ params });
    const tree = elements(page);
    const content = text(page);
    // next/link is mocked as a component, so links are matched by their href prop.
    const hrefs = tree
      .map((element) => element.props.href)
      .filter((href): href is string => typeof href === "string");

    expect(tree.find((element) => element.type === "h1")?.props.children).toBe(
      "Gameplay Engineer",
    );
    expect(hrefs).toContain("/companies/alpha");
    expect(content).toContain("Apply on the studio site");
    expect(content).toContain("5 free unlocks per UTC week.");
    expect(content).toContain("You apply on the studio site.");
    expect(content).toContain("The link opens after you sign in.");
    expect(content).toContain("More at Alpha Studio");
    expect(content).not.toContain("Not on LinkedIn");
  });

  it("links to the role hubs a title matches, and to none when it matches nothing", async () => {
    const { default: JobPage } = await import("./page");
    const unmatched = elements(await JobPage({ params }))
      .map((element) => element.props.href)
      .filter((href): href is string => typeof href === "string");

    // "Gameplay Engineer" matches no hub slug, so the related nav must not render.
    expect(unmatched.some((href) => href.startsWith("/skills/"))).toBe(false);
    expect(unmatched.some((href) => href.startsWith("/remote-"))).toBe(false);

    mocks.getJobBySlug.mockResolvedValue({
      ...job,
      slug: "gameplay-programmer",
      title: "Gameplay Programmer",
    });
    const matched = elements(await JobPage({ params }))
      .map((element) => element.props.href)
      .filter((href): href is string => typeof href === "string");

    expect(matched).toContain("/remote-gameplay-programmer-jobs");
    expect(matched).toContain("/skills/gameplay-programmer");
  });

  it("shows the honest badge with its tooltip only for hidden roles", async () => {
    mocks.getJobBySlug.mockResolvedValue({ ...job, exclusivity: "hidden_from_linkedin" });
    const { default: JobPage } = await import("./page");
    const page = await JobPage({ params });
    const badge = elements(page).find(
      (element) =>
        typeof element.props.className === "string"
        && element.props.className.split(" ").includes("badge"),
    );

    expect(badge?.props.children).toBe("Not on LinkedIn");
    expect(badge?.props.title).toBe(LINKEDIN_EXCLUSIVITY_TOOLTIP);
    expect(text(page)).toContain(LINKEDIN_EXCLUSIVITY_TOOLTIP);
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
  });

  it("builds a title, a plain-text description and a canonical path", async () => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({ params });

    expect(metadata.title).toBe("Gameplay Engineer at Alpha Studio");
    expect(metadata.description).toBe(
      "Gameplay Engineer at Alpha Studio. Remote, London. Build combat systems.",
    );
    expect(metadata.alternates?.canonical).toBe("/jobs/gameplay-engineer");
    expect(metadata.description).not.toContain(applyUrl);
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
