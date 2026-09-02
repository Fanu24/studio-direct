import React, { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../../lib/copy";
import { LEGAL_ENTITY_PLACEHOLDER, TERMS_COPY } from "../../lib/legal/copy";

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

describe("TermsPage", () => {
  it("covers third parties, incomplete inventory, no real-time LinkedIn, and badge meaning", async () => {
    const { default: TermsPage } = await import("./page");
    const page = TermsPage();
    const copy = text(page);
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(copy).toContain(TERMS_COPY.title);
    expect(copy).toContain(TERMS_COPY.thirdParties);
    expect(copy).toContain(TERMS_COPY.incomplete);
    expect(copy).toContain(TERMS_COPY.noRealtimeLinkedIn);
    expect(copy).toContain(LINKEDIN_EXCLUSIVITY_TOOLTIP);
    expect(copy).toContain(LEGAL_ENTITY_PLACEHOLDER);
    expect(copy).not.toContain("100%");
    expect(hrefs.some((href) => href === "/talent" || href.startsWith("/talent/"))).toBe(
      false,
    );
  });
});
