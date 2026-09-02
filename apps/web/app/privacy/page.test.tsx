import React, { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { LEGAL_ENTITY_PLACEHOLDER, PRIVACY_COPY } from "../../lib/legal/copy";

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

describe("PrivacyPage", () => {
  it("distinguishes job-board product use from recruiter talent-pool opt-in", async () => {
    const { default: PrivacyPage } = await import("./page");
    const page = PrivacyPage();
    const copy = text(page);
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(copy).toContain(PRIVACY_COPY.title);
    expect(copy).toContain(PRIVACY_COPY.jobProductPurpose);
    expect(copy).toContain(PRIVACY_COPY.recruiterOptInPurpose);
    expect(copy).toContain(LEGAL_ENTITY_PLACEHOLDER);
    expect(copy.toLowerCase()).toMatch(/purpose 1/);
    expect(copy.toLowerCase()).toMatch(/purpose 2/);
    expect(copy).not.toContain("100%");
    expect(hrefs.some((href) => href === "/talent" || href.startsWith("/talent/"))).toBe(
      false,
    );
  });
});
