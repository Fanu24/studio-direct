import React, { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { HomeMegaLinks } from "./home-mega";
import { TagChips } from "./tag-chips";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => React.createElement("a", props),
}));

vi.stubGlobal("React", React);

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

describe("home mega chrome", () => {
  it("lists competitor-style hubs without competitor brands", () => {
    const tree = HomeMegaLinks();
    const hrefs = elements(tree)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);
    const copy = text(tree);

    expect(copy).toContain("Remote Web3 Jobs");
    expect(copy).toContain("Web3 Developer Salaries");
    expect(copy).toContain("Top Web3 Cities");
    expect(copy).toContain("Hire Web3 Developers");
    expect(copy).toContain("Benefits");
    expect(hrefs).toContain("/remote+solidity-jobs");
    expect(hrefs).toContain("/web3-jobs-new-york");
    expect(hrefs).toContain("/hire/rust");
    expect(hrefs).toContain("/learn-web3/article");
    expect(copy).not.toMatch(/Bondex|wagmi|WxRK/i);
    expect(copy).not.toMatch(/[–—]/);
  });

  it("carries the reference link inventory in every browse section", () => {
    const tree = HomeMegaLinks();
    const sections = elements(tree).filter((el) => el.type === "section");
    const sizes = new Map(
      sections.map((section) => {
        const heading = elements(section).find((el) => el.type === "h2");
        const hrefs = elements(section).filter(
          (el) => typeof el.props.href === "string",
        );
        return [text(heading), hrefs.length] as const;
      }),
    );

    // Sizes measured off the reference board's homepage sections.
    expect(sizes.get("Remote Web3 Jobs")).toBeGreaterThanOrEqual(19);
    expect(sizes.get("Remote Non-Tech Web3 Jobs")).toBeGreaterThanOrEqual(11);
    expect(sizes.get("Web3 Developer Salaries")).toBeGreaterThanOrEqual(37);
    expect(sizes.get("Web3 Non-Tech Salaries")).toBeGreaterThanOrEqual(14);
    expect(sizes.get("Top Web3 Cities")).toBeGreaterThanOrEqual(20);
    expect(sizes.get("Top Regions for Web3 Careers")).toBeGreaterThanOrEqual(6);

    const hrefs = elements(tree)
      .filter((el) => typeof el.props.href === "string")
      .map((el) => el.props.href as string);
    expect(hrefs).toContain("/customer-support+remote-jobs");
    expect(hrefs).toContain("/remote+tech-lead-jobs");
    expect(hrefs).toContain("/dev+entry-level+remote-jobs");
    expect(hrefs).toContain("/entry-level+non-tech+remote-jobs");
    // href doubles as the React key inside a section, so no section may repeat one.
    for (const section of sections) {
      const inSection = elements(section)
        .filter((el) => typeof el.props.href === "string")
        .map((el) => el.props.href as string);
      expect(new Set(inSection).size).toBe(inSection.length);
    }
  });

  it("keeps compact chips with a show more control and extra tags in the DOM", () => {
    const tree = TagChips({});
    const hrefs = elements(tree)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);
    const copy = text(tree);

    expect(copy).toContain("Show more");
    expect(copy).toContain("Show less");
    expect(hrefs).toContain("/community-manager-jobs");
    expect(hrefs).toContain("/solidity-jobs");
  });
});
