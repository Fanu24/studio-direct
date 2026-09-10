import React, { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

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

describe("PostWeb3JobBundlePage", () => {
  it("describes the bundle shape without claiming it can be bought", async () => {
    const { default: BundlePage } = await import("./page");
    const page = BundlePage();
    const copy = text(page);

    expect(text(elements(page).find((element) => element.type === "h1"))).toBe(
      "Job post bundles",
    );
    expect(copy).toContain("24 months");
    expect(copy.toLowerCase()).toContain("checkout is not built");
  });

  it("collects no payment: no form, input, or currency figure anywhere on the page", async () => {
    const { default: BundlePage } = await import("./page");
    const page = BundlePage();
    const tree = elements(page);
    const types = tree.map((element) => element.type);

    expect(types).not.toContain("form");
    expect(types).not.toContain("input");
    expect(types).not.toContain("select");
    expect(types).not.toContain("button");
    // A currency figure on a page with no billing behind it is the exact
    // failure mode this page exists to avoid.
    expect(text(page)).not.toMatch(/[$€£]\s?\d/);
  });

  it("routes to the account and the single-post page, never to a checkout", async () => {
    const { default: BundlePage } = await import("./page");
    const page = BundlePage();
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(hrefs).toContain("/login");
    expect(hrefs).toContain("/post-web3-job");
    expect(hrefs).toContain("/pricing");
    expect(hrefs.some((href) => /checkout|stripe|pay|buy/i.test(href))).toBe(false);
  });

  it("carries FAQPage JSON-LD", async () => {
    const { default: BundlePage } = await import("./page");
    const page = BundlePage();
    const jsonLd = elements(page)
      .map(
        (element) =>
          element.props.data as { "@type"?: string; mainEntity?: unknown[] } | undefined,
      )
      .find((data) => data?.["@type"] === "FAQPage");

    expect(jsonLd?.mainEntity?.length).toBeGreaterThanOrEqual(4);
  });
});
