import React, { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ArticleLayout } from "../_components/article-layout";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement("a", props),
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
  return text((node as ReactElement<{ children?: ReactNode }>).props.children);
}

describe("FaqPage", () => {
  it("uses original Nodework answers and links to the catalog", async () => {
    const { default: FaqPage } = await import("./page");
    const page = await FaqPage();
    const layout = elements(page).find((element) => element.type === ArticleLayout);
    const tree = layout
      ? ArticleLayout(layout.props as React.ComponentProps<typeof ArticleLayout>)
      : page;
    const copy = `${text(page)} ${text(tree)}`;
    const hrefs = [...elements(page), ...elements(tree)]
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(text(elements(tree).find((element) => element.type === "h1"))).toBe(
      "Frequently Asked Questions",
    );
    expect(copy).toContain("How does Web3 work?");
    expect(copy).not.toContain("What is Nodework?");
    expect(copy).not.toContain("Solana software development kit");
    expect(copy).not.toMatch(/[–—]/);
    expect(hrefs).toContain("/jobs");
    expect(hrefs.some((href) => href === "/talent" || href.startsWith("/talent/"))).toBe(
      false,
    );
  });

  it("renders every question as an anchored h2 so the page has a real outline", async () => {
    const { default: FaqPage } = await import("./page");
    const page = await FaqPage();
    const layout = elements(page).find((element) => element.type === ArticleLayout);
    const tree = ArticleLayout(
      layout!.props as React.ComponentProps<typeof ArticleLayout>,
    );
    const sections = elements(tree).filter(
      (element) => element.props.className === "faq-qa",
    );
    const headings = elements(tree).filter(
      (element) => element.type === "h2" && element.props.className === "faq-qa__question",
    );

    expect(sections.length).toBeGreaterThanOrEqual(10);
    expect(headings).toHaveLength(sections.length);
    expect(sections.every((section) => typeof section.props.id === "string")).toBe(true);
    // Every question in the on-this-page nav points at a section that exists.
    const ids = new Set(sections.map((section) => section.props.id as string));
    const tocHrefs = (
      layout!.props.toc as readonly { href: string; label: string }[]
    ).map((item) => item.href);
    expect(tocHrefs.length).toBe(sections.length);
    for (const href of tocHrefs) {
      expect(ids.has(href.slice(1)), href).toBe(true);
    }
  });
});
