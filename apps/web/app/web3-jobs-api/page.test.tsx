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

describe("Web3JobsApiPage", () => {
  it("documents the endpoint, filters and response fields honestly", async () => {
    const { default: Web3JobsApiPage } = await import("./page");
    const page = Web3JobsApiPage();
    const copy = text(page);
    const h1 = elements(page).find((element) => element.type === "h1");

    expect(text(h1)).toBe("Web3 jobs API access");
    expect(copy).toContain("/api/v1/jobs");
    expect(copy).toContain("salaryMin");
    expect(copy).toContain("salaryMax");
    expect(copy).toContain("tags");
    expect(copy).toContain("companySlug");
    expect(copy.toLowerCase()).toContain("no public api endpoint live yet");
  });

  it("frames access as a request, not a live public tier, and links to /login", async () => {
    const { default: Web3JobsApiPage } = await import("./page");
    const page = Web3JobsApiPage();
    const copy = text(page);
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(copy.toLowerCase()).toContain("request early access");
    expect(hrefs).toContain("/login");
    expect(hrefs).toContain("/jobs");
    expect(copy).not.toMatch(/\$\d+\s*\/\s*(month|year|call)/i);
    expect(copy).not.toMatch(/unlimited requests/i);
  });

  it("carries FAQPage JSON-LD", async () => {
    const { default: Web3JobsApiPage } = await import("./page");
    const page = Web3JobsApiPage();
    const jsonLd = elements(page)
      .map((element) => element.props.data as { "@type"?: string; mainEntity?: unknown[] } | undefined)
      .find((data) => data?.["@type"] === "FAQPage");

    expect(jsonLd?.mainEntity?.length).toBeGreaterThanOrEqual(3);
  });
});
