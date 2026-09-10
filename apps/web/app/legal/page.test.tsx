import React, { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

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

describe("LegalPage", () => {
  it("summarises terms and privacy without duplicating their full text", async () => {
    const { default: LegalPage } = await import("./page");
    const page = LegalPage();
    const copy = text(page);
    const h1 = elements(page).find((element) => element.type === "h1");

    expect(text(h1)).toBe("Legal information");
    expect(copy).toContain(TERMS_COPY.legalEntity);
    expect(copy).not.toContain(TERMS_COPY.thirdParties);
    expect(copy).not.toContain(TERMS_COPY.incomplete);
  });

  it("links to /terms and /privacy", async () => {
    const { default: LegalPage } = await import("./page");
    const page = LegalPage();
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(hrefs).toContain("/terms");
    expect(hrefs).toContain("/privacy");
  });
});
