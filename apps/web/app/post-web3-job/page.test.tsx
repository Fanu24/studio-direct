import React, { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { PLAN_COPY } from "../../lib/billing/plans";

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

describe("PostWeb3JobPage", () => {
  it("targets employers and uses the real billing prices, not invented ones", async () => {
    const { default: PostWeb3JobPage } = await import("./page");
    const page = PostWeb3JobPage();
    const copy = text(page);
    const h1 = elements(page).find((element) => element.type === "h1");

    expect(text(h1)).toBe("Post a Web3 job on Nodework");
    expect(copy).toContain(PLAN_COPY.monthly.label);
    expect(copy).toContain(PLAN_COPY.yearly.label);
    expect(copy.toLowerCase()).toContain("not live");
    expect(copy).not.toMatch(/\$\d+\s*\/\s*(job|post|listing)/i);
  });

  it("routes the CTA to the account route, not a fabricated checkout", async () => {
    const { default: PostWeb3JobPage } = await import("./page");
    const page = PostWeb3JobPage();
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(hrefs).toContain("/login");
    expect(hrefs).toContain("/pricing");
    expect(hrefs).toContain("/ads");
  });

  it("carries FAQPage JSON-LD", async () => {
    const { default: PostWeb3JobPage } = await import("./page");
    const page = PostWeb3JobPage();
    const jsonLd = elements(page)
      .map((element) => element.props.data as { "@type"?: string; mainEntity?: unknown[] } | undefined)
      .find((data) => data?.["@type"] === "FAQPage");

    expect(jsonLd?.mainEntity?.length).toBeGreaterThanOrEqual(3);
  });
});
