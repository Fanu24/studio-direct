import { HUB_ROLE_SLUGS, hubSlugLabel } from "@gaming/shared";
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
  it("links every role hub and its skill page", async () => {
    const { default: RolesPage } = await import("./page");
    const page = RolesPage();
    const copy = text(page);
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    for (const slug of HUB_ROLE_SLUGS) {
      expect(copy).toContain(hubSlugLabel(slug));
      expect(hrefs).toContain(`/remote-${slug}-jobs`);
      expect(hrefs).toContain(`/skills/${slug}`);
    }

    expect(copy).toContain("Gaming jobs by role");
    expect(copy).not.toContain("—");
    expect(hrefs.some((href) => href === "/talent" || href.startsWith("/talent/"))).toBe(
      false,
    );
  });
});
