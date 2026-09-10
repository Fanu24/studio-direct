import { FEATURED_TAG_CHIPS, tagLabel } from "@gaming/shared";
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
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object" || !("props" in node)) return "";
  return text((node as TestElement).props.children);
}

describe("RolesPage", () => {
  it("links featured tag landings and remote variants", async () => {
    const { default: RolesPage } = await import("./page");
    const page = RolesPage();
    const copy = text(page);
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    for (const slug of FEATURED_TAG_CHIPS) {
      expect(copy).toContain(tagLabel(slug));
      expect(hrefs).toContain(`/${slug}-jobs`);
      expect(hrefs).toContain(`/remote-${slug}-jobs`);
    }

    expect(copy).toContain("Web3 jobs by tag");
    expect(copy).not.toContain("—");
    expect(copy).not.toContain("Gaming jobs by role");
    expect(hrefs.some((href) => href === "/talent" || href.startsWith("/talent/"))).toBe(
      false,
    );
  });
});
