import React, { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { HOMEPAGE_CLAIM, LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../../lib/copy";
import { TERMS_COPY } from "../../lib/legal/copy";

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

describe("AboutPage", () => {
  it("explains sources, the badge, unlocks, and what the product does not do", async () => {
    const { default: AboutPage } = await import("./page");
    const page = AboutPage();
    const copy = text(page);
    const h1 = elements(page).find((element) => element.type === "h1");

    expect(text(h1)).toBe("How Studio Direct works");
    expect(copy).toContain(HOMEPAGE_CLAIM);
    expect(copy).toContain(TERMS_COPY.thirdParties);
    expect(copy).toContain(TERMS_COPY.incomplete);
    expect(copy).toContain(TERMS_COPY.noRealtimeLinkedIn);
    expect(copy).toContain(LINKEDIN_EXCLUSIVITY_TOOLTIP);
    expect(copy).toContain("5");
    expect(copy.toLowerCase()).toContain("utc week");
    expect(copy.toLowerCase()).toContain("studio site");
  });

  it("carries FAQPage JSON-LD and links to the board, hidden jobs, and pricing", async () => {
    const { default: AboutPage } = await import("./page");
    const page = AboutPage();
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);
    const jsonLd = elements(page)
      .map((element) => element.props.data as { "@type"?: string; mainEntity?: unknown[] } | undefined)
      .find((data) => data?.["@type"] === "FAQPage");

    expect(jsonLd?.mainEntity?.length).toBeGreaterThanOrEqual(4);
    expect(hrefs).toContain("/jobs");
    expect(hrefs).toContain("/hidden-jobs");
    expect(hrefs).toContain("/pricing");
  });

  it("never uses banned claims or dashes and never links to /talent", async () => {
    const { default: AboutPage } = await import("./page");
    const page = AboutPage();
    const copy = text(page);
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(copy).not.toContain("100%");
    expect(copy).not.toMatch(/trusted by/i);
    expect(copy).not.toMatch(/clerk|resend/i);
    expect(copy).not.toMatch(/auto-apply|cover letter|employer portal|recruiter search/i);
    expect(copy).not.toMatch(/[–—]/);
    expect(hrefs.some((href) => href === "/talent" || href.startsWith("/talent/"))).toBe(
      false,
    );
  });
});
