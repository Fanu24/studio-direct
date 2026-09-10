import React, { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import NotFound from "./not-found";

vi.stubGlobal("React", React);

function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (!node || typeof node !== "object" || !("props" in node)) return "";
  return text((node as ReactElement<{ children?: ReactNode }>).props.children);
}

describe("NotFound", () => {
  it("does not call an employer a studio", async () => {
    const tree = NotFound();
    expect(text(tree)).not.toMatch(/\bstudios?\b/i);
  });
});
