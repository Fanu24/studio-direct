import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ArticleLayout } from "../../_components/article-layout";
import { JobCardGrid } from "../../_components/job-card";
import { ResourceGrid } from "../../_components/resource-grid";
import { LEARN_CATEGORIES, isLearnTopicJobTag } from "../categories";
import { resourcesForCategory } from "../resources";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  listJobs: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("../../../lib/jobs/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/jobs/queries")>();
  return { ...actual, listJobs: mocks.listJobs };
});

vi.mock("../../../lib/tenant", () => ({
  requireTenantId: async () => "tenant-gaming",
}));

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => React.createElement("a", props),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
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

function layoutTree(page: ReactNode) {
  const layout = elements(page).find((element) => element.type === ArticleLayout);
  return ArticleLayout(
    layout?.props as React.ComponentProps<typeof ArticleLayout>,
  );
}

/**
 * The ArticleLayout tree, plus every sub-component's own rendered output
 * (ResourceGrid, JobCardGrid) invoked directly - the same "find the
 * element, call it as a function" pattern this repo already uses for
 * ArticleLayout, JobBoard, and CatalogPager, since the tree walker below
 * only recurses into props.children and does not execute components.
 */
function fullTree(page: ReactNode) {
  const tree = layoutTree(page);
  const treeElements = elements(tree);
  const resourceGrid = treeElements.find((element) => element.type === ResourceGrid);
  const jobCardGrid = treeElements.find((element) => element.type === JobCardGrid);
  const resourceGridTree = resourceGrid
    ? ResourceGrid(resourceGrid.props as React.ComponentProps<typeof ResourceGrid>)
    : null;
  const jobCardGridTree = jobCardGrid
    ? JobCardGrid(jobCardGrid.props as React.ComponentProps<typeof JobCardGrid>)
    : null;
  return { tree, resourceGridTree, jobCardGridTree };
}

async function renderCategory(category: string) {
  const { default: LearnCategoryPage } = await import("./page");
  const page = await LearnCategoryPage({ params: Promise.resolve({ category }) });
  const { tree, resourceGridTree, jobCardGridTree } = fullTree(page);
  const copy = `${text(page)} ${text(tree)} ${text(resourceGridTree)} ${text(jobCardGridTree)}`;
  const hrefs = [
    ...elements(page),
    ...elements(tree),
    ...elements(resourceGridTree),
    ...elements(jobCardGridTree),
  ]
    .filter((element) => typeof element.props.href === "string")
    .map((element) => element.props.href as string);
  return { page, tree, copy, hrefs };
}

describe("LearnCategoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: {} } });
    mocks.listJobs.mockResolvedValue({
      jobs: [],
      page: 1,
      pageSize: 6,
      total: 0,
      totalPages: 0,
    });
  });

  it("renders original tutorial-category copy and catalog links", async () => {
    const { tree, copy, hrefs } = await renderCategory("tutorial");

    expect(text(elements(tree).find((element) => element.type === "h1"))).toBe(
      "Web3 tutorials and the catalog",
    );
    expect(copy.trim().split(/\s+/).filter(Boolean).length).toBeGreaterThanOrEqual(400);
    expect(copy).toContain("Nodework will not republish those walkthroughs");
    expect(copy).not.toMatch(/[–—]/);
    expect(hrefs).toContain("/solidity-jobs");
    expect(hrefs).toContain("/solana-jobs");
    expect(hrefs).toContain("/intern-jobs");
    expect(hrefs).toContain("/learn-web3");
    expect(mocks.listJobs).not.toHaveBeenCalled();
  });

  it("404s unknown categories", async () => {
    const { default: LearnCategoryPage } = await import("./page");
    await expect(
      LearnCategoryPage({
        params: Promise.resolve({ category: "scraped-article" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders every vocabulary slug that used to 404 with a 200-shaped tree", async () => {
    for (const slug of [
      "solidity",
      "rust",
      "nft",
      "defi",
      "dao",
      "ethereum",
      "bootcamp",
      "beginner",
      "zero-knowledge",
    ]) {
      const { tree, hrefs } = await renderCategory(slug);
      expect(elements(tree).find((element) => element.type === "h1")).toBeDefined();
      expect(hrefs).toContain(`/learn-web3/${slug}`);
    }
  });

  it("puts the live resource count in the H1 and meta description for a topic page", async () => {
    const { generateMetadata } = await import("./page");
    const solidityCount = resourcesForCategory("solidity").length;
    expect(solidityCount).toBeGreaterThan(0);

    const { tree, copy } = await renderCategory("solidity");
    const h1 = text(elements(tree).find((element) => element.type === "h1"));
    expect(h1).toBe(`${solidityCount} Solidity Resources to Learn Web3`);
    expect(copy).toContain(`${solidityCount} curated Solidity resource`);

    const metadata = await generateMetadata({
      params: Promise.resolve({ category: "solidity" }),
    });
    expect(metadata.title).toBe(h1);
    expect(metadata.description).toContain(String(solidityCount));
  });

  it("renders a truthful empty state for a topic with no curated resources yet", async () => {
    expect(resourcesForCategory("recruiter")).toHaveLength(0);
    const { tree, copy } = await renderCategory("recruiter");
    const h1 = text(elements(tree).find((element) => element.type === "h1"));
    expect(h1).toBe("Learn Recruiter for Web3 Jobs");
    expect(copy).toContain("No curated Recruiter resources are listed yet");
  });

  it("fetches and renders live jobs for a topic that is also a job tag", async () => {
    const job = {
      id: "job-1",
      slug: "solidity-engineer",
      externalId: null,
      title: "Solidity Engineer",
      companyId: "c1",
      companyName: "Acme",
      companySlug: "acme",
      location: "Remote",
      remote: "remote",
      salaryText: null,
      salaryMin: null,
      salaryMax: null,
      highlight: 0,
      featuredUntil: null,
      exclusivity: "none",
      postedAt: null,
      tags: ["solidity"],
    };
    mocks.listJobs.mockResolvedValue({
      jobs: [job],
      page: 1,
      pageSize: 6,
      total: 1,
      totalPages: 1,
    });

    const { page } = await renderCategory("solidity");
    const { jobCardGridTree } = fullTree(page);
    expect(mocks.listJobs).toHaveBeenCalledWith({}, "tenant-gaming", {
      tag: "solidity",
      pageSize: 6,
    });
    // JobCardGrid is used as JSX (<JobCardGrid .../>), not invoked, so its
    // own <JobCard> children are element nodes here rather than rendered
    // text - assert on the job data JobCardGrid actually received.
    const jobCardElement = elements(jobCardGridTree).find(
      (element) => (element.props as { job?: { id?: string } }).job?.id === "job-1",
    );
    expect(jobCardElement).toBeDefined();
    expect((jobCardElement?.props as { job: typeof job }).job.title).toBe(
      "Solidity Engineer",
    );
  });

  it("links a job-tag topic straight to its tag and remote tag landings", async () => {
    const { hrefs, copy } = await renderCategory("solidity");
    expect(hrefs).toContain("/solidity-jobs");
    expect(hrefs).toContain("/remote-solidity-jobs");
    expect(copy).not.toMatch(/[–—]/);
  });

  it("falls back to the curated catalog for a topic that is not a job tag", async () => {
    expect(isLearnTopicJobTag("career-advice")).toBe(false);
    const { hrefs } = await renderCategory("career-advice");
    expect(hrefs).toContain("/solidity-jobs");
    expect(hrefs).toContain("/solana-jobs");
    expect(hrefs).not.toContain("/career-advice-jobs");
    expect(mocks.listJobs).not.toHaveBeenCalled();
  });

  it("reaches every facet slug from the pill bar on a topic page, with the current one active", async () => {
    const { tree, hrefs } = await renderCategory("solidity");
    for (const slug of LEARN_CATEGORIES) {
      expect(hrefs).toContain(`/learn-web3/${slug}`);
    }
    const activePill = elements(tree).find(
      (element) =>
        element.props.href === "/learn-web3/solidity" &&
        typeof element.props.className === "string" &&
        element.props.className.includes("chip--on"),
    );
    expect(activePill).toBeDefined();
  });

  it("renders the resource grid filtered to the current category", async () => {
    const { page } = await renderCategory("solidity");
    const { resourceGridTree } = fullTree(page);
    const resourceElements = elements(resourceGridTree);
    const topicLinks = resourceElements.filter(
      (element) => element.props.href === "/learn-web3/solidity",
    );
    expect(topicLinks.length).toBeGreaterThan(0);
  });

  it("covers the whole vocabulary in generateStaticParams", async () => {
    const { generateStaticParams } = await import("./page");
    const params = generateStaticParams();
    const categories = params.map((entry) => entry.category);
    for (const slug of LEARN_CATEGORIES) {
      expect(categories).toContain(slug);
    }
  });
});
