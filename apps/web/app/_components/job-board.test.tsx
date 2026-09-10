import React, { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { JobBoard } from "./job-board";
import type { JobDetail, JobListItem } from "../../lib/jobs/queries";

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement("a", props),
}));

vi.stubGlobal("React", React);

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

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
  return text((node as TestElement).props.children);
}

const job: JobListItem = {
  id: "job-1",
  slug: "solidity-engineer-alpha",
  externalId: "991",
  title: "Solidity Engineer",
  companyId: "studio-a",
  companyName: "Alpha Studio",
  companySlug: "alpha-studio",
  location: "London",
  remote: "remote",
  salaryText: "$120k - $160k",
  salaryMin: 120000,
  salaryMax: 160000,
  highlight: 0,
  featuredUntil: null,
  exclusivity: "unknown",
  postedAt: "2026-09-02T00:00:00Z",
  tags: ["solidity"],
};

const selected: JobDetail = {
  id: job.id,
  slug: job.slug,
  externalId: job.externalId,
  title: job.title,
  companyName: job.companyName,
  companySlug: job.companySlug,
  location: job.location,
  remote: job.remote,
  descriptionHtml: "<p>Ship contracts.</p><script>alert(1)</script>",
  salaryText: job.salaryText,
  salaryMin: job.salaryMin,
  salaryMax: job.salaryMax,
  highlight: 0,
  exclusivity: "unknown",
  postedAt: job.postedAt,
  tags: job.tags,
};

describe("JobBoard", () => {
  it("lists jobs on the left and keeps Apply on Nodework", () => {
    const tree = JobBoard({
      jobs: [job],
      selected,
      emptyMessage: "None",
    });
    const nodes = elements(tree);
    const row = nodes.find((element) =>
      /\bboard-row(?:\s|$)/.test(String(element.props.className ?? "")),
    );
    const apply = nodes.find(
      (element) =>
        typeof element.props.href === "string"
        && String(element.props.href).endsWith("/apply")
        && String(element.props.className ?? "").includes("button--primary"),
    );
    const hrefs = nodes
      .map((element) => element.props.href)
      .filter((href): href is string => typeof href === "string");

    const body = elements(tree).find(
      (element) =>
        typeof (element.props.dangerouslySetInnerHTML as { __html?: string } | undefined)
          ?.__html === "string",
    );
    const html = String(
      (body?.props.dangerouslySetInnerHTML as { __html?: string } | undefined)?.__html ?? "",
    );

    expect(text(tree)).toContain("Solidity Engineer");
    expect(html).toContain("Ship contracts.");
    expect(html).not.toContain("alert(1)");
    expect(html).not.toContain("<script");
    expect(row?.props.href).toBe("/solidity-engineer-alpha/991");
    expect(apply?.props.href).toBe("/solidity-engineer-alpha/991/apply");
    expect(hrefs.some((href) => href.includes("web3.career"))).toBe(false);
  });

  it("renders catalog column headers", () => {
    const tree = JobBoard({
      jobs: [job],
      selected,
      emptyMessage: "None",
    });
    const copy = text(tree);

    expect(copy).toContain("Posted");
    expect(copy).toContain("Location");
    expect(copy).toContain("Salary");
    expect(copy).toContain("Tags");
  });

  it("keeps the detail-pane title an h2 by default, but renders h1 when it is the page's heading", () => {
    const defaultTree = JobBoard({
      jobs: [job],
      selected,
      emptyMessage: "None",
    });
    const defaultNodes = elements(defaultTree);
    expect(defaultNodes.some((element) => element.type === "h1")).toBe(false);
    const paneTitle = defaultNodes.find((element) =>
      String(element.props.className ?? "").includes("board-apply__title"),
    );
    expect(paneTitle?.type).toBe("h2");
    expect(paneTitle?.props.children).toBe("Solidity Engineer");

    const h1Tree = JobBoard({
      jobs: [job],
      selected,
      emptyMessage: "None",
      titleAs: "h1",
    });
    const h1Nodes = elements(h1Tree);
    const h1s = h1Nodes.filter((element) => element.type === "h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0]?.props.children).toBe("Solidity Engineer");
  });

  it("gives every listing row a heading - job title, then company one level down", () => {
    const second: JobListItem = {
      ...job,
      id: "job-2",
      slug: "rust-engineer-beta",
      externalId: "992",
      title: "Rust Engineer",
      companyName: "Beta Labs",
      companySlug: "beta-labs",
    };
    const nodes = elements(
      JobBoard({ jobs: [job, second], selected, emptyMessage: "None" }),
    );

    const rowTitles = nodes.filter((element) =>
      String(element.props.className ?? "").includes("board-row__title"),
    );
    expect(rowTitles).toHaveLength(2);
    expect(rowTitles.every((element) => element.type === "h2")).toBe(true);
    expect(rowTitles.map((element) => text(element))).toEqual([
      "Solidity Engineer",
      "Rust Engineer",
    ]);

    const rowCompanies = nodes.filter((element) =>
      String(element.props.className ?? "").includes("board-row__company"),
    );
    expect(rowCompanies).toHaveLength(2);
    expect(rowCompanies.every((element) => element.type === "h3")).toBe(true);
    expect(rowCompanies.map((element) => text(element))).toEqual([
      "Alpha Studio",
      "Beta Labs",
    ]);

    // One h1 per page is the page's job, but the board must never emit one of its
    // own here, and every row title has to be a heading rather than plain text.
    expect(nodes.some((element) => element.type === "h1")).toBe(false);
  });

  it("drops the row headings a level when a section h2 already introduces the board", () => {
    const nodes = elements(
      JobBoard({
        jobs: [job],
        selected,
        emptyMessage: "None",
        rowTitleAs: "h3",
      }),
    );
    const rowTitle = nodes.find((element) =>
      String(element.props.className ?? "").includes("board-row__title"),
    );
    const rowCompany = nodes.find((element) =>
      String(element.props.className ?? "").includes("board-row__company"),
    );

    expect(rowTitle?.type).toBe("h3");
    expect(rowCompany?.type).toBe("h4");
  });

  it("links the detail pane company to the canonical directory path, not the redirect", () => {
    const hrefs = elements(
      JobBoard({ jobs: [job], selected, emptyMessage: "None" }),
    )
      .map((element) => element.props.href)
      .filter((href): href is string => typeof href === "string");

    expect(hrefs).toContain("/web3-companies/alpha-studio");
    expect(hrefs.every((href) => !href.startsWith("/companies/"))).toBe(true);
  });

  it("falls back to the initial-letter mark in the detail-pane header when there is no company logo", () => {
    const tree = JobBoard({
      jobs: [job],
      selected,
      emptyMessage: "None",
    });
    const marks = elements(tree).filter((element) =>
      String(element.props.className ?? "").includes("board-row__mark"),
    );
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.every((mark) => !elements(mark).some((child) => child.type === "img"))).toBe(
      true,
    );
    expect(text(tree)).toContain("AS");
  });

  it("shows the real company logo in the detail-pane header when one is available", () => {
    const tree = JobBoard({
      jobs: [job],
      selected: { ...selected, companyLogoUrl: "https://cdn.example.com/logo.png" },
      emptyMessage: "None",
    });
    const images = elements(tree).filter((element) => element.type === "img");
    expect(images.some((img) => img.props.src === "https://cdn.example.com/logo.png")).toBe(
      true,
    );
  });

  it("leaves the row unranked when rankOffset is omitted", () => {
    const nodes = elements(JobBoard({ jobs: [job], selected, emptyMessage: "None" }));
    expect(nodes.some((element) => String(element.props.className ?? "").includes("board-row__rank"))).toBe(
      false,
    );
  });

  it("renders each row's position in the full result set, not the page, when rankOffset is set", () => {
    const second: JobListItem = { ...job, id: "job-2", slug: "rust-engineer-beta" };
    const nodes = elements(
      JobBoard({ jobs: [job, second], selected, emptyMessage: "None", rankOffset: 20 }),
    );
    const ranks = nodes
      .filter((element) => String(element.props.className ?? "").includes("board-row__rank"))
      .map((element) => text(element).replace(/\D/g, ""));

    expect(ranks).toEqual(["21", "22"]);
  });

  it("only marks the table as containing the podium when rankOffset is exactly 0", () => {
    const table = (tree: ReactNode) =>
      elements(tree).find((element) => element.type === "table");

    const page1 = table(JobBoard({ jobs: [job], selected, emptyMessage: "None", rankOffset: 0 }));
    expect(String(page1?.props.className)).toContain("board-table--ranked");
    expect(String(page1?.props.className)).toContain("board-table--ranked-top");

    const page2 = table(
      JobBoard({ jobs: [job], selected, emptyMessage: "None", rankOffset: 20 }),
    );
    expect(String(page2?.props.className)).toContain("board-table--ranked");
    expect(String(page2?.props.className)).not.toContain("board-table--ranked-top");

    const unranked = table(JobBoard({ jobs: [job], selected, emptyMessage: "None" }));
    expect(String(unranked?.props.className)).not.toContain("board-table--ranked");
  });

  it("links tag chips to Nodework tag landings", () => {
    const tree = JobBoard({
      jobs: [job],
      selected,
      emptyMessage: "None",
    });
    const hrefs = elements(tree)
      .map((element) => element.props.href)
      .filter((href): href is string => typeof href === "string");

    expect(hrefs).toContain("/solidity-jobs");
    expect(hrefs.every((href) => !href.includes("web3.career"))).toBe(true);
  });
});
