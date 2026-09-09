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

describe("WhatIsWeb3Page", () => {
  it("explains Web3 in original Nodework copy with historical depth", async () => {
    const { default: WhatIsWeb3Page } = await import("./page");
    const page = WhatIsWeb3Page();
    const layout = elements(page).find((element) => element.type === ArticleLayout);
    const tree = layout
      ? ArticleLayout(layout.props as React.ComponentProps<typeof ArticleLayout>)
      : page;
    const copy = `${text(page)} ${text(tree)}`;
    const hrefs = [...elements(page), ...elements(tree)]
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(text(elements(tree).find((element) => element.type === "h1"))).toBe(
      "What is Web3",
    );
    expect(copy).toContain("Web 1.0");
    expect(copy).toContain("Web 2.0");
    expect(copy).toContain("Web 3.0");
    expect(copy).toMatch(/ownership/i);
    expect(copy).toMatch(/blockchain/i);
    expect(copy).toMatch(/cryptocurrency/i);
    expect(copy).toMatch(/metaverse/i);
    expect(copy).toContain("hiring label");
    expect(copy).not.toMatch(/[–—]/);
    expect(hrefs).toContain("/jobs");
    expect(hrefs).toContain("/faq");
    expect(hrefs).not.toContain("/learn");
  });
});
