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

describe("AdsPage", () => {
  it("describes the featured listing placement without inventing formats or numbers", async () => {
    const { default: AdsPage } = await import("./page");
    const page = AdsPage();
    const copy = text(page);
    const h1 = elements(page).find((element) => element.type === "h1");

    expect(text(h1)).toBe("Advertise on Nodework");
    expect(copy).toContain("Featured listing");
    expect(copy.toLowerCase()).toContain("not offered yet");
    expect(copy.toLowerCase()).toContain("banner");
    expect(copy).not.toMatch(/\d[\d,.]*\s*(visitors|impressions|page ?views|readers)/i);
    expect(copy).not.toMatch(/trusted by/i);
  });

  it("links to the account route and job posting, not a fabricated checkout", async () => {
    const { default: AdsPage } = await import("./page");
    const page = AdsPage();
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(hrefs).toContain("/login");
    expect(hrefs).toContain("/post-web3-job");
  });

  it("carries FAQPage JSON-LD", async () => {
    const { default: AdsPage } = await import("./page");
    const page = AdsPage();
    const jsonLd = elements(page)
      .map((element) => element.props.data as { "@type"?: string; mainEntity?: unknown[] } | undefined)
      .find((data) => data?.["@type"] === "FAQPage");

    expect(jsonLd?.mainEntity?.length).toBeGreaterThanOrEqual(3);
  });
});
