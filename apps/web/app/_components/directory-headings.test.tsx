import React, { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { SalaryBreakdownTable, SalaryStatsTable } from "./salary-tables";
import { TABLE_HEADING_STYLE } from "./table-heading";
import { CompanyDirectoryTable } from "../web3-companies/_directory";
import type { CompanyDirectoryItem } from "../../lib/companies/queries";

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => React.createElement("a", props),
}));

// The table components compile to classic createElement calls, so they need
// React on globalThis when they are invoked as plain functions below.
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

const COMPANIES: CompanyDirectoryItem[] = [
  {
    id: "studio-a",
    name: "Alpha Studio",
    slug: "alpha",
    domain: null,
    logoUrl: null,
    category: "solidity",
    jobCount: 3,
    lastPostedAt: "2026-09-02T00:00:00Z",
    avgSalary: 140000,
  },
  {
    id: "studio-b",
    name: "Beta Forge",
    slug: "betaforge",
    domain: null,
    logoUrl: null,
    category: null,
    jobCount: 0,
    lastPostedAt: null,
    avgSalary: null,
  },
];

describe("directory row headings", () => {
  it("marks every company row's name as a heading and leaves the numeric cells alone", () => {
    const table = CompanyDirectoryTable({ companies: COMPANIES, emptyMessage: "none" });
    const rowHeadings = headings(table);

    expect(rowHeadings.map((heading) => heading.type)).toEqual(["h2", "h2"]);
    expect(rowHeadings.map(text)).toEqual(["Alpha Studio", "Beta Forge"]);
  });

  it("does not emit headings when the company directory is empty", () => {
    const table = CompanyDirectoryTable({ companies: [], emptyMessage: "No companies" });
    expect(headings(table)).toHaveLength(0);
    expect(text(table)).toContain("No companies");
  });

  it("marks every fixed-taxonomy salary row's position as a heading below the table heading", () => {
    const table = SalaryStatsTable({
      heading: "By role",
      hrefFor: (slug) => `/web3-salaries/${slug}`,
      labelHeader: "Position",
      rows: [{ slug: "solidity", avg: 150000, min: 100000, max: 200000 }],
      slugs: ["solidity", "rust"],
    });

    const all = headings(table);
    expect(all.map((heading) => heading.type)).toEqual(["h2", "h2", "h2"]);
    expect(all.map(text)).toEqual(["By role", "Solidity", "Rust"]);
  });

  it("marks every breakdown row's label as a heading, with or without a link", () => {
    const rows = [
      { slug: "united-states", avg: 150000, min: 100000, max: 200000, count: 4 },
      { slug: "germany", avg: 90000, min: 70000, max: 110000, count: 2 },
    ];

    const linked = SalaryBreakdownTable({ labelHeader: "Country", rows, hrefFor: (s) => `/x/${s}` });
    expect(headings(linked).map(text)).toEqual(["United States", "Germany"]);

    const plain = SalaryBreakdownTable({ labelHeader: "Country", rows });
    expect(headings(plain).map(text)).toEqual(["United States", "Germany"]);
  });

  it("emits no row headings when a breakdown has no data yet", () => {
    const table = SalaryBreakdownTable({
      labelHeader: "Country",
      rows: [],
      emptyMessage: "No salary data available yet for this breakdown.",
    });

    expect(headings(table)).toHaveLength(0);
    expect(text(table)).toContain("No salary data available yet");
  });

  it("hands every typographic property the global heading rule sets back to the table cell", () => {
    // A row heading must not look like a heading. globals.css sets font-size,
    // font-weight, line-height, letter-spacing, colour and margin on h1..h4,
    // so each one has to be reset for the cell to render unchanged.
    expect(TABLE_HEADING_STYLE).toEqual({
      color: "inherit",
      display: "inline",
      font: "inherit",
      letterSpacing: "inherit",
      margin: 0,
    });

    const table = CompanyDirectoryTable({ companies: COMPANIES, emptyMessage: "none" });
    for (const heading of headings(table)) {
      expect(heading.props.style).toBe(TABLE_HEADING_STYLE);
    }
  });
});
