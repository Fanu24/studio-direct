import React, { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { JobCard, JobCardGrid } from "./job-card";
import { JobRow, JobRowList } from "./job-row";
import type { JobListItem } from "../../lib/jobs/queries";

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => React.createElement("a", props),
}));

// job-card.tsx / job-row.tsx compile to classic createElement calls, so the
// components need React on globalThis when they are invoked as plain functions.
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

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

function headings(node: ReactNode) {
  return elements(node).filter(
    (element) => typeof element.type === "string" && HEADINGS.has(element.type),
  );
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

const second: JobListItem = {
  ...job,
  id: "job-2",
  slug: "rust-engineer-beta",
  externalId: "992",
  title: "Rust Engineer",
  companyName: "Beta Labs",
  companySlug: "beta-labs",
};

describe("JobRow headings", () => {
  it("renders the job title as an h2 heading by default", () => {
    const found = headings(JobRow({ job }));

    expect(found).toHaveLength(1);
    expect(found[0]?.type).toBe("h2");
    expect(text(found[0])).toBe("Solidity Engineer");
  });

  it("drops to h3 when the surrounding section already owns an h2", () => {
    const found = headings(JobRow({ job, headingLevel: "h3" }));

    expect(found.map((element) => element.type)).toEqual(["h3"]);
  });

  it("keeps the title link inside the heading so the row still navigates", () => {
    const heading = headings(JobRow({ job }))[0];
    const link = elements(heading).find(
      (element) => typeof element.props.href === "string",
    );

    expect(link?.props.href).toBe("/solidity-engineer-alpha/991");
    expect(String(heading?.props.className ?? "")).toContain("job-row__heading");
  });

  it("gives every row in a list its own heading and no h1", () => {
    const found = headings(
      JobRowList({ jobs: [job, second], emptyMessage: "None" }),
    );

    expect(found.map((element) => element.type)).toEqual(["h2", "h2"]);
    expect(found.map(text)).toEqual(["Solidity Engineer", "Rust Engineer"]);
  });

  it("passes the heading level through the list to each row", () => {
    const found = headings(
      JobRowList({ jobs: [job, second], emptyMessage: "None", headingLevel: "h3" }),
    );

    expect(found.map((element) => element.type)).toEqual(["h3", "h3"]);
  });

  it("links the company to the canonical directory path, not the redirect", () => {
    const hrefs = elements(JobRow({ job }))
      .map((element) => element.props.href)
      .filter((href): href is string => typeof href === "string");

    expect(hrefs).toContain("/web3-companies/alpha-studio");
    expect(hrefs.every((href) => !href.startsWith("/companies/"))).toBe(true);
  });
});

describe("JobCard headings", () => {
  it("keeps its title a heading and links the company to /web3-companies", () => {
    const found = headings(JobCard({ job }));
    const hrefs = elements(JobCard({ job }))
      .map((element) => element.props.href)
      .filter((href): href is string => typeof href === "string");

    expect(found.map((element) => element.type)).toEqual(["h3"]);
    expect(text(found[0])).toBe("Solidity Engineer");
    expect(hrefs).toContain("/web3-companies/alpha-studio");
    expect(hrefs.every((href) => !href.startsWith("/companies/"))).toBe(true);
  });

  it("promotes card titles to h2 where the grid is the page's job list", () => {
    // JobCardGrid renders <JobCard /> as JSX, so the walker sees the element, not
    // its output - assert on the level each card is handed, then render one.
    const cards = elements(
      JobCardGrid({ jobs: [job, second], headingLevel: "h2", emptyMessage: "None" }),
    ).filter((element) => element.type === JobCard);

    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.props.headingLevel)).toEqual(["h2", "h2"]);
    expect(
      headings(
        JobCard(cards[0]?.props as React.ComponentProps<typeof JobCard>),
      ).map((element) => element.type),
    ).toEqual(["h2"]);
  });
});
